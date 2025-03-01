import React, { useState } from 'react';
import { submitPrompt, pollJobStatus, legacySubmitPrompt } from '@/services/api';
import { ArrowDownTrayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface InputPanelProps {
  onVisualizationUpdate: (script: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
  currentPrompt: string;
  onPromptChange: (prompt: string) => void;
  onPromptSubmit: (prompt: string) => void;
  selectedModel: string;
  useInteractiveMode: boolean;
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

export const InputPanel: React.FC<InputPanelProps> = ({ onVisualizationUpdate, onLoadingChange, currentPrompt, onPromptChange, onPromptSubmit, selectedModel, useInteractiveMode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentScript, setCurrentScript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScientificError, setIsScientificError] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  // Poll for job updates
  const pollForUpdates = async (id: string) => {
    try {
      const pollInterval = setInterval(async () => {
        const result = await pollJobStatus(id);
        
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
    
    console.log('Making request for:', currentPrompt, 'with model:', selectedModel, 'interactive mode:', useInteractiveMode);

    try {
      if (useInteractiveMode) {
        // Use the non-polling direct geometry generation endpoint
        const response = await legacySubmitPrompt(currentPrompt, selectedModel);
        console.log('Legacy geometry response:', response);
        
        setCurrentScript(response.result);
        onVisualizationUpdate(response.result);
        onPromptSubmit(currentPrompt);
        setIsLoading(false);
        onLoadingChange(false);
      } else {
        // Use the job-based API flow with polling
        const response = await submitPrompt(currentPrompt, selectedModel);
        console.log('Initial response:', response);
        
        if (response.status === 'processing') {
          setJobId(response.job_id);
          // Start polling for updates
          pollForUpdates(response.job_id);
        } else {
          // Handle immediate response (rare case)
          if ('result' in response) {
            setCurrentScript(response.result);
            onVisualizationUpdate(response.result);
            onPromptSubmit(currentPrompt);
          }
          setIsLoading(false);
          onLoadingChange(false);
        }
      }
    } catch (error: any) {
      console.error('Failed to get visualization:', error);
      setIsLoading(false);
      onLoadingChange(false);
      
      // Check for scientific validation error
      if (error.message && error.message.includes('Scientific validation failed')) {
        setIsScientificError(true);
        setError(error.message.replace('Scientific validation failed: ', ''));
        // Track this error for analytics
        if (window.analytics) {
          window.analytics.track('Non-scientific prompt rejected', {
            prompt: currentPrompt
          });
        }
      } else {
        setError('An error occurred while processing your request.');
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
                      
                      // Initial camera positioning based on molecule size
                      const molecule = scene.getObjectByName('waterMolecule');
                      console.log('Found molecule:', molecule);
                      if (molecule) {
                          const box = new THREE.Box3().setFromObject(molecule);
                          const size = box.getSize(new THREE.Vector3());
                          const center = box.getCenter(new THREE.Vector3());
                          
                          const radius = Math.max(size.x, size.y, size.z);
                          const distance = radius * 5;
                          camera.position.set(distance, distance * 0.8, distance);
                          camera.lookAt(center);
                          console.log('Camera positioned at distance:', distance);
                      }
                      
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
    <div className="h-[calc(100vh-8rem)] bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-700 flex flex-col">
      <h2 className="text-lg font-semibold mb-3 text-white">Ask The Scientist</h2>
      <form onSubmit={handleSubmit} className="space-y-3 flex-grow">
        <textarea
          value={currentPrompt}
          onChange={(e) => {
            onPromptChange(e.target.value);
            setIsScientificError(false);
            setError(null);
          }}
          className="w-full h-32 p-2 bg-gray-700 border-gray-600 rounded-lg resize-none 
            focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
          placeholder="What would you like to learn about? (e.g., 'teach me about water molecules')"
        />
        
        {isScientificError && (
          <div className="bg-amber-900/50 border border-amber-700 rounded-lg p-3 text-amber-200 mb-3">
            <div className="flex items-start mb-2">
              <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <h4 className="font-medium">Scientific Prompt Required</h4>
            </div>
            <p className="text-sm mb-3">{error}</p>
            <div className="text-sm">
              <p className="mb-2">Try one of these examples instead:</p>
              <ul className="space-y-1 list-disc pl-5">
                <li>Teach me about the structure of DNA</li>
                <li>Show me how a water molecule is structured</li>
                <li>Explain the 3D structure of methane</li>
              </ul>
              <button 
                type="button"
                onClick={handleSuggestTopic}
                className="mt-3 text-amber-300 hover:text-amber-200 font-medium text-sm"
              >
                Suggest a scientific topic
              </button>
            </div>
          </div>
        )}
        
        {error && !isScientificError && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-200">
            <p>{error}</p>
          </div>
        )}
        
        <button
          type="submit"
          disabled={isLoading || !currentPrompt.trim()}
          className="w-full bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 
            transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Learn'}
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
          onClick={handleSuggestTopic}
          className="w-full bg-gray-700 text-gray-200 py-2 px-3 rounded-lg hover:bg-gray-600 
            transition focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        >
          Suggest Random Topic
        </button>
      </div>
    </div>
  );
};