import React from 'react';
import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';

// Dynamically import components to avoid SSR issues
const SimpleVisualization = dynamic(() => import('./SimpleVisualization'), { ssr: false });
const ComplexVisualization = dynamic(() => import('./ComplexVisualization'), { ssr: false });

interface VisualizationRendererProps {
  isInteractiveMode: boolean;
  data: {
    result?: string;
    html?: string;
    js?: string;
    title?: string;
  };
}

export const VisualizationRenderer: React.FC<VisualizationRendererProps> = ({ 
  isInteractiveMode, 
  data 
}) => {
  if (!data) return null;

  return (
    <div className="w-full h-full">
      {isInteractiveMode && data.html && data.js && data.title ? (
        <ComplexVisualization data={data as Required<typeof data>} />
      ) : (
        <Canvas>
          <SimpleVisualization geometryCode={data.result || ''} />
        </Canvas>
      )}
    </div>
  );
}; 