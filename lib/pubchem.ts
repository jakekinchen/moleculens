import fetch, { Response } from 'node-fetch';

export interface MoleculeData {
  pdb_data: string;
  sdf: string;
  name: string;
  cid: number;
  formula: string;
}

interface SDFToPDBRequest {
  sdf: string;
}

interface SDFToPDBResponse {
  pdb_data: string;
}

const PUBCHEM = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const MOLECULENS_API = 'https://api.moleculens.com/prompt';

const COMMON_NAME_MAPPINGS: Record<string, string> = {
  bullvalene: 'tricyclo[3.3.2.0²,⁸]deca-3,6,9-triene',
  'crown ether': '18-crown-6',
  'crown ethers': '18-crown-6'
  // …
};

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
function candidateStrings(input: string): string[] {
  const set = new Set<string>();

  // 0. raw
  const raw = input.trim();
  if (raw) set.add(raw);

  // 1. strip straight & curly quotes
  let s = raw.replace(/["'""]/g, '');

  // 2. strip possessive 's  (ferrocene's -> ferrocene)
  s = s.replace(/\b([A-Za-z0-9\-]+)'s\b/gi, '$1');
  if (s !== raw) set.add(s);

  // 3. remove simple punctuation , . ; : ? ! ( )
  const punctFree = s.replace(/[.,;:?!()]/g, '');
  if (punctFree !== s) set.add(punctFree);

  // 4. single‑word tokens (≥3 chars) and bigrams
  const words = punctFree.split(/\s+/)
    .map(w => w.replace(/[^A-Za-z0-9+\-\[\]]/g, ''))
    .filter(Boolean);

  words.forEach(w => { if (w.length >= 3) set.add(w); });

  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`.trim();
    if (bigram.split(' ').length === 2) set.add(bigram);
  }

  return Array.from(set);
}

/* ----------  top-level  ---------- */

export async function resolveCid(q: string): Promise<number> {
  for (const cand of candidateStrings(q)) {
    // A. direct / synonym
    let cid = await cidByExact(cand);
    if (cid) return cid;

    // B. fuzzy autocomplete
    cid = await cidByAutocomplete(cand);
    if (cid) return cid;

    // C. class / family
    cid = await cidByClassSearch(cand);
    if (cid) return cid;

    // D. hard‑coded mapping
    const mapped = COMMON_NAME_MAPPINGS[cand.toLowerCase()];
    if (mapped) {
      cid = await cidByExact(mapped);
      if (cid) return cid;
    }
  }
  throw new Error(`No PubChem compound matches "${q}"`);
}

export async function fetchMoleculeData(query: string): Promise<MoleculeData> {
  console.log(`[PubChemService] Fetching molecule data for query: "${query}"`);
  // 1. Get CID
  const cid = await resolveCid(query);
  // No need to check cid here, resolveCid throws if not found
  console.log(`[PubChemService] Resolved CID: ${cid} for query: "${query}"`);

  // 2. Get SDF data
  const sdfResp = await fetch(
    `${PUBCHEM}/compound/cid/${cid}/SDF`
  );
  if (!sdfResp.ok) {
    const errorText = await sdfResp.text();
    console.error(`[PubChemService] PubChem SDF request failed: ${sdfResp.status} - ${errorText}`);
    throw new Error(`PubChem SDF request failed: ${sdfResp.status} - ${errorText}`);
  }
  const sdf = await sdfResp.text();
  console.log(`[PubChemService] Successfully fetched SDF data (length: ${sdf.length}) for CID: ${cid}`);

  // 3. Get formula
  const formulaResp = await fetch(
    `${PUBCHEM}/compound/cid/${cid}/property/MolecularFormula/JSON`
  );
  if (!formulaResp.ok) {
    const errorText = await formulaResp.text();
    console.error(`[PubChemService] PubChem formula request failed: ${formulaResp.status} - ${errorText}`);
    // Not throwing here, as formula is non-critical, but will log and return empty
  }
  let formula = '';
  if (formulaResp.ok) {
    const formulaData = await formulaResp.json() as any; // Type assertion for safety
    formula = formulaData.PropertyTable?.Properties?.[0]?.MolecularFormula ?? '';
    console.log(`[PubChemService] Successfully fetched formula: ${formula} for CID: ${cid}`);
  }

  // 4. Convert SDF to PDB using external API
  console.log(`[PubChemService] Converting SDF to PDB for CID: ${cid}`);
  let pdb_data = '';
  try {
    pdb_data = await convertSDFToPDB(sdf);
    console.log(`[PubChemService] Successfully converted SDF to PDB (length: ${pdb_data.length}) for CID: ${cid}`);
  } catch (conversionError) {
    console.error(`[PubChemService] SDF to PDB conversion failed for CID: ${cid}:`, conversionError);
    // If conversion fails, we might still want to return other data, but PDB will be empty
  }

  return {
    pdb_data,
    sdf,
    name: query,
    cid,
    formula,
  };
}

/* ----------  helpers  ---------- */

async function cidByExact(term: string): Promise<number | null> {
  const r = await fetch(
    `${PUBCHEM}/compound/name/${encodeURIComponent(term)}/cids/JSON`
  );
  if (!r.ok) return null;
  const data = await r.json() as any;
  return data?.IdentifierList?.CID?.[0] ?? null;
}

// B. autocomplete → reuse A.
async function cidByAutocomplete(term: string): Promise<number | null> {
  const r = await fetch(
    `${PUBCHEM}/autocomplete/${encodeURIComponent(term)}/JSON?limit=20`
  );                       
  if (!r.ok) return null;
  const best = (await r.json() as any)?.dictionary_terms?.compound?.[0];
  return best ? cidByExact(best) : null;
}

// C. Entrez class search
async function cidByClassSearch(term: string): Promise<number | null> {
  const xml = await fetch(
    `${PUBCHEM}/compound/name/${encodeURIComponent(term)}/cids/XML`
  ).then(res => res.text());          
  const cids = [...xml.matchAll(/<Id>(\d+)<\/Id>/g)].map(m => m[1]);
  if (!cids.length) return null;

  const prop = await fetch(
    `${PUBCHEM}/compound/cid/${cids.join(',')}/property/SubstanceCount/JSON`
  ).then(res => res.json() as any);
  const best = prop.PropertyTable?.Properties
      ?.sort((a: any, b: any) => b.SubstanceCount - a.SubstanceCount)[0];

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
      body: JSON.stringify({ sdf: sdfData })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SDF to PDB conversion failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as SDFToPDBResponse;
    console.log('[PubChemService] Successfully converted SDF to PDB using Moleculens API');
    return data.pdb_data;
  } catch (error) {
    console.error('[PubChemService] Error converting SDF to PDB:', error);
    throw error;
  }
}