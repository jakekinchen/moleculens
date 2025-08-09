"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { interpretQueryToMoleculeName } from '@/lib/llm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputKindToggle, type InputKind } from '@/components/research/InputKindToggle';
import { ExampleChips } from '@/components/research/ExampleChips';
import { AdvancedOptions } from '@/components/research/AdvancedOptions';

export default function ResearchPage() {
  const router = useRouter();
  const [inputKind, setInputKind] = useState<InputKind>('smiles');
  const [inputValue, setInputValue] = useState('CC(=O)Oc1ccccc1C(=O)O');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(768);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useLLMExtraction, setUseLLMExtraction] = useState(true);
  const [modes, setModes] = useState<Array<'2d' | '3d'>>(['2d', '3d']);
  const [outputs, setOutputs] = useState<Array<'svg' | 'png'>>(['svg', 'png']);
  const [aspectLocked, setAspectLocked] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Minimal placeholder payload until FigureSpec utilities are ported
      let effectiveValue = inputValue;
      if (inputKind === 'name' && useLLMExtraction) {
        try {
          const extracted = await interpretQueryToMoleculeName(inputValue);
          if (extracted && extracted.trim()) effectiveValue = extracted.trim();
        } catch (e: any) {
          // Non-fatal: fall back to raw input
          console.warn('LLM extraction failed, using raw input:', e?.message || e);
        }
      }

      const spec: any = {
        version: 1,
        input: { kind: inputKind, value: effectiveValue, conformer_method: 'etkdg' },
        render: { modes, outputs, width, height, dpi: 300, transparent: true },
        style_preset: 'default',
        annotations: {},
        "3d": {},
      };
      const r = await fetch('/api/figure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spec),
      });
      if (!r.ok) throw new Error(`submit failed: ${r.status}`);
      const { spec_id } = await r.json();
      router.push(`/f/${spec_id}`);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0b0f1a] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Research</h1>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl">
            Create deterministic, shareable figures. Submit a molecule and we will generate
            content-addressed 2D/3D assets.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Form */}
          <form
            onSubmit={onSubmit}
            className="space-y-6 rounded-xl border border-white/10 bg-white/5 p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Input</div>
                <div className="text-xs text-gray-300">SMILES, chemical name, or PDB ID</div>
              </div>
              <InputKindToggle value={inputKind} onChange={setInputKind} />
            </div>

            <div>
              <Input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O or caffeine or 1CRN"
                className="bg-white text-gray-900"
              />
              {inputKind === 'name' && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={useLLMExtraction}
                      onCheckedChange={setUseLLMExtraction}
                      aria-label="Use AI to interpret complex prompts"
                    />
                    <span className="text-gray-200">Use AI to interpret prompt</span>
                  </div>
                  <span className="text-xs text-gray-400">Tries to extract a molecule name</span>
                </div>
              )}
            </div>

            <AdvancedOptions
              width={width}
              height={height}
              setWidth={setWidth}
              setHeight={setHeight}
              modes={modes}
              setModes={setModes}
              outputs={outputs}
              setOutputs={setOutputs}
              aspectLocked={aspectLocked}
              setAspectLocked={setAspectLocked}
            />

            {error && (
              <Alert variant="destructive" className="bg-red-950/30 border-red-500/30">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading || !inputValue.trim()}>
                {loading ? 'Generating…' : 'Generate Figure'}
              </Button>
              <span className="text-xs text-gray-400">Press Enter to submit</span>
            </div>
          </form>

          {/* Right: Examples and info */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-6">
            <div>
              <div className="text-sm font-medium mb-2">What you&apos;ll get</div>
              <ul className="text-sm text-gray-300 list-disc pl-5 space-y-1">
                <li>Content-addressed figure URL for reproducibility</li>
                <li>2D and 3D render targets based on your selection</li>
                <li>SVG and PNG outputs at your chosen resolution</li>
              </ul>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Try an example</div>
              <ExampleChips
                onSelect={(kind, value) => {
                  setInputKind(kind);
                  setInputValue(value);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


