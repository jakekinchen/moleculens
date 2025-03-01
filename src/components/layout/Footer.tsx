import React from 'react';

export const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white py-4 px-6">
      <div className="container mx-auto text-center text-sm">
        <p>© {new Date().getFullYear()} SciVizAI - Scientific Visualization Platform</p>
      </div>
    </footer>
  );
}; 