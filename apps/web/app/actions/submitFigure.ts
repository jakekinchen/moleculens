'use server';

import { validateSpec, specId } from '@moleculens/chem';

export async function submitFigure(specInput: unknown) {
  const spec = validateSpec(specInput);
  const id = specId(spec);
  const r = await fetch(`/api/figure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(spec)
  });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return { spec_id: id };
}


