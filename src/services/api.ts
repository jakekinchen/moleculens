interface PromptRequest {
  prompt: string;
}

interface PromptResponse {
  html: string;
}

export const submitPrompt = async (prompt: string): Promise<PromptResponse> => {
  // const response = await fetch('http://165.232.151.162:8000/generate-geometry/', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({ prompt }),
  // });

  const response = await fetch('http://165.232.151.162:8000/geometry/html-test-page/', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to submit prompt');
  }

  console.log('successful api request');

  return response.json();
}; 