import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.PYMOL_SERVER_BASE_URL || 'http://localhost:8000';

export async function GET(
  _req: NextRequest,
  context: { params: { spec_id: string } }
) {
  const { spec_id } = context.params || ({} as any);
  if (!spec_id) {
    return NextResponse.json({ error: 'missing_spec_id' }, { status: 400 });
  }
  try {
    const r = await fetch(`${BASE}/v1/figure/${encodeURIComponent(spec_id)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // No body for GET
    });
    const text = await r.text();
    if (!r.ok) {
      console.error('[api/figure/:spec_id] Upstream error', r.status, text);
    }
    return new NextResponse(text, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
    });
  } catch (e) {
    console.error('[api/figure/:spec_id] Proxy failure', e);
    const message = e instanceof Error ? e.message : 'bad_request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


