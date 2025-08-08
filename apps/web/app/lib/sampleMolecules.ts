export interface SampleMolecule {
  name: string;
  type: 'small molecule' | 'macromolecule';
  formula: string;
  smiles: string;
  weight: number;
  synonyms: string[];
  apiSource: {
    type: string;
    endpoint: string;
    cid?: number;
    query: string;
  };
  pdbData: string | null;
  sdfData: string | null;
  moleculeInfo: {
    formula: string;
    formula_weight: number;
    canonical_smiles: string;
    synonyms: string[];
  };
  analytics: {
    atomCount: number;
    bondCount: number;
    heavyAtomCount: number;
    rotatablebonds: number;
    hbondDonors: number;
    hbondAcceptors: number;
    logP: number;
    polarSurfaceArea: number;
  };
}

export interface SampleMoleculesData {
  defaultMolecule: string;
  molecules: Record<string, SampleMolecule>;
}

export async function loadSampleMolecules(): Promise<SampleMoleculesData | null> {
  try {
    const response = await fetch('/sample-molecules.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch sample molecules: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading sample molecules:', error);
    return null;
  }
}

export function getDefaultMolecule(data: SampleMoleculesData): SampleMolecule | null {
  const defaultKey = data.defaultMolecule;
  return data.molecules[defaultKey] || null;
}

export function getMoleculeByKey(data: SampleMoleculesData, key: string): SampleMolecule | null {
  return data.molecules[key] || null;
}

export function getAllMoleculeKeys(data: SampleMoleculesData): string[] {
  return Object.keys(data.molecules);
}
