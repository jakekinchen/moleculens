import React, { useState } from 'react';
import { BeakerIcon } from '@heroicons/react/24/solid';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { HelpModal } from '../modals/HelpModal';

export const Header = () => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <header className="bg-gradient-to-r from-blue-900 to-purple-900 text-white py-2 px-4 shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6">
            <BeakerIcon className="w-full h-full text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">SciVizAI</h1>
            <p className="text-xs opacity-80">Let&apos;s make science visual</p>
          </div>
        </div>

        <button
          onClick={() => setIsHelpOpen(true)}
          className="p-2 text-gray-200 hover:text-white transition-colors rounded-full hover:bg-white/10"
          aria-label="Help"
        >
          <QuestionMarkCircleIcon className="w-6 h-6" />
        </button>

        <HelpModal 
          isOpen={isHelpOpen} 
          onClose={() => setIsHelpOpen(false)} 
        />
      </div>
    </header>
  );
}; 