import type { FunctionalGroup, GroupDetectionResult } from '../types';

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
  smiles?: string;
};

// Initial minimal SMARTS library (expandable/versioned)
const GROUP_PATTERNS: GroupPattern[] = [
  { id: 'hydroxyl', name: 'Hydroxyl', smarts: '[OX2H]', smiles: '[OH]', description: 'Alcohol/phenol OH' },
  { id: 'carbonyl', name: 'Carbonyl', smarts: '[CX3]=[OX1]', smiles: 'C=O', description: 'C=O (ketone/aldehyde)' },
  { id: 'carboxylate', name: 'Carboxylate', smarts: 'C(=O)[O-]', description: 'Deprotonated carboxyl' },
  { id: 'carboxylic_acid', name: 'Carboxylic acid', smarts: 'C(=O)O[H]', smiles: 'OC=O', description: 'COOH' },
  { id: 'ester', name: 'Ester', smarts: 'C(=O)O[C;!H0]', smiles: 'COOC', description: 'Ester linkage' },
  { id: 'amide', name: 'Amide', smarts: 'C(=O)N', smiles: 'NC=O', description: 'Amide linkage' },
  { id: 'primary_amine', name: 'Primary amine', smarts: '[NX3;H2;!$(NC=O)]', smiles: 'N', description: 'R-NH2' },
  { id: 'secondary_amine', name: 'Secondary amine', smarts: '[NX3;H1;!$(NC=O)]', smiles: 'NC', description: 'R2NH' },
  { id: 'tertiary_amine', name: 'Tertiary amine', smarts: '[NX3;H0;!$(NC=O)]', smiles: 'N(C)C', description: 'R3N' },
  { id: 'nitro', name: 'Nitro', smarts: '[$([NX3](=O)=O)]', smiles: '[N+](=O)[O-]', description: 'NO2' },
  { id: 'halogen', name: 'Halogen', smarts: '[F,Cl,Br,I]', description: 'Halogen atom' },
  { id: 'aromatic_ring', name: 'Aromatic ring', smarts: 'a1aaaaa1', description: 'Benzene-like ring' },
  // Backup aromatic ring detection for Kekulé-coded rings (no aromatic flags)
  { id: 'aromatic_ring_kekule', name: 'Aromatic ring (backup)', smarts: 'C1=CC=CC=C1', smiles: 'C1=CC=CC=C1', description: 'Fallback for benzene-like rings encoded with alternating bonds' },
  { id: 'aromatic_ring_aromatic_carbon', name: 'Aromatic ring (aromatic carbons)', smarts: 'c1ccccc1', smiles: 'c1ccccc1', description: 'Fallback for aromatic carbons ring' },
  // Xanthine core and fused bicyclic approximations
  // Generic imidazole ring: five-membered ring with two nitrogens pattern
  { id: 'imidazole_like', name: 'Imidazole-like ring', smarts: 'n1c[nH]c1', smiles: 'n1c[nH]c1', description: 'Generic five-membered heteroaromatic ring (approx.)' },
  // Purine/Xanthine-like fused bicyclic: two fused rings with multiple nitrogens
  // This is an approximation to catch xanthine/purine skeletons without overmatching
  { id: 'purine_like', name: 'Purine/Xanthine-like core', smarts: 'n1c2ncnc2n1', smiles: 'n1c2ncnc2n1', description: 'Fused bicyclic heteroaromatic (approx.)' },
  // Carbonyl amide motifs present in xanthine derivatives
  { id: 'imide_like', name: 'Imide-like (dicarbonyl N)', smarts: 'N(C=O)C=O', smiles: 'N(C=O)C=O', description: 'Two carbonyls on nitrogen (imide-like)' },
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
  // Perceive rings/aromaticity helpers which improve SMARTS matching
  if (typeof OCL.Molecule.prototype.ensureHelperArrays === 'function') {
    const helpers = ((OCL.Molecule.cHelperRings as number) || 0) |
      ((OCL.Molecule.cHelperAromaticity as number) || 0);
    mol.ensureHelperArrays?.(helpers);
  }

  const groups: FunctionalGroup[] = [];
  const atomToGroupIds = new Map<number, string[]>();

  for (const pattern of GROUP_PATTERNS) {
    // Build query from SMARTS using standard API
    // Some builds expose fromSmarts; others need Parser/Util. Try fallbacks.
    let query: any;
    if (typeof OCL.Molecule.fromSmarts === 'function') {
      query = OCL.Molecule.fromSmarts(pattern.smarts);
    } else if (OCL.SmartsParser && typeof OCL.SmartsParser.parse === 'function') {
      query = OCL.SmartsParser.parse(pattern.smarts);
    } else if (OCL.SmilesParser && typeof OCL.SmilesParser.parse === 'function') {
      // Very last resort: attempt to parse SMARTS as SMILES for simple patterns
      try {
        query = OCL.SmilesParser.parse(pattern.smarts);
      } catch {
        query = null;
      }
    }
    if (!query) continue;
    const matches: number[][] = [];
    try {
      // Preferred: indexed searcher
      const sIdx = new OCL.SSSearcherWithIndex();
      sIdx.setFragment(query);
      sIdx.setMolecule(mol);
      const out = (sIdx as any).findMatches?.() ?? (sIdx as any).search?.();
      if (Array.isArray(out)) {
        for (const m of out) {
          if (Array.isArray(m)) matches.push(m as number[]);
        }
      }
    } catch {
      // Fallback: baseline searcher with multiple possible APIs
      try {
        const s = new OCL.SSSearcher();
        // Some builds use setMol / setFragment; others use setMolecule
        (s as any).setMol?.(mol);
        (s as any).setMolecule?.(mol);
        (s as any).setFragment?.(query);
        const out = (s as any).findMatches?.() ?? (s as any).search?.();
        if (Array.isArray(out)) {
          for (const m of out) {
            if (Array.isArray(m)) matches.push(m as number[]);
          }
        } else if (out && typeof out.length === 'number' && typeof out.get === 'function') {
          for (let i = 0; i < out.length; i++) {
            const match = out.get(i);
            const atoms: number[] = [];
            for (let j = 0; j < match.length; j++) atoms.push(match[j]);
            matches.push(atoms);
          }
        }
      } catch {
        // ignore pattern failure
      }
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


