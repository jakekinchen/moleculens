import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';

export const VisualizationPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleExpand = () => {
    setIsTransitioning(true);
    setIsExpanded(!isExpanded);
    setTimeout(() => setIsTransitioning(false), 300); // Match duration-300
  };

  return (
    <div className={`fixed transition-all duration-300 bg-gray-800 rounded-lg shadow-lg border border-gray-700
      ${isExpanded 
        ? 'inset-0 m-0 rounded-none z-50' 
        : 'relative w-full h-full p-2'
      }`}
    >
      <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
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

        <Canvas
          camera={{ position: [0, 0, 5], fov: 75 }}
          style={{ width: '100%', height: '100%' }}
        >
          <color attach="background" args={['#111']} />
          <OrbitControls />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <mesh>
            <boxGeometry />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
        </Canvas>
      </div>
    </div>
  );
}; 