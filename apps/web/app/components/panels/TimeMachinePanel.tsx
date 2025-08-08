import React, { useEffect, useRef } from 'react';
import { XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';
import { HistoryEntry } from '../../types';

interface TimeMachinePanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onSelectEntry: (entry: HistoryEntry) => void;
}

export const TimeMachinePanel: React.FC<TimeMachinePanelProps> = ({
  isOpen,
  onClose,
  history,
  onSelectEntry,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="time-machine-title"
    >
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-full sm:w-80 bg-gray-800 shadow-xl z-40 transform transition-transform duration-300 ease-in-out"
        aria-describedby="time-machine-description"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700">
            <div className="flex items-center gap-2 text-white">
              <ClockIcon className="w-5 h-5" />
              <h2 id="time-machine-title" className="text-lg font-semibold">Time Machine</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 transition-colors"
              aria-label="Close time machine"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div id="time-machine-description" className="sr-only">
            View and restore previous molecule visualizations from your history
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
                    onClick={() => onSelectEntry(entry)}
                    className="w-full text-left p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors group"
                    aria-label={`Restore visualization from ${entry.timestamp.toLocaleString()}`}
                  >
                    <p className="text-white line-clamp-2 group-hover:text-blue-300 transition-colors">
                      {entry.prompt}
                    </p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-gray-400">
                        {entry.timestamp.toLocaleString()}
                      </p>
                      {entry.visualization && (
                        <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                          Saved
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 