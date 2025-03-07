import React, { useState, useRef, useEffect } from 'react';
import { submitPrompt, pollJobStatus, legacySubmitPrompt, generateFromPubChem } from '@/services/api';
import { ArrowDownTrayIcon, ExclamationTriangleIcon, BeakerIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { VisualizationOutput } from '@/types';
import CHEMISTRY_TOPICS from './chemistry_topics';

// Import the VisualizationData interface from the API file
interface VisualizationData {
  html: string;
  pdb_data: string;
  title: string;
  timecode_markers: string[];
  total_elements: number;
}

interface InputPanelProps {
  onVisualizationUpdate: (pdbData: string, html?: string, title?: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
  currentPrompt: string;
  onPromptChange: (prompt: string) => void;
  onPromptSubmit: (prompt: string, visualization?: VisualizationOutput) => void;
  model: string | null;
  isInteractive: boolean;
  usePubChem?: boolean;
  currentHtml?: string;
  currentTitle?: string;
}

// Update the JobStatusResponse interface to include legacy fields
interface ExtendedJobStatusResponse {
  job_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  visualization?: VisualizationData;
  error?: string;
  // Legacy fields
  pdb_data?: string;
  result_html?: string;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  onVisualizationUpdate,
  onLoadingChange,
  currentPrompt,
  onPromptChange,
  onPromptSubmit,
  model,
  isInteractive,
  usePubChem,
  currentHtml: initialHtml,
  currentTitle: initialTitle
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentScript, setCurrentScript] = useState<string | null>(null);
  const [currentHtml, setCurrentHtml] = useState<string | null>(initialHtml || null);
  const [title, setTitle] = useState<string | null>(initialTitle || null);
  const [error, setError] = useState<string | null>(null);
  const [isScientificError, setIsScientificError] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isSuggestHovered, setIsSuggestHovered] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Function to properly resize textarea accounting for padding
  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Get the computed styles
    const computedStyle = window.getComputedStyle(textarea);
    const paddingBottom = parseFloat(computedStyle.paddingBottom);
    
    // Set the new height including padding
    const newHeight = Math.max(
      textarea.scrollHeight, // Content height
      parseFloat(computedStyle.minHeight) || 0 // Min height if set
    );
    
    textarea.style.height = `${newHeight}px`;
  };

  // Update textarea size when prompt changes
  useEffect(() => {
    resizeTextarea();
  }, [currentPrompt]);

  // Update HTML and title when they change from props
  useEffect(() => {
    if (initialHtml) setCurrentHtml(initialHtml);
    if (initialTitle) setTitle(initialTitle);
  }, [initialHtml, initialTitle]);

  // Poll for job updates
  const pollForUpdates = async (id: string) => {
    try {
      const pollInterval = setInterval(async () => {
        const result = await pollJobStatus(id) as ExtendedJobStatusResponse;
        
        console.log('Job status update:', result);
        
        switch (result.status) {
          case 'completed':
            clearInterval(pollInterval);
            setIsLoading(false);
            onLoadingChange(false);
            
            if (result.visualization) {
              // Handle the structured visualization data
              const { pdb_data, html, title, timecode_markers, total_elements } = result.visualization;
              console.log('Visualization received:', { title, total_elements });
              
              // Update the visualization and store both PDB data and HTML
              setCurrentScript(pdb_data);
              setCurrentHtml(html);
              setTitle(title);
              onVisualizationUpdate(pdb_data, html, title);
              const visualizationOutput: VisualizationOutput = { pdb_data, html, title, timecode_markers, total_elements };
              onPromptSubmit(currentPrompt, visualizationOutput);
            } else if (result.pdb_data) {
              // Fallback for legacy response formats
              const pdbData = result.pdb_data;
              const html = result.result_html || '';
              setCurrentScript(pdbData);
              setCurrentHtml(html);
              onVisualizationUpdate(pdbData, html);
              const visualizationOutput: VisualizationOutput = { pdb_data: pdbData, html };
              onPromptSubmit(currentPrompt, visualizationOutput);
            }
            break;
          
          case 'processing':
            // Update progress if available
            if (result.progress !== undefined) {
              const progressPercent = Math.round(result.progress * 100);
              console.log(`Processing: ${progressPercent}% complete`);
              // Could update a progress bar here
            }
            break;
          
          case 'failed':
            clearInterval(pollInterval);
            setIsLoading(false);
            onLoadingChange(false);
            setError(`Processing failed: ${result.error || 'Unknown error'}`);
            break;
          
          default:
            console.warn('Unknown status received:', result.status);
            break;
        }
      }, 2000); // Poll every 2 seconds
      
      // Cleanup function to clear interval if component unmounts
      return () => clearInterval(pollInterval);
    } catch (error) {
      console.error('Error polling for updates:', error);
      setIsLoading(false);
      onLoadingChange(false);
      setError('Failed to check processing status');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPrompt.trim() || isLoading) return;
    
    setIsLoading(true);
    onLoadingChange(true);
    setError(null);
    setIsScientificError(false);
    
    console.log('Making request for:', currentPrompt, 'with model:', model, 'interactive mode:', isInteractive, 'PubChem mode:', usePubChem);

    try {
        const response = await generateFromPubChem({
          prompt: currentPrompt,
          model: model || undefined,
          preferred_model_category: undefined
        });
        
        if (response.pdb_data) {
          const pdbData = response.pdb_data;
          const html = response.result_html || '';
          const title = response.title;
          
          setCurrentScript(pdbData);
          setTitle(title);
          setCurrentHtml(html);
          onVisualizationUpdate(pdbData, html, title);
          onPromptSubmit(currentPrompt, { pdb_data: pdbData, html, title });
          setIsLoading(false);
          onLoadingChange(false);
        } else {
          throw new Error('No PDB data received from PubChem');
        }
    } catch (err: unknown) {
      setIsLoading(false);
      onLoadingChange(false);
      
      // Check if this is a scientific content validation error
      if (err instanceof Error && err.message.includes('Non-molecular prompt')) {
        setIsScientificError(true);
        setError(`Your prompt should be related to molecular structures. Click on the "Suggest Molecule" button to get started.`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to process prompt');
      }
    }
  };

  const handleDownload = () => {
    // If script is not in local state, use the one from props
    if (!currentScript && !currentHtml) return;
    
    // Use the backend-generated HTML if available, otherwise fall back to an empty string
    const htmlContent = currentHtml || '';
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'visualization'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSuggestTopic = () => {
    const randomTopic = CHEMISTRY_TOPICS[Math.floor(Math.random() * CHEMISTRY_TOPICS.length)];
    onPromptChange(randomTopic);
    setIsScientificError(false);
    setError(null);
    
    // Focus the textarea after suggesting a topic
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Resize will be handled by the useEffect
    }
  };

  const toggleRecording = () => {
    // Simulate toggling voice recording
    setIsRecording(!isRecording);
    // In a real implementation, this would integrate with the Web Speech API
    // or a similar service to handle voice input
  };
    
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl shadow-xl border border-gray-700">
      <div className="flex flex-col gap-1 mb-1">
        <h2 className="text-lg font-semibold text-white">
          Molecular Structure Visualization
        </h2>
        <p className="text-gray-400 text-xs sm:text-sm">
          Enter a molecular topic or structure to generate an interactive 3D visualization.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={currentPrompt}
              onChange={(e) => {
                onPromptChange(e.target.value);
                // Resize will be handled by the useEffect
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isLoading && currentPrompt.trim()) {
                    handleSubmit(e);
                  }
                }
              }}
              placeholder="Enter your prompt about molecular structures..."
              className="w-full min-h-[7rem] py-4 px-4 pb-20 text-gray-100 bg-gray-700/50 rounded-lg
                         border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30
                         placeholder-gray-500 transition-all duration-200 ease-in-out
                         hover:border-gray-500 overflow-hidden leading-relaxed"
              style={{ resize: 'none' }}
              rows={1}
              disabled={isLoading}
              maxLength={500}
              aria-label="Molecular structure prompt input"
            />
            
            {/* Buttons inside the input field at the bottom*/}
            <div className="absolute inset-x-0 bottom-0 min-h-[3.5rem] px-3 flex items-center justify-end gap-2">
              {/* Icon Container with animation */}
              <div className={`flex items-center gap-2 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                              ${currentPrompt.trim() ? '-translate-x-10' : ''}`}>
                {/* Suggest Molecule Button with morphing animation */}
                <div 
                  className="relative flex items-center justify-center"
                  onMouseEnter={() => setIsSuggestHovered(true)}
                  onMouseLeave={() => setIsSuggestHovered(false)}
                >
                  <button
                    type="button"
                    onClick={handleSuggestTopic}
                    className={`transition-all duration-300 ease-in-out flex items-center justify-center
                              h-8 rounded-md bg-transparent hover:bg-gray-600/40 text-blue-400
                              focus:outline-none focus:ring-1 focus:ring-blue-500/50
                              ${isSuggestHovered ? 'px-3' : 'px-1.5'}`}
                    aria-label="Suggest molecule"
                    disabled={isLoading}
                  >
                    <div className="flex items-center">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0">
                        <path d="M10 16.584V18.9996C10 20.1042 10.8954 20.9996 12 20.9996C13.1046 20.9996 14 20.1042 14 18.9996L14 16.584M12 3V4M18.3643 5.63574L17.6572 6.34285M5.63574 5.63574L6.34285 6.34285M4 12H3M21 12H20M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <div 
                        className={`overflow-hidden transition-all duration-300 ease-in-out
                                  ${isSuggestHovered ? 'w-16 opacity-100 ml-2' : 'w-0 opacity-0 ml-0'}`}
                      >
                        <span className="whitespace-nowrap font-medium">Suggest</span>
                      </div>
                    </div>
                  </button>
                </div>
                
                {/* Voice Input Button */}
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`h-8 w-8 flex items-center justify-center rounded-md transition-all duration-200
                              ${isRecording 
                                ? 'bg-red-500 text-white animate-pulse' 
                                : 'bg-transparent hover:bg-gray-600/40 text-gray-400'}`}
                  aria-label={isRecording ? "Stop recording" : "Start voice input"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <path d="M12 19v3"></path>
                    <path d="M8 22h8"></path>
                  </svg>
                </button>
              </div>

              {/* Enter Button - with fade and slide animation */}
              <div className={`absolute right-3 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                              ${currentPrompt.trim() && !isLoading ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
                <button
                  type="submit"
                  className="h-8 w-8 flex items-center justify-center rounded-md bg-blue-500 hover:bg-blue-400 
                            text-white transition-all duration-200"
                  aria-label="Generate visualization"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 20V4M12 4L6 10M12 4L18 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-2 text-blue-400 text-sm">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Generating visualization...</span>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className={`transform transition-all duration-200 ease-in-out
                           ${isScientificError ? 'bg-yellow-500/10' : 'bg-red-500/10'} 
                           rounded-lg p-3`}>
              <div className={`text-xs sm:text-sm ${isScientificError ? 'text-yellow-400' : 'text-red-400'} 
                             flex items-start gap-2`}>
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="break-words">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Download button - only shows when visualization is available */}
        {(currentScript || currentHtml) && !isLoading && (
          <button
            type="button"
            onClick={handleDownload}
            className="self-end flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                      bg-gradient-to-r from-green-600 to-green-500 
                      hover:from-green-500 hover:to-green-400
                      text-white text-sm font-medium shadow-md shadow-green-500/20
                      transition-all duration-200 ease-in-out
                      focus:outline-none focus:ring-2 focus:ring-green-500/50"
            aria-label="Download visualization"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            <span>Download</span>
          </button>
        )}
      </form>
    </div>
  );
};