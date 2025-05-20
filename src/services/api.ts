/* eslint-disable */
import { ModelInfo } from '../types';

interface PromptRequest {
  prompt: string;
  model?: string;
  preferred_model_category?: string;
}

// Initial prompt submission response
interface InitialPromptResponse {
  job_id: string;
  status: string;
  message: string;
}

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

// Legacy response types - keeping for backward compatibility
interface PromptResponse {
  result: string;
  is_molecular: boolean;
  validation_message?: string;
}

interface ComplexPromptResponse {
  html: string;
  js: string;
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
const isDevelopment = process.env.NODE_ENV !== 'production';
const useLocalServer = isDevelopment; // Use localhost in development mode
const API_BASE_URL = useLocalServer ? 'http://localhost:8000' : 'https://meshmo.com';

// Determine if we should include credentials based on the server we're using
const includeCredentials = useLocalServer;

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
 * Request structure for /prompt/generate-from-pubchem/:
 * {
 *   prompt: string;           // The molecule query/name to search for
 *   model?: string;          // Optional: specific model to use
 *   preferred_model_category?: string;  // Optional: preferred category of model
 * }
 *
 * Response structure:
 * {
 *   pdb_data: string;        // The PDB data for the molecule
 *   result_html: string;     // The HTML markup for the visualization container
 *   title: string;           // The title/name of the molecule
 *   status?: string;         // Optional: status of the request ('failed' if error)
 *   job_id?: string;         // Optional: job ID if request is rejected
 *   error?: string;          // Optional: error message if request fails
 * }
 *
 * Generates a 3D visualization from PubChem data for a molecule query
 * @param request The prompt request containing the molecule query
 * @returns Object containing the PDB data, HTML, and title
 */
export const generateFromPubChem = async (
  request: PromptRequest
): Promise<{
  pdb_data: string;
  result_html: string;
  title: string;
}> => {
  const endpoint = `${API_BASE_URL}/prompt/generate-from-pubchem/`;

  console.log('Generating PubChem visualization for:', request);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: includeCredentials ? 'include' : 'same-origin',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Check if the prompt was rejected due to not being scientific
    if (result.status === 'failed' && result.job_id === 'rejected') {
      console.warn('Non-molecular prompt rejected:', result.error);
      throw new Error(`Molecular validation failed: ${result.error}`);
    }

    // Ensure we have the HTML field, even if it's null
    if (result.result_html === undefined) {
      console.warn('PubChem response missing result_html field, setting to null');
      result.result_html = null;
    }

    return result;
  } catch (error: any) {
    console.error('Error generating PubChem visualization:', error);
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

  console.log('Fetching models from:', endpoint);

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
    console.log('Successfully fetched models:', data);
    return data;
  } catch (error: any) {
    console.error('Error fetching models:', error);
    throw new Error(`Failed to fetch models: ${error.message}`);
  }
};

/**
 * Classifies a molecule query as small molecule or macromolecule
 * @param prompt The user prompt describing the molecule
 */
export const classifyMolecule = async (
  prompt: string
): Promise<MoleculeClassificationResponse> => {
  // Classification is handled by a local Next.js route
  const endpoint = `/api/classify`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: includeCredentials ? 'include' : 'same-origin',
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`Failed to classify molecule: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

/**
 * Generates a visualization from RCSB PDB data for macromolecules
 */
export const generateFromRCSB = async (
  request: PromptRequest
): Promise<{
  pdb_data: string;
  result_html: string;
  title: string;
}> => {
  const endpoint = `${API_BASE_URL}/prompt/generate-from-rcsb/`;

  console.log('Generating RCSB visualization for:', request);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: includeCredentials ? 'include' : 'same-origin',
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status === 'failed' && result.job_id === 'rejected') {
    console.warn('Non-molecular prompt rejected:', result.error);
    throw new Error(`Molecular validation failed: ${result.error}`);
  }

  if (result.result_html === undefined) {
    console.warn('RCSB response missing result_html field, setting to null');
    result.result_html = null;
  }

  return result;
};
