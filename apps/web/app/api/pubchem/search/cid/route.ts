// /api/pubchem/search/cid/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getMoleculeDataByCID } from '@/services/molecular';

export async function POST(request: NextRequest) {
  try {
    const { cid } = await request.json();
    
    if (!cid) {
      return NextResponse.json(
        { error: 'CID parameter is required' },
        { status: 400 }
      );
    }

    // Validate that CID is a number
    const cidNumber = parseInt(cid.toString(), 10);
    if (isNaN(cidNumber) || cidNumber <= 0) {
      return NextResponse.json(
        { error: 'CID must be a positive integer' },
        { status: 400 }
      );
    }

    console.log(`[PubChem CID] Fetching molecule data for CID: ${cidNumber}`);
    
    const result = await getMoleculeDataByCID(cidNumber);
    
    if (!result) {
      return NextResponse.json(
        { error: `No molecule found for CID: ${cidNumber}` },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PubChem CID] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `CID lookup failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
