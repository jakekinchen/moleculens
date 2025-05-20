import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const response = await fetch('https://meshmo.com/prompt/generate-from-pubchem/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Meshmo API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying request to Meshmo:', error);
    return NextResponse.json(
      { message: 'Error processing request', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
