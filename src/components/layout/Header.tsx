import React from 'react';
import { BeakerIcon } from '@heroicons/react/24/solid';

export const Header = () => {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 shadow-lg">
      <div className="container mx-auto flex items-center gap-4">
        <div className="w-8 h-8">
          <BeakerIcon className="w-full h-full text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">SciVizAI</h1>
          <p className="text-sm opacity-80">Interactive Scientific Visualization</p>
        </div>
      </div>
    </header>
  );
}; 