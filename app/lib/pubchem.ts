import fetch from 'node-fetch';
import { MoleculeInfo } from '@/types';

export interface MoleculeData {
  pdb_data: string;
  name: string;
  cid: number;
  formula: string;
  info: MoleculeInfo;
}

interface SDFToPDBRequest {
  sdf: string;
}

interface SDFToPDBResponse {
  pdb_data: string;
}

const PUBCHEM = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
// Autocomplete lives outside the PUG namespace
const PUBCHEM_AC =
  'https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound';
const MOLECULENS_API = 'https://api.moleculens.com/prompt';
const ENTREZ = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

/**
 * Break a free‑form user prompt into several candidate strings that might
 * correspond to a compound name.  Examples:
 *   "Teach me about ferrocene's sandwich structure"
 *      -> ["Teach me about ferrocene's sandwich structure",
 *          "Teach me about ferrocene sandwich structure",
 *          "ferrocene", "sandwich", "structure"]
 *
 * The array is ordered from most‑specific (full string) to simplest tokens,
 * so exact multi‑word names like "sodium chloride" are still tried first.
 */

/* ----------  top-level  ---------- */

export async function resolveCid(q: string): Promise<number> {
  // A. direct / synonym
  let cid = await cidByExact(q);
  if (cid) return cid;

  // B. fuzzy autocomplete
  cid = await cidByAutocomplete(q);
  if (cid) return cid;

  // C. class / family
  cid = await cidByClassSearch(q);
  if (cid) return cid;

  throw new Error(`No PubChem compound matches "${q}"`);
}

const RCSB_FILES = 'https://files.rcsb.org/download';
const RCSB_DATA  = 'https://data.rcsb.org/rest/v1/core/entry';
const RCSB_AC    = 'https://search.rcsb.org/rcsbsearch/v1/keyboard_autocomplete';
const RCSB_FT    = 'https://search.rcsb.org/rcsbsearch/v2/query';

// ① quick regex test – classic PDB entries are 4-character codes.  Some search
// services may return longer identifiers (e.g. AlphaFold IDs) that don't have
// a downloadable .pdb.  Restrict to 4 chars so we only fetch valid files.
const PDB_ID_RE = /^[A-Za-z0-9]{4}$/;

// Add common protein fallback and JSON Accept header utility
const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' } as const;

// Development-only convenience map.  It is ignored in production builds so the
// search algorithm must succeed generically.
const COMMON_PROTEIN_IDS: Record<string, string> = {
  hemoglobin: '4HHB',
  myoglobin: '1MBN',
  insulin: '4INS',
  lysozyme: '1LYZ',
};

// ---------- resolvePdbId ---------- //
// ---------- resolvePdbId ---------- //
export async function resolvePdbId(q: string): Promise<string> {
  const term = q.trim();
  const termLower = term.toLowerCase();
  const log = (...args: any[]) =>
    process.env.NODE_ENV === 'development' && console.log('[resolvePdbId]', ...args);

  // 0. static map only in development
  // if (process.env.NODE_ENV === 'development' && COMMON_PROTEIN_IDS[termLower]) {
  //   log('common-map(dev)', term, '→', COMMON_PROTEIN_IDS[termLower]);
  //   return COMMON_PROTEIN_IDS[termLower];
  // }

  // A. exact ID
  if (PDB_ID_RE.test(term)) {
    log('exact-match', term);
    return term.toUpperCase();
  }

  // B. keyboard_autocomplete
  try {
    const acURL = `${RCSB_AC}?term=${encodeURIComponent(term)}&target=entry&num_results=20`;
    const ac = await fetch(acURL, { headers: JSON_HEADERS }).then(r => r.json());
    const first = ac?.suggestions?.[0];
    const candidate = (first?.identifier || first?.value || '').trim();
    if (PDB_ID_RE.test(candidate)) {
      log('autocomplete', candidate);
      return candidate.toUpperCase();
    }
  } catch (e) {
    log('autocomplete-error', e);
  }

  // C. full-text (service: full_text)
  try {
    const body = {
      query: { type: 'terminal', service: 'full_text', parameters: { value: term } },
      return_type: 'entry',
      request_options: {
        paginate: { start: 0, rows: 20 },
        sort: [{ sort_by: 'score', direction: 'desc' }],
      },
    };
    const ft = await fetch(RCSB_FT, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }).then(r => r.json());

    const hits = (ft?.result_set ?? []).filter((h: any) => PDB_ID_RE.test(h.identifier));
    if (hits.length) {
      log('full_text', hits.map((h: any) => h.identifier));
      return hits[0].identifier.toUpperCase();
    }
  } catch (e) {
    log('full_text-error', e);
  }

  // D. robust text search (service: text, attribute struct.title / entry_id)
  try {
    const mkBody = (attr: string, val: string) => ({
      query: {
        type: 'terminal',
        service: 'text',
        parameters: { attribute: attr, operator: 'contains_words', value: val },
      },
      return_type: 'entry',
      request_options: {
        paginate: { start: 0, rows: 20 },
        sort: [{ sort_by: 'score', direction: 'desc' }],
      },
    });

    const searchAttrs = [
      'struct.title',
      'rcsb_entry_container_identifiers.entry_id',
      'rcsb_polymer_entity.pdbx_description',
      'rcsb_uniprot_protein.name.value',
    ];
    for (const attr of searchAttrs) {
      const rs = await fetch(RCSB_FT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(mkBody(attr, term)),
      }).then(r => r.json());

      const hits = (rs?.result_set ?? []).filter((h: any) => PDB_ID_RE.test(h.identifier));
      if (hits.length) {
        hits.sort((a: any, b: any) => b.score - a.score);
        log('robust_text', hits.map((h: any) => ({ id: h.identifier, score: h.score })));
        return hits[0].identifier.toUpperCase();
      }
    }
  } catch (e) {
    log('robust_text-error', e);
  }

  // E. use /search/suggest endpoint similar to website autosuggest
  try {
    const suggestURL = `https://www.rcsb.org/search/suggest/false/${encodeURIComponent(term)}`;
    const text = await fetch(suggestURL, { headers: { Accept: 'application/json' } }).then(r => r.text());
    const idMatch = text.match(/[A-Za-z0-9]{4,6}/);
    if (idMatch && PDB_ID_RE.test(idMatch[0])) {
      log('suggest', idMatch[0]);
      return idMatch[0].toUpperCase();
    }
  } catch (e) {
    log('suggest-error', e);
  }

  // final fallback (development only)
  if (process.env.NODE_ENV === 'development' && COMMON_PROTEIN_IDS[termLower]) {
    log('fallback-common-map(dev)', term, '→', COMMON_PROTEIN_IDS[termLower]);
    return COMMON_PROTEIN_IDS[termLower];
  }

  throw new Error(`No PDB entry matches "${q}"`);
}

// ---------- generateFromRCSB ---------- //
function extractRCSBInfo(meta: any): MoleculeInfo {
  const info: MoleculeInfo = {};
  
  try {
    // Basic structure info
    info.structure_title = meta?.struct?.title;
    info.resolution = meta?.rcsb_entry_info?.resolution_combined?.[0];
    info.experimental_method = meta?.rcsb_entry_info?.experimental_method;
    info.formula_weight = meta?.rcsb_entry_info?.molecular_weight;
    
    // Chain info
    info.chain_count = meta?.rcsb_entry_info?.deposited_polymer_entity_instance_count;
    
    // Publication info
    info.publication_year = meta?.rcsb_primary_citation?.year;
    info.publication_doi = meta?.rcsb_primary_citation?.pdbx_database_id_doi;
    
    // Keywords and classification
    info.keywords = meta?.struct_keywords?.pdbx_keywords?.split(',').map((k: string) => k.trim()) || [];
    
    // Source organism
    const source = meta?.rcsb_entity_source_organism?.[0] || {};
    info.organism_scientific = source?.scientific_name;
    info.organism_common = source?.common_name;
    
    // Dates
    info.deposition_date = meta?.rcsb_accession_info?.deposit_date;
  } catch (error) {
    console.error('[PubChemService] Error extracting RCSB info:', error);
  }
  
  return info;
}

export async function generateFromRCSB({prompt}:{prompt:string}) {
  const id = await resolvePdbId(prompt);

  // fetch PDB block
  const pdb_data = await fetch(`${RCSB_FILES}/${id}.pdb`).then(r=>r.text());

  // fetch metadata
  let title = prompt;
  let info: MoleculeInfo = {};
  try {
    const meta = await fetch(`${RCSB_DATA}/${id}`).then(r=>r.json());
    title = meta?.struct?.title ?? title;
    info = extractRCSBInfo(meta);
  } catch (error) {
    console.error('[PubChemService] Error fetching RCSB metadata:', error);
  }

  return {pdb_data, title, pdb_id: id, info};
}

export async function fetchMoleculeData(query: string, type: 'small molecule' | 'macromolecule'): Promise<MoleculeData> {
  console.log(`[PubChemService] Fetching molecule data for query: "${query}"`);
  if (type === 'macromolecule') {
    // Generate PDB data from RCSB
    const response = await generateFromRCSB({ prompt: query });
    return {
      pdb_data: response.pdb_data,
      name: response.title || query,
      cid: 0,
      formula: '',
      info: response.info,  // Now passing through the RCSB info
    };
  }
  // 1. Get CID
  const cid = await resolveCid(query);
  // No need to check cid here, resolveCid throws if not found
  console.log(`[PubChemService] Resolved CID: ${cid} for query: "${query}"`);

  // 2. Get SDF data
  const sdfResp = await fetch(`${PUBCHEM}/compound/cid/${cid}/SDF`);
  if (!sdfResp.ok) {
    const errorText = await sdfResp.text();
    console.error(`[PubChemService] PubChem SDF request failed: ${sdfResp.status} - ${errorText}`);
    throw new Error(`PubChem SDF request failed: ${sdfResp.status} - ${errorText}`);
  }
  const sdf = await sdfResp.text();
  console.log(
    `[PubChemService] Successfully fetched SDF data (length: ${sdf.length}) for CID: ${cid}`
  );

  // 3. Get formula
  const formulaResp = await fetch(`${PUBCHEM}/compound/cid/${cid}/property/MolecularFormula/JSON`);
  if (!formulaResp.ok) {
    const errorText = await formulaResp.text();
    console.error(
      `[PubChemService] PubChem formula request failed: ${formulaResp.status} - ${errorText}`
    );
    // Not throwing here, as formula is non-critical, but will log and return empty
  }
  let formula = '';
  if (formulaResp.ok) {
    const formulaData = (await formulaResp.json()) as any; // Type assertion for safety
    formula = formulaData.PropertyTable?.Properties?.[0]?.MolecularFormula ?? '';
    console.log(`[PubChemService] Successfully fetched formula: ${formula} for CID: ${cid}`);
  }

  // 4. Convert SDF to PDB using external API
  console.log(`[PubChemService] Converting SDF to PDB for CID: ${cid}`);
  let pdb_data = '';
  try {
    pdb_data = await convertSDFToPDB(sdf);
    console.log(
      `[PubChemService] Successfully converted SDF to PDB (length: ${pdb_data.length}) for CID: ${cid}`
    );
  } catch (conversionError) {
    console.error(
      `[PubChemService] SDF to PDB conversion failed for CID: ${cid}:`,
      conversionError
    );
    // If conversion fails, we might still want to return other data, but PDB will be empty
  }

  let info: MoleculeInfo = { formula };
  try {
    const recordResp = await fetch(`${PUBCHEM}/compound/cid/${cid}/record/JSON`);
    if (recordResp.ok) {
      const record = await recordResp.json();
      info = { ...info, ...extractPubChemInfo(record) };
    }
  } catch (e) {
    console.error('[PubChemService] Error fetching record info:', e);
  }

  return {
    pdb_data,
    name: query,
    cid,
    formula,
    info,
  };
}

export function moleculeHTML(moleculeData: MoleculeData): string {
  return `<div class="molecule" data-cid="${moleculeData.cid}"></div>`;
}

/* ----------  helpers  ---------- */

async function cidByExact(term: string): Promise<number | null> {
  const r = await fetch(`${PUBCHEM}/compound/name/${encodeURIComponent(term)}/cids/JSON`);
  if (!r.ok) return null;
  const data = (await r.json()) as any;
  return data?.IdentifierList?.CID?.[0] ?? null;
}

// B. autocomplete → reuse A.
async function cidByAutocomplete(term: string): Promise<number | null> {
  // The autocomplete endpoint is separate from PUG and already includes
  // the "compound" entity segment.
  const url = `${PUBCHEM_AC}/${encodeURIComponent(term)}/JSON?limit=20`;
  const r = await fetch(url);
  if (!r.ok) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[cidByAutocomplete] PubChem autocomplete failed', r.status, term);
    }
    return null;
  }

  const suggestions = ((await r.json()) as any)?.dictionary_terms?.compound ?? [];
  for (const name of suggestions) {
    const cid = await cidByExact(name);
    if (cid) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[cidByAutocomplete] picked', name, '→', cid);
      }
      return cid;
    }
  }

  return null;
}

// C. Entrez class search
async function cidByClassSearch(term: string): Promise<number | null> {
  const xml = await fetch(
    `${ENTREZ}/esearch.fcgi?db=pccompound&retmax=200&term=${encodeURIComponent(term)}`
  ).then(r=>r.text());
  const cids = [...xml.matchAll(/<Id>(\d+)<\/Id>/g)].map(m => m[1]);
  if (!cids.length) return null;

  const prop = await fetch(
    `${PUBCHEM}/compound/cid/${cids.join(',')}/property/SubstanceCount/JSON`
  ).then(res => res.json() as any);
  const best = prop.PropertyTable?.Properties?.sort(
    (a: any, b: any) => b.SubstanceCount - a.SubstanceCount
  )[0];

  return best?.CID ?? null;
}

// New function to convert SDF to PDB using external API
async function convertSDFToPDB(sdfData: string): Promise<string> {
  console.log('[PubChemService] Converting SDF to PDB using Moleculens API');
  try {
    const response = await fetch(`${MOLECULENS_API}/sdf-to-pdb/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sdf: sdfData }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SDF to PDB conversion failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as SDFToPDBResponse;
    console.log('[PubChemService] Successfully converted SDF to PDB using Moleculens API');
    return data.pdb_data;
  } catch (error) {
    console.error('[PubChemService] Error converting SDF to PDB:', error);
    throw error;
  }
}

function extractPubChemInfo(record: any): MoleculeInfo {
  const info: MoleculeInfo = {};
  const compound = record?.PC_Compounds?.[0];
  const props = compound?.props || [];

  const getProp = (label: string) => {
    for (const p of props) {
      if (p?.urn?.label === label) {
        return p?.value?.sval ?? p?.value?.fval ?? p?.value?.ival;
      }
    }
    return undefined;
  };

  info.formula = getProp('Molecular Formula');
  const mw = getProp('Molecular Weight');
  if (mw !== undefined) info.formula_weight = parseFloat(mw);
  info.canonical_smiles = getProp('Canonical SMILES');
  info.isomeric_smiles = getProp('Isomeric SMILES');
  info.inchi = getProp('InChI');
  info.inchikey = getProp('InChIKey');
  const fc = getProp('Formal Charge');
  if (fc !== undefined) info.formal_charge = parseInt(fc as any, 10);
  info.synonyms = props
    .filter((p: any) => p?.urn?.label === 'Synonym')
    .map((p: any) => p?.value?.sval)
    .filter(Boolean);
  return info;
}
