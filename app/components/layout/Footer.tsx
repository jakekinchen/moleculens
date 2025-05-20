import React from 'react';
import { LayoutWrapper } from './LayoutWrapper';

interface FooterProps {
  useConstraints?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ useConstraints = true }) => {
  return (
    <footer className="bg-gray-900 text-gray-400 py-2 px-4 border-t border-gray-800">
      <LayoutWrapper useConstraints={useConstraints}>
        <div className="container mx-auto text-center text-xs">
          <p>© {new Date().getFullYear()} Moleculens - Molecule Visualization Platform</p>
        </div>
      </LayoutWrapper>
    </footer>
  );
}; 