import React, { useState } from 'react';
import { submitPrompt, pollJobStatus, legacySubmitPrompt } from '@/services/api';
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
}

// Scientific prompt example suggestions
const CHEMISTRY_TOPICS = [
  "Teach me about water molecules and their 3D structure",
  "Teach me about carbon hybridization and sp3 bonding",
  "Teach me about benzene's aromatic structure",
  "Teach me about tetrahedral carbon geometry",
  "Teach me about cyclohexane chair conformations",
  "Teach me about methane molecular geometry",
  "Teach me about ethene's double bond structure",
  "Teach me about acetylene's triple bond",
  "Teach me about ammonia's pyramidal shape",
  "Teach me about the 3D structure of ethanol",
  "Teach me about butane conformations",
  "Teach me about propene's molecular structure",
  "Teach me about the shape of carbon dioxide",
  "Teach me about methanol's 3D structure",
  "Teach me about ethane rotation",
  "Teach me about cyclopropane ring strain",
  "Teach me about the structure of formaldehyde",
  "Teach me about acetic acid geometry",
  "Teach me about propane's 3D structure",
  "Teach me about cyclobutane ring structure",
  "Teach me about sp2 hybridization in alkenes",
  "Teach me about the structure of ethylamine",
  "Teach me about glucose ring conformations",
  "Teach me about benzene pi orbital overlap",
  "Teach me about chiral carbon centers",
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
  isInteractive
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentScript, setCurrentScript] = useState<string | null>(null);
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
              
              // Update the visualization
              setCurrentScript(js);
              onVisualizationUpdate(js);
              onPromptSubmit(currentPrompt);
            } else {
              // Fallback for legacy response formats
              const jsCode = result.result || result.geometry_result || '';
              setCurrentScript(jsCode);
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
    
    console.log('Making request for:', currentPrompt, 'with model:', model, 'interactive mode:', isInteractive);

    try {
      if (isInteractive) {
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
        // Show multiple suggestions instead of just one
        setError(`Your prompt should be related to molecular structures. Click on the "Suggest Molecule" button to get started.`);
        // Don't automatically change the user's input
        // handleSuggestTopic();
      } else {
        setError(err.message || 'Failed to process prompt');
      }
    }
  };

  const handleDownload = () => {
    if (!currentScript) return;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Geometry Visualization</title>
          <style>
              body { margin: 0; overflow: hidden; background: #111; }
              canvas { width: 100%; height: 100%; display: block; }
          </style>
      </head>
      <body>
          <script>
              // Load Three.js first
              const loadScript = (src) => {
                  return new Promise((resolve, reject) => {
                      const script = document.createElement('script');
                      script.src = src;
                      script.onload = () => {
                          console.log('Loaded script:', src);
                          resolve();
                      };
                      script.onerror = (err) => {
                          console.error('Failed to load script:', src, err);
                          reject(err);
                      };
                      document.head.appendChild(script);
                  });
              };

              // Load scripts in sequence and then initialize
              async function init() {
                  try {
                      await loadScript('https://unpkg.com/three@0.128.0/build/three.min.js');
                      await loadScript('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
                      console.log('Three.js loaded:', THREE);
                      console.log('OrbitControls loaded:', THREE.OrbitControls);
                      
                      // Set up scene
                      const scene = new THREE.Scene();
                      console.log('Scene created');
                      
                      // Set up camera
                      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
                      camera.position.set(5, 4, 5);
                      
                      // Set up renderer
                      const renderer = new THREE.WebGLRenderer({ antialias: true });
                      renderer.setSize(window.innerWidth, window.innerHeight);
                      document.body.appendChild(renderer.domElement);
                      
                      // Add lights
                      const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
                      scene.add(ambientLight);
                      
                      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
                      directionalLight1.position.set(1, 1, 1);
                      scene.add(directionalLight1);
                      
                      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
                      directionalLight2.position.set(-1, -1, -1);
                      scene.add(directionalLight2);

                      console.log('About to execute geometry code');
                      // Execute the geometry code
                      ${currentScript}
                      console.log('Geometry code executed');

                      // Add OrbitControls
                      const controls = new THREE.OrbitControls(camera, renderer.domElement);
                      controls.enableDamping = true;
                      controls.dampingFactor = 0.05;
                      controls.autoRotate = true;
                      controls.autoRotateSpeed = 1.5;
                      
                      
                      // Animation loop
                      function animate() {
                          requestAnimationFrame(animate);
                          controls.update();
                          renderer.render(scene, camera);
                      }
                      
                      // Handle window resize
                      window.addEventListener('resize', () => {
                          camera.aspect = window.innerWidth / window.innerHeight;
                          camera.updateProjectionMatrix();
                          renderer.setSize(window.innerWidth, window.innerHeight);
                      });
                      
                      // Start animation
                      console.log('Starting animation');
                      animate();
                  } catch (error) {
                      console.error('Error initializing visualization:', error);
                  }
              }

              // Start initialization
              init().catch(console.error);
          </script>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'visualization.html';
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