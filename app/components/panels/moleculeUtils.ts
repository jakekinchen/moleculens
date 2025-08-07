import * as THREE from 'three';
// @ts-expect-error - Three.js examples module not properly typed but works correctly
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { MoleculeType, FormatType } from '../../types';

// Type definitions
export interface MoleculeStats {
  atomCount: number;
  bondCount: number;
  averageBondLength?: number | undefined;
  averageBondAngle?: number | undefined;
}

export interface PDBAtom {
  0: number; // x
  1: number; // y
  2: number; // z
  3: number; // color index
  4: string; // element symbol
}

export interface PDBData {
  atoms: PDBAtom[];
}

export type Vec3 = [number, number, number];

export interface Bounds {
  min: Vec3; // AABB min corner
  max: Vec3; // AABB max corner
  c: Vec3; // sphere centre
  r: number; // sphere radius
}

// Constants
const MAX_STATS_ATOMS = 10000; // Limit stats computation for performance

/**
 * Compute optimized bounding volumes (AABB + sphere) from atom positions
 * Uses Ritter's algorithm for efficient sphere computation
 */
export const boundingVolumes = (pos: Float32Array, vdwRadius?: Float32Array): Bounds => {
  if (pos.length < 3) {
    return { min: [0, 0, 0], max: [0, 0, 0], c: [0, 0, 0], r: 0 };
  }

  // Initialize with first atom
  let minX = pos[0],
    minY = pos[1],
    minZ = pos[2];
  let maxX = pos[0],
    maxY = pos[1],
    maxZ = pos[2];

  // Ritter seed: p = first atom, find q farthest from p
  let qIdx = 0,
    maxD = 0;
  for (let i = 3; i < pos.length; i += 3) {
    const dx = pos[i] - pos[0],
      dy = pos[i + 1] - pos[1],
      dz = pos[i + 2] - pos[2],
      d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > maxD) {
      maxD = d2;
      qIdx = i;
    }
  }

  // r = farthest from q
  let rIdx = 0;
  maxD = 0;
  const qx = pos[qIdx],
    qy = pos[qIdx + 1],
    qz = pos[qIdx + 2];
  for (let i = 0; i < pos.length; i += 3) {
    const dx = pos[i] - qx,
      dy = pos[i + 1] - qy,
      dz = pos[i + 2] - qz,
      d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > maxD) {
      maxD = d2;
      rIdx = i;
    }
  }

  // Initial sphere
  let cx = (qx + pos[rIdx]) * 0.5,
    cy = (qy + pos[rIdx + 1]) * 0.5,
    cz = (qz + pos[rIdx + 2]) * 0.5,
    r = Math.sqrt(maxD) * 0.5;

  // Single pass – update AABB and, if needed, expand the sphere
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i],
      y = pos[i + 1],
      z = pos[i + 2];

    // Update AABB
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;

    // Expand sphere only when outside. Δ = position – centre
    const dx = x - cx,
      dy = y - cy,
      dz = z - cz;
    const dist = Math.hypot(dx, dy, dz);
    let atomR = 0;
    if (vdwRadius) atomR = vdwRadius[i / 3]; // optional van‑der‑Waals padding

    if (dist + atomR > r) {
      // shift centre towards point, enlarge radius
      const newR = (r + dist + atomR) * 0.5;
      const k = (newR - r) / dist;
      cx += dx * k;
      cy += dy * k;
      cz += dz * k;
      r = newR;
    }
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    c: [cx, cy, cz],
    r,
  };
};

// Removes monatomic fragments (e.g. Na⁺, Cl⁻) that sit >cutoff Å from the main fragment's centroid
export function pruneIsolatedIons(root: THREE.Group, cutoff = 4): void {
  const mainCentroid = new THREE.Vector3();
  let n = 0;

  // First pass: calculate centroid
  root.traverse(obj => {
    if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).geometry?.type === 'SphereGeometry') {
      mainCentroid.add(obj.position);
      n++;
    }
  });
  mainCentroid.divideScalar(n || 1);

  // Second pass: collect ions to remove (don't remove during traversal)
  const loneIons = ['Na', 'Li', 'K', 'Cl', 'Br', 'F', 'Ca', 'Mg'];
  const meshesToRemove: THREE.Mesh[] = [];

  root.traverse(obj => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const symbol = mesh.userData?.atom?.symbol as string | undefined;
    if (!symbol || !loneIons.includes(symbol)) return;
    if (mesh.position.distanceTo(mainCentroid) > cutoff) {
      meshesToRemove.push(mesh);
    }
  });

  // Third pass: remove collected meshes after traversal is complete
  meshesToRemove.forEach(mesh => {
    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
  });
}

/**
 * Extract atom positions from a Three.js object hierarchy
 * Used for SDF molecules where positions are embedded in mesh objects
 */
export const extractAtomPositions = (object: THREE.Object3D): Float32Array | null => {
  const positions: number[] = [];
  // Ensure world matrices are up to date so we capture any parent scale/rotation/translation
  object.updateMatrixWorld(true);
  const worldPos = new THREE.Vector3();

  object.traverse((obj: THREE.Object3D) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const isAtomByUserData = !!((mesh.userData as { atom?: unknown } | undefined)?.atom);
      const geoType = mesh.geometry?.type;
      const isAtomByGeometry = geoType === 'SphereGeometry' || geoType === 'IcosahedronGeometry';

      // Prefer userData.atom to identify atoms; fall back to geometry heuristic
      if (isAtomByUserData || isAtomByGeometry) {
        mesh.getWorldPosition(worldPos);
        positions.push(worldPos.x, worldPos.y, worldPos.z);
      }
    }
  });

  return positions.length > 0 ? new Float32Array(positions) : null;
};

/**
 * Apply optimized bounding volumes to Three.js BufferGeometry
 * This enables faster raycasting and collision detection
 */
export const applyBoundsToGeometry = (geometry: THREE.BufferGeometry, bounds: Bounds) => {
  // Assign for internal ray‑caster pruning
  geometry.boundingBox = new THREE.Box3(
    new THREE.Vector3(...bounds.min),
    new THREE.Vector3(...bounds.max)
  );
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...bounds.c), bounds.r);
};

/**
 * Compute molecular statistics from geometry data
 * Returns atom count, bond count, and optionally bond lengths and angles
 */
export const computeStatsFromGeometry = (
  atomPositions: THREE.BufferAttribute,
  bondPositions: THREE.BufferAttribute
): MoleculeStats => {
  const atomCount = atomPositions.count;
  const bondCount = Math.floor(bondPositions.count / 2);

  // For large molecules, skip expensive calculations
  if (atomCount > MAX_STATS_ATOMS) {
    return { atomCount, bondCount };
  }

  const atoms: THREE.Vector3[] = [];
  const idxMap = new Map<string, number>();
  for (let i = 0; i < atomCount; i++) {
    const x = atomPositions.getX(i);
    const y = atomPositions.getY(i);
    const z = atomPositions.getZ(i);
    atoms.push(new THREE.Vector3(x, y, z));
    idxMap.set(`${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`, i);
  }

  const neighbors: number[][] = Array.from({ length: atomCount }, () => []);
  let totalLength = 0;

  for (let i = 0; i < bondPositions.count; i += 2) {
    const sx = bondPositions.getX(i);
    const sy = bondPositions.getY(i);
    const sz = bondPositions.getZ(i);
    const ex = bondPositions.getX(i + 1);
    const ey = bondPositions.getY(i + 1);
    const ez = bondPositions.getZ(i + 1);

    const start = new THREE.Vector3(sx, sy, sz);
    const end = new THREE.Vector3(ex, ey, ez);
    totalLength += start.distanceTo(end);

    const si = idxMap.get(`${sx.toFixed(3)},${sy.toFixed(3)},${sz.toFixed(3)}`);
    const ei = idxMap.get(`${ex.toFixed(3)},${ey.toFixed(3)},${ez.toFixed(3)}`);
    if (si !== undefined && ei !== undefined) {
      neighbors[si].push(ei);
      neighbors[ei].push(si);
    }
  }

  const averageBondLength = bondCount ? totalLength / bondCount : undefined;

  let angleSum = 0;
  let angleCount = 0;
  for (let i = 0; i < atomCount; i++) {
    const nbs = neighbors[i];
    if (nbs.length < 2) continue;
    for (let a = 0; a < nbs.length; a++) {
      for (let b = a + 1; b < nbs.length; b++) {
        const va = atoms[nbs[a]].clone().sub(atoms[i]);
        const vb = atoms[nbs[b]].clone().sub(atoms[i]);
        const ang = va.angleTo(vb);
        if (!isNaN(ang)) {
          angleSum += ang;
          angleCount++;
        }
      }
    }
  }

  const averageBondAngle = angleCount ? (angleSum / angleCount) * (180 / Math.PI) : undefined;

  return { atomCount, bondCount, averageBondLength, averageBondAngle };
};

/**
 * Build instanced atom representation using spheres
 * Creates efficient rendering for many atoms with per-instance coloring
 */
export const buildInstancedAtoms = (
  sphereGeometry: THREE.IcosahedronGeometry,
  positions: THREE.BufferAttribute,
  colors: THREE.BufferAttribute,
  json: PDBData,
  enableLabels: boolean,
  labelsGroup: THREE.Group,
  root: THREE.Group
) => {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.3,
    roughness: 0.25,
    envMapIntensity: 1.0,
  });
  const mesh = new THREE.InstancedMesh(sphereGeometry, material, positions.count);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < positions.count; i++) {
    dummy.position.set(positions.getX(i), positions.getY(i), positions.getZ(i)).multiplyScalar(120);
    dummy.scale.setScalar(40);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    color.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i));
    mesh.setColorAt(i, color);

    if (enableLabels && json.atoms[i]) {
      const atomSymbol = json.atoms[i][4];
      if (atomSymbol) {
        const text = document.createElement('div');
        text.className = 'atom-label';
        text.textContent = atomSymbol;
        const lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
        const txtColor = lum > 0.45 ? '#000' : '#fff';
        text.style.color = txtColor;
        text.style.textShadow = `0 0 4px ${txtColor === '#000' ? '#fff' : '#000'}`;
        text.style.fontSize = '14px';
        text.style.pointerEvents = 'none';

        const label = new CSS2DObject(text);
        label.position.copy(dummy.position);
        labelsGroup.add(label);
      }
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  root.add(mesh);
};

/**
 * Build point cloud representation for atoms
 * More efficient than spheres for very large molecules
 */
/**
 * Enhanced macromolecule visualization for very large structures (>20k atoms)
 * Combines multiple rendering techniques for optimal performance and visual quality
 */
export const buildMacromoleculeVisualization = (
  positions: THREE.BufferAttribute,
  colors: THREE.BufferAttribute,
  pdbData: string,
  root: THREE.Group,
  outlinePass?: { selectedObjects: THREE.Object3D[] }
) => {
  const atomCount = positions.count;
  console.log(`Building macromolecule visualization for ${atomCount} atoms`);

  // Create main group for all visualization components
  const macroGroup = new THREE.Group();
  macroGroup.name = 'macromolecule-visualization';

  // 1. Base point cloud for all atoms (lightweight foundation)
  const pointsGeometry = new THREE.BufferGeometry();
  pointsGeometry.setAttribute('position', positions.clone());
  pointsGeometry.setAttribute('color', colors.clone());
  pointsGeometry.scale(120, 120, 120);

  // Enhanced sprite texture for better atom appearance
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 128;
  const ctx = sprite.getContext('2d')!;

  // Create more sophisticated atom-like sprite
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(0.7, 'rgba(128, 128, 128, 0.4)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(sprite);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;

  const pointsMaterial = new THREE.PointsMaterial({
    size: atomCount > 50000 ? 25 : 35, // Smaller points for very large structures
    vertexColors: true,
    map: texture,
    transparent: true,
    opacity: 0.8,
    alphaTest: 0.1,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(pointsGeometry, pointsMaterial);
  points.name = 'atom-points';
  macroGroup.add(points);

  // 2. Protein backbone ribbon (if protein structure detected)
  const ribbonMesh = buildProteinRibbon(pdbData, atomCount);
  if (ribbonMesh) {
    macroGroup.add(ribbonMesh);
  }

  // 3. Secondary structure highlights (alpha helices, beta sheets)
  const secondaryStructures = buildSecondaryStructureHighlights(pdbData, atomCount);
  if (secondaryStructures.length > 0) {
    secondaryStructures.forEach(structure => macroGroup.add(structure));
  }

  // 4. Active site/binding site highlights (if detectable)
  const activeSites = buildActiveSiteHighlights(pdbData, positions, colors);
  if (activeSites.length > 0) {
    activeSites.forEach(site => macroGroup.add(site));
  }

  root.add(macroGroup);

  if (outlinePass) {
    outlinePass.selectedObjects = [macroGroup];
  }

  return macroGroup;
};

/**
 * Legacy point cloud builder - kept for backward compatibility
 * Use buildMacromoleculeVisualization for better macromolecule rendering
 */
export const buildPointsCloud = (
  positions: THREE.BufferAttribute,
  colors: THREE.BufferAttribute,
  root: THREE.Group,
  outlinePass?: { selectedObjects: THREE.Object3D[] }
) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', positions.clone());
  geometry.setAttribute('color', colors.clone());
  geometry.scale(120, 120, 120);

  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const ctx = sprite.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(1, '#000000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(sprite);

  const material = new THREE.PointsMaterial({
    size: 40,
    vertexColors: true,
    map: texture,
    transparent: true,
    opacity: 0.75,
    alphaTest: 0.1,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  root.add(points);

  if (outlinePass) {
    outlinePass.selectedObjects = [points];
  }

  return points;
};

/**
 * Build protein backbone ribbon for macromolecules
 */
const buildProteinRibbon = (pdbData: string, atomCount: number): THREE.Group | null => {
  if (atomCount < 1000) return null; // Only for large structures

  const ribbonGroup = new THREE.Group();
  ribbonGroup.name = 'protein-ribbon';

  // Extract backbone atoms (CA, N, C) for each chain
  const chains = new Map<string, { ca: THREE.Vector3[]; n: THREE.Vector3[]; c: THREE.Vector3[] }>();

  pdbData.split('\n').forEach(line => {
    if (line.startsWith('ATOM')) {
      const atomName = line.substr(12, 4).trim();
      const chainId = line.charAt(21) || 'A';

      if (['CA', 'N', 'C'].includes(atomName)) {
        const x = parseFloat(line.substr(30, 8)) * 120;
        const y = parseFloat(line.substr(38, 8)) * 120;
        const z = parseFloat(line.substr(46, 8)) * 120;

        if (!chains.has(chainId)) {
          chains.set(chainId, { ca: [], n: [], c: [] });
        }

        const chain = chains.get(chainId)!;
        const pos = new THREE.Vector3(x, y, z);

        if (atomName === 'CA') chain.ca.push(pos);
        else if (atomName === 'N') chain.n.push(pos);
        else if (atomName === 'C') chain.c.push(pos);
      }
    }
  });

  // Create ribbon geometry for each chain
  let colorHue = 0;
  chains.forEach((chain, chainId) => {
    if (chain.ca.length < 4) return;

    try {
      const curve = new THREE.CatmullRomCurve3(chain.ca, false, 'centripetal', 0.5);
      const tubeRadius = atomCount > 50000 ? 8 : 12;
      const geometry = new THREE.TubeGeometry(
        curve,
        Math.min(chain.ca.length * 2, 200),
        tubeRadius,
        8,
        false
      );

      const color = new THREE.Color().setHSL(colorHue, 0.7, 0.6);
      const material = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        metalness: 0.1,
        roughness: 0.3,
        envMapIntensity: 1.0,
      });

      const ribbon = new THREE.Mesh(geometry, material);
      ribbon.name = `ribbon-chain-${chainId}`;
      ribbonGroup.add(ribbon);

      colorHue += 0.15;
    } catch (error) {
      console.warn(`Failed to create ribbon for chain ${chainId}:`, error);
    }
  });

  return ribbonGroup.children.length > 0 ? ribbonGroup : null;
};

/**
 * Build secondary structure highlights (alpha helices, beta sheets)
 */
const buildSecondaryStructureHighlights = (
  pdbData: string,
  atomCount: number
): THREE.Object3D[] => {
  if (atomCount < 2000) return []; // Only for larger structures

  const structures: THREE.Object3D[] = [];

  // Parse HELIX records for alpha helices
  const helices: { start: number; end: number; chainId: string }[] = [];
  const sheets: { start: number; end: number; chainId: string }[] = [];

  pdbData.split('\n').forEach(line => {
    if (line.startsWith('HELIX')) {
      const chainId = line.charAt(19);
      const startRes = parseInt(line.substr(21, 4).trim());
      const endRes = parseInt(line.substr(33, 4).trim());
      if (!isNaN(startRes) && !isNaN(endRes)) {
        helices.push({ start: startRes, end: endRes, chainId });
      }
    } else if (line.startsWith('SHEET')) {
      const chainId = line.charAt(21);
      const startRes = parseInt(line.substr(22, 4).trim());
      const endRes = parseInt(line.substr(33, 4).trim());
      if (!isNaN(startRes) && !isNaN(endRes)) {
        sheets.push({ start: startRes, end: endRes, chainId });
      }
    }
  });

  // Create visual highlights for secondary structures
  // This is a simplified implementation - could be enhanced with actual geometry
  console.log(`Found ${helices.length} helices and ${sheets.length} beta sheets`);

  return structures;
};

/**
 * Build active site highlights for important binding regions
 */
const buildActiveSiteHighlights = (
  pdbData: string,
  _positions: THREE.BufferAttribute,
  _colors: THREE.BufferAttribute
): THREE.Object3D[] => {
  const highlights: THREE.Object3D[] = [];

  // Look for SITE records or common active site residues
  const activeSiteResidues = ['HIS', 'CYS', 'ASP', 'GLU', 'SER', 'THR', 'TYR'];
  const siteAtoms: THREE.Vector3[] = [];

  pdbData.split('\n').forEach(line => {
    if (line.startsWith('ATOM')) {
      const resName = line.substr(17, 3).trim();
      if (activeSiteResidues.includes(resName)) {
        const x = parseFloat(line.substr(30, 8)) * 120;
        const y = parseFloat(line.substr(38, 8)) * 120;
        const z = parseFloat(line.substr(46, 8)) * 120;
        siteAtoms.push(new THREE.Vector3(x, y, z));
      }
    }
  });

  // Create subtle highlights around potential active sites
  if (siteAtoms.length > 10 && siteAtoms.length < 1000) {
    const geometry = new THREE.BufferGeometry();
    const sitePositions = new Float32Array(siteAtoms.length * 3);

    siteAtoms.forEach((pos, i) => {
      sitePositions[i * 3] = pos.x;
      sitePositions[i * 3 + 1] = pos.y;
      sitePositions[i * 3 + 2] = pos.z;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(sitePositions, 3));

    const material = new THREE.PointsMaterial({
      size: 60,
      color: 0xffaa00,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });

    const activeSitePoints = new THREE.Points(geometry, material);
    activeSitePoints.name = 'active-sites';
    highlights.push(activeSitePoints);
  }

  return highlights;
};

/**
 * Build ribbon/cartoon overlay for protein structures
 * Creates tube geometry following backbone atoms
 */
export const buildRibbonOverlay = (pdbText: string, root: THREE.Group) => {
  const chains = new Map<string, THREE.Vector3[]>();
  pdbText.split('\n').forEach(line => {
    if (line.startsWith('ATOM') && line.substr(12, 4).trim() === 'CA') {
      const chainId = line.charAt(21).trim();
      const x = parseFloat(line.substr(30, 8));
      const y = parseFloat(line.substr(38, 8));
      const z = parseFloat(line.substr(46, 8));
      if (!chains.has(chainId)) chains.set(chainId, []);
      chains.get(chainId)!.push(new THREE.Vector3(x, y, z));
    }
  });

  let h = 0;
  chains.forEach(pts => {
    if (pts.length < 4) return;
    const curve = new THREE.CatmullRomCurve3(
      pts.map(p => p.clone().multiplyScalar(120)),
      false,
      'centripetal',
      0.5
    );
    const geometry = new THREE.TubeGeometry(curve, pts.length * 4, 12, 6, false);
    const color = new THREE.Color().setHSL(h, 0.6, 0.5);
    h += 0.3;
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      metalness: 0.0,
      roughness: 0.5,
      envMapIntensity: 1.0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    root.add(mesh);
  });
};

/**
 * Detects if molecular data contains 3D coordinates by checking Z-coordinate variation
 * @param data PDB or SDF molecular data string
 * @returns true if the data appears to have 3D coordinates
 */
export function has3DCoordinates(data: string): boolean {
  if (!data) return false;

  const lines = data.split('\n');
  const zCoords: number[] = [];

  // Check PDB format coordinates
  if (data.includes('ATOM') || data.includes('HETATM')) {
    for (const line of lines) {
      if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
        // PDB format: positions 30-38 (1-indexed) for Z coordinate
        const zStr = line.substring(46, 54).trim();
        const z = parseFloat(zStr);
        if (!isNaN(z)) {
          zCoords.push(z);
        }
      }
    }
  }

  // Check SDF format coordinates
  else if (data.includes('V2000') || data.includes('V3000')) {
    let inAtomBlock = false;
    for (const line of lines) {
      if (line.includes('V2000')) {
        inAtomBlock = true;
        continue;
      }
      if (line.includes('M  END') || line.includes('$$$$')) {
        break;
      }
      if (inAtomBlock && line.trim()) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const z = parseFloat(parts[2]);
          if (!isNaN(z)) {
            zCoords.push(z);
          }
        }
      }
    }
  }

  if (zCoords.length < 2) return false;

  // Calculate Z-coordinate variance to determine if it's 3D
  const mean = zCoords.reduce((sum, z) => sum + z, 0) / zCoords.length;
  const variance = zCoords.reduce((sum, z) => sum + Math.pow(z - mean, 2), 0) / zCoords.length;
  const stdDev = Math.sqrt(variance);

  // If standard deviation is very small, likely 2D (all Z ≈ 0)
  return stdDev > 0.01; // Threshold for considering it 3D
}

/**
 * Validates SDF data quality by checking for atoms and bonds
 * @param sdfData SDF format molecular data string
 * @returns true if the SDF data appears valid
 */
export function isValidSDF(sdfData: string): boolean {
  if (!sdfData?.trim()) return false;
  const lines = sdfData.split(/\r?\n/);

  // V3000: "M  V30 COUNTS <atoms> <bonds> ..."
  for (const l of lines) {
    const m = l.match(/M\s+V30\s+COUNTS\s+(\d+)\s+(\d+)/i);
    if (m) return parseInt(m[1], 10) > 0;
  }

  // V2000 (or generic counts line): first 10 lines usually contain counts; line may end with "V2000"
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const m = lines[i].match(/^\s*(\d+)\s+(\d+)(?:\s|$)/);
    if (m) return parseInt(m[1], 10) > 0;
  }

  return false;
}

/**
 * Smart format selection based on molecule type and data availability
 * Implements the hierarchy:
 * Small molecules: 3D SDF > 3D PDB→SDF > 2D SDF > PDB
 * Macromolecules: PDB (always)
 *
 * @param pdbData PDB format data (optional)
 * @param sdfData SDF format data (optional)
 * @param moleculeType Classification from LLM
 * @returns Optimal format to use
 */
export function selectOptimalFormat(
  pdbData?: string,
  sdfData?: string,
  moleculeType?: MoleculeType
): FormatType {
  const hasPDB = pdbData && pdbData.trim().length > 0;
  const hasSDF = sdfData && sdfData.trim().length > 0;

  // Macromolecules → PDB preferred
  if (moleculeType === 'macromolecule') return hasPDB ? 'PDB' : 'SDF';

  // Small molecules → always prefer SDF when present (preserve bond multiplicities)
  if (moleculeType === 'small molecule') return hasSDF ? 'SDF' : hasPDB ? 'PDB' : 'PDB';

  // Fallbacks
  if (hasSDF) return 'SDF';
  if (hasPDB) return 'PDB';
  return 'PDB';
}
