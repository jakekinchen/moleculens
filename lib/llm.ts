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
