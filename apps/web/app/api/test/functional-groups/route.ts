import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { detectFunctionalGroupsFromSdf } from '@/lib/chem-groups';
import canonical from '@/lib/data/functional-groups-canonical.json';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key') || 'caffeine';

    const samplesPath = path.join(process.cwd(), 'public', 'sample-molecules.json');
    const raw = fs.readFileSync(samplesPath, 'utf8');
    const json = JSON.parse(raw) as {
      molecules: Record<string, { sdfData?: string; name?: string } | undefined>;
    };
    const entry = json.molecules?.[key];
    if (!entry || !entry.sdfData) {
      return NextResponse.json(
        { status: 'failed', error: `No SDF for key "${key}" in sample-molecules.json` },
        { status: 404 }
      );
    }

    const res = await detectFunctionalGroupsFromSdf(entry.sdfData);
    const groups = res?.groups || [];
    const count = groups.length;
    // Enforce hierarchy: suppress lower-priority groups if a higher-priority overlapping carbonyl-derived group exists
    const priority: Record<string, number> = Object.fromEntries(
      (canonical as Array<{ id: string; priority?: number }>).map(r => [r.id, r.priority ?? 0])
    );
    groups.sort((a, b) => (priority[b.id] ?? 0) - (priority[a.id] ?? 0));
    const kept: typeof groups = [];
    const usedAtoms = new Set<number>();
    for (const g of groups) {
      const overlap = g.atoms.some(a => usedAtoms.has(a));
      if (!overlap) {
        kept.push(g);
        g.atoms.forEach(a => usedAtoms.add(a));
      }
    }
    return NextResponse.json({
      status: 'ok',
      key,
      name: entry.name || key,
      count: kept.length,
      groups: kept.map(g => ({ id: g.id, name: g.name, size: g.atoms.length })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ status: 'failed', error: msg }, { status: 500 });
  }
}


