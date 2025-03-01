/* eslint-disable */
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
}

interface ComplexPromptResponse {
  html: string;
  js: string;
  title: string;
  timecode_markers: string[];
  total_elements: number;
}

// API base URL configuration
const useLocalServer = false; // Set to true to use localhost for development
const API_BASE_URL = useLocalServer ? 'http://localhost:8000' : 'https://meshmo.com';

/**
 * Submits a prompt to start background processing
 * @param prompt The user's prompt text
 * @param model The model to use for generation
 * @returns A response containing the job_id for polling
 * @throws Error if prompt validation fails or request fails
 */
export const submitPrompt = async (prompt: string, model: string = 'llama3-70b'): Promise<InitialPromptResponse> => {
  const endpoint = `${API_BASE_URL}/prompt`;
  
  console.log('Submitting prompt', { prompt, model });
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, model }),
    credentials: 'include', // Include credentials for CORS with authentication
  });

  if (!response.ok) {
    throw new Error(`Failed to submit prompt: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  // Check if the prompt was rejected due to not being scientific
  if (result.status === 'failed' && result.job_id === 'rejected') {
    console.warn('Non-scientific prompt rejected:', result.error);
    throw new Error(`Scientific validation failed: ${result.error}`);
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
    credentials: 'include', // Include credentials for CORS with authentication
  });

  if (!response.ok) {
    throw new Error(`Failed to poll job status: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

/**
 * Legacy method for backward compatibility
 * @deprecated Use submitPrompt and pollJobStatus instead
 */
export const legacySubmitPrompt = async (_prompt: string, model: string = 'llama3-70b'): Promise<PromptResponse> => {
  const input = JSON.stringify({ prompt: _prompt })
  console.log('submitting prompt', input, 'with model:', model);
  
  const response = await fetch(`${API_BASE_URL}/prompt/generate-geometry/?model=${model}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: _prompt }),
    credentials: 'include', // Include credentials for CORS with authentication
  });

  if (!response.ok) {
    throw new Error('Failed to submit prompt');
  }

  console.log('successful api request');
  return response.json();
};