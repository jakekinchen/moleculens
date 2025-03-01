import React from 'react';

export const Footer = () => {
  return (
    <footer className="bg-gray-900 text-gray-400 py-2 px-4 border-t border-gray-800">
      <div className="container mx-auto text-center text-xs">
        <p>© {new Date().getFullYear()} SciVizAI - Scientific Visualization Platform</p>
      </div>
    </footer>
  );
}; 