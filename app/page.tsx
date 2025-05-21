'use client';

import React, { useState } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { InputPanel } from './components/panels/InputPanel';
import MoleculeViewer from './components/panels/MoleculeViewer';
import { VisualizationOutput } from './types';

export default function HomePage() {
  const [pdbData, setPdbData] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [isInteractive, setIsInteractive] = useState(false);

  const handleVisualizationUpdate = (pdb: string, htmlContent?: string, vizTitle?: string) => {
    setPdbData(pdb);
    setHtml(htmlContent ?? null);
    setTitle(vizTitle ?? null);
  };

  const handlePromptSubmit = (_prompt: string, _visualization?: VisualizationOutput) => {
    // Currently no-op; could add history or analytics here.
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header
        onOpenTimeMachine={() => {}}
        onSettingsChange={({ model: m, isInteractive: i }) => {
          setModel(m);
          setIsInteractive(i);
        }}
        useConstraints={false}
      />

      <main className="flex-1 flex flex-col sm:flex-row gap-4 p-4 bg-gradient-to-b from-gray-800 to-gray-900">
        <div className="w-full sm:w-1/3">
          <InputPanel
            onVisualizationUpdate={handleVisualizationUpdate}
            onLoadingChange={setIsLoading}
            currentPrompt={prompt}
            onPromptChange={setPrompt}
            onPromptSubmit={handlePromptSubmit}
            model={model}
            isInteractive={isInteractive}
            usePubChem={true}
            currentHtml={html ?? undefined}
            currentTitle={title ?? undefined}
          />
        </div>

        <div className="w-full sm:w-2/3">
          {pdbData && title ? (
            <MoleculeViewer isLoading={isLoading} pdbData={pdbData} title={title} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No visualization generated.
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
} 