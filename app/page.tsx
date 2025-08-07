'use client';

import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { InputPanel } from './components/panels/InputPanel';
import MoleculeViewer from './components/panels/MoleculeViewer';
import dynamic from 'next/dynamic';
const MacromoleculeViewer3DMol = dynamic(
  () => import('@/components/panels/MacromoleculeViewer3DMol'),
  { ssr: false }
);
import { VisualizationOutput, HistoryEntry, MoleculeInfo } from './types';
import { LayoutWrapper } from './components/layout/LayoutWrapper';
import { TimeMachinePanel } from './components/panels/TimeMachinePanel';
import { loadSampleMolecules, getDefaultMolecule, getMoleculeByKey } from './lib/sampleMolecules';
import { fetchMoleculeData } from './services/api';
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
  const [viewerKey, setViewerKey] = useState(0);

  // Load default sample molecule (from public/sample-molecules.json) on startup
  useEffect(() => {
    let cancelled = false;
    const loadDefaultFromSamples = async () => {
      setIsLoading(true);
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[HomePage] Loading default sample molecules');
        }
        const data = await loadSampleMolecules();
        if (!data) return;
        const sample = getDefaultMolecule(data) || getMoleculeByKey(data, 'caffeine');
        if (!sample) return;
        if (cancelled) return;
        // Mount immediately with bundled sample; viewer will prefer SDF
        setPdbData(sample.pdbData || null);
        setSdfData(sample.sdfData || null);
        setTitle(sample.name);
        setMoleculeType(sample.type);
        setMoleculeInfo(sample.moleculeInfo as MoleculeInfo);
        setIsLoading(false);

        // In the background, optionally refresh from backend only if sample lacks SDF/PDB
        const sampleHasSDF = !!(sample.sdfData && sample.sdfData.trim().length > 0);
        const sampleHasPDB = !!(sample.pdbData && sample.pdbData.trim().length > 0);
        const shouldRefresh = !sampleHasSDF || !sampleHasPDB;
        const query = sample.apiSource?.query || sample.name;
        if (shouldRefresh && query) {
          fetchMoleculeData(query)
            .then(result => {
              if (cancelled || !result) return;
              if (process.env.NODE_ENV !== 'production') {
                console.log('[HomePage] Startup backend refresh complete');
              }
              setPdbData(result.pdb_data && result.pdb_data.trim().length > 0 ? result.pdb_data : sample.pdbData || null);
              setSdfData(result.sdf && result.sdf.trim().length > 0 ? result.sdf : sample.sdfData || null);
              setTitle(result.name || sample.name);
              setMoleculeType(result.moleculeType || sample.type);
              setMoleculeInfo((result.info as MoleculeInfo) || (sample.moleculeInfo as MoleculeInfo));
            })
            .catch(err => {
              if (process.env.NODE_ENV !== 'production') {
                console.warn('[HomePage] Backend fetch for default sample failed (ignored)', err);
              }
            });
        }
      } catch (e) {
        console.error('Failed to load default sample molecule:', e);
      } finally {
        // isLoading is already set to false after mounting sample
      }
    };
    loadDefaultFromSamples();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVisualizationUpdate = (
    pdb: string,
    htmlContent?: string,
    vizTitle?: string,
    sdf?: string,
    moleculeTypeFromAPI?: 'small molecule' | 'macromolecule'
  ) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[HomePage] Visualization update', {
        hasPDB: !!pdb,
        hasSDF: !!sdf,
        moleculeTypeFromAPI,
      });
    }
    setPdbData(pdb);
    setMoleculeType(moleculeTypeFromAPI);
    // Only use explicit SDF data if provided; do not attempt PDB→SDF conversion
    if (sdf && sdf.trim().length > 0) setSdfData(sdf);
    else setSdfData(null);
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
              {!isLoading && pdbData && title && (
                moleculeType === 'macromolecule' ? (
                  <MacromoleculeViewer3DMol
                    key={viewerKey}
                    pdbData={pdbData}
                    title={title}
                  />
                ) : (
                  <MoleculeViewer
                    key={viewerKey}
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
                )
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
