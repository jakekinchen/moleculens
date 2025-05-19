import { NextRequest, NextResponse } from 'next/server';
import { moleculeHTML } from '../../../../lib/pubchem';

export async function POST(req: NextRequest) {
  const { molecule_data } = await req.json();
  if (!molecule_data) {
    return NextResponse.json({ error: 'Missing molecule data' }, { status: 400 });
  }
  const html = moleculeHTML(molecule_data);
  return NextResponse.json({ html });
}
