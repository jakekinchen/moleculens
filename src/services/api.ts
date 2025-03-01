/* eslint-disable */
interface PromptResponse {
  result: string;
}

export const submitPrompt = async (_prompt: string, model: string = 'llama3-70b'): Promise<PromptResponse> => {
  console.log('submitting prompt with model:', model);
  
  const input = JSON.stringify({ prompt: _prompt })
  console.log('submitting prompt', input, 'with model:', model);
  
  const response = await fetch(`https://meshmo.com/prompt/generate-geometry/?model=${model}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: _prompt }),
  });

  // const response = await fetch('http://165.232.151.162:8000/geometry/html-test-page/', {
  //   method: 'GET',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  // });

  if (!response.ok) {
    throw new Error('Failed to submit prompt');
  }

  console.log('successful api request');
  return response.json();
}; 