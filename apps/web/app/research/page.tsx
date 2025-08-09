"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateSpec, specId } from '@moleculens/chem';

export default function ResearchPage() {
  const router = useRouter();
  const [inputKind, setInputKind] = useState<'smiles'|'name'|'pdb'>('smiles');
  const [inputValue, setInputValue] = useState('CC(=O)Oc1ccccc1C(=O)O');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(768);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const specInput = {
        version: 1,
        input: { kind: inputKind, value: inputValue, protonation_pH: 7.4, conformer_method: 'none' },
        render: { modes: ['2d','3d'], outputs: ['svg','png'], width, height, transparent: true, dpi: 300 },
        style_preset: 'nature-2025',
        annotations: { functional_groups: true, charge_labels: 'minimal', atom_numbering: false, scale_bar: true, legend: 'auto' },
        ['3d']: { representation: 'cartoon+licorice', bg: 'transparent', camera: { target: 'auto', distance: 'auto', azimuth: 30, elevation: 15 }, lighting: 'three_point_soft', quality: 'raytrace_high' }
      };

      const spec = validateSpec(specInput);
      const id = specId(spec);
      const r = await fetch('/api/figure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(spec) });
      if (!r.ok) throw new Error(`submit failed: ${r.status}`);
      router.push(`/f/${id}`);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Research</h1>
      <p className="text-sm text-gray-600 mb-6">Create deterministic, shareable figures using FigureSpec v1. Submit a molecule and we will generate content-addressed 2D/3D assets.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Input kind</span>
            <select className="border rounded px-3 py-2 bg-white" value={inputKind} onChange={(e) => setInputKind(e.target.value as any)}>
              <option value="smiles">SMILES</option>
              <option value="name">Name</option>
              <option value="pdb">PDB</option>
            </select>
          </label>
          <label className="sm:col-span-2 flex flex-col gap-1">
            <span className="text-sm font-medium">Value</span>
            <input className="border rounded px-3 py-2" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Enter SMILES / name / PDB id" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Width (px)</span>
            <input type="number" className="border rounded px-3 py-2" value={width} onChange={(e) => setWidth(parseInt(e.target.value || '0', 10))} min={64} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Height (px)</span>
            <input type="number" className="border rounded px-3 py-2" value={height} onChange={(e) => setHeight(parseInt(e.target.value || '0', 10))} min={64} />
          </label>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
          {loading ? 'Submitting…' : 'Generate Figure'}
        </button>
      </form>
    </div>
  );
}


