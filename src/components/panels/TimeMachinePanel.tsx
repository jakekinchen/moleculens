import React from 'react';
import { XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';

interface HistoryEntry {
  prompt: string;
  timestamp: Date;
}

interface TimeMachinePanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onSelectPrompt: (prompt: string) => void;
}

export const TimeMachinePanel: React.FC<TimeMachinePanelProps> = ({
  isOpen,
  onClose,
  history,
  onSelectPrompt,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-gray-800 shadow-xl z-40 transform transition-transform duration-300 ease-in-out">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2 text-white">
            <ClockIcon className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Time Machine</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4">
          {history.length === 0 ? (
            <div className="text-gray-400 text-center mt-4">
              No history yet. Start learning!
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry, index) => (
                <button
                  key={index}
                  onClick={() => onSelectPrompt(entry.prompt)}
                  className="w-full text-left p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors group"
                >
                  <p className="text-white line-clamp-2 group-hover:text-blue-300 transition-colors">
                    {entry.prompt}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {entry.timestamp.toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 