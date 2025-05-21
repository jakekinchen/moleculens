import { NextRequest, NextResponse } from 'next/server';
import { fetchMoleculeData } from '@/lib/pubchem';
import { classifyPrompt, interpretQueryToMoleculeName } from '@/lib/llm';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const query: string | undefined = body.query ?? body.prompt;
  if (!query) {
    return NextResponse.json({ error: 'Missing prompt', status: 'failed' }, { status: 400 });
  }

  try {
    const classification = await classifyPrompt(query);
    let moleculeQuery = query;
    let moleculeType: 'small molecule' | 'macromolecule' = 'small molecule';

    if (classification.type !== 'unknown') {
      moleculeQuery = classification.name ?? (await interpretQueryToMoleculeName(query));
      moleculeType = classification.type === 'macromolecule' ? 'macromolecule' : 'small molecule';
    }

    const data = await fetchMoleculeData(moleculeQuery, moleculeType);

    // Return full molecule data expected by the frontend
    return NextResponse.json({
      pdb_data: data.pdb_data,
      name: data.name,
      cid: data.cid,
      formula: data.formula,
      sdf: data.sdf,
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'failed', error: err.message }, { status: 500 });
  }
}
