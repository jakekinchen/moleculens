/* eslint-disable */
import React, { useState, useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import * as THREE from 'three';
import { LoadingFacts } from './LoadingFacts';

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
  isInteractiveMode: boolean;
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
  isLoading = false,
  isInteractiveMode
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
          <LoadingFacts isVisible={isLoading && !isTransitioning} showFacts={true} />

          {/* Only show expand button when there's a script/visualization */}
          {!isLoading && !isTransitioning && script && (
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
          )}

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
                {DynamicScene && <DynamicScene />}
              </Canvas>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 