import { NextRequest, NextResponse } from 'next/server';
import { fetchMoleculeData } from '../../../../lib/pubchem';

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  }
  try {
    const data = await fetchMoleculeData(query);
    return NextResponse.json(data);
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Compound not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.startsWith('Network error')) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
