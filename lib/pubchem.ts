import fetch from 'node-fetch';

export interface MoleculeData {
  pdb_data: string;
  name: string;
  cid: number;
  formula: string;
  sdf: string;
}

async function fetchCID(query: string): Promise<number> {
  const resp = await fetch(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(
      query
    )}/cids/JSON`
  );
  const data = (await resp.json()) as any;
  if (!data.IdentifierList?.CID?.length) {
    throw new Error('Compound not found');
  }
  return data.IdentifierList.CID[0];
}

export async function fetchMoleculeData(query: string): Promise<MoleculeData> {
  const cid = await fetchCID(query);
  const sdfResp = await fetch(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`
  );
  const sdf = await sdfResp.text();
  const formulaResp = await fetch(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula/JSON`
  );
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
