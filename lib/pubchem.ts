import fetch, { Response } from 'node-fetch';

export interface MoleculeData {
  pdb_data: string;
  name: string;
  cid: number;
  formula: string;
  sdf: string;
}

// Common name to IUPAC or representative molecule mappings
const COMMON_NAME_MAPPINGS: Record<string, string> = {
  bullvalene: 'tricyclo[3.3.2.02,8]deca-3,6,9-triene',
  // "crown ethers" is a class of compounds. Choose a common example so
  // PubChem search succeeds.
  'crown ethers': '18-crown-6',
  'crown ether': '18-crown-6',
  // Add more mappings as needed
};

async function fetchCID(query: string): Promise<number> {
  // First try the original query
  let resp = await tryFetchCID(query);
  if (resp) return resp;

  // If that fails, try the common name mapping
  const iupacName = COMMON_NAME_MAPPINGS[query.toLowerCase()];
  if (iupacName) {
    resp = await tryFetchCID(iupacName);
    if (resp) return resp;
  }

  // If both attempts fail, throw a more descriptive error
  throw new Error(
    `Compound "${query}" not found in PubChem. Try using the IUPAC name or a different common name.`
  );
}

async function tryFetchCID(query: string): Promise<number | null> {
  let resp: Response;
  try {
    resp = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(
        query
      )}/cids/JSON`
    );
  } catch (err) {
    throw new Error('Network error fetching CID');
  }

  if (!resp.ok) {
    if (resp.status === 404) {
      return null;
    }
    throw new Error(`PubChem CID request failed: ${resp.status}`);
  }

  const data = (await resp.json()) as any;
  if (!data.IdentifierList?.CID?.length) {
    return null;
  }
  return data.IdentifierList.CID[0];
}

export async function fetchMoleculeData(query: string): Promise<MoleculeData> {
  const cid = await fetchCID(query);

  // Fetch PDB data directly so the frontend viewer can parse it without
  // additional conversion from SDF.
  let pdbResp: Response;
  try {
    pdbResp = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/PDB?record_type=3d`
    );
  } catch (err) {
    throw new Error('Network error fetching PDB');
  }
  if (!pdbResp.ok) {
    throw new Error(`PubChem PDB request failed: ${pdbResp.status}`);
  }
  const pdbData = await pdbResp.text();

  let sdfResp: Response;
  try {
    sdfResp = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`
    );
  } catch (err) {
    throw new Error('Network error fetching SDF');
  }
  if (!sdfResp.ok) {
    throw new Error(`PubChem SDF request failed: ${sdfResp.status}`);
  }
  const sdf = await sdfResp.text();

  let formulaResp: Response;
  try {
    formulaResp = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula/JSON`
    );
  } catch (err) {
    throw new Error('Network error fetching formula');
  }
  if (!formulaResp.ok) {
    throw new Error(`PubChem formula request failed: ${formulaResp.status}`);
  }
  const formulaData = (await formulaResp.json()) as any;

  const moleculeResult: MoleculeData = {
    pdb_data: pdbData,
    name: query,
    cid,
    formula: formulaData.PropertyTable?.Properties?.[0]?.MolecularFormula ?? '',
    sdf,
  };

  // Log the entire result, focusing on pdb_data and sdf length for brevity in console if they are too long
  console.log('[lib/pubchem] fetchMoleculeData result for query:', query, 'CID:', cid);
  console.log('[lib/pubchem] Formula:', moleculeResult.formula);
  console.log('[lib/pubchem] SDF data (first 100 chars):', moleculeResult.sdf.substring(0, 100));
  // Log a snippet of the returned PDB data to verify it was retrieved
  console.log(
    '[lib/pubchem] PDB data (first 100 chars):',
    moleculeResult.pdb_data.substring(0, 100)
  );
  if (!moleculeResult.pdb_data || moleculeResult.pdb_data.trim() === '') {
    console.warn('[lib/pubchem] WARNING: PDB data is empty or whitespace for CID:', cid);
  }

  return moleculeResult;
}

export function moleculeHTML(moleculeData: MoleculeData): string {
  return `<div class="molecule" data-cid="${moleculeData.cid}"></div>`;
}
