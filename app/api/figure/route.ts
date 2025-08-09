import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.PYMOL_SERVER_BASE_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Debug logging of outbound spec to backend
    try {
      console.log('[api/figure] Outbound spec to server /v1/figure:', JSON.stringify(body, null, 2));
    } catch (e) {
      console.log('[api/figure] Outbound spec logging failed');
    }
    const r = await fetch(`${BASE}/v1/figure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) {
      console.error('[api/figure] Upstream error', r.status, text);
    } else {
      try {
        console.log('[api/figure] Upstream response', {
          status: r.status,
          contentType: r.headers.get('content-type'),
        });
      } catch {
        // ignore
      }
    }
    return new NextResponse(text, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
    });
  } catch (e) {
    console.error('[api/figure] Proxy failure', e);
    const message = e instanceof Error ? e.message : 'bad_request'
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


