import React from 'react';
import { BeakerIcon } from '@heroicons/react/24/solid';

export const Header = () => {
  return (
    <header className="bg-gradient-to-r from-blue-900 to-purple-900 text-white py-2 px-4 shadow-lg">
      <div className="container mx-auto flex items-center gap-3">
        <div className="w-6 h-6">
          <BeakerIcon className="w-full h-full text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">SciVizAI</h1>
          <p className="text-xs opacity-80">Let&apos;s make science visual</p>
        </div>
      </div>
    </header>
  );
}; 