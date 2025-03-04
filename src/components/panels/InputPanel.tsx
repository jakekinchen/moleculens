import React, { useState } from 'react';
import { submitPrompt, pollJobStatus, legacySubmitPrompt, generateFromPubChem } from '@/services/api';
import { ArrowDownTrayIcon, ExclamationTriangleIcon, SparklesIcon, BeakerIcon } from '@heroicons/react/24/outline';

// Import the VisualizationData interface from the API file
interface VisualizationData {
  html: string;
  js: string;
  title: string;
  timecode_markers: string[];
  total_elements: number;
}

interface InputPanelProps {
  onVisualizationUpdate: (script: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
  currentPrompt: string;
  onPromptChange: (prompt: string) => void;
  onPromptSubmit: (prompt: string) => void;
  model: string | null;
  isInteractive: boolean;
  usePubChem?: boolean;
}

// Scientific prompt example suggestions
const CHEMISTRY_TOPICS = [
  // Keep some fundamental structures
  "Teach me about water molecules and their 3D structure",
  "Teach me about carbon hybridization and sp3 bonding",
  "Teach me about benzene's aromatic structure",
  "Teach me about tetrahedral carbon geometry",
  "Teach me about cyclohexane chair conformations",
  
  // Add new advanced structures
  "Teach me about diborane's bridging hydrogen bonds",
  "Teach me about boranes and 3-center 2-electron bonds",
  "Teach me about ferrocene's sandwich structure",
  "Teach me about buckminsterfullerene (C60)",
  "Teach me about cubane's unusual bond angles",
  "Teach me about bullvalene's fluxional structure",
  "Teach me about porphyrin rings and their coordination sites",
  "Teach me about crown ethers' coordination geometry",
  "Teach me about transition metal complexes with octahedral geometry",
  "Teach me about metal-carbonyl complexes and back-bonding",
  "Teach me about phosphazenes and their ring structures",
  "Teach me about the metal sandwich complexes like bis(cyclopentadienyl) complexes",
  "Teach me about cryptands and 3D host-guest complexation",
  "Teach me about norbornane and its bridging structure",
  "Teach me about carboranes and their polyhedral cage structures",
"Teach me about the DNA double helix and base-pair stacking",
"Teach me about metal-metal quadruple bonds in dimolybdenum complexes",
"Teach me about rotaxanes and their mechanically interlocked architecture",
"Teach me about dendrimers and their hyperbranched growth patterns",
"Teach me about polyoxometalates and their metal-oxygen clusters",
"Teach me about alkali-doped fullerenes and superconductivity",
"Teach me about catenanes and how their rings interlock",
"Teach me about helicenes and their helical chirality",
"Teach me about metallophthalocyanines and their planar macrocycles",
"Teach me about organosilanes and the silicon hypervalency debate",
"Teach me about zintl clusters and their electron-rich frameworks",
"Teach me about cryptophanes and their host-guest chemistry",
"Teach me about double helical sulfur (S∞ chains) and polysulfur rings",
"Teach me about the Schrock carbene complexes and metal-ligand multiple bonds",
"Teach me about hydrogen-bonded molecular knots and trefoil structures",
"Teach me about peptidic β-sheets and α-helices in proteins",
"Teach me about bridging metal-carbonyl ligands in cluster compounds",
"Teach me about diiron nonacarbonyl Fe2(CO)9 and its bridging CO groups",
"Teach me about the Jahn-Teller distortion in octahedral Cu(II) complexes",
"Teach me about cuneane and its strained cage system",
"Teach me about tetraphenylporphyrin and its planar macrocycle",
"Teach me about the Kekulé structure of benzene",
"Teach me about the Woodward-Hoffmann rules for conrotatory and disrotatory reactions"


];

// Update the JobStatusResponse interface to include legacy fields
interface ExtendedJobStatusResponse {
  job_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  visualization?: VisualizationData;
  error?: string;
  // Legacy fields
  result?: string;
  geometry_result?: string;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  onVisualizationUpdate,
  onLoadingChange,
  currentPrompt,
  onPromptChange,
  onPromptSubmit,
  model,
  isInteractive,
  usePubChem
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentScript, setCurrentScript] = useState<string | null>(null);
  const [currentHtml, setCurrentHtml] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScientificError, setIsScientificError] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

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
              const { js, html, title, timecode_markers, total_elements } = result.visualization;
              console.log('Visualization received:', { title, total_elements });
              
              // Update the visualization and store both JS and HTML
              setCurrentScript(js);
              setCurrentHtml(html);
              onVisualizationUpdate(js);
              onPromptSubmit(currentPrompt);
            } else {
              // Fallback for legacy response formats
              const jsCode = result.result || result.geometry_result || '';
              setCurrentScript(jsCode);
              setCurrentHtml(null);
              onVisualizationUpdate(jsCode);
              onPromptSubmit(currentPrompt);
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
    setIsLoading(true);
    onLoadingChange(true);
    setError(null);
    setIsScientificError(false);
    
    console.log('Making request for:', currentPrompt, 'with model:', model, 'interactive mode:', isInteractive, 'PubChem mode:', usePubChem);

    try {
      if (usePubChem) {
        // Use PubChem mode
        const response = await generateFromPubChem({
          prompt: currentPrompt,
          model: model || undefined,
          preferred_model_category: undefined
        });
        
        if (response.result) {
          setCurrentScript(response.result);
          setTitle(response.title);
          setCurrentHtml(response.result_html || null);
          onVisualizationUpdate(response.result);
          onPromptSubmit(currentPrompt);
          setIsLoading(false);
          onLoadingChange(false);
        } else {
          throw new Error('No result received from PubChem');
        }
      } else if (isInteractive) {
        // Use the job-based API flow with polling for animation
        const response = await submitPrompt({
          prompt: currentPrompt,
          model: model || undefined,
          preferred_model_category: undefined
        });
        
        if (response.job_id) {
          setJobId(response.job_id);
          pollForUpdates(response.job_id);
        } else {
          throw new Error('No job ID received');
        }
      } else {
        // Use the legacy direct geometry generation flow
        const response = await legacySubmitPrompt({
          prompt: currentPrompt,
          model: model || undefined,
          preferred_model_category: undefined
        });
        
        if (response.result) {
          setCurrentScript(response.result);
          setCurrentHtml(null);
          onVisualizationUpdate(response.result);
          onPromptSubmit(currentPrompt);
          setIsLoading(false);
          onLoadingChange(false);
        } else {
          throw new Error('No result received');
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      onLoadingChange(false);
      
      // Check if this is a scientific content validation error
      if (err.message && err.message.includes('Non-molecular prompt')) {
        setIsScientificError(true);
        setError(`Your prompt should be related to molecular structures. Click on the "Suggest Molecule" button to get started.`);
      } else {
        setError(err.message || 'Failed to process prompt');
      }
    }
  };

  const handleDownload = () => {
    if (!currentScript) return;
    
    // Use the backend-generated HTML if available, otherwise fall back to generating our own
    let htmlContent;

      // Use the backend-generated HTML which has proper PDBLoader imports
    console.log('Using backend-generated HTML for download');
    htmlContent = currentHtml || '';
    

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
  };
    
  return (
    <div className="flex flex-col gap-6 p-6 bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl shadow-xl border border-gray-700">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <SparklesIcon className="w-6 h-6 text-blue-400" />
          Molecular Structure Visualization
        </h2>
        <p className="text-gray-400 text-sm">
          Enter a prompt about molecular structures and watch as AI generates an interactive 3D visualization.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <textarea
              value={currentPrompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isLoading && currentPrompt.trim()) {
                    handleSubmit(e);
                  }
                }
              }}
              placeholder="Enter your prompt about molecular structures..."
              className="w-full h-32 p-4 text-gray-100 bg-gray-800/50 rounded-lg resize-none 
                         border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                         placeholder-gray-500 transition-all duration-200 ease-in-out
                         hover:border-gray-500"
              disabled={isLoading}
              maxLength={500}
              aria-label="Molecular structure prompt input"
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500">
              {currentPrompt.length} / 500 characters
            </div>
          </div>

          <button
            type="button"
            onClick={handleSuggestTopic}
            className="self-start flex items-center gap-2 px-4 py-2 text-sm font-medium
                     bg-gradient-to-r from-indigo-500/10 to-blue-500/10
                     hover:from-indigo-500/20 hover:to-blue-500/20
                     text-blue-400 rounded-lg
                     transition-all duration-200 ease-in-out
                     focus:outline-none focus:ring-2 focus:ring-blue-500/50
                     disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Suggest molecule"
            disabled={isLoading}
          >
            <BeakerIcon className="w-4 h-4" />
            Suggest Molecule
          </button>
          
          {error && (
            <div className={`transform transition-all duration-200 ease-in-out
                           ${isScientificError ? 'bg-yellow-500/10' : 'bg-red-500/10'} 
                           rounded-lg p-4`}>
              <div className={`text-sm ${isScientificError ? 'text-yellow-400' : 'text-red-400'} 
                             flex items-start gap-3`}>
                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{error}</p>

                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center gap-4">
          <button
            type="submit"
            disabled={isLoading || !currentPrompt.trim()}
            className={`flex items-center justify-center gap-2 min-w-[140px] px-6 py-2.5 rounded-lg font-medium
                       transition-all duration-200 ease-in-out focus:outline-none focus:ring-2
                       ${isLoading || !currentPrompt.trim()
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20'
            }`}
            aria-label={isLoading ? 'Processing visualization' : 'Generate visualization'}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="flex-shrink-0">Processing...</span>
              </>
            ) : (
              'Generate'
            )}
          </button>
          
          {currentScript && (
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 min-w-[140px] px-6 py-2.5 rounded-lg font-medium
                         bg-gradient-to-r from-green-600 to-green-500 
                         hover:from-green-500 hover:to-green-400
                         text-white shadow-lg shadow-green-500/20
                         transition-all duration-200 ease-in-out
                         focus:outline-none focus:ring-2 focus:ring-green-500/50
                         disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Download visualization"
              disabled={isLoading}
            >
              <ArrowDownTrayIcon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-shrink-0">Download</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};