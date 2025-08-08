import { NextRequest, NextResponse } from 'next/server';
import { generatePresentationScript } from '@/lib/llm';

export async function POST(req: NextRequest) {
  try {
    const { molecule_data } = await req.json();

    if (!molecule_data) {
      return NextResponse.json({ error: 'Missing molecule data' }, { status: 400 });
    }

    const script = await generatePresentationScript(molecule_data);

    return NextResponse.json({ script });
  } catch (error) {
    console.error('Error generating presentation script:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate presentation script' },
      { status: 500 }
    );
  }
}
