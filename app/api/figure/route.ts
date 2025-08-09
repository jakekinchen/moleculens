import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.PYMOL_SERVER_BASE_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const r = await fetch(`${BASE}/v1/figure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'bad_request'
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


