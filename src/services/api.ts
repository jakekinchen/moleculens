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
  js: string;
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

// API base URL configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const useLocalServer = isDevelopment; // Use localhost in development mode
const API_BASE_URL = useLocalServer ? 'http://localhost:8000' : 'https://meshmo.com';

// Determine if we should include credentials based on the server we're using
const includeCredentials = useLocalServer;

/**
 * Submits a prompt to start background processing
 * @param request The prompt request containing prompt text and optional model settings
 * @returns A response containing the job_id for polling
 * @throws Error if prompt validation fails or request fails
 */
export const submitPrompt = async (request: PromptRequest): Promise<InitialPromptResponse> => {
  const endpoint = `${API_BASE_URL}/prompt`;
  
  console.log('Submitting prompt', request);
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: includeCredentials ? 'include' : 'same-origin',
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit prompt: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  // Check if the prompt was rejected due to not being scientific
  if (result.status === 'failed' && result.job_id === 'rejected') {
    console.warn('Non-molecular prompt rejected:', result.error);
    throw new Error(`Molecular validation failed: ${result.error}`);
  }

  return result;
};

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
 * Generates Three.js geometry for a scientific prompt
 * This uses the /prompt/generate-geometry endpoint for direct, non-polling geometry generation
 * 
 * @param request The prompt request containing prompt text and optional model settings
 * @returns PromptResponse with Three.js code and validation info
 * @throws Error if the request is not molecular with a helpful message
 */
export const legacySubmitPrompt = async (request: PromptRequest): Promise<PromptResponse> => {
  const endpoint = `${API_BASE_URL}/prompt/generate-geometry/`;
  
  console.log('Generating geometry for prompt:', request);
  
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

    // Check if the response indicates non-molecular content
    if (!result.is_molecular) {
      throw new Error(`Non-molecular prompt: ${result.validation_message || 'Please try a molecular structure prompt'}`);
    }

    if (!result.result) {
      throw new Error('No result received from server');
    }

    return result;
  } catch (error: any) {
    console.error('Error generating geometry:', error);
    throw error;
  }
};

/**
 * Generates a 3D visualization from PubChem data for a molecule query
 * @param request The prompt request containing the molecule query
 * @returns Object containing the visualization JS, HTML, and title
 */
export const generateFromPubChem = async (request: PromptRequest): Promise<{
  result: string;
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