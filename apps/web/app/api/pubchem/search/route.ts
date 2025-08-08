// /api/pubchem/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { searchMoleculeByName, getMoleculeDataByCID } from '@/services/molecular';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Check if query is a number (CID) or text (molecule name)
    const trimmedQuery = query.toString().trim();
    const isNumeric = /^\d+$/.test(trimmedQuery);
    
    let result = null;

    if (isNumeric) {
      // Try CID lookup first for numeric queries
      try {
        const cid = parseInt(trimmedQuery, 10);
        console.log(`[PubChem Search] Attempting CID lookup for: ${cid}`);
        result = await getMoleculeDataByCID(cid);
      } catch (error) {
        console.warn(`[PubChem Search] CID lookup failed for ${trimmedQuery}:`, error);
        // Fall back to name search
        result = await searchMoleculeByName(trimmedQuery);
      }
    } else {
      // Use name search for text queries
      console.log(`[PubChem Search] Attempting name search for: ${trimmedQuery}`);
      result = await searchMoleculeByName(trimmedQuery);
    }

    if (!result) {
      return NextResponse.json(
        { error: `No molecule found for query: ${query}` },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PubChem Search] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Search failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}