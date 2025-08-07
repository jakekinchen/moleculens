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
const NIST_CGI = 'https://webbook.nist.gov/cgi/cbook.cgi';
const CAS_RE = /^\d{2,7}-\d{2}-\d$/;

// ============================================================================
// 3D STRUCTURE FETCHING HELPERS
// ============================================================================

/**
 * Check if SDF data contains 3D coordinates
 */
function isSdf3D(text: string): boolean {
  const head = text.slice(0, 400).toUpperCase();
  if (head.includes(' 2D')) return false;
  if (head.includes(' 3D') || head.includes(' V3000')) return true;

  // look at first ~25 atom lines to check for non-zero Z coordinates
  return text
    .split(/\n/)
    .slice(4, 30)
    .some(l => {
      const z = parseFloat(l.slice(20, 30)); // correct V2000 Z column
      return !Number.isNaN(z) && Math.abs(z) > 1e-3;
    });
}

/**
 * Try to fetch 3D SDF from NCI/CACTUS
 */
async function cactus3d(id: number | string): Promise<string | null> {
  const idPath =
    typeof id === 'number' || /^\d+$/.test(String(id))
      ? `cid/${id}`
      : encodeURIComponent(String(id));

  const tryFetch = async (get3d: boolean): Promise<string | null> => {
    const suffix = get3d ? '?format=sdf&get3d=true' : '?format=sdf';
    const url = `https://cactus.nci.nih.gov/chemical/structure/${idPath}/file${suffix}`;
    
    console.log(`[3D Fetch] CACTUS attempt: ${url}`);
    const r = await fetch(url, { headers: { 'User-Agent': 'moleculens/1.0' } });
    console.log(`[3D Fetch] CACTUS response: ${r.status} ${r.headers.get('content-type')}`);
    
    // Only return null on 404 (not found); 500 means try without 3D
    if (r.status === 404) return null;
    if (!r.ok && r.status !== 500) return null;
    const txt = await r.text();
    return isSdf3D(txt) ? txt : null;
  };

  // Try with 3D first, then fallback to regular SDF
  let txt = await tryFetch(true);
  if (!txt) txt = await tryFetch(false);
  return txt;
}

/**
 * Get CAS number from PubChem
 */
async function casFromPubChem(cid: number): Promise<string | null> {
  const r = await fetch(`${PUBCHEM_COMPOUND}/cid/${cid}/synonyms/JSON`, {
    headers: { 'User-Agent': 'moleculens/1.0' },
  });
  console.log(`[3D Fetch] CAS lookup response: ${r.status}`);
  if (!r.ok) return null;
  const syns = (await r.json())?.InformationList?.Information?.[0]?.Synonym as string[] | undefined;
  return syns?.find(s => CAS_RE.test(s)) ?? null;
}

/**
 * Fetch 3D SDF from NIST
 */
async function nist3dSdf(cas: string): Promise<string | null> {
  const res = await fetch(`${NIST_CGI}?Str3File=C${cas.replace(/-/g, '')}`, {
    headers: { 'User-Agent': 'moleculens/1.0' },
  });
  console.log(`[3D Fetch] NIST response: ${res.status} ${res.headers.get('content-type')}`);
  if (!res.ok) return null;
  const text = await res.text();
  return isSdf3D(text) ? text : null;
}

/**
 * Get SMILES notation for a compound from PubChem
 */
async function getSmiles(cid: number): Promise<string | null> {
  try {
    const props = 'CanonicalSMILES,IsomericSMILES,InChI';
    const r = await fetch(`${PUBCHEM_COMPOUND}/cid/${cid}/property/${props}/JSON`);
    if (!r.ok) return null;

    const p = (await r.json())?.PropertyTable?.Properties?.[0] ?? {};
    return p.CanonicalSMILES || p.IsomericSMILES || p.InChI || null;
  } catch {
    return null;
  }
}

/**
 * Sanitize chemical names for consistent external service queries
 */
function sanitizeName(name: string): string {
  return name
    .normalize('NFKD') // decompose accents, NB-spaces, etc.
    .replace(/[\u00AD\u2010-\u2015\u202F]/g, '-') // soft-hyphens & fancy dashes → -
    .replace(/[^\u0020-\u007F]/g, '') // strip non-ASCII leftovers
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

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
 * Get comprehensive molecule data by PubChem CID with 3D structure prioritization
 */
export async function getMoleculeDataByCID(cid: number): Promise<MolecularSearchResult> {
  try {
    console.log(`[3D Fetch] Starting enhanced 3D fetch for CID ${cid}`);

    // Get properties and synonyms first (not SDF yet)
    const [propsResponse, synonymsResponse] = await Promise.all([
      fetch(
        `${PUBCHEM_COMPOUND}/cid/${cid}/property/MolecularFormula,MolecularWeight,CanonicalSMILES,InChI/JSON`
      ),
      fetch(`${PUBCHEM_COMPOUND}/cid/${cid}/synonyms/JSON`),
    ]);

    const propsData = await propsResponse.json();
    const props = propsData.PropertyTable?.Properties?.[0];

    if (!props) {
      throw new Error('No molecular properties found');
    }

    let synonyms: string[] = [];
    try {
      const synonymsData = await synonymsResponse.json();
      synonyms = synonymsData.InformationList?.Information?.[0]?.Synonym || [];
    } catch {
      // Synonyms are optional
    }

    const moleculeName = synonyms[0] || `CID ${cid}`;

    // ============================================================================
    // COMPREHENSIVE 3D STRUCTURE FETCHING CASCADE
    // ============================================================================
    
    let sdfData = '';
    
    console.log(`[3D Fetch] Step 1: Trying PubChem 3D endpoint for ${moleculeName}`);
    // 1. PubChem 3D endpoint
    try {
      const r = await fetch(`${PUBCHEM_COMPOUND}/cid/${cid}/SDF?record_type=3d`);
      if (r.ok) {
        const txt = await r.text();
        if (isSdf3D(txt)) {
          console.log(`[3D Fetch] ✓ Got 3D data from PubChem 3D endpoint`);
          sdfData = txt;
        } else {
          console.warn(`[3D Fetch] PubChem returned planar coordinates for ${moleculeName}; trying other sources`);
        }
      }
    } catch (error) {
      console.warn(`[3D Fetch] PubChem 3D endpoint failed:`, error);
    }

    // 2. NIST via CAS
    if (!sdfData) {
      console.log(`[3D Fetch] Step 2: Trying NIST via CAS for ${moleculeName}`);
      const cas = await casFromPubChem(cid);
      if (cas) {
        const txt = await nist3dSdf(cas);
        if (txt && isSdf3D(txt)) {
          console.log(`[3D Fetch] ✓ Got 3D data from NIST (CAS ${cas})`);
          sdfData = txt;
        }
      }
    }

    // 3. CACTUS via CID
    if (!sdfData) {
      console.log(`[3D Fetch] Step 3: Trying CACTUS via CID for ${moleculeName}`);
      const txt = await cactus3d(cid);
      if (txt) {
        console.log(`[3D Fetch] ✓ Got 3D data from CACTUS via CID`);
        sdfData = txt;
      }
    }

    // 4. CACTUS via SMILES
    if (!sdfData) {
      console.log(`[3D Fetch] Step 4: Trying CACTUS via SMILES for ${moleculeName}`);
      const smiles = await getSmiles(cid);
      if (smiles) {
        const txt = await cactus3d(smiles);
        if (txt) {
          console.log(`[3D Fetch] ✓ Got 3D data from CACTUS via SMILES`);
          sdfData = txt;
        }
      }
    }

    // 5. CACTUS via molecule name
    if (!sdfData) {
      console.log(`[3D Fetch] Step 5: Trying CACTUS via name for ${moleculeName}`);
      const txt = await cactus3d(sanitizeName(moleculeName));
      if (txt) {
        console.log(`[3D Fetch] ✓ Got 3D data from CACTUS via name`);
        sdfData = txt;
      }
    }

    // 6. PubChem computed conformers
    if (!sdfData) {
      console.log(`[3D Fetch] Step 6: Trying PubChem computed conformers for ${moleculeName}`);
      try {
        const conformerUrl = `${PUBCHEM_COMPOUND}/cid/${cid}/record/SDF?record_type=3d&response_type=save`;
        const r = await fetch(conformerUrl, { headers: { 'User-Agent': 'moleculens/1.0' } });
        console.log(`[3D Fetch] Conformer response: ${r.status} ${r.headers.get('content-type')}`);
        if (r.ok) {
          const txt = await r.text();
          console.log(`[3D Fetch] ✓ Got computed 3D from conformer endpoint`);
          sdfData = txt;
        }
      } catch (error) {
        console.warn(`[3D Fetch] Conformer endpoint failed:`, error);
      }
    }

    // 7. PubChem 2D fallback
    if (!sdfData) {
      console.log(`[3D Fetch] Step 7: Falling back to PubChem 2D for ${moleculeName}`);
      try {
        const r2 = await fetch(`${PUBCHEM_COMPOUND}/cid/${cid}/SDF?record_type=2d`);
        if (r2.ok) {
          sdfData = await r2.text();
          if (!isSdf3D(sdfData)) {
            console.warn(`[3D Fetch] ⚠️ No 3D structure found for ${moleculeName}. Using 2D representation.`);
          }
        } else {
          // Final fallback - default SDF endpoint
          const r3 = await fetch(`${PUBCHEM_COMPOUND}/cid/${cid}/SDF`);
          if (r3.ok) {
            sdfData = await r3.text();
            console.warn(`[3D Fetch] ⚠️ Using default SDF endpoint as final fallback`);
          }
        }
      } catch (error) {
        console.error(`[3D Fetch] All SDF fetch attempts failed:`, error);
      }
    }

    if (!sdfData) {
      throw new Error(`Unable to obtain SDF data for "${moleculeName}" (CID ${cid})`);
    }

    // Log final result
    const is3D = isSdf3D(sdfData);
    console.log(`[3D Fetch] Final result for ${moleculeName}: ${is3D ? '3D' : '2D'} structure`);
    if (is3D) {
      console.log(`[3D Fetch] ✓ Successfully obtained 3D coordinates`);
    }

    // Convert SDF to PDB using our conversion function
    const pdbData = await convertSDFToPDB(sdfData);

    return {
      name: moleculeName,
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
 * Convert SDF data to PDB format with proper bond parsing
 */
export async function convertSDFToPDB(sdfData: string): Promise<string> {
  try {
    console.log('[SDF→PDB] Starting enhanced SDF to PDB conversion with bond parsing');
    
    const lines = sdfData.split(/\r?\n/); // Handle both \r\n and \n
    let atomCount = 0;
    let bondCount = 0;

    // Find the counts line (usually line 3)
    let countsLineIndex = -1;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.match(/^\s*\d+\s+\d+/)) {
        const parts = line.split(/\s+/);
        atomCount = parseInt(parts[0]);
        bondCount = parseInt(parts[1]);
        countsLineIndex = i;
        console.log(`[SDF→PDB] Found counts: ${atomCount} atoms, ${bondCount} bonds`);
        break;
      }
    }

    if (atomCount === 0) {
      throw new Error('No atoms found in SDF data');
    }

    // Convert to PDB format with proper header
    let pdbContent = 'HEADER    MOLECULE CONVERTED FROM SDF\n';
    pdbContent += 'COMPND    UNNAMED\n';
    pdbContent += 'AUTHOR    MOLECULENS CLIENT-SIDE CONVERTER WITH BOND PARSING\n';

    // Parse atoms starting from line after counts
    const atomBlockStart = countsLineIndex + 1;
    const atoms: Array<{ x: number; y: number; z: number; element: string; atomNum: number }> = [];

    console.log(`[SDF→PDB] Parsing ${atomCount} atoms starting from line ${atomBlockStart}`);
    
    for (let i = 0; i < atomCount && atomBlockStart + i < lines.length; i++) {
      const line = lines[atomBlockStart + i].trim();
      const parts = line.split(/\s+/);

      if (parts.length >= 4) {
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        const z = parseFloat(parts[2]);
        const element = parts[3] || 'C';
        const atomNum = i + 1;

        // Store atom info for bond processing
        atoms.push({ x, y, z, element, atomNum });

        const atomNumStr = atomNum.toString().padStart(5, ' ');
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

        pdbContent += `ATOM  ${atomNumStr} ${atomName} ${resName} ${chainId}${resNum}    ${xStr}${yStr}${zStr}  ${occupancy}  ${tempFactor}          ${elementStr}\n`;
      }
    }

    // ============================================================================
    // PARSE BOND TABLE AND GENERATE CONECT RECORDS
    // ============================================================================
    
    const bondBlockStart = atomBlockStart + atomCount;
    const connections: Map<number, Set<number>> = new Map();
    
    console.log(`[SDF→PDB] Parsing ${bondCount} bonds starting from line ${bondBlockStart}`);
    
    // Initialize connection map
    for (let i = 1; i <= atomCount; i++) {
      connections.set(i, new Set());
    }

    let bondsProcessed = 0;
    for (let i = 0; i < bondCount && bondBlockStart + i < lines.length; i++) {
      const line = lines[bondBlockStart + i].trim();
      
      // Skip empty lines and metadata
      if (!line || line.startsWith('M ') || line.startsWith('>')) {
        continue;
      }
      
      const parts = line.split(/\s+/);
      
      if (parts.length >= 3) {
        const atom1 = parseInt(parts[0]);
        const atom2 = parseInt(parts[1]);
      //  const bondType = parseInt(parts[2]) || 1; // Default to single bond
        
        // Validate atom indices
        if (atom1 >= 1 && atom1 <= atomCount && atom2 >= 1 && atom2 <= atomCount && atom1 !== atom2) {
          connections.get(atom1)?.add(atom2);
          connections.get(atom2)?.add(atom1);
          bondsProcessed++;
          
          // if (bondsProcessed <= 10) { // Log first few bonds for debugging
          //   const elem1 = atoms[atom1 - 1]?.element || '?';
          //   const elem2 = atoms[atom2 - 1]?.element || '?';
          //   console.log(`[SDF→PDB] Bond ${bondsProcessed}: ${elem1}${atom1}-${elem2}${atom2} (type ${bondType})`);
          // }
        } else {
          console.warn(`[SDF→PDB] Invalid bond: ${atom1}-${atom2} (atom count: ${atomCount})`);
        }
      }
    }

    console.log(`[SDF→PDB] Successfully processed ${bondsProcessed} bonds`);

    // Generate CONECT records
    let conectCount = 0;
    for (const [atomNum, connectedAtoms] of connections) {
      if (connectedAtoms.size > 0) {
        // Convert Set to sorted array for consistent output
        const sortedConnections = Array.from(connectedAtoms).sort((a, b) => a - b);
        
        // PDB CONECT format can handle up to 4 connections per line
        // If more than 4, create multiple CONECT records
        for (let i = 0; i < sortedConnections.length; i += 4) {
          const batch = sortedConnections.slice(i, i + 4);
          const atomNumStr = atomNum.toString().padStart(5, ' ');
          
          let conectLine = `CONECT${atomNumStr}`;
          for (const connectedAtom of batch) {
            conectLine += connectedAtom.toString().padStart(5, ' ');
          }
          
          pdbContent += conectLine + '\n';
          conectCount++;
        }
      }
    }

    console.log(`[SDF→PDB] Generated ${conectCount} CONECT records`);

    pdbContent += 'END\n';

    // Log summary
    console.log(`[SDF→PDB] Conversion complete: ${atomCount} atoms, ${bondsProcessed} bonds, ${conectCount} CONECT records`);

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
