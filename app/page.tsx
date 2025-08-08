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
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [isInteractive, setIsInteractive] = useState(false);
  const [alwaysFindMolecule, setAlwaysFindMolecule] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);
  const [moleculeInfo, setMoleculeInfo] = useState<MoleculeInfo | null>(null);
  const [moleculeType, setMoleculeType] = useState<'small molecule' | 'macromolecule' | undefined>(
    undefined
  );
  const [viewerKey] = useState(0);

  // Effect to handle when molecule is ready to render (hide loading overlay)
  useEffect(() => {
    if (
      showLoadingOverlay &&
      title &&
      (moleculeType === 'macromolecule' ? !!pdbData : !!(sdfData || pdbData))
    ) {
      // Delay to allow MoleculeViewer to initialize and render
      const timer = setTimeout(() => {
        setShowLoadingOverlay(false);
      }, 800); // Shorter delay - should be enough for Three.js to render
      return () => clearTimeout(timer);
    }
  }, [showLoadingOverlay, title, pdbData, sdfData, moleculeType]);

  // Load default sample molecule (from public/sample-molecules.json) on startup
  useEffect(() => {
    let cancelled = false;
    const loadDefaultFromSamples = async () => {
      setShowLoadingOverlay(true);
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
        // Don't set isLoading(false) here - let the useEffect handle it when molecule is ready

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
              setPdbData(
                result.pdb_data && result.pdb_data.trim().length > 0
                  ? result.pdb_data
                  : sample.pdbData || null
              );
              setSdfData(
                result.sdf && result.sdf.trim().length > 0 ? result.sdf : sample.sdfData || null
              );
              setTitle(result.name || sample.name);
              setMoleculeType(result.moleculeType || sample.type);
              setMoleculeInfo(
                (result.info as MoleculeInfo) || (sample.moleculeInfo as MoleculeInfo)
              );
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
      // Persist stable identifiers and info for deterministic restore
      ...(visualization?.moleculeType && { moleculeType: visualization.moleculeType }),
      ...(visualization?.name && { name: visualization.name }),
      ...(typeof visualization?.cid === 'number' && { cid: visualization.cid }),
      ...(visualization?.pdb_id && { pdbId: visualization.pdb_id }),
      ...(visualization?.info && { info: visualization.info as MoleculeInfo }),
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
      // Prefer refetch by stable identifiers (CID/PDB) via helper
      const recreatedEntry = await recreateVisualizationFromHistory(entry);
      if (recreatedEntry?.visualization) {
        const viz = recreatedEntry.visualization as VisualizationOutput;
        // Set SDF if present (small molecules), else rely on PDB
        setSdfData(viz.sdf || null);
        setPdbData(viz.pdb_data || '');
        setHtml(''); // clear HTML to force clean 3D render
        setTitle(entry.name || viz.title || entry.title || null);
        if (entry.moleculeType) setMoleculeType(entry.moleculeType);
        if (entry.info) setMoleculeInfo(entry.info as MoleculeInfo);
        setIsLoading(false);
        return;
      }

      // Fallback to stored visualization data if recreation fails
      if (entry.visualization) {
        setSdfData(entry.visualization.sdf || null);
        setPdbData(entry.visualization.pdb_data);
        setHtml('');
        setTitle(entry.name || (entry.visualization.title ?? null));
        if (entry.moleculeType) setMoleculeType(entry.moleculeType);
        if (entry.info) setMoleculeInfo(entry.info as MoleculeInfo);
      }
    } catch (error) {
      console.error('Failed to recreate visualization:', error);
      // Fallback to stored data
      if (entry.visualization) {
        setSdfData(entry.visualization.sdf || null);
        setPdbData(entry.visualization.pdb_data);
        setHtml('');
        setTitle(entry.name || (entry.visualization.title ?? null));
        if (entry.moleculeType) setMoleculeType(entry.moleculeType);
        if (entry.info) setMoleculeInfo(entry.info as MoleculeInfo);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Header
        onOpenTimeMachine={() => setIsTimeMachineOpen(true)}
        onSettingsChange={({ model: m, isInteractive: i, alwaysFindMolecule: af }) => {
          setModel(m);
          setIsInteractive(i);
          setAlwaysFindMolecule(af);
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
                alwaysFindMolecule={alwaysFindMolecule}
                {...(html && { currentHtml: html })}
                {...(title && { currentTitle: title })}
                onInfoUpdate={(info: unknown) => setMoleculeInfo(info as MoleculeInfo)}
                {...(moleculeInfo && { _moleculeInfo: moleculeInfo })}
              />
            </div>

            <div className="molecule-viewer-container">
              {showLoadingOverlay && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm z-10">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-400 border-t-transparent"></div>
                </div>
              )}
              {(moleculeType === 'macromolecule' ? !!pdbData : !!(sdfData || pdbData)) &&
                title &&
                (moleculeType === 'macromolecule' ? (
                  <MacromoleculeViewer3DMol
                    key={viewerKey}
                    pdbData={pdbData || ''}
                    title={title || ''}
                  />
                ) : (
                  <MoleculeViewer
                    key={viewerKey}
                    isLoading={isLoading}
                    pdbData={pdbData || ''}
                    {...(sdfData && { sdfData })}
                    title={title || ''}
                    {...(moleculeInfo && { moleculeInfo })}
                    {...(moleculeType && { moleculeType })}
                    enableRibbonOverlay={false}
                    enableHoverPause={false}
                    enableHoverGlow={false}
                    showHoverDebug={false}
                    showDebugWireframe={false}
                    onFirstFrameRendered={() => setShowLoadingOverlay(false)}
                    enableInteraction={isInteractive}
                  />
                ))}
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
