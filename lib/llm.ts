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

export interface PromptClassification {
  type: 'molecule' | 'macromolecule' | 'unknown';
  name: string | null;
}

/**
 * Classify a user prompt and optionally extract a molecule name.
 * If the underlying LLM is not configured this will default to
 * treating the prompt as a small molecule and echoing the input
 * as the name so development can proceed without the API key.
 */
export async function classifyPrompt(prompt: string): Promise<PromptClassification> {
  if (!openai) {
    return { type: 'molecule', name: prompt };
  }

  const question = `You are a chemical assistant. Classify the following user input as a 'molecule', 'macromolecule', or 'unknown'. If a specific molecule or macromolecule can be identified, provide its common name. Respond ONLY with JSON in the form {"type":"molecule|macromolecule|unknown","name":"<name>"}.

User input: "${prompt}"`;

  const result = await callLLM(question);
  try {
    const parsed = JSON.parse(result);
    let type: 'molecule' | 'macromolecule' | 'unknown' = 'unknown';
    if (parsed.type === 'molecule' || parsed.type === 'macromolecule') {
      type = parsed.type;
    } else if (parsed.type === 'unknown') {
      type = 'unknown';
    }
    const name =
      typeof parsed.name === 'string' && parsed.name.trim() !== '' ? parsed.name.trim() : null;
    return { type, name };
  } catch (err) {
    const lower = result.toLowerCase();
    if (lower.includes('macromolecule')) return { type: 'macromolecule', name: null };
    if (lower.includes('molecule')) return { type: 'molecule', name: null };
    return { type: 'unknown', name: null };
  }
}

export async function interpretQueryToMoleculeName(userInput: string): Promise<string> {
  if (!openai) {
    // Fallback: if LLM is not configured, try to use the input directly if it looks like a simple molecule name
    if (userInput.split(' ').length <= 3 && !/[?!.,:;]/.test(userInput)) {
      return userInput;
    }
    // If it's a complex query and LLM is not available, we can't do much.
    console.warn('LLM not configured. Attempting to use query directly for PubChem lookup.');
    return userInput;
  }

  const prompt = `Your task is to identify a single, specific, and common chemical compound name or identifier from the user's input. This name will be used for a PubChem database search.

CRITICAL INSTRUCTIONS:
1.  **SINGLE SPECIFIC COMPOUND**: You MUST return the name of ONE specific molecule.
2.  **CLASSES OF COMPOUNDS**: If the user asks about a general class of compounds (e.g., "aldehydes", "alkynes", "organosilanes"), you MUST provide a common, simple, and representative EXAMPLE from that class. Do NOT return the class name itself. For instance:
    *   "aldehydes" -> "acetaldehyde" OR "formaldehyde"
    *   "alkynes" -> "acetylene"
    *   "organosilanes" -> "trimethylsilane" OR "tetramethylsilane"
    *   "carboranes" -> "o-carborane" OR "1,2-dicarba-closo-dodecaborane"
    *   "crown ethers" -> "18-crown-6"
3.  **PRIORITIZE COMMON NAMES/EXAMPLES**: Prefer well-known, simple examples.
4.  **SEARCHABILITY**: The name must be something searchable in PubChem. Common names or IUPAC names are good.
5.  **NO CONVERSATION**: Extract only the chemical name. Do not include any conversational parts of the query.
6.  **DIRECT QUESTIONS**: For "Tell me about X" or "What is Y?", extract "X" or "Y" (applying instruction #2 if X or Y is a class).
7.  **N/A FOR NON-MOLECULES**: If no specific molecule (or a specific example from a class) can be clearly identified, or if the query is too general, not about a specific molecule/class, or unresolvable to a specific example, respond with 'N/A'.

Examples:
- User input: "Tell me about bullvalene's fluxional structure" -> Output: "bullvalene"
- User input: "What are crown ethers?" -> Output: "18-crown-6"
- User input: "Information on Fe(CO)5" -> Output: "Fe(CO)5"
- User input: "glucose" -> Output: "glucose"
- User input: "Teach me about carboranes and their polyhedral cage structures" -> Output: "o-carborane"
- User input: "What is water?" -> Output: "water"
- User input: "Explain photosynthesis" -> Output: "N/A"
- User input: "Tell me about organosilanes" -> Output: "trimethylsilane" (or another common, specific organosilane)
- User input: "General properties of alcohols" -> Output: "ethanol" (or "methanol")

User input: "${userInput}"
Output:`;

  const moleculeName = await callLLM(prompt);
  if (moleculeName.trim().toUpperCase() === 'N/A' || moleculeName.trim() === '') {
    throw new Error(`Could not identify a specific molecule from the query: "${userInput}"`);
  }
  return moleculeName.trim();
}
