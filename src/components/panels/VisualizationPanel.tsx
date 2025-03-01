/* eslint-disable */
import React, { useState, useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import * as THREE from 'three';

// Helper component to auto-fit camera to scene
const CameraController = () => {
  const { camera, scene } = useThree();
  
  useEffect(() => {
    // Wait a frame to ensure the molecule is added
    requestAnimationFrame(() => {
      const molecule = scene.getObjectByName('waterMolecule');
      if (molecule) {
        const box = new THREE.Box3().setFromObject(molecule);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const radius = Math.max(size.x, size.y, size.z);
        const distance = radius * 5; // Increased for better view of water molecule
        camera.position.set(distance, distance * 0.8, distance);
        camera.lookAt(center);
        camera.updateProjectionMatrix();
      }
    });
  }, [camera, scene]);

  return null;
};

interface VisualizationPanelProps {
  script?: string;
  isLoading?: boolean;
}

const DynamicSceneComponent = ({ code }: { code: string }) => {
  const { scene } = useThree();
  
  useEffect(() => {
    try {
      // Clean up everything except lights
      scene.children.slice().forEach(child => {
        if (!(child instanceof THREE.Light)) {
          scene.remove(child);
        }
      });

      // Create a function from the code string and execute it
      const createScene = new Function('THREE', 'scene', code);
      createScene(THREE, scene);

      // Clean up function for unmounting - preserve lights again
      return () => {
        scene.children.slice().forEach(child => {
          if (!(child instanceof THREE.Light)) {
            scene.remove(child);
          }
        });
      };
    } catch (error) {
      console.error('Error executing scene code:', error);
    }
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
  isLoading = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const DynamicScene = useMemo(() => {
    if (!script) return null;
    
    try {
      // Extract the code between the marker comments
      const match = script.match(/\/\/ GeometryAgent LLM-generated code([\s\S]*?)(?=$)/);
      if (!match || !match[1]) {
        console.error('Could not find geometry code in script');
        return null;
      }
      
      return () => <DynamicSceneComponent code={match[1]} />;
    } catch (error) {
      console.error('Error creating scene:', error);
      return null;
    }
  }, [script]);

  const handleExpand = () => {
    setIsTransitioning(true);
    setIsExpanded(!isExpanded);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  return (
    <div className="absolute inset-0">
      <div className={`transition-all duration-300 bg-gray-800 rounded-lg shadow-lg border border-gray-700
        ${isExpanded ? 'fixed inset-0 z-50 m-0' : 'absolute inset-0 m-2'}`}
      >
        <div className="w-full h-full bg-black rounded-lg overflow-hidden relative">
          {/* Loading Overlay */}
          <div className={`absolute inset-0 bg-black bg-opacity-75 z-20 flex items-center justify-center
            transition-opacity duration-300 ${isLoading || isTransitioning ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500" />
          </div>

          <button
            onClick={handleExpand}
            className="absolute top-2 right-2 z-30 p-1.5 bg-gray-800 rounded-lg 
              hover:bg-gray-700 transition-colors duration-200 group"
            aria-label={isExpanded ? 'Collapse visualization' : 'Expand visualization'}
          >
            {isExpanded ? (
              <ArrowsPointingInIcon className="w-5 h-5 text-gray-400 group-hover:text-white" />
            ) : (
              <ArrowsPointingOutIcon className="w-5 h-5 text-gray-400 group-hover:text-white" />
            )}
          </button>

          <div className="w-full h-full">
            {!script ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-lg">
                Enter a prompt to see a visualization
              </div>
            ) : (
              <Canvas
                camera={{ position: [0, 0, 5], fov: 75 }}
                style={{ width: '100%', height: '100%' }}
              >
                <color attach="background" args={['#111']} />
                <CameraController />
                <OrbitControls makeDefault />
                {DynamicScene && <DynamicScene />}
              </Canvas>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 