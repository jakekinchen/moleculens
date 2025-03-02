import type { NextPage } from 'next';
import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { VisualizationPanel } from '@/components/panels/VisualizationPanel';
import { InputPanel } from '@/components/panels/InputPanel';
import { TimeMachinePanel } from '@/components/panels/TimeMachinePanel';

const Home: NextPage = () => {
  const [currentScript, setCurrentScript] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ prompt: string; timestamp: Date }>>([]);
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('o3-mini');
  const [useInteractiveMode, setUseInteractiveMode] = useState(false);
  const [geometryModel, setGeometryModel] = useState<string | undefined>(undefined);
  const [animationModel, setAnimationModel] = useState<string | undefined>(undefined);

  const handlePromptSubmit = (prompt: string) => {
    // Add to history when a prompt is submitted
    setHistory(prev => [...prev, { prompt, timestamp: new Date() }]);
  };

  const handleSettingsChange = (settings: { 
    selectedModel: string; 
    useInteractiveMode: boolean;
    geometryModel?: string;
    animationModel?: string;
  }) => {
    setSelectedModel(settings.selectedModel);
    setUseInteractiveMode(settings.useInteractiveMode);
    setGeometryModel(settings.geometryModel);
    setAnimationModel(settings.animationModel);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Header 
        onOpenTimeMachine={() => setIsTimeMachineOpen(true)}
        onSettingsChange={handleSettingsChange}
      />
      <main className="container mx-auto px-2 py-4 flex-grow">
        <div className="grid grid-cols-12 gap-2 h-[calc(100vh-8rem)]">
          <div className="col-span-3">
            <InputPanel 
              onVisualizationUpdate={setCurrentScript}
              onLoadingChange={setIsLoading}
              currentPrompt={currentPrompt}
              onPromptChange={setCurrentPrompt}
              onPromptSubmit={handlePromptSubmit}
              selectedModel={selectedModel}
              useInteractiveMode={useInteractiveMode}
              geometryModel={geometryModel}
              animationModel={animationModel}
            />
          </div>
          <div className="col-span-9 relative">
            <VisualizationPanel 
              script={currentScript}
              isLoading={isLoading}
              useInteractiveMode={useInteractiveMode}
            />
          </div>
        </div>
      </main>
      <TimeMachinePanel
        isOpen={isTimeMachineOpen}
        onClose={() => setIsTimeMachineOpen(false)}
        history={history}
        onSelectPrompt={setCurrentPrompt}
      />
      <Footer />
    </div>
  );
};

export default Home; 