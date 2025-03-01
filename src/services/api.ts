interface PromptRequest {
  prompt: string;
}

interface PromptResponse {
  jsx: string;
}

export const submitPrompt = async (prompt: string): Promise<PromptResponse> => {
  // const response = await fetch('http://165.232.151.162:8000/geometry/cube/', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({ prompt }),
  // });

  const response = await fetch('http://165.232.151.162:8000/geometry/cube/', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to submit prompt');
  }

  console.log('success');

  return response.json();
}; 