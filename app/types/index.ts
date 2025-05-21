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

export interface MoleculeInfo {
  formula?: string;
  formula_weight?: number;
  canonical_smiles?: string;
  isomeric_smiles?: string;
  inchi?: string;
  inchikey?: string;
  formal_charge?: number;
  synonyms?: string[];
}

export interface MoleculePlacement {
  molecule: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  label_position?: 'above' | 'below' | 'left' | 'right';
}

export interface Arrow {
  start: number[];
  end: number[];
  style: 'straight' | 'curved';
  text?: string;
}

export interface DiagramPromptRequest {
  prompt: string;
  canvas_width?: number;
  canvas_height?: number;
  model?: string;
  preferred_model_category?: string;
}

export interface DiagramPlan {
  plan: string;
  molecule_list: MoleculePlacement[];
  arrows?: Arrow[];
  canvas_width?: number;
  canvas_height?: number;
}

export interface DiagramResponse {
  diagram_image: string;
  diagram_plan: DiagramPlan;
  status: 'completed' | 'failed' | 'processing';
  job_id?: string;
  error?: string;
}
