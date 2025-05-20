import { NextRequest, NextResponse } from 'next/server';
import { fetchMoleculeData, moleculeHTML } from '../../../../lib/pubchem';
import { classifyPrompt, interpretQueryToMoleculeName } from '../../../../lib/llm';

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

    if (classification.type === 'macromolecule') {
      const response = await fetch('https://meshmo.com/prompt/generate-from-rcsb/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: classification.name ?? query }),
      });

      if (!response.ok) {
        throw new Error(`RCSB API responded with status: ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    const moleculeQuery = classification.name ?? (await interpretQueryToMoleculeName(query));
    const data = await fetchMoleculeData(moleculeQuery);
    const html = moleculeHTML(data);
    return NextResponse.json({ sdf: data.sdf, result_html: html, title: data.name });
  } catch (err: any) {
    return NextResponse.json({ status: 'failed', error: err.message }, { status: 500 });
  }
}
