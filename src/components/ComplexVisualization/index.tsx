import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ComplexVisualizationProps {
  data: {
    html: string;
    js: string;
    title: string;
  };
}

const ComplexVisualization: React.FC<ComplexVisualizationProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer();
    
    // ... rest of setup code ...

    return () => {
      // Use captured variables instead of ref
      renderer.dispose();
      scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [data]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default ComplexVisualization; 