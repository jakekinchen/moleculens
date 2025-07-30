'use client';

import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { InputPanel } from './components/panels/InputPanel';
import MoleculeViewer from './components/panels/MoleculeViewer';
import { VisualizationOutput, HistoryEntry, MoleculeInfo } from './types';
import { LayoutWrapper } from './components/layout/LayoutWrapper';
import { TimeMachinePanel } from './components/panels/TimeMachinePanel';
import { saveHistoryToSession, loadHistoryFromSession } from './lib/utils';

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
  const [sdfData, setSdfData] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>('Propane (C3H8)');
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [isInteractive, setIsInteractive] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);
  const [moleculeInfo, setMoleculeInfo] = useState<MoleculeInfo | null>({
    formula: 'C3H8',
    formula_weight: 44.1,
    canonical_smiles: 'CCC',
    synonyms: ['Propane', 'n-Propane', 'Dimethylmethane'],
  });

  const handleVisualizationUpdate = (pdb: string, htmlContent?: string, vizTitle?: string) => {
    setPdbData(pdb);
    // Heuristic: treat data as SDF if it contains 'V2000' marker
    if (/V2000|M {2}END/.test(pdb)) {
      setSdfData(pdb);
    } else {
      setSdfData(null);
    }
    setHtml(htmlContent ?? null);
    setTitle(vizTitle ?? null);
  };

  useEffect(() => {
    setHistory(loadHistoryFromSession());
  }, []);

  useEffect(() => {
    saveHistoryToSession(history);
  }, [history]);

  const handlePromptSubmit = (promptText: string, visualization?: VisualizationOutput) => {
    const entry: HistoryEntry = {
      prompt: promptText,
      timestamp: new Date(),
      visualization,
      title: visualization?.title,
    };
    setHistory(prev => [entry, ...prev]);
  };

  const handleSelectHistory = (entry: HistoryEntry) => {
    if (entry.visualization) {
      setPdbData(entry.visualization.pdb_data);
      setHtml(entry.visualization.html);
      setTitle(entry.visualization.title ?? null);
    }
    setPrompt(entry.prompt);
    setIsTimeMachineOpen(false);
  };

  return (
    <div className="app-container">
      <Header
        onOpenTimeMachine={() => setIsTimeMachineOpen(true)}
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
                onInfoUpdate={(info: unknown) => setMoleculeInfo(info as MoleculeInfo)}
                _moleculeInfo={moleculeInfo ?? undefined}
              />
            </div>

            <div className="molecule-viewer-container">
              <MoleculeViewer
                isLoading={isLoading}
                pdbData={pdbData!}
                sdfData={sdfData ?? undefined}
                title={title!}
                moleculeInfo={moleculeInfo ?? undefined}
                enableRibbonOverlay={false}
              />
            </div>
          </div>
        </LayoutWrapper>
      </main>
      <Footer />
      <TimeMachinePanel
        isOpen={isTimeMachineOpen}
        onClose={() => setIsTimeMachineOpen(false)}
        history={history}
        onSelectEntry={handleSelectHistory}
      />
    </div>
  );
}
