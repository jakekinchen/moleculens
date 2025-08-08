/* eslint-disable */
import { ModelInfo, DiagramPromptRequest, DiagramResponse } from '../types';

// Response while processing or when complete
interface JobStatusResponse {
  job_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  visualization?: VisualizationData;
  error?: string;
}

// Visualization data when job is completed
interface VisualizationData {
  html: string;
  title: string;
  timecode_markers: string[];
  total_elements: number;
}

// Response from the classification endpoint
export interface MoleculeClassificationResponse {
  type: 'small' | 'macromolecule' | 'unknown';
  name?: string;
}

// API base URL configuration
// Priority:
// 1) Use NEXT_PUBLIC_API_BASE_URL if provided (allows pointing dev build to production backend)
// 2) Fallback to using Next.js route handlers under `/api`
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

// Only include credentials (cookies) when we are talking to a same-origin localhost backend
const includeCredentials = API_BASE_URL.startsWith('http://localhost');

/**
 * Polls the status of a job
 * @param jobId The job ID returned from submitPrompt
 * @returns The current status of the job
 */
export const pollJobStatus = async (jobId: string): Promise<JobStatusResponse> => {
  const endpoint = `${API_BASE_URL}/prompt/process/${jobId}`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: includeCredentials ? 'include' : 'same-origin',
  });

  if (!response.ok) {
    throw new Error(`Failed to poll job status: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

/**
 * Fetch only the PDB and minimal data for a given molecule query (Step A).
 * Calls /fetch-molecule-data/ on the backend.
 *
 * @param query The molecule name or query
 * @returns An object containing { pdb_data, name, cid, formula, sdf, etc. }
 */
export const fetchMoleculeData = async (
  query: string,
  options?: { alwaysFindMolecule?: boolean }
): Promise<{
  pdb_data?: string;
  sdf?: string;
  name: string;
  cid: number;
  formula: string;
  info: any;
  moleculeType?: 'small molecule' | 'macromolecule';
  pdb_id?: string;
}> => {
  const endpoint = `${API_BASE_URL}/prompt/fetch-molecule-data/`;

  if (process.env.NODE_ENV !== 'production') {
    console.log('=== MOLECULE DATA REQUEST ===');
    console.log('Query:', query);
    console.log('Endpoint:', endpoint);
    console.log('Timestamp:', new Date().toISOString());
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: includeCredentials ? 'include' : 'same-origin',
      body: JSON.stringify({ query, alwaysFindMolecule: !!options?.alwaysFindMolecule }),
    });
    let result: any = {};
    try {
      result = await response.json();
    } catch {
      // ignore parse errors
    }

    if (!response.ok) {
      const message = result?.error ? result.error : `${response.status} ${response.statusText}`;
      throw new Error(`Failed to fetch molecule data: ${message}`);
    }

    if (result.detail) {
      throw new Error(result.detail);
    }

    if (process.env.NODE_ENV !== 'production') {
      // Log the response with SDF information
      console.log('=== MOLECULE DATA RESPONSE ===');
      console.log('Molecule Name:', result.name);
      console.log('CID:', result.cid);
      console.log('Formula:', result.formula);
      console.log('Has PDB Data:', !!result.pdb_data);
      console.log('Has SDF Data:', !!result.sdf);
      if (result.sdf) {
        console.log('SDF Data Length:', result.sdf.length);
        console.log('SDF Data Preview (first 500 chars):', result.sdf.substring(0, 500));
        console.log('Full SDF Data:', result.sdf);
      }
      if (result.pdb_data) {
        console.log('PDB Data Length:', result.pdb_data.length);
        console.log('PDB Data Preview (first 1500 chars):', result.pdb_data.substring(0, 1500));
      }
      console.log('Additional Info:', result.info);
      console.log('================================');
    }

    return result;
  } catch (error: any) {
    console.error('Error fetching molecule data:', error);
    throw error;
  }
};

/**
 * Generate the HTML from previously fetched molecule data (Step B).
 * Calls /generate-molecule-html/ on the backend.
 *
 * @param moleculeData The object with { pdb_data, name, cid, sdf, formula, etc. }
 * @returns { html: string }
 */
export const generateMoleculeHTML = async (
  moleculeData: Record<string, any>
): Promise<{ html: string }> => {
  const endpoint = `${API_BASE_URL}/prompt/generate-molecule-html/`;

  if (process.env.NODE_ENV !== 'production') {
    console.log('=== MOLECULE HTML GENERATION REQUEST ===');
    console.log('Molecule Data:', moleculeData);
    console.log('Endpoint:', endpoint);
    console.log('Timestamp:', new Date().toISOString());
    if (moleculeData.sdf) {
      console.log('SDF Data Length:', moleculeData.sdf.length);
      console.log('SDF Data Preview (first 500 chars):', moleculeData.sdf.substring(0, 500));
      console.log('Full SDF Data:', moleculeData.sdf);
    }
    if (moleculeData.pdb_data) {
      console.log('PDB Data Length:', moleculeData.pdb_data.length);
      console.log('PDB Data Preview (first 500 chars):', moleculeData.pdb_data.substring(0, 500));
    }
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: includeCredentials ? 'include' : 'same-origin',
      body: JSON.stringify({ molecule_data: moleculeData }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate HTML: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    if (!result.html) {
      throw new Error('No HTML returned from backend');
    }

    if (process.env.NODE_ENV !== 'production') {
      // Log the HTML generation response
      console.log('=== MOLECULE HTML GENERATION RESPONSE ===');
      console.log('HTML Length:', result.html.length);
      console.log('HTML Preview (first 500 chars):', result.html.substring(0, 500));
      console.log('==========================================');
    }

    return result;
  } catch (error: any) {
    console.error('Error generating HTML:', error);
    throw error;
  }
};

/**
 * Fetches the list of available models from the backend
 * @returns Array of ModelInfo objects containing model capabilities and information
 * @throws Error if the request fails
 */
export const getModels = async (): Promise<ModelInfo[]> => {
  const endpoint = `${API_BASE_URL}/prompt/models/`;

  if (process.env.NODE_ENV !== 'production') {
    console.log('Fetching models from:', endpoint);
  }

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: includeCredentials ? 'include' : 'same-origin',
    });

    if (!response.ok) {
      console.error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (process.env.NODE_ENV !== 'production') {
      console.log('Successfully fetched models:', data);
    }
    return data;
  } catch (error: any) {
    console.error('Error fetching models:', error);
    throw new Error(`Failed to fetch models: ${error.message}`);
  }
};

// ---------------------------------------------
// Molecule diagram (2D) generation endpoint
// ---------------------------------------------

export const generateMoleculeDiagram = async (
  request: DiagramPromptRequest
): Promise<DiagramResponse> => {
  const endpoint = `${API_BASE_URL}/prompt/generate-molecule-diagram/`;

  if (process.env.NODE_ENV !== 'production') {
    console.log('=== MOLECULE DIAGRAM REQUEST ===');
    console.log('Request:', request);
    console.log('Endpoint:', endpoint);
    console.log('Timestamp:', new Date().toISOString());
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: includeCredentials ? 'include' : 'same-origin',
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to generate molecule diagram: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();

  if (process.env.NODE_ENV !== 'production') {
    // Log the diagram response
    console.log('=== MOLECULE DIAGRAM RESPONSE ===');
    console.log('Response:', result);
    console.log('Has Diagram Image:', !!result.diagram_image);
    console.log('Has Diagram Plan:', !!result.diagram_plan);
    if (result.diagram_plan) {
      console.log('Diagram Plan:', result.diagram_plan);
    }
    console.log('===================================');
  }

  return result;
};

/**
 * Generate a presentation script for a molecule
 * @param moleculeData The molecule data to generate a script for
 * @returns The generated presentation script
 */
export const generatePresentationScript = async (
  moleculeData: Record<string, any>
): Promise<{ script: any }> => {
  const endpoint = `${API_BASE_URL}/prompt/generate-presentation-script/`;

  if (process.env.NODE_ENV !== 'production') {
    console.log('=== PRESENTATION SCRIPT GENERATION REQUEST ===');
    console.log('Molecule Data:', moleculeData);
    console.log('Endpoint:', endpoint);
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: includeCredentials ? 'include' : 'same-origin',
      body: JSON.stringify({ molecule_data: moleculeData }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to generate presentation script: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    if (process.env.NODE_ENV !== 'production') {
      // Log the presentation script generation response
      console.log('=== PRESENTATION SCRIPT GENERATION RESPONSE ===');
      console.log('Script:', result.script);
    }

    return result;
  } catch (error: any) {
    console.error('Error generating presentation script:', error);
    throw error;
  }
};

// ---------------------------------------------
// FigureSpec flow (content-addressed)
// ---------------------------------------------

export interface SubmitResponse {
  spec_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  urls?: Record<string, string> | null;
}

export async function submitFigureSpec(spec: Record<string, any>): Promise<SubmitResponse> {
  const r = await fetch(`${API_BASE_URL}/figure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(spec),
    credentials: includeCredentials ? 'include' : 'same-origin',
  });
  if (!r.ok) throw new Error(`submit failed: ${r.status}`);
  return r.json();
}

export async function getFigureStatus(spec_id: string): Promise<SubmitResponse> {
  const r = await fetch(`${API_BASE_URL}/figure/${spec_id}`, { cache: 'no-store', credentials: includeCredentials ? 'include' : 'same-origin' });
  if (!r.ok) throw new Error(`status failed: ${r.status}`);
  return r.json();
}

