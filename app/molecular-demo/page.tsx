/**
 * Molecular Demo Page
 *
 * Demonstrates the new client-side molecular processing capabilities
 * that replace PyMOL server functionality.
 */

'use client';

import React, { useState } from 'react';
// import { searchMoleculeByName } from '@/services/molecular'; // Using API endpoint instead
import Molecule2DViewer, { MoleculeCard2D } from '@/components/panels/Molecule2DViewer';
import MoleculeViewer from '@/components/panels/MoleculeViewer';
import SimpleStructureViewer from '@/components/panels/SimpleStructureViewer';

interface DemoMolecule {
  name: string;
  smiles: string;
  formula?: string;
  molecular_weight?: number;
  pdb_data?: string;
  sdf_data?: string;
}

const DEMO_MOLECULES = [
  {
    name: 'Caffeine',
    smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
    formula: 'C8H10N4O2',
    molecular_weight: 194.19,
  },
  {
    name: 'Aspirin',
    smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O',
    formula: 'C9H8O4',
    molecular_weight: 180.16,
  },
  {
    name: 'Glucose',
    smiles: 'C([C@@H]1[C@H]([C@@H]([C@H]([C@H](O1)O)O)O)O)O',
    formula: 'C6H12O6',
    molecular_weight: 180.16,
  },
  { name: 'Benzene', smiles: 'C1=CC=CC=C1', formula: 'C6H6', molecular_weight: 78.11 },
  { name: 'Ethanol', smiles: 'CCO', formula: 'C2H6O', molecular_weight: 46.07 },
  { name: 'Water', smiles: 'O', formula: 'H2O', molecular_weight: 18.02 },
];

export default function MolecularDemoPage() {
  const [selectedMolecule, setSelectedMolecule] = useState<DemoMolecule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<DemoMolecule | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [view3D, setView3D] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      // Use the existing API endpoint instead of direct PubChem calls
      const response = await fetch('/api/prompt/fetch-molecule-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Extract SMILES from the API response
      const smiles = data.smiles || data.info?.canonical_smiles || data.info?.isomeric_smiles || '';

      setSearchResult({
        name: data.name || searchQuery,
        smiles: smiles,
        formula: data.formula || data.info?.formula,
        molecular_weight: data.info?.formula_weight,
        pdb_data: data.pdb_data,
        sdf_data: data.sdf,
      });
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleMoleculeSelect = (molecule: DemoMolecule) => {
    setSelectedMolecule(molecule);
    setView3D(false);
  };

  const handleView3D = () => {
    setView3D(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Client-Side Molecular Processing Demo
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            This demo showcases our new client-side molecular processing capabilities using
            OpenChemLib and direct PubChem API integration, eliminating the need for PyMOL server
            calls.
          </p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Search Molecules</h2>
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Enter molecule name (e.g., caffeine, aspirin, glucose)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button
              type="button"
              onClick={e => {
                e.preventDefault();
                handleSearch();
              }}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchError && <div className="text-red-600 mb-4">Error: {searchError}</div>}

          {/* Debug info */}
          {process.env.NODE_ENV === 'development' && searchResult && (
            <div className="bg-gray-100 p-3 rounded text-xs mb-4">
              <strong>Debug Info:</strong>
              <br />
              SMILES: {searchResult.smiles || 'None'}
              <br />
              Formula: {searchResult.formula || 'None'}
              <br />
              MW: {searchResult.molecular_weight || 'None'}
            </div>
          )}

          {searchResult && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3">Search Result:</h3>
              <MoleculeCard2D
                smiles={searchResult.smiles}
                name={searchResult.name}
                formula={searchResult.formula}
                molecularWeight={searchResult.molecular_weight}
                onViewDetails={() => handleMoleculeSelect(searchResult)}
              />
            </div>
          )}
        </div>

        {/* Demo Molecules Grid */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Demo Molecules</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEMO_MOLECULES.map(molecule => (
              <div
                key={molecule.name}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col items-center">
                  <SimpleStructureViewer smiles={molecule.smiles} width={180} height={180} />
                  <h3 className="text-lg font-semibold mt-3 mb-2">{molecule.name}</h3>
                  <div className="text-sm text-gray-600 space-y-1 w-full">
                    <div className="flex justify-between">
                      <span>Formula:</span>
                      <span className="font-mono">{molecule.formula}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>MW:</span>
                      <span>{molecule.molecular_weight} g/mol</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      handleMoleculeSelect(molecule);
                    }}
                    className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Molecule Details */}
        {selectedMolecule && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{selectedMolecule.name} - Detailed View</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    setView3D(false);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    !view3D
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  2D Structure
                </button>
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    handleView3D();
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    view3D
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  disabled={!selectedMolecule.pdb_data && !selectedMolecule.sdf_data}
                >
                  3D Structure
                </button>
              </div>{' '}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Structure Viewer */}
              <div className="flex justify-center">
                {view3D ? (
                  selectedMolecule.pdb_data || selectedMolecule.sdf_data ? (
                    <div className="w-full h-96 bg-gray-900 rounded-lg">
                      <MoleculeViewer
                        pdbData={selectedMolecule.pdb_data || ''}
                        sdfData={selectedMolecule.sdf_data}
                        title={selectedMolecule.name}
                        showAnnotations={true}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                      <div className="text-gray-500 text-center">
                        <p>3D structure not available</p>
                        <p className="text-sm">Try searching for the molecule to get 3D data</p>
                      </div>
                    </div>
                  )
                ) : (
                  <Molecule2DViewer
                    smiles={selectedMolecule.smiles}
                    width={400}
                    height={400}
                    transparent={false}
                    atomLabels={true}
                    className="border border-gray-200 rounded-lg"
                  />
                )}
              </div>

              {/* Molecule Information */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Molecular Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">Name:</span>
                      <span>{selectedMolecule.name}</span>
                    </div>
                    {selectedMolecule.formula && (
                      <div className="flex justify-between">
                        <span className="font-medium">Formula:</span>
                        <span className="font-mono">{selectedMolecule.formula}</span>
                      </div>
                    )}
                    {selectedMolecule.molecular_weight && (
                      <div className="flex justify-between">
                        <span className="font-medium">Molecular Weight:</span>
                        <span>
                          {typeof selectedMolecule.molecular_weight === 'number'
                            ? selectedMolecule.molecular_weight.toFixed(2)
                            : selectedMolecule.molecular_weight}{' '}
                          g/mol
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="font-medium">SMILES:</span>
                      <span className="font-mono text-xs break-all max-w-xs">
                        {selectedMolecule.smiles}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Available Data</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          selectedMolecule.smiles ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span>2D Structure (SMILES)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          selectedMolecule.sdf_data ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span>3D Structure (SDF)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          selectedMolecule.pdb_data ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span>PDB Format</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Client-Side Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="font-medium mb-2">Fast Performance</h3>
              <p className="text-sm text-gray-600">
                No server round-trips for basic molecular operations
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="font-medium mb-2">Direct API Access</h3>
              <p className="text-sm text-gray-600">Direct integration with PubChem and RCSB PDB</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 7.172V5L8 4z"
                  />
                </svg>
              </div>
              <h3 className="font-medium mb-2">Client-Side Processing</h3>
              <p className="text-sm text-gray-600">2D structure generation and format conversion</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
