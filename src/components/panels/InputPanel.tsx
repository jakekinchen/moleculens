import React, { useState } from 'react';
import { submitPrompt } from '@/services/api';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface InputPanelProps {
  onVisualizationUpdate: (script: string) => void;
}

export const InputPanel: React.FC<InputPanelProps> = ({ onVisualizationUpdate }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentScript, setCurrentScript] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await submitPrompt(query);
      setCurrentScript(response.html);
      onVisualizationUpdate(response.html);
    } catch (error) {
      console.error('Failed to get visualization:', error);
      // TODO: Add error handling UI
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!currentScript) return;
    const blob = new Blob([currentScript], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'visualization.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-3 h-full border border-gray-700 flex flex-col">
      <h2 className="text-lg font-semibold mb-3 text-white">Learn</h2>
      <form onSubmit={handleSubmit} className="space-y-3 flex-grow">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-32 p-2 bg-gray-700 border-gray-600 rounded-lg resize-none 
            focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
          placeholder="What would you like to learn about? (e.g., 'teach me about water molecules')"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 
            transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Loading...' : 'Learn'}
        </button>
      </form>

      <div className="space-y-2 mt-3 pt-3 border-t border-gray-700">
        {currentScript && (
          <>
            <div className="flex gap-2 mb-2">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 text-gray-200 py-2 px-3 rounded-lg 
                  hover:bg-gray-600 transition focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Download Visualization 
              </button>
            </div>
            <button
              type="button"
              className="w-full bg-gray-700 text-gray-200 py-2 px-3 rounded-lg hover:bg-gray-600 
                transition focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              Quiz Me
            </button>
          </>
        )}
        <button
          type="button"
          className="w-full bg-gray-700 text-gray-200 py-2 px-3 rounded-lg hover:bg-gray-600 
            transition focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        >
          Suggest Topic
        </button>
      </div>
    </div>
  );
}; 