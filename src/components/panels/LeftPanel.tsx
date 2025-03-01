import React from 'react';

interface LeftPanelProps {
  content?: string;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ content }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full overflow-y-auto">
      <h2 className="text-xl font-semibold mb-4">Information</h2>
      <div className="prose prose-sm max-w-none">
        {content || 'Select a topic to begin learning about chemical structures and reactions.'}
      </div>
    </div>
  );
}; 