import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : undefined;

export async function callLLM(prompt: string): Promise<string> {
  if (!openai) throw new Error('LLM not configured');
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
  });
  return completion.choices[0]?.message?.content ?? '';
}

export async function isMolecularPrompt(prompt: string): Promise<boolean> {
  if (!openai) return true;
  const question = `Is the following prompt about a molecule or chemistry topic? "${prompt}" Answer yes or no.`;
  const result = await callLLM(question);
  return /^yes/i.test(result.trim());
}

export async function interpretQueryToMoleculeName(userInput: string): Promise<string> {
  if (!openai) {
    // Fallback: if LLM is not configured, try to use the input directly if it looks like a simple molecule name
    if (userInput.split(' ').length <= 3 && !/[?!.,:;]/.test(userInput)) {
      return userInput;
    }
    // If it's a complex query and LLM is not available, we can't do much.
    // Throw an error or return a default. For now, let's assume it might be a direct name.
    // Or, we could throw: throw new Error('LLM not configured to interpret complex query.');
    console.warn("LLM not configured. Attempting to use query directly for PubChem lookup.");
    return userInput; // Or a specific "unknown" / error indicator
  }

  const prompt = `Given the user input related to molecular structures or chemistry, identify the primary molecule name or chemical identifier that the user is interested in.
Only respond with the most relevant molecule name or identifier. If no specific molecule can be clearly identified, or if the query is too general or not about a specific molecule, respond with 'N/A'.

Important guidelines:
1. Prefer simple, well-known examples if the query is about a class of compounds (e.g., for "carboranes", a common example like "o-carborane" or "1,2-dicarba-closo-dodecaborane" would be good).
2. For complex structures or topics, choose a representative simple example.
3. Use common names if appropriate, but ensure they are searchable in PubChem. IUPAC names are also good.
4. Avoid returning conversational parts of the query.
5. For queries like "Tell me about X", extract "X".
6. If the query is a question like "What is the structure of Y?", extract "Y".

Examples:
- User input: "Tell me about bullvalene's fluxional structure" -> Output: "bullvalene"
- User input: "What are crown ethers?" -> Output: "18-crown-6" (as a representative example)
- User input: "Information on Fe(CO)5" -> Output: "Fe(CO)5"
- User input: "glucose" -> Output: "glucose"
- User input: "Teach me about carboranes and their polyhedral cage structures" -> Output: "o-carborane" (or another specific carborane)
- User input: "What is water?" -> Output: "water"
- User input: "Explain photosynthesis" -> Output: "N/A" (too general, not a specific molecule for direct lookup)

User input: "${userInput}"
Output:`;

  const moleculeName = await callLLM(prompt);
  if (moleculeName.trim().toUpperCase() === 'N/A' || moleculeName.trim() === '') {
    // If LLM says N/A, it means it couldn't find a specific molecule.
    // We might then throw an error or let PubChem search try the original (less ideal for long queries).
    // For now, let's throw a specific error that can be caught by the route handler.
    throw new Error(`Could not identify a specific molecule from the query: "${userInput}"`);
  }
  return moleculeName.trim();
}
