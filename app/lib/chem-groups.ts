import type { FunctionalGroup, GroupDetectionResult } from '@/types';

// Lazy import to avoid SSR/Next build issues and keep initial bundle small
let OCLPromise: Promise<any> | null = null;
const getOCL = () => {
  if (!OCLPromise) {
    OCLPromise = import('openchemlib').then(m => (m as any).default ?? m);
  }
  return OCLPromise;
};

type GroupPattern = {
  id: string;
  name: string;
  smarts: string;
  description?: string;
};

// Initial minimal SMARTS library (expandable/versioned)
const GROUP_PATTERNS: GroupPattern[] = [
  { id: 'hydroxyl', name: 'Hydroxyl', smarts: '[OX2H]', description: 'Alcohol/phenol OH' },
  { id: 'carbonyl', name: 'Carbonyl', smarts: '[CX3]=[OX1]', description: 'C=O (ketone/aldehyde)' },
  { id: 'carboxylate', name: 'Carboxylate', smarts: 'C(=O)[O-]', description: 'Deprotonated carboxyl' },
  { id: 'carboxylic_acid', name: 'Carboxylic acid', smarts: 'C(=O)O[H]', description: 'COOH' },
  { id: 'ester', name: 'Ester', smarts: 'C(=O)O[C;!H0]', description: 'Ester linkage' },
  { id: 'amide', name: 'Amide', smarts: 'C(=O)N', description: 'Amide linkage' },
  { id: 'primary_amine', name: 'Primary amine', smarts: '[NX3;H2;!$(NC=O)]', description: 'R-NH2' },
  { id: 'secondary_amine', name: 'Secondary amine', smarts: '[NX3;H1;!$(NC=O)]', description: 'R2NH' },
  { id: 'tertiary_amine', name: 'Tertiary amine', smarts: '[NX3;H0;!$(NC=O)]', description: 'R3N' },
  { id: 'nitro', name: 'Nitro', smarts: '[$([NX3](=O)=O)]', description: 'NO2' },
  { id: 'halogen', name: 'Halogen', smarts: '[F,Cl,Br,I]', description: 'Halogen atom' },
  { id: 'aromatic_ring', name: 'Aromatic ring', smarts: 'a1aaaaa1', description: 'Benzene-like ring' },
];

function hashString(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return `${h}`;
}

const detectionCache = new Map<string, GroupDetectionResult>();

export async function detectFunctionalGroupsFromSdf(sdf: string): Promise<GroupDetectionResult> {
  const key = `sdf:${hashString(sdf)}`;
  const cached = detectionCache.get(key);
  if (cached) return cached;

  const OCL = await getOCL();
  const mol = OCL.Molecule.fromMolfile(sdf);

  const groups: FunctionalGroup[] = [];
  const atomToGroupIds = new Map<number, string[]>();

  for (const pattern of GROUP_PATTERNS) {
    const query = OCL.SSSearcher.getMoleculeFromSmarts(pattern.smarts);
    const searcher = new OCL.SSSearcher();
    searcher.setMol(mol);
    searcher.setFragment(query);

    const matches: number[][] = [];
    const matchList = searcher.search();
    for (let i = 0; i < matchList.length; i++) {
      const match = matchList.get(i);
      const atoms: number[] = [];
      for (let j = 0; j < match.length; j++) {
        atoms.push(match[j]);
      }
      matches.push(atoms);
    }

    if (matches.length > 0) {
      const atomSet = new Set<number>();
      matches.forEach(m => m.forEach(a => atomSet.add(a)));
      const group: FunctionalGroup = {
        id: pattern.id,
        name: pattern.name,
        atoms: Array.from(atomSet.values()),
        smarts: pattern.smarts,
        description: pattern.description,
      };
      groups.push(group);
      group.atoms.forEach(a => {
        const list = atomToGroupIds.get(a) || [];
        list.push(group.id);
        atomToGroupIds.set(a, list);
      });
    }
  }

  const result: GroupDetectionResult = { groups, atomToGroupIds };
  detectionCache.set(key, result);
  return result;
}


