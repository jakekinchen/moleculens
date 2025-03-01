import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls';

interface ComplexVisualizationProps {
  data: {
    html: string;
    js: string;
    title: string;
  };
}

interface SceneRefs {
  scene?: THREE.Scene;
  camera?: THREE.Camera;
  renderer?: THREE.WebGLRenderer;
  controls?: ThreeOrbitControls;
}

const ComplexVisualization: React.FC<ComplexVisualizationProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRefs>({});

  useEffect(() => {
    if (!containerRef.current || !data) return;

    // Clear existing content
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }

    // Create HTML container and parse content
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(data.html, 'text/html');
    const htmlContainer = document.createElement('div');
    htmlContainer.innerHTML = htmlDoc.body.innerHTML;

    // Handle styles
    const styleElement = htmlDoc.querySelector('style');
    if (styleElement) {
      document.head.appendChild(styleElement.cloneNode(true));
    }

    // Add content to container
    containerRef.current.appendChild(htmlContainer);

    // Execute animation code
    try {
      const executeAnimation = new Function('THREE', data.js);
      executeAnimation(THREE);
    } catch (error) {
      console.error('Failed to execute visualization:', error);
    }

    // Cleanup function
    return () => {
      if (sceneRef.current) {
        const { scene, renderer, controls } = sceneRef.current;
        
        controls?.dispose();
        renderer?.dispose();
        
        scene?.traverse((object: THREE.Object3D) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }

      // Remove added styles
      const styles = document.querySelectorAll('style');
      styles.forEach(style => {
        if (style.textContent?.includes('Dynamic World of Water Molecules')) {
          style.remove();
        }
      });
    };
  }, [data]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default ComplexVisualization; 