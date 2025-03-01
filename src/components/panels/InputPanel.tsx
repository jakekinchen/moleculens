import React, { useState } from 'react';
import { submitPrompt } from '@/services/api';
import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface InputPanelProps {
  onVisualizationUpdate: (script: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

export const InputPanel: React.FC<InputPanelProps> = ({ onVisualizationUpdate, onLoadingChange }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentScript, setCurrentScript] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    onLoadingChange(true);

    try {
      const response = await submitPrompt(query);
      setCurrentScript(response.result);
      onVisualizationUpdate(response.result);
      console.log('response result', response.result);
    } catch (error) {
      console.error('Failed to get visualization:', error);
      // TODO: Add error handling UI
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
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

  const handleOpenInNewTab = () => {
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
          <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/0.128.0/three.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
      </head>
      <body>
          <script>
              // Wait for scripts to load
              window.addEventListener('load', () => {
                  // Set up scene
                  const scene = new THREE.Scene();
                  
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

                  try {
                      ${currentScript}
                  } catch (error) {
                      console.error('Error executing geometry code:', error);
                  }

                  // Add OrbitControls
                  const controls = new THREE.OrbitControls(camera, renderer.domElement);
                  controls.enableDamping = true;
                  controls.dampingFactor = 0.05;
                  
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
                  
                  // Initial camera positioning based on molecule size
                  setTimeout(() => {
                      const molecule = scene.getObjectByName('waterMolecule');
                      if (molecule) {
                          const box = new THREE.Box3().setFromObject(molecule);
                          const size = box.getSize(new THREE.Vector3());
                          const center = box.getCenter(new THREE.Vector3());
                          
                          const radius = Math.max(size.x, size.y, size.z);
                          const distance = radius * 5;
                          camera.position.set(distance, distance * 0.8, distance);
                          camera.lookAt(center);
                      }
                  }, 100);
                  
                  // Start animation
                  animate();
              });
          </script>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
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
            {/* <div className="flex gap-2 mb-2">
              <button
                onClick={handleOpenInNewTab}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 text-gray-200 py-2 px-3 rounded-lg 
                  hover:bg-gray-600 transition focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
              >
                <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                Open in New Tab
              </button>
            </div> */}
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