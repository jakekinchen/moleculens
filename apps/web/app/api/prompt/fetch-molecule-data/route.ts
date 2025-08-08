import { NextRequest, NextResponse } from 'next/server';
import { fetchMoleculeDataEnhanced } from '@/lib/pubchem';
import { classifyPrompt } from '@/lib/llm';
import { detectFunctionalGroupsFromSdf } from '@/lib/chem-groups';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const query: string | undefined = body.query ?? body.prompt;
  const alwaysFindMolecule: boolean = !!body.alwaysFindMolecule;
  if (!query) {
    return NextResponse.json({ error: 'Missing prompt', status: 'failed' }, { status: 400 });
  }

  try {
    const classification = await classifyPrompt(query, alwaysFindMolecule);
    console.log(`[PubChemService] Classification: ${JSON.stringify(classification)}`);
    let moleculeQuery = classification.name ?? '';
    let moleculeType: 'small molecule' | 'macromolecule' = 'small molecule';

    if (classification.type !== 'unknown') {
      moleculeType = classification.type === 'macromolecule' ? 'macromolecule' : 'small molecule';

      // Start with the LLM-supplied (or fallback) name.
      moleculeQuery = classification.name ?? '';
    } else {
      return NextResponse.json(
        {
          status: 'failed',
          error:
            'Non-molecular prompt: Your prompt should be related to molecular structures. Click on the "Suggest Molecule" button to get started.',
        },
        { status: 200 }
      );
    }

    const data = await fetchMoleculeDataEnhanced(moleculeQuery, moleculeType);

    // Server-side functional group count logging for small molecules
    try {
      const sdfText = data.sdf || '';
      if (sdfText && sdfText.trim().length > 0) {
        const res = await detectFunctionalGroupsFromSdf(sdfText);
        const count = res?.groups?.length ?? 0;
        console.log(`[FunctionalGroups][server] ${data.name || moleculeQuery}: ${count} groups detected`);
      } else {
        console.log(`[FunctionalGroups][server] ${data.name || moleculeQuery}: 0 groups (no SDF)`);
      }
    } catch (e) {
      console.warn('[FunctionalGroups][server] detection failed:', e);
    }

    // Return full molecule data expected by the frontend
    return NextResponse.json({
      pdb_data: data.pdb_data,
      sdf: data.sdf,
      name: data.name,
      cid: data.cid,
      formula: data.formula,
      info: data.info,
      moleculeType,
      pdb_id: (data as any).pdb_id,
      // Include SMILES data from the info object for 2D rendering
      smiles: data.info?.canonical_smiles || data.info?.isomeric_smiles,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json({ status: 'failed', error: errorMessage }, { status: 500 });
  }
}
