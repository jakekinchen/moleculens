import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.PYMOL_SERVER_BASE_URL || 'http://localhost:8000';

export async function GET(_: NextRequest, { params }: { params: { spec_id: string } }) {
  const { spec_id } = params;
  try {
    const r = await fetch(`${BASE}/v1/figure/${spec_id}`, { cache: 'no-store' });
    if (!r.ok) return NextResponse.json({ spec_id, status: 'unknown' }, { status: 200 });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ spec_id, status: 'unknown' }, { status: 200 });
  }
}


