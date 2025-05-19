import fetch from 'node-fetch';

export interface MoleculeData {
  pdb_data: string;
  name: string;
  cid: number;
  formula: string;
  sdf: string;
}

async function fetchCID(query: string): Promise<number> {
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
    throw new Error(`PubChem CID request failed: ${resp.status}`);
  }
  const data = (await resp.json()) as any;
  if (!data.IdentifierList?.CID?.length) {
    throw new Error('Compound not found');
  }
  return data.IdentifierList.CID[0];
}

export async function fetchMoleculeData(query: string): Promise<MoleculeData> {
  const cid = await fetchCID(query);

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
  return {
    pdb_data: sdf,
    name: query,
    cid,
    formula: formulaData.PropertyTable?.Properties?.[0]?.MolecularFormula ?? '',
    sdf,
  };
}

export function moleculeHTML(moleculeData: MoleculeData): string {
  return `<div class="molecule" data-cid="${moleculeData.cid}"></div>`;
}
