'use client';

import React, { useState } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { InputPanel } from './components/panels/InputPanel';
import MoleculeViewer from './components/panels/MoleculeViewer';
import { VisualizationOutput } from './types';
import { LayoutWrapper } from './components/layout/LayoutWrapper';

export default function HomePage() {
  // Default molecule data (Propane)
  const DEFAULT_PDB_DATA = `COMPND    6334
HETATM    1  C1  UNL     1       2.872  -0.474   0.000  1.00  0.00           C  
HETATM    2  C2  UNL     1       4.171   0.269   0.000  1.00  0.00           C  
HETATM    3  C3  UNL     1       1.558   0.243   0.000  1.00  0.00           C  
HETATM    4  H1  UNL     1       2.314  -1.434   0.000  1.00  0.00           H  
HETATM    5  H2  UNL     1       3.448  -1.423   0.000  1.00  0.00           H  
HETATM    6  H3  UNL     1       5.021  -0.413   0.000  1.00  0.00           H  
HETATM    7  H4  UNL     1       4.946   1.061   0.000  1.00  0.00           H  
HETATM    8  H5  UNL     1       3.747   1.272   0.000  1.00  0.00           H  
HETATM    9  H6  UNL     1       1.962   1.254   0.000  1.00  0.00           H  
HETATM   10  H7  UNL     1       0.767   1.019   0.000  1.00  0.00           H  
HETATM   11  H8  UNL     1       0.722  -0.455   0.000  1.00  0.00           H  
CONECT    1    2    3    4    5
CONECT    2    6    7    8
CONECT    3    9   10   11
END`;

  const [pdbData, setPdbData] = useState<string | null>(DEFAULT_PDB_DATA);
  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>('Propane (C3H8)');
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
    <div className="app-container">
      <Header
        onOpenTimeMachine={() => {}}
        onSettingsChange={({ model: m, isInteractive: i }) => {
          setModel(m);
          setIsInteractive(i);
        }}
        useConstraints={true}
      />
      <main className="main-content">
        <LayoutWrapper useConstraints={true}>
          <div className="panels-container">
            <div className="input-panel-container">
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

            <div className="molecule-viewer-container">
              <MoleculeViewer
                isLoading={isLoading}
                pdbData={pdbData!}
                title={title!}
              />
            </div>
          </div>
        </LayoutWrapper>
      </main>
      <Footer />
    </div>
  );
} 