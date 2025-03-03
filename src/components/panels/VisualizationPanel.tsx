/* eslint-disable */
import React, { useState, useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import * as THREE from 'three';
import { LoadingFacts } from './LoadingFacts';

// Extend Window interface to include PDBLoader
declare global {
  interface Window {
    PDBLoader?: any;
  }
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
        const distance = diagonal * 1.2; // Adjust multiplier as needed

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
    />
  );
};

interface VisualizationPanelProps {
  script?: string;
  isLoading?: boolean;
  isInteractive?: boolean;
}

const DynamicSceneComponent = ({ code }: { code: string }) => {
  const { scene } = useThree();
  
  useEffect(() => {
    async function setupScene() {
      try {
        // Clean up everything except lights
        scene.children.slice().forEach(child => {
          if (!(child instanceof THREE.Light)) {
            scene.remove(child);
          }
        });

        // Import PDBLoader dynamically and make it globally available
        const { PDBLoader } = await import('three/examples/jsm/loaders/PDBLoader');
        window.PDBLoader = PDBLoader;

        // Execute the code directly (it contains the function call)
        const createScene = new Function('THREE', 'scene', code);
        createScene(THREE, scene);

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
    };
  }, [code, scene]);

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
        <div className={`transition-all duration-300 bg-gray-800 rounded-lg shadow-lg border border-gray-700
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
          <div className="w-full h-full">
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
      <div className={`transition-all duration-300 bg-gray-800 rounded-lg shadow-lg border border-gray-700
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
        <div className="w-full h-full">
          <Canvas>
            <CameraController />
            {DynamicScene && <DynamicScene />}
          </Canvas>
        </div>
      </div>
    </div>
  );
}; 