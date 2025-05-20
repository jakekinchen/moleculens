import { NextRequest, NextResponse } from 'next/server';
import { fetchMoleculeData } from '../../../../lib/pubchem';
import { interpretQueryToMoleculeName } from '../../../../lib/llm';

export async function POST(req: NextRequest) {
  let originalQuery;
  try {
    // Clone the request to read its body as text for logging, without consuming it for req.json()
    const reqClone = req.clone();
    const rawBody = await reqClone.text();
    console.log('[fetch-molecule-data] Raw request body:', rawBody);

    const jsonData = await req.json(); // Use original req for parsing
    originalQuery = jsonData.query;

    if (!originalQuery) {
      return NextResponse.json({ error: 'Missing query in JSON body' }, { status: 400 });
    }

    const moleculeName = await interpretQueryToMoleculeName(originalQuery);
    // If interpretQueryToMoleculeName throws an error because it couldn't identify a molecule (e.g. returned N/A),
    // it will be caught by the catch block below.
    const data = await fetchMoleculeData(moleculeName);
    return NextResponse.json(data);
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[fetch-molecule-data] Error processing query. Original query: "${originalQuery || '[Query not parsed]'}". Error: ${message}`);

    // Check for the specific error from interpretQueryToMoleculeName
    if (message.startsWith('Could not identify a specific molecule')) {
      return NextResponse.json({ error: message }, { status: 400 }); // Bad request, as query was not interpretable
    }
    if (message.includes('Compound not found') || message.includes('PubChem CID request failed: 404') || message.includes('No PubChem compound matches')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.startsWith('Network error')) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    if (err instanceof SyntaxError) { // Specifically catch JSON parsing errors
        return NextResponse.json({ error: `Invalid JSON in request body: ${message}`}, {status: 400 });
    }
    
    return NextResponse.json({ error: `Internal server error: ${message}` }, { status: 500 });
  }
}
