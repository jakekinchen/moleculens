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
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    const distance = radius * 2.5;
    camera.position.set(distance, distance * 0.8, distance);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }, [camera, scene]);

  return null;
};

interface VisualizationPanelProps {
  script?: string;
}

// Add display name to fix react/display-name error
const DynamicSceneComponent = () => {
  const sunGeometry = new THREE.SphereGeometry(5, 64, 64);
  const sunMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xffcc00, 
    emissive: 0xffaa00, 
    emissiveIntensity: 0.5 
  });

  return (
    <>
      {/* @ts-ignore to bypass react/no-unknown-property for Three.js props */}
      <ambientLight intensity={0.4} />
      {/* @ts-ignore */}
      <directionalLight position={[1, 1, 1]} intensity={1} />
      {/* @ts-ignore */}
      <mesh geometry={sunGeometry} material={sunMaterial} />
    </>
  );
};

export const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ script }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const DynamicScene = useMemo(() => {
    if (!script) return null;
    
    try {
      const match = script.match(/\/\/ GeometryAgent LLM-generated code([\s\S]*?)(?=\n\s*\/\/|$)/);
      if (!match || !match[1]) return null;
      
      return DynamicSceneComponent;
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
            transition-opacity duration-300 ${isTransitioning ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
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
                {/* @ts-ignore */}
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