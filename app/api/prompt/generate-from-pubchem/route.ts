import { NextRequest, NextResponse } from 'next/server';
import { fetchMoleculeData, moleculeHTML } from '../../../../lib/pubchem';
import { isMolecularPrompt, interpretQueryToMoleculeName } from '../../../../lib/llm';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const query = body.prompt as string;
  if (!query) {
    return NextResponse.json({ error: 'Missing prompt', status: 'failed' }, { status: 400 });
  }
  const ok = await isMolecularPrompt(query);
  if (!ok) {
    return NextResponse.json({ status: 'failed', job_id: 'rejected', error: 'Prompt not about molecules' });
  }
  try {
    const moleculeQuery = await interpretQueryToMoleculeName(query);
    const data = await fetchMoleculeData(moleculeQuery);
    const html = moleculeHTML(data);
    return NextResponse.json({ sdf: data.sdf, result_html: html, title: data.name });
  } catch (err: any) {
    return NextResponse.json({ status: 'failed', error: err.message }, { status: 500 });
  }
}
