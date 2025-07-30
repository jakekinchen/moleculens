import OpenAI from 'openai';
import { z } from 'zod';
import { sanitizeName } from './pubchem';

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : undefined;

export async function callLLM(prompt: string): Promise<string> {
  if (!openai) throw new Error('LLM not configured');
  const completion = await openai.chat.completions.create({
    model: 'o3-mini',
    messages: [{ role: 'user', content: prompt }],
  });
  return completion.choices[0]?.message?.content ?? '';
}

export async function structuredLLMResponse<T>(prompt: string, schema: z.ZodSchema<T>): Promise<T> {
  if (!openai) throw new Error('LLM not configured');
  const completion = await openai.chat.completions.create({
    model: 'o3-mini',
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = completion.choices[0]?.message?.content ?? '';
  // Attempt to parse the LLM response as JSON and validate with the provided schema
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error('Structured LLM response is not valid JSON');
  }
  return schema.parse(json);
}

export interface PromptClassification {
  type: 'small molecule' | 'macromolecule' | 'unknown';
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
    console.warn('LLM not configured. Defaulting to small molecule classification.');
    return { type: 'small molecule', name: sanitizeName(prompt) };
  }

  const question = `You are a chemical assistant. Classify the following user input as a 'small molecule', 'macromolecule', or 'unknown'. If a specific molecule or macromolecule can be identified, provide its common name. Respond ONLY with JSON in the form {"type":"molecule|macromolecule|unknown","name":"<name>"}. For example if the prompt is "Tell me about the structure of glucose", the response should be {"type":"small molecule","name":"glucose"} or if the prompt is "Tell me about the structure of a protein", the response should be {"type":"macromolecule","name":"leucine", or if the prompt is "Teach me about metal-carbonyl complexes and back-bonding", the response should be {"type":"small molecule","name":"nickel tetracarbonyl" or with "Teach me about metal-metal quadruple bonds in dimolybdenum complexes", the response should be {"type":"small molecule","name":"dimolybdenum tetraacetate"}.

User input: "${prompt}"`;

  const result = await structuredLLMResponse(
    question,
    z.object({
      type: z.enum(['small molecule', 'macromolecule', 'unknown']),
      name: z.string().nullable(),
    })
  );
  // Sanitize the name to ASCII before returning
  return {
    type: result.type,
    name: result.name ? sanitizeName(result.name) : null,
  };
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

export interface PresentationStep {
  timecode: string;
  atoms: string[];
  caption: string;
}

export interface PresentationScript {
  title: string;
  content: PresentationStep[];
}

/**
 * Generate a presentation script for a molecule based on its data and structure
 */
export async function generatePresentationScript(moleculeData: {
  name: string;
  formula?: string;
  info?: unknown;
  pdb_data?: string;
  sdf?: string;
}): Promise<PresentationScript> {
  if (!openai) {
    throw new Error('LLM not configured for presentation generation');
  }

  // Extract basic information about the molecule
  const { name, formula, info } = moleculeData;

  // Build context about the molecule
  let moleculeContext = `Molecule: ${name}`;
  if (formula) moleculeContext += `\nFormula: ${formula}`;
  if (info && typeof info === 'object' && 'canonical_smiles' in info)
    moleculeContext += `\nSMILES: ${(info as any).canonical_smiles}`;
  if (
    info &&
    typeof info === 'object' &&
    'synonyms' in info &&
    Array.isArray((info as any).synonyms)
  )
    moleculeContext += `\nSynonyms: ${(info as any).synonyms.slice(0, 3).join(', ')}`;
  if (info && typeof info === 'object' && 'formula_weight' in info)
    moleculeContext += `\nMolecular Weight: ${(info as any).formula_weight} g/mol`;
  if (info && typeof info === 'object' && 'experimental_method' in info)
    moleculeContext += `\nExperimental Method: ${(info as any).experimental_method}`;
  if (info && typeof info === 'object' && 'resolution' in info)
    moleculeContext += `\nResolution: ${(info as any).resolution} Å`;

  const prompt = `You are creating an educational presentation script for a 3D molecular visualization. Generate a presentation script that highlights different parts of the molecule over time with educational captions.

${moleculeContext}

Create a presentation script with 4-6 steps that:
1. Introduces the molecule and its significance
2. Highlights different structural features or functional groups
3. Explains key properties or biological/chemical importance
4. Concludes with applications or interesting facts

Each step should:
- Have a timecode in "MM:SS" format (starting at 00:00, incrementing by 5-10 seconds)
- Specify which atoms to highlight (use atom indices as strings, e.g., ["0", "1", "2"])
- Include an educational caption (1-2 sentences, under 120 characters)

For atom indices:
- Use empty array [] for general introduction
- Use specific atom indices to highlight structural features
- For small molecules, typically have 5-20 atoms (indices 0-19)
- For larger molecules, focus on key functional groups or active sites

EXAMPLE for glucose (C6H12O6):
{
  "title": "Glucose: Essential Sugar Molecule",
  "content": [
    {
      "timecode": "00:00",
      "atoms": [],
      "caption": "Glucose is a simple sugar and primary energy source for living cells."
    },
    {
      "timecode": "00:05",
      "atoms": ["0", "1", "2", "3", "4", "5"],
      "caption": "The six-carbon backbone forms a ring structure in aqueous solution."
    },
    {
      "timecode": "00:10",
      "atoms": ["6", "7", "8", "9", "10"],
      "caption": "Five hydroxyl groups make glucose highly water-soluble."
    },
    {
      "timecode": "00:15",
      "atoms": ["11"],
      "caption": "The aldehyde group can form hemiacetal bonds, creating ring structures."
    },
    {
      "timecode": "00:20",
      "atoms": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
      "caption": "Glucose is metabolized through glycolysis to produce cellular energy (ATP)."
    }
  ]
}

Now generate a similar script for ${name}. Respond ONLY with JSON in the exact format shown above:`;

  const result = await structuredLLMResponse(
    prompt,
    z.object({
      title: z.string(),
      content: z.array(
        z.object({
          timecode: z.string(),
          atoms: z.array(z.string()),
          caption: z.string(),
        })
      ),
    })
  );

  return result;
}
