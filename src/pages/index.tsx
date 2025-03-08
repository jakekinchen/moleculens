import type { NextPage } from 'next';
import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LayoutWrapper } from '@/components/layout/LayoutWrapper';
import MoleculeViewer from '@/components/panels/MoleculeViewer';
import { InputPanel } from '@/components/panels/InputPanel';
import { TimeMachinePanel } from '@/components/panels/TimeMachinePanel';
import { HistoryEntry, VisualizationOutput } from '@/types';
import { loadHistoryFromSession, saveHistoryToSession } from '@/lib/utils';

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

const Home: NextPage = () => {
  const [currentHtml, setCurrentHtml] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [isInteractive, setIsInteractive] = useState(false);
  const [currentTitle, setCurrentTitle] = useState<string>('Propane (C3H8)');
  const [currentPdbData, setCurrentPdbData] = useState<string>(DEFAULT_PDB_DATA);
  const [useLayoutConstraints, setUseLayoutConstraints] = useState(true); // eslint-disable-line @typescript-eslint/no-unused-vars
  const usePubChem = true;

  // Load history from session storage on mount
  useEffect(() => {
    const savedHistory = loadHistoryFromSession();
    if (savedHistory?.length > 0) {
      setHistory(savedHistory);
    }
  }, []);

  // Save history to session storage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      saveHistoryToSession(history);
    }
  }, [history]);

  const handleVisualizationUpdate = (pdbData: string, html?: string, title?: string) => {
    setCurrentPdbData(pdbData);
    if (html) setCurrentHtml(html);
    if (title) {
      setCurrentTitle(title);
    } else {
      setCurrentTitle('Propane (C3H8)'); // Default back to initial title if none provided
    }
  };

  const handlePromptSubmit = (prompt: string, visualization?: VisualizationOutput) => {
    // Add to history when a prompt is submitted with its visualization data
    const newEntry: HistoryEntry = {
      prompt,
      timestamp: new Date(),
      visualization: visualization || (currentPdbData && {
        pdb_data: currentPdbData,
        html: currentHtml || '',
        title: currentTitle
      }),
      title: visualization?.title || currentTitle
    };
    
    setHistory(prev => [...prev, newEntry]);
  };

  const handleSelectFromHistory = (entry: HistoryEntry) => {
    setCurrentPrompt(entry.prompt);
    if (entry.visualization) {
      setCurrentPdbData(entry.visualization.pdb_data);
      setCurrentHtml(entry.visualization.html);
      setCurrentTitle(entry.visualization.title);
    }
  };

  const handleSettingsChange = (settings: { 
    model: string | null;
    isInteractive: boolean;
    usePubChem: boolean;
  }) => {
    setModel(settings.model);
    setIsInteractive(settings.isInteractive);
  };

  return (
    <div className="app-container">
      <Header 
        onOpenTimeMachine={() => setIsTimeMachineOpen(true)}
        onSettingsChange={handleSettingsChange}
        useConstraints={useLayoutConstraints}
      />
      <main className="main-content">
        <LayoutWrapper useConstraints={useLayoutConstraints}>
          <div className="panels-container">
            {/* Input Panel */}
            <div className="input-panel-container">
              <InputPanel 
                onVisualizationUpdate={handleVisualizationUpdate}
                onLoadingChange={setIsLoading}
                currentPrompt={currentPrompt}
                onPromptChange={setCurrentPrompt}
                onPromptSubmit={handlePromptSubmit}
                model={model}
                isInteractive={isInteractive}
                usePubChem={usePubChem}
                currentHtml={currentHtml}
                currentTitle={currentTitle}
              />
            </div>
            
            {/* Molecule Viewer */}
            <div className="molecule-viewer-container">
              <MoleculeViewer 
                isLoading={isLoading}
                pdbData={currentPdbData}
                title={currentTitle}
              />
            </div>
          </div>
        </LayoutWrapper>
      </main>
      <TimeMachinePanel
        isOpen={isTimeMachineOpen}
        onClose={() => setIsTimeMachineOpen(false)}
        history={history}
        onSelectEntry={handleSelectFromHistory}
      />
      <Footer useConstraints={useLayoutConstraints} />
    </div>
  );
};

// Clean, modern CSS using grid, flexbox, and CSS custom properties
const styles = `
  /* CSS custom properties for easy theming and adjustments */
  :root {
    --header-height: 60px;
    --footer-height: 60px;
    --padding: 1rem;
    --border-radius: 0.5rem;
    --bg-color: #111827; /* bg-gray-900 */
    --panel-gap: 1rem;
  }

  /* Base styles */
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    background-color: var(--bg-color);
    color: white;
  }

  /* Main app container - use CSS Grid for the overall layout */
  .app-container {
    display: grid;
    grid-template-rows: auto 1fr auto;
    min-height: 100vh;
    width: 100%;
    overflow: hidden;
  }

  /* Main content area */
  .main-content {
    padding: var(--padding);
    overflow: visible;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }

  /* When using layout constraints, adjust main-content padding */
  .main-content > div {
    margin: 0 auto;
    width: 100%;
    height: 100%;
  }

  /* Panel container - uses CSS Grid for responsive layout */
  .panels-container {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--panel-gap);
    height: 100%;
    flex: 1 1 auto;
    min-height: 0;
  }

  /* Input panel */
  .input-panel-container {
    overflow-y: auto;
    min-height: 150px;
  }

  /* Molecule viewer container */
  .molecule-viewer-container {
    position: relative;
    border-radius: var(--border-radius);
    background-color: rgba(255, 255, 255, 0.03);
    min-height: 250px;
    height: 100%;
    overflow: hidden;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
  }

  /* Footer */
  .footer-container {
    background-color: var(--bg-color);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 10;
  }

  /* Button group */
  .input-panel-container .button-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .input-panel-container .button-group button {
    flex: 1 1 calc(50% - 0.25rem);
  }

  /* Desktop layout - Wide screens (≥1024px) */
  @media (min-width: 1024px) {
    .panels-container {
      grid-template-columns: 1fr 3fr;
    }
    
    .input-panel-container {
      height: 100%;
    }
  }

  /* Tablet layout */
  @media (max-width: 1023px) and (min-width: 768px) {
    .panels-container {
      grid-template-rows: auto 1fr;
    }
  }

  /* Mobile layout */
  @media (max-width: 767px) {
    .panels-container {
      grid-template-rows: auto 1fr;
    }
  }

`;

const HomeWithStyles: NextPage = () => {
  return (
    <>
      <style >{styles}</style>
      <Home />
    </>
  );
};

export default HomeWithStyles;