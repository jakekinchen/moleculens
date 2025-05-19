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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
