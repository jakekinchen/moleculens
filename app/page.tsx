'use client';

import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { InputPanel } from './components/panels/InputPanel';
import MoleculeViewer from './components/panels/MoleculeViewer';
import { VisualizationOutput, HistoryEntry, MoleculeInfo } from './types';
import { LayoutWrapper } from './components/layout/LayoutWrapper';
import { TimeMachinePanel } from './components/panels/TimeMachinePanel';
import {
  saveHistoryToSession,
  loadHistoryFromSession,
  recreateVisualizationFromHistory,
} from './lib/utils';
// import { loadSampleMolecules, getDefaultMolecule } from './lib/sampleMolecules';

export default function HomePage() {
  const [pdbData, setPdbData] = useState<string | null>(null);
  const [sdfData, setSdfData] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [isInteractive, setIsInteractive] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);
  const [moleculeInfo, setMoleculeInfo] = useState<MoleculeInfo | null>(null);
  const [moleculeType, setMoleculeType] = useState<'small molecule' | 'macromolecule' | undefined>(
    undefined
  );

  // Load caffeine by default using API
  useEffect(() => {
    const loadDefaultMolecule = async () => {
      setIsLoading(true);
      try {
        console.log('[Default Load] Fetching caffeine via API...');
        const response = await fetch('/api/prompt/fetch-molecule-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: 'caffeine' }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[Default Load] Caffeine data received:', data);
          
          setPdbData(data.pdb_data);
          setSdfData(data.sdf);
          setTitle(data.name);
          setMoleculeType('small molecule');
          setMoleculeInfo(data.info || {
            formula: data.formula,
            formula_weight: 194.19,
            canonical_smiles: data.smiles,
          });
        } else {
          console.error('[Default Load] API response not ok:', response.status);
          throw new Error('Failed to fetch caffeine data');
        }
      } catch (error) {
        console.error('[Default Load] Error loading caffeine:', error);
        
        // Fallback to hardcoded propane data if API loading fails
        const fallbackPdbData = `COMPND    6334
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
        setPdbData(fallbackPdbData);
        setTitle('Propane (C3H8)');
        setMoleculeType('small molecule');
        setMoleculeInfo({
          formula: 'C3H8',
          formula_weight: 44.1,
          canonical_smiles: 'CCC',
          synonyms: ['Propane', 'n-Propane', 'Dimethylmethane'],
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadDefaultMolecule();
  }, []);

  const handleVisualizationUpdate = (
    pdb: string,
    htmlContent?: string,
    vizTitle?: string,
    sdf?: string,
    moleculeTypeFromAPI?: 'small molecule' | 'macromolecule'
  ) => {
    setPdbData(pdb);
    setMoleculeType(moleculeTypeFromAPI);

    // Smart SDF data handling based on molecule type
    if (sdf && sdf.trim().length > 0) {
      // Explicit SDF data provided
      setSdfData(sdf);
    } else if (moleculeTypeFromAPI === 'small molecule' && /V2000|M {2}END/.test(pdb)) {
      // Only convert PDB to SDF for small molecules when it contains SDF markers
      setSdfData(pdb);
    } else {
      // For macromolecules or when no SDF markers, don't set SDF data
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
      ...(visualization && { visualization }),
      ...(visualization?.title && { title: visualization.title }),
      // Store API parameters to recreate this visualization
      apiParams: {
        endpoint: '/api/prompt/fetch-molecule-data',
        query: promptText,
        ...(model && { model }),
        interactive: isInteractive,
        pubchem: true, // Currently always true in this app
      },
    };
    setHistory(prev => [entry, ...prev]);
  };

  const handleSelectHistory = async (entry: HistoryEntry) => {
    setIsTimeMachineOpen(false);
    setPrompt(entry.prompt);
    setIsLoading(true);

    try {
      // Try to recreate visualization from API parameters first
      if (entry.apiParams) {
        const recreatedEntry = await recreateVisualizationFromHistory(entry);
        if (recreatedEntry?.visualization) {
          setPdbData(recreatedEntry.visualization.pdb_data);
          setHtml(recreatedEntry.visualization.html);
          setTitle(recreatedEntry.visualization.title ?? null);
          setIsLoading(false);
          return;
        }
      }

      // Fallback to stored visualization data if recreation fails
      if (entry.visualization) {
        setPdbData(entry.visualization.pdb_data);
        setHtml(entry.visualization.html);
        setTitle(entry.visualization.title ?? null);
      }
    } catch (error) {
      console.error('Failed to recreate visualization:', error);
      // Fallback to stored data
      if (entry.visualization) {
        setPdbData(entry.visualization.pdb_data);
        setHtml(entry.visualization.html);
        setTitle(entry.visualization.title ?? null);
      }
    } finally {
      setIsLoading(false);
    }
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
                {...(html && { currentHtml: html })}
                {...(title && { currentTitle: title })}
                onInfoUpdate={(info: unknown) => setMoleculeInfo(info as MoleculeInfo)}
                {...(moleculeInfo && { _moleculeInfo: moleculeInfo })}
              />
            </div>

            <div className="molecule-viewer-container">
              {pdbData && title && (
                <MoleculeViewer
                  isLoading={isLoading}
                  pdbData={pdbData}
                  {...(sdfData && { sdfData })}
                  title={title}
                  {...(moleculeInfo && { moleculeInfo })}
                  {...(moleculeType && { moleculeType })}
                  enableRibbonOverlay={false}
                  enableHoverPause={false}
                  enableHoverGlow={false}
                  showHoverDebug={false}
                  showDebugWireframe={false}
                />
              )}
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
