import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75" onClick={onClose} />

        <div className="relative inline-block w-full max-w-2xl p-6 overflow-hidden text-left align-middle transition-all transform bg-gray-800 rounded-lg shadow-xl">
          <div className="absolute top-4 right-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <h2 className="text-2xl font-semibold mb-4 text-white">
            Welcome to SciVizAI
          </h2>

          <div className="space-y-4 text-gray-300">
            <p>
              SciVizAI helps you learn chemistry through interactive 3D visualizations. 
              Simply describe what you want to learn about, and we&apos;ll generate a 3D model 
              that you can explore.
            </p>

            <h3 className="text-lg font-semibold text-white mt-6">How to use:</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>Type what you want to learn about (or use &quot;Suggest Random Topic&quot;)</li>
              <li>Click &quot;Learn&quot; to generate a 3D visualization</li>
              <li>Interact with the model:
                <ul className="list-disc list-inside ml-6 mt-1 text-gray-400">
                  <li>Click and drag to rotate</li>
                  <li>Scroll to zoom in/out</li>
                  <li>Right-click and drag to pan</li>
                </ul>
              </li>
              <li>Use the expand button to view the model in full screen</li>
              <li>Download the visualization to view it offline</li>
            </ol>

            <p className="mt-6">
              Try starting with simple molecules like &quot;water&quot; or &quot;methane&quot; and work your 
              way up to more complex structures!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}; 