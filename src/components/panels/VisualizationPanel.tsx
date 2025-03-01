import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';

export const VisualizationPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`fixed transition-all duration-300 bg-gray-800 rounded-lg shadow-lg border border-gray-700
      ${isExpanded 
        ? 'inset-0 m-0 rounded-none z-50' 
        : 'relative w-full h-full p-2'
      }`}
    >
      <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute top-2 right-2 z-10 p-1.5 bg-gray-800 rounded-lg 
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