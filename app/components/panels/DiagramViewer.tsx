import React from 'react';
import { DiagramPlan } from '../../types';

interface DiagramViewerProps {
  isLoading?: boolean;
  diagramImage?: string;
  diagramPlan?: DiagramPlan;
}

const DiagramViewer: React.FC<DiagramViewerProps> = ({
  isLoading = false,
  diagramImage,
  diagramPlan,
}) => {
  return (
    <div className="w-full h-full flex flex-col gap-2 overflow-auto p-2">
      {isLoading && <p>Loading...</p>}
      {!isLoading && diagramImage && (
        <div className="w-full" dangerouslySetInnerHTML={{ __html: diagramImage }} />
      )}
      {!isLoading && !diagramImage && (
        <p className="text-sm text-gray-500">No diagram generated.</p>
      )}
      {diagramPlan && (
        <details className="mt-2 text-xs whitespace-pre-wrap">
          <summary className="cursor-pointer">Plan (debug)</summary>
          <pre>{JSON.stringify(diagramPlan, null, 2)}</pre>
        </details>
      )}
    </div>
  );
};

export default DiagramViewer;
