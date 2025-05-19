import { ModelInfo } from '../src/types';

export const MODELS: ModelInfo[] = [
  {
    name: 'gpt-3.5-turbo',
    display_name: 'GPT-3.5 Turbo',
    provider: 'openai',
    categories: ['general'],
    context_length: 16000,
    is_default: true,
  },
  {
    name: 'gpt-4',
    display_name: 'GPT-4',
    provider: 'openai',
    categories: ['general'],
    context_length: 32000,
    is_default: false,
  },
];

export function listModels(): ModelInfo[] {
  return MODELS;
}
