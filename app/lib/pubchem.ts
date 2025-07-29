import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { MoleculeInfo } from '@/types';

interface RCSBSearchHit {
  identifier: string;
  score?: number;
}

interface RCSBMetadata {
  struct_keywords?: {
    pdbx_keywords?: string;
  };
  struct?: {
    title?: string;
  };
  rcsb_entry_info?: {
    resolution_combined?: number[];
    experimental_method?: string;
    deposited_polymer_entity_instance_count?: number;
    deposited_modeled_polymer_monomer_count?: number;
    deposition_date?: string;
    molecular_weight?: number;
  };
  rcsb_accession_info?: {
    initial_release_date?: string;
  };
  rcsb_primary_citation?: {
    year?: number;
    pdbx_database_id_doi?: string;
  };
  rcsb_entity_source_organism?: Array<{
    ncbi_scientific_name?: string;
    ncbi_common_name?: string;
  }>;
}

interface PubChemIdentifierResponse {
  IdentifierList?: {
    CID?: number[];
  };
}

interface PubChemAutocompleteResponse {
  dictionary_terms?: {
    compound?: string[];
  };
}

interface PubChemClassSearchResponse {
  InformationList?: {
    Information?: Array<{
      CID?: number;
      SubstanceCount?: number;
    }>;
  };
}

export interface MoleculeData {
  pdb_data: string;
  sdf?: string;
  name: string;
  cid: number;
  formula: string;
  info: MoleculeInfo;
}

const PUBCHEM = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
// Autocomplete lives outside the PUG namespace
const PUBCHEM_AC = 'https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound';
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
const RCSB_DATA = 'https://data.rcsb.org/rest/v1/core/entry';
const RCSB_AC = 'https://search.rcsb.org/rcsbsearch/v1/keyboard_autocomplete';
const RCSB_FT = 'https://search.rcsb.org/rcsbsearch/v2/query';

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
  const log = (...args: unknown[]) =>
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

    const hits = (ft?.result_set ?? []).filter((h: RCSBSearchHit) => PDB_ID_RE.test(h.identifier));
    if (hits.length) {
      log(
        'full_text',
        hits.map((h: RCSBSearchHit) => h.identifier)
      );
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

      const hits = (rs?.result_set ?? []).filter((h: RCSBSearchHit) =>
        PDB_ID_RE.test(h.identifier)
      );
      if (hits.length) {
        hits.sort((a: RCSBSearchHit, b: RCSBSearchHit) => (b.score ?? 0) - (a.score ?? 0));
        log(
          'robust_text',
          hits.map((h: RCSBSearchHit) => ({ id: h.identifier, score: h.score }))
        );
        return hits[0].identifier.toUpperCase();
      }
    }
  } catch (e) {
    log('robust_text-error', e);
  }

  // E. use /search/suggest endpoint similar to website autosuggest
  try {
    const suggestURL = `https://www.rcsb.org/search/suggest/false/${encodeURIComponent(term)}`;
    const text = await fetch(suggestURL, { headers: { Accept: 'application/json' } }).then(r =>
      r.text()
    );
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
function generateMacromoleculeTitle(meta: RCSBMetadata): string {
  try {
    // Get the molecule name from keywords or title
    let moleculeName = '';
    const keywords = meta?.struct_keywords?.pdbx_keywords || '';
    const fullTitle = meta?.struct?.title || '';

    // Try to extract the main molecule name (usually the first word in keywords or before "FROM" in title)
    if (keywords) {
      moleculeName = keywords.split(',')[0].trim();
    } else {
      const fromMatch = fullTitle.match(/^([^(]+?)(?:\s+FROM|$)/i);
      if (fromMatch) {
        moleculeName = fromMatch[1].trim();
      } else {
        moleculeName = fullTitle.split(/\s+/)[0];
      }
    }

    // Get organism info
    const organism = meta?.rcsb_entity_source_organism?.[0];
    const organismName = organism?.ncbi_common_name || organism?.ncbi_scientific_name;

    // Get resolution
    const resolution = meta?.rcsb_entry_info?.resolution_combined?.[0];

    // Construct the title
    let title = moleculeName;
    if (organismName) {
      title += ` from ${organismName}`;
    }
    if (resolution) {
      title += ` (${resolution.toFixed(1)} Å)`;
    }

    return title;
  } catch (error) {
    console.error('[PubChemService] Error generating macromolecule title:', error);
    return meta?.struct?.title || '';
  }
}

function extractRCSBInfo(meta: RCSBMetadata): MoleculeInfo {
  const info: MoleculeInfo = {};

  try {
    // Store the full description
    info.full_description = meta?.struct?.title;

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
    info.keywords =
      meta?.struct_keywords?.pdbx_keywords?.split(',').map((k: string) => k.trim()) || [];

    // Source organism
    const source = meta?.rcsb_entity_source_organism?.[0] || {};
    info.organism_scientific = source?.ncbi_scientific_name;
    info.organism_common = source?.ncbi_common_name;

    // Dates
    info.deposition_date = meta?.rcsb_accession_info?.initial_release_date;
  } catch (error) {
    console.error('[PubChemService] Error extracting RCSB info:', error);
  }

  return info;
}

export async function generateFromRCSB({ prompt }: { prompt: string }) {
  const id = await resolvePdbId(prompt);

  // fetch PDB block
  const pdb_data = await fetch(`${RCSB_FILES}/${id}.pdb`).then(r => r.text());

  // fetch metadata
  let title = prompt;
  let info: MoleculeInfo = {};
  try {
    const meta = await fetch(`${RCSB_DATA}/${id}`).then(r => r.json());
    title = generateMacromoleculeTitle(meta);
    info = extractRCSBInfo(meta);
  } catch (error) {
    console.error('[PubChemService] Error fetching RCSB metadata:', error);
  }

  return { pdb_data, title, pdb_id: id, info };
}

export async function fetchMoleculeData(
  query: string,
  type: 'small molecule' | 'macromolecule'
): Promise<MoleculeData> {
  console.log(`[PubChemService] Fetching molecule data for query: "${query}"`);
  if (type === 'macromolecule') {
    // Generate PDB data from RCSB
    const response = await generateFromRCSB({ prompt: query });
    return {
      pdb_data: response.pdb_data,
      name: response.title || query,
      cid: 0,
      formula: '',
      info: response.info,
      sdf: '',
    };
  }
  // 1. Get CID
  const cid = await resolveCid(query);
  // No need to check cid here, resolveCid throws if not found
  console.log(`[PubChemService] Resolved CID: ${cid} for query: "${query}"`);

  // 2. Get SDF data – prefer 3D, fallback to 2D then generic
  let sdfResp = await fetch(`${PUBCHEM}/compound/cid/${cid}/SDF?record_type=3d`);
  if (!sdfResp.ok) {
    console.warn(`[PubChemService] 3D SDF not found for CID ${cid}. Falling back to 2D.`);
    sdfResp = await fetch(`${PUBCHEM}/compound/cid/${cid}/SDF?record_type=2d`);
    if (!sdfResp.ok) {
      console.warn(`[PubChemService] 2D SDF not found for CID ${cid}. Trying default SDF.`);
      sdfResp = await fetch(`${PUBCHEM}/compound/cid/${cid}/SDF`);
    }
  }

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
    const formulaData = (await formulaResp.json()) as {
      PropertyTable?: { Properties?: Array<{ MolecularFormula?: string }> };
    };
    formula = formulaData.PropertyTable?.Properties?.[0]?.MolecularFormula ?? '';
    console.log(`[PubChemService] Successfully fetched formula: ${formula} for CID: ${cid}`);
  }

  // For small molecules we no longer perform SDF → PDB conversion; viewer will parse SDF directly.
  const pdb_data = '';
  const sdf_text = sdf; // rename for clarity

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
    sdf: sdf_text,
    name: query,
    cid,
    formula,
    info,
  };
}

export function moleculeHTML(moleculeData: MoleculeData): string {
  try {
    const templatePath = path.join(process.cwd(), 'output.html');
    let html = fs.readFileSync(templatePath, 'utf8');

    // Escape backticks in PDB data so it can reside inside template literal
    const escapeBackticks = (str: string) => str.replace(/`/g, '\\`');
    const pdbEscaped = escapeBackticks(moleculeData.pdb_data);

    // Replace the pdbData string inside the template
    html = html.replace(
      /const\s+pdbData\s*=\s*`[\s\S]*?`;/m,
      `const pdbData = \
\`${pdbEscaped}\`;`
    );

    // Update the title in <title> tag if present
    if (moleculeData.name) {
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${moleculeData.name}</title>`);

      // Also patch scriptData.title if present (VR presentation script)
      html = html.replace(/"title"\s*:\s*"[^"]*"/, `"title": "${moleculeData.name}"`);
    }

    // Insert CID attribute on top-level div if it exists in template
    if (moleculeData.cid) {
      html = html.replace(/data-cid="[^"]*"/, `data-cid="${moleculeData.cid}"`);
    }

    return html;
  } catch (err) {
    console.error('[moleculeHTML] Failed to build HTML from template:', err);
    // Fallback minimal
    return `<div class="molecule" data-cid="${moleculeData.cid}"></div>`;
  }
}

/* ----------  helpers  ---------- */

async function cidByExact(term: string): Promise<number | null> {
  const r = await fetch(`${PUBCHEM}/compound/name/${encodeURIComponent(term)}/cids/JSON`);
  if (!r.ok) return null;
  const data = (await r.json()) as PubChemIdentifierResponse;
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

  const suggestions =
    ((await r.json()) as PubChemAutocompleteResponse)?.dictionary_terms?.compound ?? [];
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
  ).then(r => r.text());
  const cids = [...xml.matchAll(/<Id>(\d+)<\/Id>/g)].map(m => m[1]);
  if (!cids.length) return null;

  const prop = await fetch(
    `${PUBCHEM}/compound/cid/${cids.join(',')}/property/SubstanceCount/JSON`
  ).then(res => res.json() as PubChemClassSearchResponse);
  const best = prop.InformationList?.Information?.sort(
    (a, b) => (b.SubstanceCount ?? 0) - (a.SubstanceCount ?? 0)
  )[0];

  return best?.CID ?? null;
}

function extractPubChemInfo(record: unknown): MoleculeInfo {
  const info: MoleculeInfo = {};
  const compound = (record as { PC_Compounds?: unknown[] })?.PC_Compounds?.[0];
  const props = (compound as { props?: unknown[] })?.props || [];

  const getProp = (label: string) => {
    for (const p of props) {
      const prop = p as {
        urn?: { label?: string };
        value?: { sval?: string; fval?: number; ival?: number };
      };
      if (prop?.urn?.label === label) {
        return prop?.value?.sval ?? prop?.value?.fval ?? prop?.value?.ival;
      }
    }
    return undefined;
  };

  const formula = getProp('Molecular Formula');
  info.formula = typeof formula === 'string' ? formula : undefined;

  const mw = getProp('Molecular Weight');
  if (mw !== undefined) info.formula_weight = parseFloat(String(mw));

  const canonicalSmiles = getProp('Canonical SMILES');
  info.canonical_smiles = typeof canonicalSmiles === 'string' ? canonicalSmiles : undefined;

  const isomericSmiles = getProp('Isomeric SMILES');
  info.isomeric_smiles = typeof isomericSmiles === 'string' ? isomericSmiles : undefined;

  const inchi = getProp('InChI');
  info.inchi = typeof inchi === 'string' ? inchi : undefined;

  const inchikey = getProp('InChIKey');
  info.inchikey = typeof inchikey === 'string' ? inchikey : undefined;

  const fc = getProp('Formal Charge');
  if (fc !== undefined) info.formal_charge = parseInt(String(fc), 10);

  info.synonyms = props
    .filter((p: unknown) => {
      const prop = p as { urn?: { label?: string }; value?: { sval?: string } };
      return prop?.urn?.label === 'Synonym';
    })
    .map((p: unknown) => {
      const prop = p as { value?: { sval?: string } };
      return prop?.value?.sval;
    })
    .filter((s): s is string => Boolean(s));
  return info;
}
