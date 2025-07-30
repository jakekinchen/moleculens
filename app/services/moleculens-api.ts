/**
 * MoleculeLens Server API Integration
 *
 * This service provides a comprehensive interface to the MoleculeLens server API
 * at api.moleculens.com, enabling advanced molecular visualization, PyMOL rendering,
 * and scientific diagram generation.
 */

// API Configuration
const MOLECULENS_API_BASE = 'https://api.moleculens.com';

// Request timeout for large rendering operations
const DEFAULT_TIMEOUT = 120000; // 2 minutes
const LARGE_FILE_TIMEOUT = 300000; // 5 minutes for complex renders

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RenderRequest {
  description: string;
  format?: 'image' | 'model' | 'animation';
  transparent_background?: boolean;
  ray_trace?: boolean;
  resolution?: [number, number];
  dpi?: number;
  ray_trace_mode?: 'default' | 'cartoon_outline' | 'bw' | 'poster';
  antialias?: boolean;
  ray_shadow?: boolean;
  depth_cue?: boolean;
  background_color?: string;
}

export interface RenderResponse {
  url?: string;
  metadata?: {
    camera_position?: [number, number, number];
    center?: [number, number, number];
    bounding_box?: {
      min: [number, number, number];
      max: [number, number, number];
    };
  };
}

export interface GraphicRequest {
  brief: string;
  context?: string;
  theme?: string;
  width?: number;
  height?: number;
  sections?: string;
  notes?: string;
  model_name?: string;
}

export interface GraphicResponse {
  yaml_spec: string;
  svg_content?: string;
  png_base64?: string;
  status: string;
  error?: string;
}

export interface PromptRequest {
  prompt: string;
  model?: string;
}

export interface DiagramRequest {
  prompt: string;
  canvas_width?: number;
  canvas_height?: number;
  model?: string;
}

export interface DiagramResponse {
  diagram_image: string;
  diagram_plan: {
    plan: string;
    molecule_list: Array<{
      molecule: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      label?: string;
      label_position?: string;
    }>;
    arrows: Array<{
      start: [number, number];
      end: [number, number];
      text?: string;
    }>;
    canvas_width: number;
    canvas_height: number;
  };
  status: string;
  job_id?: string;
  error?: string;
}

export interface RCSBRequest {
  identifier: string;
  format?: 'pdb' | 'cif';
}

export interface RCSBResponse {
  data: string;
}

export interface MoleculeRenderOptions {
  molecule_name: string;
  render_type?: '2d_transparent' | '3d_pdb' | 'both';
  size?: 'small' | 'medium' | 'large';
  quality?: 'fast' | 'high' | 'publication';
}

export interface MoleculeRenderResult {
  name: string;
  png?: string;
  png_base64?: string;
  png_url?: string;
  pdb_data?: string;
  metadata?: any;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create fetch options with timeout and error handling
 */
function createFetchOptions(
  method: 'GET' | 'POST' = 'GET',
  body?: any,
  timeout: number = DEFAULT_TIMEOUT
): RequestInit & { signal: AbortSignal } {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);

  const options: RequestInit & { signal: AbortSignal } = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'MoleculeLens-Client/1.0',
    },
    signal: controller.signal,
  };

  if (body && method === 'POST') {
    options.body = JSON.stringify(body);
  }

  return options;
}

/**
 * Handle API responses with proper error handling
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `API request failed: ${response.status} ${response.statusText}`;

    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If we can't parse the error response, use the default message
    }

    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type');

  // Handle different response types
  if (contentType?.includes('application/json')) {
    return response.json();
  } else if (contentType?.includes('image/')) {
    return response.blob() as Promise<T>;
  } else if (contentType?.includes('chemical/x-pdb') || contentType?.includes('text/plain')) {
    return response.text() as Promise<T>;
  } else {
    return response.json();
  }
}

// ============================================================================
// RENDER API - PyMOL 3D Molecular Rendering
// ============================================================================

/**
 * Render a molecular structure using PyMOL
 * Supports both 2D images and 3D model data
 */
export async function renderMolecule(
  request: RenderRequest
): Promise<RenderResponse | Blob | string> {
  const options = createFetchOptions('POST', request, LARGE_FILE_TIMEOUT);

  try {
    const response = await fetch(`${MOLECULENS_API_BASE}/render`, options);

    // Check if this is a direct file response or a URL response
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('image/png')) {
      // Direct PNG response
      return response.blob();
    } else if (contentType?.includes('chemical/x-pdb')) {
      // Direct PDB response
      return response.text();
    } else {
      // JSON response with URL or metadata
      const data = await handleResponse<RenderResponse>(response);

      // Extract metadata from headers if available
      const metadataHeader = response.headers.get('X-Metadata');
      if (metadataHeader && !data.metadata) {
        try {
          data.metadata = JSON.parse(metadataHeader);
        } catch {
          // Ignore metadata parsing errors
        }
      }

      return data;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'Render request timed out. The molecule may be too complex or the server is busy.'
      );
    }
    throw error;
  }
}

/**
 * Get 2D transparent PNG for UI overlays and thumbnails
 */
export async function get2DTransparentPNG(
  moleculeName: string,
  options?: {
    resolution?: [number, number];
    dpi?: number;
    quality?: 'fast' | 'high' | 'publication';
  }
): Promise<Blob> {
  const request: RenderRequest = {
    description: `Show ${moleculeName} molecule with transparent background`,
    format: 'image',
    transparent_background: true,
    ray_trace: true,
    resolution: options?.resolution || [512, 512],
    dpi: options?.dpi || 150,
    ray_trace_mode: options?.quality === 'publication' ? 'poster' : 'default',
    antialias: true,
    ray_shadow: false, // Better for transparent backgrounds
    background_color: 'white',
  };

  const result = await renderMolecule(request);

  if (result instanceof Blob) {
    return result;
  } else if (typeof result === 'object' && 'url' in result && result.url) {
    // Fetch from URL
    const imageResponse = await fetch(result.url);
    return imageResponse.blob();
  } else {
    throw new Error('Unexpected response format for 2D PNG request');
  }
}

/**
 * Get 3D PDB data for Three.js reconstruction
 */
export async function get3DPDBData(moleculeName: string): Promise<string> {
  const request: RenderRequest = {
    description: `Load ${moleculeName} molecule structure`,
    format: 'model', // Returns PDB format
  };

  const result = await renderMolecule(request);

  if (typeof result === 'string') {
    return result;
  } else if (typeof result === 'object' && 'url' in result && result.url) {
    // Fetch from URL
    const pdbResponse = await fetch(result.url);
    return pdbResponse.text();
  } else {
    throw new Error('Unexpected response format for 3D PDB request');
  }
}

/**
 * Enhanced molecule rendering with both 2D and 3D data
 */
export async function getMoleculeData(
  options: MoleculeRenderOptions
): Promise<MoleculeRenderResult> {
  const endpoint = `${MOLECULENS_API_BASE}/render/molecule`;
  const fetchOptions = createFetchOptions('POST', options);

  const response = await fetch(endpoint, fetchOptions);
  const data = await handleResponse<MoleculeRenderResult>(response);

  return {
    name: data.name,
    png: data.png_base64 ? `data:image/png;base64,${data.png_base64}` : data.png_url,
    pdb_data: data.pdb_data,
    metadata: data.metadata,
  };
}

/**
 * Batch process multiple molecules
 */
export async function getBatchMolecules(
  molecules: string[],
  options?: {
    render_type?: '2d_transparent' | '3d_pdb' | 'both';
    size?: 'small' | 'medium' | 'large';
    quality?: 'fast' | 'high' | 'publication';
  }
): Promise<MoleculeRenderResult[]> {
  const endpoint = `${MOLECULENS_API_BASE}/render/batch`;
  const request = {
    molecules,
    render_type: options?.render_type || '2d_transparent',
    size: options?.size || 'small',
    quality: options?.quality || 'fast',
  };

  const fetchOptions = createFetchOptions('POST', request, LARGE_FILE_TIMEOUT);
  const response = await fetch(endpoint, fetchOptions);

  return handleResponse<MoleculeRenderResult[]>(response);
}

// ============================================================================
// GRAPHIC API - Scientific Diagram Generation
// ============================================================================

/**
 * Generate scientific diagrams from natural language descriptions
 */
export async function generateGraphic(request: GraphicRequest): Promise<GraphicResponse> {
  const endpoint = `${MOLECULENS_API_BASE}/graphic/make`;
  const fetchOptions = createFetchOptions('POST', {
    ...request,
    output_format: 'both', // Get both SVG and PNG
  });

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse<GraphicResponse>(response);
}

/**
 * Plan a graphic (generate YAML specification)
 */
export async function planGraphic(
  request: GraphicRequest
): Promise<{ yaml_spec: string; status: string; error?: string }> {
  const endpoint = `${MOLECULENS_API_BASE}/graphic/plan`;
  const fetchOptions = createFetchOptions('POST', request);

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse(response);
}

/**
 * Validate a YAML specification
 */
export async function validateGraphic(
  yamlSpec: string
): Promise<{ valid: boolean; errors: string[]; status: string }> {
  const endpoint = `${MOLECULENS_API_BASE}/graphic/validate`;
  const fetchOptions = createFetchOptions('POST', { yaml_spec: yamlSpec });

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse(response);
}

/**
 * Render a graphic from YAML specification
 */
export async function renderGraphic(
  yamlSpec: string,
  options?: { deterministic?: boolean; output_format?: 'svg' | 'png' | 'both' }
): Promise<{ svg_content?: string; png_base64?: string; status: string; error?: string }> {
  const endpoint = `${MOLECULENS_API_BASE}/graphic/render`;
  const fetchOptions = createFetchOptions('POST', {
    yaml_spec: yamlSpec,
    deterministic: options?.deterministic ?? true,
    output_format: options?.output_format ?? 'both',
  });

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse(response);
}

// ============================================================================
// PROMPT API - Molecular Prompt Processing
// ============================================================================

/**
 * Generate molecule names from natural language prompts
 */
export async function generateMoleculeNames(
  request: PromptRequest
): Promise<{ molecule_names: string[] }> {
  const endpoint = `${MOLECULENS_API_BASE}/prompt/generate-from-pubchem/`;
  const fetchOptions = createFetchOptions('POST', request);

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse(response);
}

/**
 * Validate if a prompt is scientific/molecular in nature
 */
export async function validateScientificPrompt(
  request: PromptRequest
): Promise<{ is_molecular: boolean }> {
  const endpoint = `${MOLECULENS_API_BASE}/prompt/validate-scientific/`;
  const fetchOptions = createFetchOptions('POST', request);

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse(response);
}

/**
 * Generate 2D molecule diagrams from text prompts
 */
export async function generateMoleculeDiagram(request: DiagramRequest): Promise<DiagramResponse> {
  const endpoint = `${MOLECULENS_API_BASE}/prompt/generate-molecule-diagram/`;
  const fetchOptions = createFetchOptions('POST', request);

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse(response);
}

/**
 * Fetch molecule information and PDB data
 */
export async function fetchMoleculeInfo(query: string): Promise<{ molecule_data: any }> {
  const endpoint = `${MOLECULENS_API_BASE}/prompt/fetch-molecule-data/`;
  const fetchOptions = createFetchOptions('POST', { query });

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse(response);
}

/**
 * Convert SDF text to PDB format using RDKit
 */
export async function convertSDFToPDB(sdf: string): Promise<{ pdb_data: string }> {
  const endpoint = `${MOLECULENS_API_BASE}/prompt/sdf-to-pdb/`;
  const fetchOptions = createFetchOptions('POST', { sdf });

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse(response);
}

// ============================================================================
// RCSB API - Protein Structure Database
// ============================================================================

/**
 * Fetch protein structure by identifier
 */
export async function fetchProteinStructure(request: RCSBRequest): Promise<RCSBResponse> {
  const endpoint = `${MOLECULENS_API_BASE}/rcsb/fetch-structure/`;
  const fetchOptions = createFetchOptions('POST', request);

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse(response);
}

/**
 * Fetch AlphaFold model by UniProt ID
 */
export async function fetchAlphaFoldModel(
  uniprotId: string,
  format: 'pdb' | 'cif' = 'pdb'
): Promise<RCSBResponse> {
  const endpoint = `${MOLECULENS_API_BASE}/rcsb/fetch-model/`;
  const fetchOptions = createFetchOptions('POST', { uniprot_id: uniprotId, format });

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse(response);
}

/**
 * Get metadata for a PDB entry
 */
export async function getPDBMetadata(identifier: string): Promise<{ metadata: any }> {
  const endpoint = `${MOLECULENS_API_BASE}/rcsb/entry/${identifier}`;
  const fetchOptions = createFetchOptions('GET');

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse(response);
}

/**
 * Get sequence annotations for a PDB entry
 */
export async function getPDBAnnotations(identifier: string): Promise<{ annotations: any }> {
  const endpoint = `${MOLECULENS_API_BASE}/rcsb/annotations/${identifier}`;
  const fetchOptions = createFetchOptions('GET');

  const response = await fetch(endpoint, fetchOptions);
  return handleResponse(response);
}

// ============================================================================
// ADVANCED FEATURES
// ============================================================================

/**
 * Create PyMOL animations
 */
export async function createMoleculeAnimation(
  moleculeName: string,
  animationType: 'rotation' | 'morph' | 'trajectory' = 'rotation',
  options?: {
    duration?: number;
    fps?: number;
    resolution?: [number, number];
    format?: 'gif' | 'mp4';
  }
): Promise<Blob> {
  const request: RenderRequest = {
    description: `Create ${animationType} animation of ${moleculeName}`,
    format: 'animation',
    resolution: options?.resolution || [800, 600],
    ray_trace: true,
    antialias: true,
  };

  const result = await renderMolecule(request);

  if (result instanceof Blob) {
    return result;
  } else if (typeof result === 'object' && 'url' in result && result.url) {
    const animationResponse = await fetch(result.url);
    return animationResponse.blob();
  } else {
    throw new Error('Unexpected response format for animation request');
  }
}

/**
 * Generate protein structure with specific representation
 */
export async function renderProteinStructure(
  pdbId: string,
  representation: 'cartoon' | 'surface' | 'stick' | 'ribbon' = 'cartoon',
  options?: {
    size?: 'medium' | 'large';
    quality?: 'high' | 'publication';
    transparent_background?: boolean;
  }
): Promise<MoleculeRenderResult> {
  const endpoint = `${MOLECULENS_API_BASE}/render/protein`;
  const request = {
    pdb_id: pdbId,
    render_type: 'both',
    representation,
    size: options?.size || 'medium',
    quality: options?.quality || 'high',
    transparent_background: options?.transparent_background || false,
  };

  const fetchOptions = createFetchOptions('POST', request, LARGE_FILE_TIMEOUT);
  const response = await fetch(endpoint, fetchOptions);

  return handleResponse<MoleculeRenderResult>(response);
}

/**
 * Error handling wrapper for all API calls
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        // Log error for debugging
        console.error(`MoleculeLens API Error: ${error.message}`);

        // Re-throw with more context
        if (error.message.includes('timeout') || error.name === 'AbortError') {
          throw new Error(
            'Request timed out. The server may be busy or the molecule is too complex to process.'
          );
        } else if (error.message.includes('404')) {
          throw new Error('Molecule or structure not found. Please check the name or identifier.');
        } else if (error.message.includes('429')) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
        } else if (error.message.includes('500')) {
          throw new Error('Server error occurred. Please try again later.');
        }
      }
      throw error;
    }
  };
}

// Export wrapped versions of main functions for better error handling
export const safeRenderMolecule = withErrorHandling(renderMolecule);
export const safeGet2DTransparentPNG = withErrorHandling(get2DTransparentPNG);
export const safeGet3DPDBData = withErrorHandling(get3DPDBData);
export const safeGetMoleculeData = withErrorHandling(getMoleculeData);
export const safeGenerateGraphic = withErrorHandling(generateGraphic);
export const safeGenerateMoleculeDiagram = withErrorHandling(generateMoleculeDiagram);
