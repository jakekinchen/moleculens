/* eslint-disable */
export interface Topic {
  id: string;
  title: string;
  content: string;
}

export interface VisualizationData {
  type: 'molecule' | 'reaction' | 'structure';
  data: any; // TODO: Define specific visualization data types
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any; // If we need to keep this as any
}

export interface SomeInterface {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export interface ModelInfo {
  name: string;
  display_name: string;
  provider: string;
  categories: string[];
  context_length: number;
  is_default: boolean;
} 