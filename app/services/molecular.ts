/**
 * Client-Side Molecular Processing Service
 *
 * This service provides comprehensive molecular data processing capabilities
 * using client-side libraries, eliminating the need for PyMOL server API calls.
 *
 * Features:
 * - Direct PubChem API integration
 * - RCSB PDB structure fetching
 * - AlphaFold model access
 * - 2D molecular structure generation
 * - SDF to PDB conversion
 * - Molecular property calculations
 */

import { MoleculeInfo } from '@/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MolecularSearchResult {
  name: string;
  cid?: number;
  smiles?: string;
  inchi?: string;
  formula?: string;
  molecular_weight?: number;
  synonyms?: string[];
  sdf_data?: string;
  pdb_data?: string;
}

export interface StructureData {
  pdb_data: string;
  sdf_data?: string;
  metadata?: {
    resolution?: number;
    method?: string;
    organism?: string;
    title?: string;
  };
}

export interface Molecule2DOptions {
  width?: number;
  height?: number;
  format?: 'svg' | 'png' | 'canvas';
  transparent?: boolean;
  atom_labels?: boolean;
}

export interface Molecule2DResult {
  svg?: string;
  png?: string;
  canvas?: HTMLCanvasElement;
  width: number;
  height: number;
}

// ============================================================================
// PUBCHEM API INTEGRATION
// ============================================================================

const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const PUBCHEM_COMPOUND = `${PUBCHEM_BASE}/compound`;

/**
 * Search for molecules by name using PubChem
 */
export async function searchMoleculeByName(name: string): Promise<MolecularSearchResult | null> {
  try {
    // First, get the compound ID
    const cidResponse = await fetch(
      `${PUBCHEM_COMPOUND}/name/${encodeURIComponent(name)}/cids/JSON`
    );

    if (!cidResponse.ok) {
      throw new Error(`PubChem search failed: ${cidResponse.statusText}`);
    }

    const cidData = await cidResponse.json();
    const cid = cidData.IdentifierList?.CID?.[0];

    if (!cid) {
      return null;
    }

    return await getMoleculeDataByCID(cid);
  } catch (error) {
    console.error('Error searching molecule by name:', error);
    return null;
  }
}

/**
 * Get comprehensive molecule data by PubChem CID
 */
export async function getMoleculeDataByCID(cid: number): Promise<MolecularSearchResult> {
  try {
    // Get multiple properties in parallel
    const [propsResponse, sdfResponse, synonymsResponse] = await Promise.all([
      fetch(
        `${PUBCHEM_COMPOUND}/cid/${cid}/property/MolecularFormula,MolecularWeight,CanonicalSMILES,InChI/JSON`
      ),
      fetch(`${PUBCHEM_COMPOUND}/cid/${cid}/SDF`),
      fetch(`${PUBCHEM_COMPOUND}/cid/${cid}/synonyms/JSON`),
    ]);

    const propsData = await propsResponse.json();
    const sdfData = await sdfResponse.text();

    let synonyms: string[] = [];
    try {
      const synonymsData = await synonymsResponse.json();
      synonyms = synonymsData.InformationList?.Information?.[0]?.Synonym || [];
    } catch {
      // Synonyms are optional
    }

    const props = propsData.PropertyTable?.Properties?.[0];

    if (!props) {
      throw new Error('No molecular properties found');
    }

    // Convert SDF to PDB using our conversion function
    const pdbData = await convertSDFToPDB(sdfData);

    return {
      name: synonyms[0] || `CID ${cid}`,
      cid,
      smiles: props.CanonicalSMILES,
      inchi: props.InChI,
      formula: props.MolecularFormula,
      molecular_weight: props.MolecularWeight,
      synonyms: synonyms.slice(0, 10), // Limit to first 10 synonyms
      sdf_data: sdfData,
      pdb_data: pdbData,
    };
  } catch (error) {
    console.error('Error fetching molecule data by CID:', error);
    throw error;
  }
}

/**
 * Search for multiple molecules from a list of names
 */
export async function searchMultipleMolecules(names: string[]): Promise<MolecularSearchResult[]> {
  const results = await Promise.allSettled(names.map(name => searchMoleculeByName(name)));

  return results
    .filter(
      (result): result is PromiseFulfilledResult<MolecularSearchResult | null> =>
        result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value!);
}

// ============================================================================
// PROTEIN STRUCTURE DATABASE INTEGRATION
// ============================================================================

const RCSB_BASE = 'https://data.rcsb.org/rest/v1/core';
const RCSB_FILES = 'https://files.rcsb.org/download';
const ALPHAFOLD_BASE = 'https://alphafold.ebi.ac.uk/files';

/**
 * Fetch protein structure from RCSB PDB
 */
export async function fetchProteinStructure(pdbId: string): Promise<StructureData> {
  try {
    const pdbIdUpper = pdbId.toUpperCase();

    // Get PDB file and metadata in parallel
    const [pdbResponse, metadataResponse] = await Promise.all([
      fetch(`${RCSB_FILES}/${pdbIdUpper}.pdb`),
      fetch(`${RCSB_BASE}/entry/${pdbIdUpper}`),
    ]);

    if (!pdbResponse.ok) {
      throw new Error(`PDB structure not found: ${pdbId}`);
    }

    const pdbData = await pdbResponse.text();

    let metadata = {};
    try {
      const metadataJson = await metadataResponse.json();
      metadata = {
        resolution: metadataJson.rcsb_entry_info?.resolution_combined?.[0],
        method: metadataJson.exptl?.[0]?.method,
        organism: metadataJson.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name,
        title: metadataJson.struct?.title,
      };
    } catch {
      // Metadata is optional
    }

    return {
      pdb_data: pdbData,
      metadata,
    };
  } catch (error) {
    console.error('Error fetching protein structure:', error);
    throw error;
  }
}

/**
 * Fetch AlphaFold model by UniProt ID
 */
export async function fetchAlphaFoldModel(uniprotId: string): Promise<StructureData> {
  try {
    const response = await fetch(`${ALPHAFOLD_BASE}/AF-${uniprotId}-F1-model_v4.pdb`);

    if (!response.ok) {
      throw new Error(`AlphaFold model not found: ${uniprotId}`);
    }

    const pdbData = await response.text();

    return {
      pdb_data: pdbData,
      metadata: {
        method: 'AlphaFold prediction',
        organism: 'Various',
      },
    };
  } catch (error) {
    console.error('Error fetching AlphaFold model:', error);
    throw error;
  }
}

// ============================================================================
// CLIENT-SIDE MOLECULAR PROCESSING
// ============================================================================

/**
 * Convert SDF data to PDB format using client-side processing
 */
export async function convertSDFToPDB(sdfData: string): Promise<string> {
  try {
    // Simple SDF to PDB conversion - extract coordinates and create basic PDB format
    const lines = sdfData.split('\n');
    let atomCount = 0;
    // let bondCount = 0; // Not used in current implementation

    // Find the counts line (usually line 3)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.match(/^\s*\d+\s+\d+/)) {
        const parts = line.split(/\s+/);
        atomCount = parseInt(parts[0]);
        // bondCount = parseInt(parts[1]); // Not used in current implementation
        break;
      }
    }

    if (atomCount === 0) {
      throw new Error('No atoms found in SDF data');
    }

    // Convert to PDB format
    let pdbContent = 'HEADER    MOLECULE CONVERTED FROM SDF\n';
    pdbContent += 'COMPND    UNNAMED\n';
    pdbContent += 'AUTHOR    MOLECULENS CLIENT-SIDE CONVERTER\n';

    // Find atom block start
    let atomBlockStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^\s*\d+\s+\d+/) && line.split(/\s+/).length >= 2) {
        atomBlockStart = i + 1;
        break;
      }
    }

    if (atomBlockStart === -1) {
      throw new Error('Could not find atom block in SDF data');
    }

    // Parse atoms
    for (let i = 0; i < atomCount && atomBlockStart + i < lines.length; i++) {
      const line = lines[atomBlockStart + i].trim();
      const parts = line.split(/\s+/);

      if (parts.length >= 4) {
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        const z = parseFloat(parts[2]);
        const element = parts[3] || 'C';

        const atomNum = (i + 1).toString().padStart(5, ' ');
        const atomName = element.padEnd(4, ' ');
        const resName = 'MOL'.padEnd(3, ' ');
        const chainId = 'A';
        const resNum = '1'.padStart(4, ' ');
        const xStr = x.toFixed(3).padStart(8, ' ');
        const yStr = y.toFixed(3).padStart(8, ' ');
        const zStr = z.toFixed(3).padStart(8, ' ');
        const occupancy = '1.00';
        const tempFactor = '0.00';
        const elementStr = element.padStart(2, ' ');

        pdbContent += `ATOM  ${atomNum} ${atomName} ${resName} ${chainId}${resNum}    ${xStr}${yStr}${zStr}  ${occupancy}  ${tempFactor}          ${elementStr}\n`;
      }
    }

    pdbContent += 'END\n';

    return pdbContent;
  } catch (error) {
    console.error('Error converting SDF to PDB:', error);
    throw error;
  }
} /**
 * Generate 2D molecular structure image using OpenChemLib
 */
export async function generate2DMoleculeImage(
  smiles: string,
  options: Molecule2DOptions = {}
): Promise<Molecule2DResult> {
  try {
    const OCL = await import('openchemlib');

    const molecule = OCL.Molecule.fromSmiles(smiles);
    const width = options.width || 300;
    const height = options.height || 300;

    // Generate SVG
    const svg = molecule.toSVG(width, height, undefined, {
      suppressChiralText: !options.atom_labels,
      suppressESR: true,
      suppressCIPParity: true,
      noStereoProblem: true,
    });

    const result: Molecule2DResult = {
      svg,
      width,
      height,
    };

    // Generate PNG if requested
    if (options.format === 'png' || options.format === 'canvas') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // Create image from SVG
      const img = new Image();
      const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);

      await new Promise((resolve, reject) => {
        img.onload = () => {
          if (options.transparent) {
            ctx.clearRect(0, 0, width, height);
          } else {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          resolve(void 0);
        };
        img.onerror = reject;
        img.src = url;
      });

      if (options.format === 'canvas') {
        result.canvas = canvas;
      } else {
        result.png = canvas.toDataURL('image/png');
      }
    }

    return result;
  } catch (error) {
    console.error('Error generating 2D molecule image:', error);
    throw error;
  }
}

/**
 * Calculate molecular properties using OpenChemLib
 */
export async function calculateMolecularProperties(smiles: string) {
  try {
    const OCL = await import('openchemlib');

    const molecule = OCL.Molecule.fromSmiles(smiles);

    return {
      molecular_formula: molecule.getMolecularFormula().formula,
      molecular_weight: molecule.getMolweight(),
      rotatable_bonds: molecule.getRotatableBondCount(),
      stereo_centers: molecule.getStereoCenterCount(),
      // Note: Some properties may not be available in all versions of OpenChemLib
      // We'll implement basic ones that are commonly available
    };
  } catch (error) {
    console.error('Error calculating molecular properties:', error);
    throw error;
  }
}

// ============================================================================
// INTEGRATION WITH EXISTING TYPES
// ============================================================================

/**
 * Convert our molecular search result to the existing MoleculeInfo type
 */
export function toMoleculeInfo(result: MolecularSearchResult): MoleculeInfo {
  return {
    // Small molecule fields
    canonical_smiles: result.smiles,
    inchi: result.inchi,
    formula: result.formula,
    formula_weight: result.molecular_weight,
    synonyms: result.synonyms || [],

    // Macromolecule fields (not applicable for small molecules)
    full_description: undefined,
    resolution: undefined,
    experimental_method: undefined,
    chain_count: undefined,
    organism_scientific: undefined,
    organism_common: undefined,
    keywords: [],
    publication_year: undefined,
    publication_doi: undefined,
  };
}

/**
 * Enhanced molecule search that returns both data and MoleculeInfo
 */
export async function searchMoleculeComplete(name: string): Promise<{
  data: MolecularSearchResult;
  info: MoleculeInfo;
} | null> {
  const data = await searchMoleculeByName(name);
  if (!data) return null;

  return {
    data,
    info: toMoleculeInfo(data),
  };
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Process multiple molecules in parallel with rate limiting
 */
export async function processMoleculeBatch(
  names: string[],
  options: {
    maxConcurrent?: number;
    include2D?: boolean;
    imageOptions?: Molecule2DOptions;
  } = {}
): Promise<
  Array<{
    name: string;
    data?: MolecularSearchResult;
    info?: MoleculeInfo;
    image2D?: Molecule2DResult;
    error?: string;
  }>
> {
  const maxConcurrent = options.maxConcurrent || 5;
  const results: Array<{
    name: string;
    data?: MolecularSearchResult;
    info?: MoleculeInfo;
    image2D?: Molecule2DResult;
    error?: string;
  }> = [];

  // Process in batches to avoid overwhelming APIs
  for (let i = 0; i < names.length; i += maxConcurrent) {
    const batch = names.slice(i, i + maxConcurrent);

    const batchResults = await Promise.allSettled(
      batch.map(async name => {
        try {
          const result = await searchMoleculeComplete(name);
          if (!result) {
            return { name, error: 'Molecule not found' };
          }

          let image2D: Molecule2DResult | undefined;
          if (options.include2D && result.data.smiles) {
            try {
              image2D = await generate2DMoleculeImage(result.data.smiles, options.imageOptions);
            } catch (error) {
              console.warn(`Failed to generate 2D image for ${name}:`, error);
            }
          }

          return {
            name,
            data: result.data,
            info: result.info,
            image2D,
          };
        } catch (error) {
          return {
            name,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    results.push(
      ...batchResults.map(result =>
        result.status === 'fulfilled'
          ? result.value
          : { name: 'unknown', error: 'Processing failed' }
      )
    );
  }

  return results;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate if a string is a valid SMILES
 */
export async function isValidSMILES(smiles: string): Promise<boolean> {
  try {
    const OCL = await import('openchemlib');
    OCL.Molecule.fromSmiles(smiles);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert between different molecular formats
 */
export async function convertMolecularFormat(
  input: string,
  fromFormat: 'smiles' | 'sdf' | 'mol',
  toFormat: 'smiles' | 'sdf' | 'pdb'
): Promise<string> {
  try {
    if (fromFormat === 'sdf' && toFormat === 'pdb') {
      return await convertSDFToPDB(input);
    }

    if (fromFormat === 'smiles') {
      const OCL = await import('openchemlib');
      const molecule = OCL.Molecule.fromSmiles(input);

      if (toFormat === 'sdf') {
        return molecule.toMolfile();
      }
    }

    throw new Error(`Conversion from ${fromFormat} to ${toFormat} not yet implemented`);
  } catch (error) {
    console.error('Error converting molecular format:', error);
    throw error;
  }
}
