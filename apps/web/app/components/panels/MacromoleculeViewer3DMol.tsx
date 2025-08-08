"use client";

import React, { useEffect, useRef } from 'react';

interface Props {
  pdbData: string;
  title: string;
}

/**
 * Minimal 3Dmol.js-based viewer for macromolecules
 * Renders PDB text using 3Dmol's cartoon/line styles inside a canvas in this component.
 */
export default function MacromoleculeViewer3DMol({ pdbData, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let viewer: any;
    let scriptEl: HTMLScriptElement | null = null;

    const ensure3DMol = async () => {
      // Load 3Dmol.js from CDN if not present on window
      if (typeof (window as any).$3Dmol === 'undefined') {
        scriptEl = document.createElement('script');
        scriptEl.src = 'https://3Dmol.org/build/3Dmol-min.js';
        scriptEl.async = true;
        document.head.appendChild(scriptEl);
        await new Promise<void>((resolve, reject) => {
          scriptEl!.onload = () => resolve();
          scriptEl!.onerror = () => reject(new Error('Failed to load 3Dmol.js'));
        });
      }

      const $3Dmol = (window as any).$3Dmol;
      if (!containerRef.current) return;

      const width = containerRef.current.clientWidth || 800;
      const height = containerRef.current.clientHeight || 600;
      viewer = new $3Dmol.GLViewer(containerRef.current, {
        backgroundColor: 'rgb(24,34,59)',
        antialias: true,
      });

      viewer.addModel(pdbData, 'pdb');
      // Cartoon for proteins, lines for ligands; auto coloring
      viewer.setStyle({}, { cartoon: { color: 'spectrum' }, line: { linewidth: 1.5 } });
      viewer.addLabel(title, { position: { x: 0, y: 0, z: 0 }, backgroundOpacity: 0.0, fontSize: 14 });
      viewer.zoomTo();
      viewer.render();
      viewer.zoom(1.0, 1000);

      const handleResize = () => {
        if (!containerRef.current || !viewer) return;
        viewer.resize();
        viewer.render();
      };
      const ro = new ResizeObserver(handleResize);
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    };

    (async () => {
      try {
        await ensure3DMol();
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      if (viewer && viewer.clear) viewer.clear();
      if (scriptEl && scriptEl.parentNode) {
        // Keep 3Dmol.js cached for subsequent mounts; do not remove script
      }
    };
  }, [pdbData, title]);

  return <div ref={containerRef} className="relative w-full h-full rounded-xl overflow-hidden" />;
}



