import { NextRequest, NextResponse } from 'next/server';

/**
 * Very simple keyword-based classification to decide if a query
 * refers to a macromolecule (e.g., protein, DNA) or a small molecule.
 */
const MACRO_KEYWORDS = [
  'protein',
  'enzyme',
  'antibody',
  'antigen',
  'dna',
  'rna',
  'peptide',
  'pdb',
  'chain',
];

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const normalized = prompt.toLowerCase();
  const isMacro = MACRO_KEYWORDS.some((kw) => normalized.includes(kw));

  const result = {
    type: isMacro ? 'macromolecule' : 'small',
    name: prompt,
  };

  return NextResponse.json(result);
}
