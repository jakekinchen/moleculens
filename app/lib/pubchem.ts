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

// API roots ---------------------------------------------------
export const PUBCHEM = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';   // was const
export const PUBCHEM_AC = 'https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound';
export const ENTREZ      = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const NIST_CGI = 'https://webbook.nist.gov/cgi/cbook.cgi';
const CAS_RE   = /^\d{2,7}-\d{2}-\d$/;

/**
 * Try to fetch a 3-D SDF from NCI/CACTUS.
 * – Accepts CID (number) or arbitrary identifier (string).
 * – Falls back to "plain" SDF (no get3d) if the 3-D request 500s.
 */
async function cactus3d(id: number | string): Promise<string | null> {
  // CACTUS requires the "cid/" path segment when a numeric PubChem CID is supplied.
  const idPath =
    typeof id === 'number' || /^\d+$/.test(String(id)) ? `cid/${id}` : encodeURIComponent(String(id));

  const tryFetch = async (get3d: boolean): Promise<string | null> => {
    const suffix = get3d ? '?format=sdf&get3d=true' : '?format=sdf';
    const url = `https://cactus.nci.nih.gov/chemical/structure/${idPath}/file${suffix}`;
    console.log('CACTUS attempt:', url);
    const r = await fetch(url, { headers: { 'User-Agent': 'moleculens/1.0' } });
    console.log('CACTUS response:', r.status, r.headers.get('content-type'));
    // Only return null on 404 (not found); 500 means try without 3D
    if (r.status === 404) return null;
    if (!r.ok && r.status !== 500) return null;
    const txt = await r.text();
    return isSdf3D(txt) ? txt : null;
  };

  // 1º – ask CACTUS for a prepared 3-D conformer
  let txt = await tryFetch(true);
  // 2º – some metals/inorganics fail with 500; fetch plain SDF and test
  if (!txt) txt = await tryFetch(false);
  return txt;
}

function isSdf3D(text: string): boolean {
  const head = text.slice(0, 400).toUpperCase();
  if (head.includes(' 2D')) return false;
  if (head.includes(' 3D') || head.includes(' V3000')) return true;

  // look at first ~25 atom lines
  return text
    .split(/\n/)
    .slice(4, 30)
    .some(l => {
      const z = parseFloat(l.slice(20, 30)); // correct V2000 Z column
      return !Number.isNaN(z) && Math.abs(z) > 1e-3;
    });
}

async function casFromPubChem(cid: number): Promise<string | null> {
  const r = await fetch(`${PUBCHEM}/compound/cid/${cid}/synonyms/JSON`, { headers: { 'User-Agent': 'moleculens/1.0' } });
  console.log('CAS response', r.status);
  if (!r.ok) return null;
  const syns =
    (await r.json())?.InformationList?.Information?.[0]?.Synonym as string[] | undefined;
  return syns?.find(s => CAS_RE.test(s)) ?? null;
}

async function nist3dSdf(cas: string): Promise<string | null> {
  const res = await fetch(`${NIST_CGI}?Str3File=C${cas.replace(/-/g, '')}`, { headers: { 'User-Agent': 'moleculens/1.0' } });
  console.log('NIST', res.status, res.headers.get('content-type'));
  if (!res.ok) return null;
  const text = await res.text();
  return isSdf3D(text) ? text : null;
}

/**
 * Normalize chemical names to ASCII for consistent external service queries.
 * Handles soft-hyphens, fancy dashes, accents, and other Unicode artifacts.
 */
export function sanitizeName(name: string): string {
  return name
    .normalize('NFKD')          // decompose accents, NB-spaces, etc.
    .replace(/[\u00AD\u2010-\u2015\u202F]/g, '-')  // soft-hyphens & fancy dashes → -
    .replace(/[^\u0020-\u007F]/g, '') // strip non-ASCII leftovers (space through DEL)
    .replace(/\s+/g, ' ')         // collapse whitespace
    .trim();
}

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
  const term = sanitizeName(q);  // normalize to ASCII for consistent lookup
  // A. direct / synonym
  let cid = await cidByExact(term);
  if (cid) return cid;

  // B. fuzzy autocomplete
  cid = await cidByAutocomplete(term);
  if (cid) return cid;

  // C. class / family
  cid = await cidByClassSearch(term);
  if (cid) return cid;

  throw new Error(`No PubChem compound matches "${term}"`);
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
    });
    if (!ft.ok) {
      throw new Error(`RCSB returned ${ft.status}`);
    }
    const text = await ft.text();
    if (!text.trim()) {
      throw new Error('Empty response from RCSB');
    }
    const data = JSON.parse(text);

    const hits = (data?.result_set ?? []).filter((h: RCSBSearchHit) => PDB_ID_RE.test(h.identifier));
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
      });
      if (!rs.ok) {
        throw new Error(`RCSB returned ${rs.status}`);
      }
      const text = await rs.text();
      if (!text.trim()) {
        throw new Error('Empty response from RCSB');
      }
      const data = JSON.parse(text);

      const hits = (data?.result_set ?? []).filter((h: RCSBSearchHit) =>
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
  if (type === 'macromolecule') {
    const { pdb_data, title, info } = await generateFromRCSB({ prompt: query });
    return { pdb_data, name: title ?? query, cid: 0, formula: '', info, sdf: '' };
  }

  /* ---------- small molecules ---------- */
  const cid = await resolveCid(query);
  const mustHave3D = false; // generic detection – no CID whitelist
  let sdf = '';

  /* 1 ─── PubChem “3d” endpoint */
  {
    const r = await fetch(`${PUBCHEM}/compound/cid/${cid}/SDF?record_type=3d`);
    if (r.ok) {
      const txt = await r.text();
      if (isSdf3D(txt)) {
        sdf = txt;
      } else {
        console.warn(`PubChem returned planar coordinates for ${query}; will try NIST.`);
      }
    }
  }

  /* 2 ─── NIST via CAS */
  if (!sdf) {
    const cas = await casFromPubChem(cid);
    if (cas) {
      const txt = await nist3dSdf(cas);
      if (txt && isSdf3D(txt)) {
        console.log(`Retrieved 3-D coordinates from NIST (CAS ${cas}).`);
        sdf = txt;
      }
    }
  }

  /* 3 ─── CACTUS (computed / repository 3-D) */
  if (!sdf) {
    // (a) direct CID – cheapest, avoids name-parsing quirks
    const txt = await cactus3d(cid);
    if (txt) {
      console.log('[PubChemService] Retrieved 3-D SDF from CACTUS via CID.');
      sdf = txt;
    }
  }

  /* 3b ─── CACTUS via SMILES if CID failed */
  if (!sdf) {
    const smiles = await getSmiles(cid);
    if (smiles) {
      const txt = await cactus3d(smiles);
      if (txt) {
        console.log('[PubChemService] Retrieved 3-D SDF from CACTUS via SMILES.');
        sdf = txt;
      }
    }
  }

  /* 3c ─── CACTUS via cleaned name */
  if (!sdf) {
    const txt = await cactus3d(sanitizeName(query));
    if (txt) {
      console.log('[PubChemService] Retrieved 3-D SDF from CACTUS via name.');
      sdf = txt;
    }
  }

  if (sdf) {
    console.log('[PubChemService] Retrieved 3-D SDF from NCI/CACTUS.');
  }

  /* 4 ─── PubChem computed conformers */
  if (!sdf) {
    const conformerUrl = `${PUBCHEM}/compound/cid/${cid}/record/SDF?record_type=3d&response_type=save`;
    const pc3 = await fetch(conformerUrl, { headers: { 'User-Agent': 'moleculens/1.0' } });
    console.log('Conformer', pc3.status, pc3.headers.get('content-type'));
    if (pc3.ok) {
      const txt = await pc3.text();
      console.log('[PubChemService] Retrieved computed 3-D from conformer endpoint.');
      sdf = txt;
    }
  }
  /* 5 ─── PubChem 2-D fallback */
  if (!sdf) {
    const r2 =
      (await fetch(`${PUBCHEM}/compound/cid/${cid}/SDF?record_type=2d`)).ok
        ? await fetch(`${PUBCHEM}/compound/cid/${cid}/SDF?record_type=2d`)
        : await fetch(`${PUBCHEM}/compound/cid/${cid}/SDF`);
    if (r2.ok) {
      sdf = await r2.text();
      // Final check: if we have an SDF but it's not 3D, log a warning
      if (!isSdf3D(sdf)) {
        console.warn(`[PubChemService] No 3D structure found for ${query}. Falling back to 2D representation.`);
      }
    }
  }

  if (!sdf) throw new Error(`Unable to obtain SDF for “${query}” (CID ${cid}).`);

  /* --- ancillary data (formula, record info) --- */
  let formula = '';
  try {
    const f = await fetch(`${PUBCHEM}/compound/cid/${cid}/property/MolecularFormula/JSON`);
    if (f.ok) formula = (await f.json()).PropertyTable.Properties[0].MolecularFormula ?? '';
  } catch {
    /* ignore non-critical formula fetch errors */
  }

  let info: MoleculeInfo = { formula };
  try {
    const r = await fetch(`${PUBCHEM}/compound/cid/${cid}/record/JSON`);
    if (r.ok) info = { ...info, ...extractPubChemInfo(await r.json()) };
  } catch {
    /* ignore non-critical record info fetch errors */
  }

  return { pdb_data: '', sdf, name: query, cid, formula, info };
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

/**
 * Fetch canonical SMILES notation for a compound from PubChem.
 * Returns null if not found or error occurs.
 */
// Fetch CanonicalSMILES, IsomericSMILES or InChI (in that order) for CACTUS
async function getSmiles(cid: number): Promise<string | null> {
  try {
    const props = 'CanonicalSMILES,IsomericSMILES,InChI';
    const r = await fetch(
      `${PUBCHEM}/compound/cid/${cid}/property/${props}/JSON`
    );
    if (!r.ok) return null;

    const p = (await r.json())?.PropertyTable?.Properties?.[0] ?? {};
    return (
      p.CanonicalSMILES ||
      p.IsomericSMILES ||
      p.InChI ||
      null
    );
  } catch {
    return null;
  }
}

// helper previously internal → public
export function extractPubChemInfo(record: unknown): MoleculeInfo {
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

export { cidByExact, cidByAutocomplete, cidByClassSearch };
