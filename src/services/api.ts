/* eslint-disable */
interface PromptResponse {
  result: string;
}

export const submitPrompt = async (_prompt: string): Promise<PromptResponse> => {
  const hi = JSON.stringify({ prompt: _prompt })
  console.log('submitting prompt', hi);
  const response = await fetch('http://165.232.151.162:8000/prompt/generate-geometry/', {
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