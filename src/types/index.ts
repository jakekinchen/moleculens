/* eslint-disable */
export interface Topic {
  id: string;
  title: string;
  content: string;
}

export interface VisualizationOutput {
  pdb_data: string;
  html: string;
  title?: string;
  timecode_markers?: string[];
  total_elements?: number;
}

export interface VisualizationData {
  type: 'molecule' | 'reaction' | 'structure';
  data: {
    pdb_data: string;
    html: string;
    title?: string;
    timecode_markers?: string[];
    total_elements?: number;
  };
}

export interface HistoryEntry {
  prompt: string;
  timestamp: Date;
  visualization?: VisualizationOutput;
  title?: string;
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