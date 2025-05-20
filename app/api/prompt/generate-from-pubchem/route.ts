import { NextRequest, NextResponse } from 'next/server';
import { fetchMoleculeData } from '@/lib/pubchem';
import { classifyPrompt, interpretQueryToMoleculeName } from '@/lib/llm';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const query = body.prompt as string;
  if (!query) {
    return NextResponse.json({ error: 'Missing prompt', status: 'failed' }, { status: 400 });
  }

  try {
    const classification = await classifyPrompt(query);
    if (classification.type === 'unknown') {
      return NextResponse.json({
        status: 'failed',
        job_id: 'rejected',
        error: 'Prompt not about molecules',
      });
    }

    const moleculeQuery = classification.name ?? (await interpretQueryToMoleculeName(query));
    const data = await fetchMoleculeData(moleculeQuery, classification.type);
    return NextResponse.json({ sdf: data.sdf, title: data.name });

    throw new Error(`Unknown classification type: ${classification.type}`);
  } catch (err: any) {
    return NextResponse.json({ status: 'failed', error: err.message }, { status: 500 });
  }
}
