/**
 * 2D Molecular Structure Viewer
 *
 * This component renders 2D molecular structures using OpenChemLib
 * for thumbnails, overlays, and diagram elements.
 */

import React, { useEffect, useRef, useState } from 'react';
import { generate2DMoleculeImage, Molecule2DOptions, Molecule2DResult } from '@/services/molecular';

interface Molecule2DViewerProps {
  smiles: string;
  width?: number;
  height?: number;
  transparent?: boolean;
  atomLabels?: boolean;
  className?: string;
  onImageGenerated?: (result: Molecule2DResult) => void;
  onError?: (error: Error) => void;
}

export default function Molecule2DViewer({
  smiles,
  width = 300,
  height = 300,
  transparent = false,
  atomLabels = false,
  className = '',
  onImageGenerated,
  onError,
}: Molecule2DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<Molecule2DResult | null>(null);

  useEffect(() => {
    if (!smiles) {
      setError('No SMILES data provided');
      setIsLoading(false);
      return;
    }

    const generateImage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Try to use OpenChemLib for actual 2D structure generation
        try {
          const OCL = await import('openchemlib');
          const molecule = OCL.Molecule.fromSmiles(smiles);

          const svg = molecule.toSVG(width, height, undefined, {
            suppressChiralText: !atomLabels,
            suppressESR: true,
            suppressCIPParity: true,
            noStereoProblem: true,
          });

          const result: Molecule2DResult = {
            svg,
            width,
            height,
          };

          setImageResult(result);

          if (onImageGenerated) {
            onImageGenerated(result);
          }
        } catch (oclError) {
          console.warn('OpenChemLib failed, using fallback:', oclError);

          // Fallback to a more informative placeholder
          const placeholderSVG = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="${transparent ? 'none' : 'white'}" stroke="#e5e7eb" stroke-width="1"/>
              <circle cx="50%" cy="40%" r="20" fill="#3b82f6" opacity="0.2"/>
              <text x="50%" y="30%" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#3b82f6" font-weight="bold">
                2D Structure
              </text>
              <text x="50%" y="50%" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#6b7280">
                Loading...
              </text>
              <text x="50%" y="70%" text-anchor="middle" font-family="monospace" font-size="8" fill="#9ca3af">
                ${smiles.length > 40 ? smiles.substring(0, 40) + '...' : smiles}
              </text>
            </svg>
          `;

          const result: Molecule2DResult = {
            svg: placeholderSVG,
            width,
            height,
          };

          setImageResult(result);

          if (onImageGenerated) {
            onImageGenerated(result);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate 2D structure';
        setError(errorMessage);

        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMessage));
        }
      } finally {
        setIsLoading(false);
      }
    };

    generateImage();
  }, [smiles, width, height, transparent, atomLabels, onImageGenerated, onError]);

  if (isLoading) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-gray-100 rounded ${className}`}
        style={{ width, height }}
      >
        <div className="text-sm text-gray-500">Generating structure...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-red-50 border border-red-200 rounded ${className}`}
        style={{ width, height }}
      >
        <div className="text-sm text-red-600 text-center px-2">Error: {error}</div>
      </div>
    );
  }

  if (!imageResult?.svg) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-gray-100 rounded ${className}`}
        style={{ width, height }}
      >
        <div className="text-sm text-gray-500">No structure available</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded ${className}`}
      style={{ width, height }}
    >
      <div dangerouslySetInnerHTML={{ __html: imageResult.svg }} className="w-full h-full" />
    </div>
  );
}

/**
 * Hook for generating 2D molecular images
 */
export function useMolecule2D(smiles: string, options?: Molecule2DOptions) {
  const [result, setResult] = useState<Molecule2DResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!smiles) {
      setResult(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const generateImage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const imageResult = await generate2DMoleculeImage(smiles, options);
        setResult(imageResult);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to generate 2D structure'));
      } finally {
        setIsLoading(false);
      }
    };

    generateImage();
  }, [smiles, options]);

  return { result, isLoading, error };
}

/**
 * Utility component for molecule thumbnails
 */
interface MoleculeThumbnailProps {
  smiles: string;
  size?: number;
  className?: string;
  onClick?: () => void;
}

export function MoleculeThumbnail({
  smiles,
  size = 150,
  className = '',
  onClick,
}: MoleculeThumbnailProps) {
  return (
    <div
      className={`cursor-pointer hover:opacity-80 transition-opacity ${className}`}
      onClick={onClick}
    >
      <Molecule2DViewer
        smiles={smiles}
        width={size}
        height={size}
        transparent={true}
        atomLabels={false}
        className="border border-gray-200 hover:border-gray-300"
      />
    </div>
  );
}

/**
 * Component for displaying molecular properties alongside 2D structure
 */
interface MoleculeCard2DProps {
  smiles: string;
  name: string;
  formula?: string;
  molecularWeight?: number;
  properties?: Record<string, string | number>;
  onViewDetails?: () => void;
}

export function MoleculeCard2D({
  smiles,
  name,
  formula,
  molecularWeight,
  properties,
  onViewDetails,
}: MoleculeCard2DProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 max-w-sm">
      <div className="flex flex-col items-center">
        <Molecule2DViewer
          smiles={smiles}
          width={200}
          height={200}
          transparent={true}
          atomLabels={false}
          className="mb-3"
        />

        <h3 className="text-lg font-semibold text-center mb-2">{name}</h3>

        <div className="text-sm text-gray-600 space-y-1 w-full">
          {formula && (
            <div className="flex justify-between">
              <span>Formula:</span>
              <span className="font-mono">{formula}</span>
            </div>
          )}

          {molecularWeight && (
            <div className="flex justify-between">
              <span>MW:</span>
              <span>
                {typeof molecularWeight === 'number' ? molecularWeight.toFixed(2) : molecularWeight}{' '}
                g/mol
              </span>
            </div>
          )}

          {properties &&
            Object.entries(properties).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span>{key}:</span>
                <span>{value}</span>
              </div>
            ))}
        </div>

        {onViewDetails && (
          <button
            type="button"
            onClick={e => {
              e.preventDefault();
              onViewDetails();
            }}
            className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
}
