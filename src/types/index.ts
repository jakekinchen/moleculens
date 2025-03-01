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