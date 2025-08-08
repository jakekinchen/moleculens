/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GroupDetectionResult, FunctionalGroup } from '@/types';
import path from 'path';

let rdkitModule: any | null = null;

async function getRDKit(): Promise<any> {
  if (rdkitModule) return rdkitModule;
  const init = (await import('@rdkit/rdkit')).default as unknown as (opts?: any) => Promise<any>;
  // Node (server) can load from node_modules absolute path; browser will fetch relative
  let locateFile: (file: string) => string;
  if (typeof window === 'undefined') {
    // Server: resolve the wasm from the package directory
    const rdkitEntry = require.resolve('@rdkit/rdkit');
    const baseDir = path.dirname(rdkitEntry);
    locateFile = (file: string) => path.join(baseDir, file);
  } else {
    // Client: let rdkit load from same-origin (Next serves the JS and will fetch the wasm next to it)
    locateFile = (file: string) => file;
  }
  rdkitModule = await init({ locateFile });
  return rdkitModule;
}

type Rule = { id: string; name: string; smarts?: string; smiles?: string; description?: string };
let cachedRules: Rule[] | null = null;

async function loadRules(): Promise<Rule[]> {
  if (cachedRules) return cachedRules;
  // Import JSON rules statically for bundlers
  const base = (await import('./data/functional-groups.json')).default as Rule[];
  const canon = (await import('./data/functional-groups-canonical.json')).default as Rule[];
  const rules = [...canon, ...base];
  cachedRules = rules;
  return rules;
}

export async function detectFunctionalGroupsFromSdfRDKit(sdf: string): Promise<GroupDetectionResult> {
  const RDKit = await getRDKit();
  const rules = await loadRules();

  const groups: FunctionalGroup[] = [];
  const atomToGroupIds = new Map<number, string[]>();

  let mol: any;
  try {
    mol = RDKit.get_mol(sdf);
  } catch {
    return { groups: [], atomToGroupIds };
  }

  try {
    for (const rule of rules) {
      let qmol: any = null;
      try {
        if (rule.smarts) qmol = RDKit.get_qmol(rule.smarts);
      } catch {
        qmol = null;
      }
      if (!qmol && rule.smiles) {
        try {
          qmol = RDKit.get_mol(rule.smiles);
        } catch {
          qmol = null;
        }
      }
      if (!qmol) continue;

      let matchStr = '';
      try {
        matchStr = mol.get_substruct_matches(qmol); // JSON string of arrays
      } catch {
        matchStr = '[]';
      }
      let matchArr: number[][] = [];
      try {
        matchArr = JSON.parse(matchStr) as number[][];
      } catch {
        matchArr = [];
      }
      if (!matchArr.length) continue;

      const atomSet = new Set<number>();
      for (const m of matchArr) for (const a of m) atomSet.add(a);
      const atomIdx = Array.from(atomSet.values());
      const fg: FunctionalGroup = {
        id: rule.id,
        name: rule.name,
        atoms: atomIdx,
        smarts: rule.smarts,
        description: rule.description,
      };
      groups.push(fg);
      for (const a of atomIdx) {
        const list = atomToGroupIds.get(a) || [];
        list.push(rule.id);
        atomToGroupIds.set(a, list);
      }
    }
  } finally {
    mol?.delete?.();
  }

  return { groups, atomToGroupIds };
}


