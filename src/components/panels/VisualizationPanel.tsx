/* eslint-disable */
import React, { useState, useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import * as THREE from 'three';
import { LoadingFacts } from './LoadingFacts';

// Extend Window interface to include PDBLoader and labelRenderer
declare global {
  interface Window {
    PDBLoader?: any;
    labelRenderer?: any;
    labelRendererResizeListener?: boolean;
  }
}

// Extend THREE namespace with CSS2D types
declare module 'three' {
  export var CSS2DRenderer: any;
  export var CSS2DObject: any;
}

// Helper component to auto-fit camera to scene
const CameraController = () => {
  const { camera, scene } = useThree();
  
  useEffect(() => {
    requestAnimationFrame(() => {
      // Get all non-light objects in the scene
      const objects = scene.children.filter(child => !(child instanceof THREE.Light));
      
      if (objects.length > 0) {
        // Create bounding box for all objects
        const box = new THREE.Box3();
        objects.forEach(object => box.expandByObject(object));
        
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Calculate distance based on the diagonal of the bounding box
        const diagonal = Math.sqrt(
          size.x * size.x + 
          size.y * size.y + 
          size.z * size.z
        );
        
        // Increase the distance for larger molecules
        const scaleFactor = Math.max(1.2, Math.log10(diagonal) * 0.8);
        const distance = diagonal * scaleFactor;

        // Position camera using spherical coordinates for better viewing angle
        const theta = Math.PI / 4; // 45 degrees
        const phi = Math.PI / 6;   // 30 degrees
        
        camera.position.set(
          center.x + distance * Math.sin(theta) * Math.cos(phi),
          center.y + distance * Math.sin(phi),
          center.z + distance * Math.cos(theta) * Math.cos(phi)
        );

        // Look at the center point
        camera.lookAt(center);
        
        // Update the orbit controls target
        const controls = camera.userData.controls;
        if (controls) {
          controls.target.copy(center);
        }

        // Adjust camera's near and far planes based on molecule size
        camera.near = distance * 0.01;
        camera.far = distance * 10;
        camera.updateProjectionMatrix();
      }
    });
  }, [camera, scene]);

  return (
    <OrbitControls 
      makeDefault 
      autoRotate 
      autoRotateSpeed={1.5}
      enableDamping
      dampingFactor={0.05}
      minDistance={1} // Allow closer zoom
      maxDistance={1000} // Allow further zoom out
    />
  );
};

interface VisualizationPanelProps {
  script?: string;
  isLoading?: boolean;
  isInteractive?: boolean;
}

const DynamicSceneComponent = ({ code }: { code: string }) => {
  const { scene, camera, controls, gl: renderer } = useThree();
  
  useEffect(() => {
    async function setupScene() {
      var enableAnnotations = true;
      try {
        // Clean up everything except lights
        scene.children.slice().forEach(child => {
          if (!(child instanceof THREE.Light)) {
            scene.remove(child);
          }
        });

        // Import PDBLoader and CSS2D renderers dynamically
        console.log('setupScene');
        const { PDBLoader } = await import('three/examples/jsm/loaders/PDBLoader');
        const { CSS2DRenderer, CSS2DObject } = await import('three/addons/renderers/CSS2DRenderer.js');
        window.PDBLoader = PDBLoader;
        
        // Set up CSS2DRenderer for labels
        const container = document.querySelector('#container');
        if (container && !window.labelRenderer) {
          window.labelRenderer = new CSS2DRenderer();
          window.labelRenderer.setSize(container.clientWidth, container.clientHeight);
          window.labelRenderer.domElement.style.position = 'absolute';
          window.labelRenderer.domElement.style.top = '0px';
          window.labelRenderer.domElement.style.pointerEvents = 'none';
          container.appendChild(window.labelRenderer.domElement);

          // Patch the renderer to include CSS2D rendering
          const originalRender = renderer.render.bind(renderer);
          renderer.render = function(scene: THREE.Scene, camera: THREE.Camera) {
            originalRender(scene, camera);
            if (window.labelRenderer) {
              window.labelRenderer.render(scene, camera);
            }
          };

          // Handle resize
          const handleResize = () => {
            if (container && window.labelRenderer) {
              window.labelRenderer.setSize(container.clientWidth, container.clientHeight);
            }
          };
          window.addEventListener('resize', handleResize);
        }

        // Attach CSS2D classes to THREE namespace using type assertions
        (THREE as any).CSS2DRenderer = CSS2DRenderer;
        (THREE as any).CSS2DObject = CSS2DObject;

        // Execute the code directly (it contains the function call)
        const createScene = new Function('THREE', 'scene', 'options', code);
        createScene(THREE, scene, { camera, controls });

      } catch (error) {
        console.error('Error executing scene code:', error);
      }
    }

    setupScene();

    // Clean up function for unmounting
    return () => {
      scene.children.slice().forEach(child => {
        if (!(child instanceof THREE.Light)) {
          scene.remove(child);
        }
      });
      // Clean up global PDBLoader
      delete window.PDBLoader;
      
      // Clean up CSS2DRenderer
      const container = document.querySelector('#container');
      if (container && window.labelRenderer) {
        container.removeChild(window.labelRenderer.domElement);
        delete window.labelRenderer;
      }
    };
  }, [code, scene, camera, controls, renderer]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[1, 1, 1]} intensity={1} />
      <directionalLight position={[-1, -1, -1]} intensity={0.4} />
    </>
  );
};

export const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ 
  script,
  isLoading = false,
  isInteractive = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const DynamicScene = useMemo(() => {
    if (!script) return null;
      return () => <DynamicSceneComponent code={script} />;
  }, [script]);

  const handleExpand = () => {
    setIsTransitioning(true);
    setIsExpanded(!isExpanded);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // For non-interactive mode (direct geometry rendering)
  if (!isInteractive) {
    return (
      <div className="absolute inset-0">
        <div className={`transition-all duration-300 bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden
          ${isExpanded ? 'fixed inset-0 z-50 m-0' : 'absolute inset-0 m-2'}`}
        >
          {/* Expand/Collapse button */}
          <button
            onClick={handleExpand}
            className="absolute top-2 right-2 z-10 p-2 text-gray-400 hover:text-white transition-colors"
            aria-label={isExpanded ? 'Collapse visualization' : 'Expand visualization'}
          >
            {isExpanded ? (
              <ArrowsPointingInIcon className="w-6 h-6" />
            ) : (
              <ArrowsPointingOutIcon className="w-6 h-6" />
            )}
          </button>

          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90 z-20">
              <LoadingFacts isVisible={isLoading} showFacts={true} />
            </div>
          )}

          {/* Three.js scene */}
          <div id="container" className="w-full h-full relative overflow-hidden">
            <Canvas>
              <CameraController />
              {DynamicScene && <DynamicScene />}
            </Canvas>
          </div>
        </div>
      </div>
    );
  }

  // For interactive mode (animation with controls)
  return (
    <div className="absolute inset-0">
      <div className={`transition-all duration-300 bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden
        ${isExpanded ? 'fixed inset-0 z-50 m-0' : 'absolute inset-0 m-2'}`}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={handleExpand}
          className="absolute top-2 right-2 z-10 p-2 text-gray-400 hover:text-white transition-colors"
          aria-label={isExpanded ? 'Collapse visualization' : 'Expand visualization'}
        >
          {isExpanded ? (
            <ArrowsPointingInIcon className="w-6 h-6" />
          ) : (
            <ArrowsPointingOutIcon className="w-6 h-6" />
          )}
        </button>

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90 z-20">
            <LoadingFacts isVisible={isLoading} showFacts={true} />
          </div>
        )}

        {/* Three.js scene */}
        <div id="container" className="w-full h-full relative overflow-hidden">
          <Canvas>
            <CameraController />
            {DynamicScene && <DynamicScene />}
          </Canvas>
        </div>
      </div>
    </div>
  );
}; 