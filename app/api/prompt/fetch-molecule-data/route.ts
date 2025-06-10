import { NextRequest, NextResponse } from 'next/server';
import { fetchMoleculeData } from '@/lib/pubchem';
import { classifyPrompt} from '@/lib/llm';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const query: string | undefined = body.query ?? body.prompt;
  if (!query) {
    return NextResponse.json({ error: 'Missing prompt', status: 'failed' }, { status: 400 });
  }

  try {
    const classification = await classifyPrompt(query);
    console.log(`[PubChemService] Classification: ${JSON.stringify(classification)}`);
    let moleculeQuery = classification.name ?? '';
    let moleculeType: 'small molecule' | 'macromolecule' = 'small molecule';

    if (classification.type !== 'unknown') {
      moleculeType = classification.type === 'macromolecule' ? 'macromolecule' : 'small molecule';

      // Start with the LLM-supplied (or fallback) name.
      moleculeQuery = classification.name ?? '';

    } else {
      return NextResponse.json({
        status: 'failed',
        error: 'Non-molecular prompt: Your prompt should be related to molecular structures. Click on the "Suggest Molecule" button to get started.'
      }, { status: 400 });
    }

    const data = await fetchMoleculeData(moleculeQuery, moleculeType);

    // Return full molecule data expected by the frontend
    return NextResponse.json({
      pdb_data: data.pdb_data,
      name: data.name,
      cid: data.cid,
      formula: data.formula,
      info: data.info,
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'failed', error: err.message }, { status: 500 });
  }
}
