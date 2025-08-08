import { NextRequest, NextResponse } from 'next/server';
import { validateSpec, specId } from '@moleculens/chem';

const BASE = process.env.PYMOL_SERVER_BASE_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const spec = validateSpec(body);
    const id = specId(spec);
    const r = await fetch(`${BASE}/v1/figure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    });
    if (!r.ok) {
      return NextResponse.json({ spec_id: id, status: 'queued' }, { status: 202 });
    }
    const data = await r.json();
    if (!data.spec_id) data.spec_id = id;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'bad_request' }, { status: 400 });
  }
}


