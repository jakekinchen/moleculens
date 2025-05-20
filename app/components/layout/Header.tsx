import React, { useState } from 'react';
import { BeakerIcon } from '@heroicons/react/24/solid';
import { QuestionMarkCircleIcon, Cog6ToothIcon, ClockIcon } from '@heroicons/react/24/outline';
import { HelpModal } from '../modals/HelpModal';
import { SettingsModal } from '../modals/SettingsModal';
import { LayoutWrapper } from './LayoutWrapper';

interface HeaderProps {
  onOpenTimeMachine: () => void;
  onSettingsChange: (settings: { 
    model: string | null;
    isInteractive: boolean;
    usePubChem: boolean;
  }) => void;
  useConstraints?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenTimeMachine, onSettingsChange, useConstraints = true }) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  const [isInteractive, setIsInteractive] = useState(false);
  const usePubChem = true;

  const handleModelChange = (newModel: string | null) => {
    setModel(newModel);
    onSettingsChange({ model: newModel, isInteractive, usePubChem });
  };

  const handleInteractiveChange = (newIsInteractive: boolean) => {
    setIsInteractive(newIsInteractive);
    onSettingsChange({ model, isInteractive: newIsInteractive, usePubChem });
  };

  return (
    <header className="bg-gradient-to-r from-blue-900 to-purple-900 text-white py-2 px-4 shadow-lg">
      <LayoutWrapper useConstraints={useConstraints}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-5 h-5 sm:w-6 sm:h-6">
              <BeakerIcon className="w-full h-full text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold">MolecuLens</h1>
              <p className="text-xs opacity-80 hidden sm:block">Let&apos;s make science visual</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setIsHelpOpen(true)}
              className="p-1.5 sm:p-2 text-gray-200 hover:text-white transition-colors rounded-full hover:bg-white/10"
              aria-label="Help"
            >
              <QuestionMarkCircleIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={onOpenTimeMachine}
              className="p-1.5 sm:p-2 text-gray-200 hover:text-white transition-colors rounded-full hover:bg-white/10"
              aria-label="Time Machine"
            >
              <ClockIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 sm:p-2 text-gray-200 hover:text-white transition-colors rounded-full hover:bg-white/10"
              aria-label="Settings"
            >
              <Cog6ToothIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          <HelpModal 
            isOpen={isHelpOpen} 
            onClose={() => setIsHelpOpen(false)} 
          />
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            model={model}
            setModel={handleModelChange}
            isInteractive={isInteractive}
            setIsInteractive={handleInteractiveChange}
            _usePubChem={usePubChem}
            _setUsePubChem={() => {}}
          />
        </div>
      </LayoutWrapper>
    </header>
  );
}; 