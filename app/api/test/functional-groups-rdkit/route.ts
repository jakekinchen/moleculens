import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { detectFunctionalGroupsFromSdfRDKit } from '@/lib/rdkit-groups';

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

    const res = await detectFunctionalGroupsFromSdfRDKit(entry.sdfData);
    const groups = res?.groups || [];
    const count = groups.length;
    return NextResponse.json({
      status: 'ok',
      key,
      name: entry.name || key,
      count,
      groups: groups.map(g => ({ id: g.id, name: g.name, size: g.atoms.length })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ status: 'failed', error: msg }, { status: 500 });
  }
}




