/**
 * Simple Structure Viewer for testing OpenChemLib
 */

import React, { useEffect, useState } from 'react';

interface SimpleStructureViewerProps {
  smiles: string;
  width?: number;
  height?: number;
}

export default function SimpleStructureViewer({
  smiles,
  width = 200,
  height = 200,
}: SimpleStructureViewerProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateStructure = async () => {
      if (!smiles) {
        setError('No SMILES provided');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        console.log('Attempting to load OpenChemLib...');
        const OCL = await import('openchemlib');
        console.log('OpenChemLib loaded successfully');

        console.log('Parsing SMILES:', smiles);
        const molecule = OCL.Molecule.fromSmiles(smiles);
        console.log('Molecule created successfully');

        const svgResult = molecule.toSVG(width, height);
        console.log('SVG generated successfully');

        setSvg(svgResult);
      } catch (err) {
        console.error('Error generating structure:', err);
        setError(
          `Failed to generate structure: ${err instanceof Error ? err.message : 'Unknown error'}`
        );

        // Create a simple fallback SVG
        const fallbackSvg = `
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="white" stroke="#ccc"/>
            <text x="50%" y="30%" text-anchor="middle" font-size="12" fill="#666">Structure Error</text>
            <text x="50%" y="50%" text-anchor="middle" font-size="10" fill="#999">${smiles.substring(0, 20)}...</text>
            <text x="50%" y="70%" text-anchor="middle" font-size="8" fill="#ccc">OpenChemLib failed</text>
          </svg>
        `;
        setSvg(fallbackSvg);
      } finally {
        setLoading(false);
      }
    };

    generateStructure();
  }, [smiles, width, height]);

  if (loading) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center bg-gray-100 border rounded"
      >
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="border rounded overflow-hidden">
      {error && (
        <div className="bg-red-50 border-b border-red-200 p-2">
          <span className="text-xs text-red-600">{error}</span>
        </div>
      )}
      <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width, height }} />
    </div>
  );
}
