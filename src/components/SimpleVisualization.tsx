/* eslint-disable react/no-unknown-property */
import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface SimpleVisualizationProps {
  geometryCode: string;
}

const SimpleVisualization: React.FC<SimpleVisualizationProps> = ({ geometryCode }) => {
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
      const createScene = new Function('THREE', 'scene', geometryCode);
      createScene(THREE, scene);

      // Clean up function
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
  }, [geometryCode, scene]);

  return (
    <>
      {/* @ts-expect-error @react-three/fiber special props */}
      <ambientLight intensity={0.4} />
      {/* @ts-expect-error @react-three/fiber special props */}
      <directionalLight position={[1, 1, 1]} intensity={1} />
      {/* @ts-expect-error @react-three/fiber special props */}
      <directionalLight position={[-1, -1, -1]} intensity={0.4} />
    </>
  );
};

export default SimpleVisualization; 