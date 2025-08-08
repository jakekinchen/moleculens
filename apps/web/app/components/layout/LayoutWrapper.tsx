import React from 'react';

interface LayoutWrapperProps {
  children: React.ReactNode;
  useConstraints?: boolean;
}

export const LayoutWrapper: React.FC<LayoutWrapperProps> = ({ 
  children, 
  useConstraints = true 
}) => {
  return (
    <div className={`w-full ${useConstraints ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' : ''}`}>
      {children}
    </div>
  );
}; 