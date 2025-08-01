import { NextRequest, NextResponse } from 'next/server';
import { generateDiagram } from '@/lib/diagram';

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const result = await generateDiagram(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
