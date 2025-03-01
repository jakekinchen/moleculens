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

    // Clear existing content
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }

    // Create HTML container and parse content
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(data.html, 'text/html');
    const htmlContainer = document.createElement('div');
    htmlContainer.innerHTML = htmlDoc.body.innerHTML;

    // Add content to container
    containerRef.current.appendChild(htmlContainer);

    // Execute animation code
    try {
      const executeAnimation = new Function('THREE', data.js);
      executeAnimation(THREE);
    } catch (error) {
      console.error('Failed to execute visualization:', error);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default ComplexVisualization; 