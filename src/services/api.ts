/* eslint-disable */
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

export const submitPrompt = async (_prompt: string, isInteractiveMode: boolean): Promise<PromptResponse | ComplexPromptResponse> => {
  const endpoint = isInteractiveMode 
    ? 'https://meshmo.com/prompt/'
    : 'https://meshmo.com/prompt/generate-geometry/';

  console.log('submitting prompt', JSON.stringify({ prompt: _prompt }));

  console.log('endpoint used', endpoint);
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: _prompt }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit prompt');
  }

  console.log('successful api request');
  return response.json();
}; 