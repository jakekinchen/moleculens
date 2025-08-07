import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
// @ts-expect-error - Three.js examples module not properly typed but works correctly
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// @ts-expect-error - Three.js examples module not properly typed but works correctly
import { PDBLoader } from 'three/examples/jsm/loaders/PDBLoader';
// @ts-expect-error - Three.js examples module not properly typed but works correctly
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
// @ts-expect-error - Three.js examples module not properly typed but works correctly
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
// @ts-expect-error - Three.js examples module not properly typed but works correctly
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
// @ts-expect-error - Three.js examples module not properly typed but works correctly
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
// @ts-expect-error - Three.js examples module not properly typed but works correctly
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
// @ts-expect-error - three-sdf-loader lacks types
import { loadSDF } from 'three-sdf-loader';
import { LoadingFacts } from './LoadingFacts';
import { MoleculeInfo } from '@/types';

// Constants for animation
const ROTATION_SPEED = 0.1; // Rotations per second
const PAUSE_SMOOTHING = 0.15; // Smoothing factor for pause/play transitions

interface MoleculeViewerProps {
  isLoading?: boolean;
  pdbData: string;
  /** If provided, SDF format will be used instead of PDB */
  sdfData?: string;
  title: string;
  /**
   * Whether atom symbol labels should be rendered.  For macromolecules we
   * disable this to improve performance.  Defaults to true.
   */
  showAnnotations?: boolean;
  moleculeInfo?: MoleculeInfo | null;
  /** Enable experimental ribbon/cartoon rendering */
  enableRibbonOverlay?: boolean;
  /** Enable pause rotation on hover over molecule sphere */
  enableHoverPause?: boolean;
  /** Enable golden glow effect when hovering over molecule */
  enableHoverGlow?: boolean;
  /** Show debug visualization of hover boundary (development only) */
  showHoverDebug?: boolean;
  /** Show persistent debug wireframe of bounding sphere */
  showDebugWireframe?: boolean;
}

interface MoleculeStats {
  atomCount: number;
  bondCount: number;
  averageBondLength?: number;
  averageBondAngle?: number;
}

interface PDBAtom {
  0: number; // x
  1: number; // y
  2: number; // z
  3: number; // color index
  4: string; // element symbol
}

interface PDBData {
  atoms: PDBAtom[];
}

type Vec3 = [number, number, number];

interface Bounds {
  min: Vec3; // AABB min corner
  max: Vec3; // AABB max corner
  c: Vec3; // sphere centre
  r: number; // sphere radius
}

export default function MoleculeViewer({
  isLoading = false,
  pdbData,
  sdfData,
  title,
  showAnnotations = true,
  moleculeInfo,
  enableRibbonOverlay = false,
  enableHoverPause = true,
  enableHoverGlow = false,
  showHoverDebug = false,
  showDebugWireframe = false,
}: MoleculeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement | null>(null);
  const labelContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [stats, setStats] = useState<MoleculeStats | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [optimizedBounds, setOptimizedBounds] = useState<Bounds | null>(null);
  const optimizedBoundsRef = useRef<Bounds | null>(null);
  const [currentFormat, setCurrentFormat] = useState<'PDB' | 'SDF'>('SDF'); // Default to SDF if available
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const rotationRef = useRef<number>(0);
  const clockRef = useRef<THREE.Clock | null>(null);
  const targetRotationSpeedRef = useRef<number>(0);
  const currentRotationSpeedRef = useRef<number>(0);

  // Use refs to prevent scene rebuilds on pause/play and annotation toggle
  const isPausedRef = useRef(false);
  const isHoveredRef = useRef(false);
  const showAnnotationsRef = useRef(showAnnotations);

  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);

  // Determine if both formats are available and set initial format
  const bothFormatsAvailable = !!(
    pdbData &&
    pdbData.trim().length > 0 &&
    sdfData &&
    sdfData.trim().length > 0
  );

  // Set initial format preference (SDF if available, otherwise PDB)
  useEffect(() => {
    if (sdfData && sdfData.trim().length > 0) {
      setCurrentFormat('SDF');
    } else {
      setCurrentFormat('PDB');
    }
  }, [pdbData, sdfData]);

  // Sync showAnnotations prop with ref
  useEffect(() => {
    showAnnotationsRef.current = showAnnotations;
  }, [showAnnotations]);

  // Handle prop-driven label toggle without scene rebuild
  useEffect(() => {
    // Skip until the scene exists
    const labels = labelRendererRef.current?.domElement;
    if (!labels) return;

    // Toggle CSS2DRenderer visibility
    labels.style.display = showAnnotations ? '' : 'none';

    // Toggle labelsGroup visibility if it exists
    const labelsGroup =
      rendererRef.current?.domElement?.parentElement?.querySelector('.labels-group');
    if (labelsGroup) {
      (labelsGroup as HTMLElement).style.display = showAnnotations ? '' : 'none';
    }
  }, [showAnnotations]);

  useEffect(() => {
    if (isLoading) return; // Don't initialize Three.js when loading

    let camera: THREE.PerspectiveCamera;
    let scene: THREE.Scene;
    let renderer: THREE.WebGLRenderer;
    let labelRenderer: CSS2DRenderer;
    let composer: EffectComposer;
    let outlinePass: OutlinePass;
    let controls: OrbitControls;
    let root: THREE.Group;
    let labelsGroup: THREE.Group;
    let animationId: number;
    let resizeObserver: ResizeObserver;

    const config = { enableAnnotations: showAnnotationsRef.current };

    // Handle resize
    const onResize = () => {
      if (!wrapperRef.current || !containerRef.current || !labelContainerRef.current) return;

      const rect = wrapperRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      // Update both renderers with the same dimensions
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';

      if (composer) {
        composer.setSize(width, height);
      }

      if (showAnnotationsRef.current && labelRenderer) {
        labelRenderer.setSize(width, height);
        labelRenderer.domElement.style.width = '100%';
        labelRenderer.domElement.style.height = '100%';
      }

      // Force a render to update the view
      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
      if (showAnnotationsRef.current && labelRenderer) {
        labelRenderer.render(scene, camera);
      }
    };

    // Helper to load an HDRI environment map for realistic reflections
    const addEnvironment = async (
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene
    ): Promise<void> => {
      return new Promise((resolve, reject) => {
        new RGBELoader().load(
          'https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/hdri/venice_sunset_1k.hdr',
          (hdr: THREE.Texture) => {
            const pmrem = new THREE.PMREMGenerator(renderer);
            const envMap = pmrem.fromEquirectangular(hdr).texture;
            scene.environment = envMap;
            hdr.dispose();
            pmrem.dispose();
            resolve();
          },
          undefined,
          (err: unknown) => {
            if (process.env.NODE_ENV !== 'production') {
              console.error('Failed to load HDRI environment', err);
            }
            reject(err);
          }
        );
      });
    };

    // Initialization
    const init = async () => {
      if (!containerRef.current || !labelContainerRef.current || !wrapperRef.current) return;

      // Initialize clock
      clockRef.current = new THREE.Clock();

      // Scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x18223b);
      sceneRef.current = scene;

      // Camera
      const rect = wrapperRef.current.getBoundingClientRect();
      camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 1, 5000);
      camera.position.z = 800;
      cameraRef.current = camera;

      // Ambient + hemi lights for base illumination
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));

      const hemi = new THREE.HemisphereLight(0xffffff, 0x080820, 0.7);
      scene.add(hemi);

      const light1 = new THREE.DirectionalLight(0xffffff, 1.2);
      light1.position.set(1, 1, 1);
      scene.add(light1);
      const light2 = new THREE.DirectionalLight(0xffffff, 0.8);
      light2.position.set(-1, -1, 1);
      scene.add(light2);

      // Root group
      root = new THREE.Group();
      labelsGroup = new THREE.Group();
      root.add(labelsGroup);
      scene.add(root);
      rootRef.current = root;

      // Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true });
      // Use new outputColorSpace (r152+); fall back to legacy outputEncoding
      if ('outputColorSpace' in renderer) {
        (renderer as THREE.WebGLRenderer & { outputColorSpace: string }).outputColorSpace =
          THREE.SRGBColorSpace;
      } else {
        // @ts-expect-error - legacy property for older Three.js types
        renderer.outputEncoding = THREE.sRGBEncoding;
      }
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      (
        renderer as THREE.WebGLRenderer & { physicallyCorrectLights: boolean }
      ).physicallyCorrectLights = true;

      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      containerRef.current.appendChild(renderer.domElement);

      // Add environment reflections
      try {
        await addEnvironment(renderer, scene);
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to load environment map, continuing with basic lighting');
        }
      }

      composer = new EffectComposer(renderer);
      composer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      outlinePass = new OutlinePass(
        new THREE.Vector2(containerRef.current.clientWidth, containerRef.current.clientHeight),
        scene,
        camera
      );
      composer.addPass(outlinePass);
      composerRef.current = composer;
      outlinePassRef.current = outlinePass;

      // Hide fallback caption if present
      if (wrapperRef.current) {
        const fallback = wrapperRef.current.querySelector<HTMLDivElement>('.molecule');
        if (fallback) fallback.style.display = 'none';
      }

      // CSS2D renderer
      if (showAnnotationsRef.current) {
        labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize(
          labelContainerRef.current.clientWidth,
          labelContainerRef.current.clientHeight
        );
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0px';
        labelRenderer.domElement.style.pointerEvents = 'none';
        labelContainerRef.current.appendChild(labelRenderer.domElement);
      }

      // Controls
      controls = new OrbitControls(camera, renderer.domElement);
      controls.minDistance = 400;
      controls.maxDistance = 1200;
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enablePan = false; // Disable panning to prevent off-center dragging

      // Setup resize observer
      resizeObserver = new ResizeObserver(_entries => {
        // Use RAF to avoid multiple resize calls
        requestAnimationFrame(() => {
          onResize();
        });
      });
      resizeObserver.observe(wrapperRef.current);

      // Initial size
      onResize();

      // Load molecule depending on format
      loadMolecule();

      // Store references for cleanup
      rendererRef.current = renderer;
      labelRendererRef.current = labelRenderer;
    };

    const buildInstancedAtoms = (
      sphereGeometry: THREE.IcosahedronGeometry,
      positions: THREE.BufferAttribute,
      colors: THREE.BufferAttribute,
      json: PDBData,
      enableLabels: boolean
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
        dummy.position
          .set(positions.getX(i), positions.getY(i), positions.getZ(i))
          .multiplyScalar(120);
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

    const buildPointsCloud = (positions: THREE.BufferAttribute, colors: THREE.BufferAttribute) => {
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

    const buildRibbonOverlay = (pdbText: string) => {
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

    // Helper to compute simple molecule statistics
    const computeStatsFromGeometry = (
      atomPositions: THREE.BufferAttribute,
      bondPositions: THREE.BufferAttribute
    ): MoleculeStats => {
      const atomCount = atomPositions.count;
      const bondCount = Math.floor(bondPositions.count / 2);

      // For huge molecules just return counts
      const MAX_STATS_ATOMS = 2000;
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

    // PDB loader
    const loadMolecule = () => {
      // Clear any existing molecule from the scene and reset transformations
      if (root) {
        root.clear();
        root.add(labelsGroup);
        root.position.set(0, 0, 0); // reset any translation left by a prior model
        root.rotation.set(0, 0, 0);
      }
      controls.reset();
      setOptimizedBounds(null); // drop bounds from the previous molecule
      optimizedBoundsRef.current = null;
      // Use the selected format if both are available, otherwise use what's available
      const sdfAvailable = sdfData && sdfData.trim().length > 0;
      const pdbAvailable = pdbData && pdbData.trim().length > 0;
      const shouldUseSDF = sdfAvailable && (currentFormat === 'SDF' || !pdbAvailable);

      if (shouldUseSDF) {
        console.log('=== ATTEMPTING SDF LOADING ===');
        console.log('SDF data available:', !!sdfData);
        console.log('SDF data length:', sdfData?.length);
        try {
          // Use enhanced SDF loading with three-center bond detection for diborane-like molecules
          const mol = loadSDF(sdfData!, {
            showHydrogen: true, // Show hydrogens for better molecular structure understanding
            addThreeCenterBonds: true, // Enable three-center bond detection (helps with diborane)
            layout: 'auto', // Auto-detect 2D vs 3D layout
            renderMultipleBonds: true,
            attachAtomData: true,
            attachProperties: true,
          });

          // Count atoms and bonds for debugging and fallback detection
          let atomCount = 0;
          let bondCount = 0;
          const atomTypes: string[] = [];
          const bondTypes: string[] = [];

          mol.traverse((obj: THREE.Object3D) => {
            if (
              (obj as THREE.Mesh).isMesh &&
              (obj as THREE.Mesh).geometry?.type === 'SphereGeometry'
            ) {
              atomCount++;
              if ((obj as THREE.Mesh).userData?.atom?.symbol) {
                atomTypes.push((obj as THREE.Mesh).userData.atom.symbol);
              }
            }
            // Count all bond-related objects: LineSegments, Lines, and Cylinder meshes
            if (
              (obj as THREE.LineSegments).isLineSegments ||
              (obj as THREE.Line).isLine ||
              ((obj as THREE.Mesh).isMesh &&
                ((obj as THREE.Mesh).geometry?.type === 'CylinderGeometry' ||
                  (obj as THREE.Mesh).geometry?.type === 'BufferGeometry'))
            ) {
              bondCount++;
              // Track what type of bond objects we're finding
              if ((obj as THREE.LineSegments).isLineSegments) {
                bondTypes.push('LineSegments');
              } else if ((obj as THREE.Line).isLine) {
                bondTypes.push('Line');
              } else if ((obj as THREE.Mesh).isMesh) {
                bondTypes.push(`Mesh(${(obj as THREE.Mesh).geometry?.type})`);
              }
            }
          });
          // Log layout detection and molecule structure for debugging
          if (process.env.NODE_ENV !== 'production') {
            console.log('=== SDF LAYOUT DETECTION ===');
            console.log('Layout mode:', mol.userData.layoutMode);
            console.log('Properties:', mol.userData.properties);
            console.log('Atoms found:', atomCount);
            console.log('Atom types:', atomTypes);
            console.log('Bonds found:', bondCount);
            console.log('Bond types:', bondTypes);
            console.log('Total children in mol:', mol.children.length);
            console.log('============================');
          }

          // Check if SDF parsing failed to create bonds - fallback to PDB if so
          if (atomCount > 1 && bondCount === 0) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('SDF parsing found atoms but no bonds - falling back to PDB format');
            }
            // Clear the failed SDF attempt and fall through to PDB loading
            root.clear();
            throw new Error('SDF bonds missing - fallback to PDB');
          }

          // Upgrade materials for PBR & reflections
          mol.traverse((obj: THREE.Object3D) => {
            if ((obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;
              const material = mesh.material as THREE.MeshBasicMaterial;
              const base = material.color?.clone?.() ?? new THREE.Color(0xffffff);
              mesh.material = new THREE.MeshStandardMaterial({
                color: base,
                metalness: 0.3,
                roughness: 0.25,
                envMapIntensity: 1.0,
              });
            }
          });

          // Wrap molecule in a parent group so we can rotate it easily
          const molGroup = new THREE.Group();
          molGroup.add(mol);
          root.add(molGroup);

          // Handle 2D vs 3D layout differences
          if (mol.userData.layoutMode === '2d') {
            if (process.env.NODE_ENV !== 'production') {
              console.log('2D layout detected - adjusting camera and controls');
            }
            // For 2D molecules, position camera directly in front and reduce rotation freedom
            camera.position.set(0, 0, 800);
            controls.enableRotate = true; // Still allow some rotation to see the molecule from different angles
            controls.maxPolarAngle = Math.PI; // Allow full rotation
            controls.minPolarAngle = 0;
          } else {
            if (process.env.NODE_ENV !== 'production') {
              console.log('3D layout detected - using standard camera setup');
            }
            // Standard 3D setup - camera will be positioned by fitCameraToMolecule
            controls.enableRotate = true;
            controls.maxPolarAngle = Math.PI;
            controls.minPolarAngle = 0;
          }

          // Labels
          if (showAnnotations) {
            const atomSymbols: string[] = [];
            mol.traverse((o: THREE.Object3D) => {
              if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).userData?.atom?.symbol) {
                atomSymbols.push((o as THREE.Mesh).userData.atom.symbol);
              }
            });

            let atomIndex = 0;
            mol.traverse((obj: THREE.Object3D) => {
              if (!(obj as THREE.Mesh).isMesh) return;
              const geoType = (obj as THREE.Mesh).geometry?.type;
              if (geoType !== 'SphereGeometry' && geoType !== 'IcosahedronGeometry') return;

              const symbol = atomSymbols[atomIndex++] ?? '';
              if (!symbol) return;

              const div = document.createElement('div');
              div.className = 'atom-label';
              div.textContent = symbol;
              const { r, g, b } = ((obj as THREE.Mesh).material as THREE.MeshStandardMaterial)
                .color;
              const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
              const txtColor = lum > 0.45 ? '#000' : '#fff';
              div.style.color = txtColor;
              div.style.fontSize = '12px';
              div.style.textShadow = `0 0 4px ${txtColor === '#000' ? '#fff' : '#000'}`;

              const label = new CSS2DObject(div);
              label.position.set(0, 0, 0);
              obj.add(label);
            });
          }

          // recenter is now handled once inside fitCameraToMoleculeOptimized

          // Use optimized bounding calculation for SDF molecules
          // Debug: log what geometry types the SDF loader created
          if (process.env.NODE_ENV !== 'production') {
            console.log('=== SDF GEOMETRY DEBUG ===');
            mol.traverse((obj: THREE.Object3D) => {
              if ((obj as THREE.Mesh).isMesh) {
                const mesh = obj as THREE.Mesh;
                console.log('Found mesh with geometry type:', mesh.geometry?.type);
              }
            });
            console.log('========================');
          }

          const atomPositions = extractAtomPositions(mol);
          if (atomPositions && atomPositions.length > 0) {
            const bounds = boundingVolumes(atomPositions);

            if (process.env.NODE_ENV !== 'production') {
           //   console.log('=== OPTIMIZED BOUNDING CALCULATION (SDF) ===');
              console.log('Atom count:', atomPositions.length / 3);
            //  console.log('AABB min:', bounds.min);
            //  console.log('AABB max:', bounds.max);
            //  console.log('Sphere center:', bounds.c);
            //  console.log('Sphere radius:', bounds.r.toFixed(2));
            //  console.log('============================================');
            }

            // Use optimized camera fitting
            fitCameraToMoleculeOptimized(atomPositions);
          } else {
            if (process.env.NODE_ENV !== 'production') {
              console.log('SDF: No atom positions extracted, using fallback method');
            }
            // Fallback to standard method
            fitCameraToMolecule();
          }

          labelsGroup.visible = config.enableAnnotations;
          setStats(null);
          ensureTitleVisible(); // Ensure title is visible after SDF loading
          return; // done
        } catch (e) {
          console.error('Failed to load SDF molecule:', e);
          console.error('SDF data length:', sdfData?.length);
          console.error('SDF data preview:', sdfData?.substring(0, 200));
          // Clear any partial SDF loading attempt
          root.clear();
        }
      }

      /* -------- existing PDB path -------- */
      const pdbBlob = new Blob([pdbData], { type: 'text/plain' });
      const pdbUrl = URL.createObjectURL(pdbBlob);

      const loader = new PDBLoader();
      loader.load(
        pdbUrl,
        (pdb: {
          geometryAtoms: THREE.BufferGeometry;
          geometryBonds: THREE.BufferGeometry;
          json: PDBData;
        }) => {
          const { geometryAtoms, geometryBonds, json } = pdb;
          const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
          const sphereGeometry = new THREE.IcosahedronGeometry(1, 3);
          const offset = new THREE.Vector3();

          geometryAtoms.computeBoundingBox();
          geometryAtoms.boundingBox?.getCenter(offset).negate();

          geometryAtoms.translate(offset.x, offset.y, offset.z);
          geometryBonds.translate(offset.x, offset.y, offset.z);

          let positions = geometryAtoms.getAttribute('position');
          const colors = geometryAtoms.getAttribute('color');
          const position = new THREE.Vector3();
          const color = new THREE.Color();

          // Heuristic: disable per-atom labels if the structure is huge (avoids
          // thousands of CSS2DObjects that kill performance for macromolecules).
          const MAX_LABEL_ATOMS = 500; // tweak as needed
          const enableLabelsThisModel =
            config.enableAnnotations && positions.count <= MAX_LABEL_ATOMS;

          const ATOMS_INSTANCED_THRESHOLD = 5000;
          const POINTS_THRESHOLD = 20000;

          if (positions.count <= ATOMS_INSTANCED_THRESHOLD) {
            // Individual meshes (existing path)
            for (let i = 0; i < positions.count; i++) {
              position.set(positions.getX(i), positions.getY(i), positions.getZ(i));
              color.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i));

              const atomMaterial = new THREE.MeshStandardMaterial({
                color,
                metalness: 0.3,
                roughness: 0.25,
                envMapIntensity: 1.0,
              });
              const atom = new THREE.Mesh(sphereGeometry, atomMaterial);
              atom.position.copy(position).multiplyScalar(120);
              atom.scale.setScalar(40);
              root.add(atom);

              if (enableLabelsThisModel && json.atoms[i]) {
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
                  label.position.copy(atom.position);
                  labelsGroup.add(label);
                }
              }
            }

            // Bonds
            positions = geometryBonds.getAttribute('position') as THREE.BufferAttribute;
            const start = new THREE.Vector3();
            const end = new THREE.Vector3();

            for (let i = 0; i < positions.count; i += 2) {
              start
                .set(positions.getX(i), positions.getY(i), positions.getZ(i))
                .multiplyScalar(120);
              end
                .set(positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1))
                .multiplyScalar(120);

              const bondMesh = new THREE.Mesh(
                boxGeometry,
                new THREE.MeshStandardMaterial({
                  color: 0xffffff,
                  metalness: 0.1,
                  roughness: 0.3,
                  envMapIntensity: 1.0,
                })
              );
              bondMesh.position.copy(start).lerp(end, 0.5);
              bondMesh.scale.set(8, 8, start.distanceTo(end));
              bondMesh.lookAt(end);
              root.add(bondMesh);
            }
          } else if (positions.count <= POINTS_THRESHOLD) {
            buildInstancedAtoms(
              sphereGeometry,
              positions as THREE.BufferAttribute,
              colors as THREE.BufferAttribute,
              json,
              enableLabelsThisModel
            );

            // Bonds for instanced meshes
            positions = geometryBonds.getAttribute('position') as THREE.BufferAttribute;
            const start = new THREE.Vector3();
            const end = new THREE.Vector3();

            for (let i = 0; i < positions.count; i += 2) {
              start
                .set(positions.getX(i), positions.getY(i), positions.getZ(i))
                .multiplyScalar(120);
              end
                .set(positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1))
                .multiplyScalar(120);

              const bondMesh = new THREE.Mesh(
                boxGeometry,
                new THREE.MeshStandardMaterial({
                  color: 0xffffff,
                  metalness: 0.1,
                  roughness: 0.3,
                  envMapIntensity: 1.0,
                })
              );
              bondMesh.position.copy(start).lerp(end, 0.5);
              bondMesh.scale.set(8, 8, start.distanceTo(end));
              bondMesh.lookAt(end);
              root.add(bondMesh);
            }
          } else {
            buildPointsCloud(positions as THREE.BufferAttribute, colors as THREE.BufferAttribute);
          }

          // Only draw ribbon overlay for large macromolecules (heuristic)
          const MIN_ATOMS_FOR_RIBBON = 500;
          if (enableRibbonOverlay && positions.count > MIN_ATOMS_FOR_RIBBON) {
            buildRibbonOverlay(pdbData);
          }

          // Compute basic statistics for info panel
          try {
            const statsResult = computeStatsFromGeometry(
              geometryAtoms.getAttribute('position') as THREE.BufferAttribute,
              geometryBonds.getAttribute('position') as THREE.BufferAttribute
            );
            setStats(statsResult);
          } catch (e) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('Failed to compute molecule statistics', e);
            }
            setStats(null);
          }

          URL.revokeObjectURL(pdbUrl);
          labelsGroup.visible = config.enableAnnotations;

          // Fit camera to the molecule after loading using optimized bounds
          // recenter is now handled once inside fitCameraToMoleculeOptimized

          // Use optimized bounding calculation for better performance
          const atomPositions = geometryAtoms.getAttribute('position') as THREE.BufferAttribute;
          const posArray = new Float32Array(atomPositions.array as ArrayLike<number>);

          // CRITICAL: Scale positions by the same factor used for mesh rendering (120x)
          // Without this, camera fitting calculates bounds on Å-scale data while meshes are 120x larger,
          // causing camera to be positioned inside the molecule
          for (let i = 0; i < posArray.length; i++) {
            posArray[i] *= 120;
          }

          // Apply optimized bounds to geometry for faster raycasting
          const bounds = boundingVolumes(posArray);
          applyBoundsToGeometry(geometryAtoms, bounds);



          // Use optimized camera fitting
          fitCameraToMoleculeOptimized(posArray);
          ensureTitleVisible(); // Ensure title is visible after PDB loading
        }
      );
    };

    /**
     * Optimized O(N) bounding volume calculation using Ritter's algorithm
     * Calculates both AABB and near-minimal bounding sphere in a single pass
     */
    const boundingVolumes = (pos: Float32Array, vdwRadius?: Float32Array): Bounds => {
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

    /**
     * Extract atom positions from a Three.js object hierarchy
     * Used for SDF molecules where positions are embedded in mesh objects
     */
    const extractAtomPositions = (object: THREE.Object3D): Float32Array | null => {
      const positions: number[] = [];

      object.traverse((obj: THREE.Object3D) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          const geoType = mesh.geometry?.type;

          // Look for sphere geometries (atoms)
          if (geoType === 'SphereGeometry' || geoType === 'IcosahedronGeometry') {
            const pos = mesh.position;
            positions.push(pos.x, pos.y, pos.z);
          }
        }
      });

      return positions.length > 0 ? new Float32Array(positions) : null;
    };

    /**
     * Apply optimized bounding volumes to Three.js BufferGeometry
     * This enables faster raycasting and collision detection
     */
    const applyBoundsToGeometry = (geometry: THREE.BufferGeometry, bounds: Bounds) => {
      // Assign for internal ray‑caster pruning
      geometry.boundingBox = new THREE.Box3(
        new THREE.Vector3(...bounds.min),
        new THREE.Vector3(...bounds.max)
      );
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...bounds.c), bounds.r);
    };

    /** Ensure the molecule title is visible */
    const ensureTitleVisible = () => {
      if (captionRef.current) {
        captionRef.current.style.display = '';
        captionRef.current.style.opacity = '1';
        captionRef.current.style.visibility = 'visible';
      }
    };

    /**
     * Enhanced camera fitting using optimized bounding calculation
     * Uses atom positions directly for more accurate bounds
     */
    const fitCameraToMoleculeOptimized = (
      atomPositions: Float32Array,
      margin = 1.15,
      vdwRadii?: Float32Array
    ) => {
      if (!root || atomPositions.length < 3) return;

      /* ---------- reset rotation / zoom inherited from previous model ---------- */
      controls.reset();
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      rotationRef.current = 0;
      currentRotationSpeedRef.current = 0;
      root.rotation.set(0, 0, 0);

      /* ---------- compute optimized bounding volumes ---------- */
      const bounds = boundingVolumes(atomPositions, vdwRadii);
      const center = new THREE.Vector3(...bounds.c);
      const radius = bounds.r;

      /* ---------- re–centre children (pivot = molecule centre) ---------- */
      root.children.forEach(child => child.position.sub(center)); // ← was root.position.sub(center)

      /* ---------- place camera ---------- */
      const fov = (camera.fov * Math.PI) / 180; // vertical FOV in rad
      const dist = (radius * margin) / Math.sin(fov / 2); // basic geometry
      camera.position.set(0, 0, dist);
      camera.near = dist * 0.01;
      camera.far = dist * 10;
      camera.updateProjectionMatrix();

      /* ---------- orbit controls ---------- */
      controls.target.set(0, 0, 0);
      controls.minDistance = dist * 0.2;
      controls.maxDistance = dist * 5;
      controls.update();
      controls.saveState(); // new baseline

      /* ---------- adjusted bounds for hover‑pause ---------- */
      const centredBounds: Bounds = {
        min: bounds.min.map((v, i) => v - bounds.c[i]) as Vec3,
        max: bounds.max.map((v, i) => v - bounds.c[i]) as Vec3,
        c: [0, 0, 0],
        r: bounds.r,
      };
      setOptimizedBounds(centredBounds);
      optimizedBoundsRef.current = centredBounds;
      return centredBounds;
    };

    /**
     * Re-fit camera & controls so the current molecule fully occupies the viewport.
     * Works for both Å-scale (small ligands) and 100 Å proteins without manual tweaks.
     * Fallback method using Three.js built-in bounding calculation
     */
    const fitCameraToMolecule = (margin = 1.15 /* > 1 adds visual breathing room */) => {
      if (!root) return;

      /* ---------- reset rotation / zoom inherited from previous model ---------- */
      controls.reset();
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      rotationRef.current = 0;
      currentRotationSpeedRef.current = 0;
      root.rotation.set(0, 0, 0);

      /* ---------- compute bounding-sphere ---------- */
      const sphere = new THREE.Sphere();
      new THREE.Box3().setFromObject(root).getBoundingSphere(sphere);
      const { center, radius } = sphere;

      /* ---------- re–centre children (pivot = molecule centre) ---------- */
      root.children.forEach(child => child.position.sub(center)); // ← pivot fix

      /* ---------- place camera ---------- */
      const fov = (camera.fov * Math.PI) / 180; // vertical FOV in rad
      const dist = (radius * margin) / Math.sin(fov / 2); // basic geometry
      camera.position.set(0, 0, dist);
      camera.near = dist * 0.01;
      camera.far = dist * 10;
      camera.updateProjectionMatrix();

      /* ---------- orbit controls ---------- */
      controls.target.set(0, 0, 0);
      controls.minDistance = dist * 0.2;
      controls.maxDistance = dist * 5;
      controls.update();
      controls.saveState(); // new baseline
    };

    // Animation loop
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (root && clockRef.current) {
        const delta = clockRef.current.getDelta();

        // Update rotation speed with smooth interpolation
        targetRotationSpeedRef.current =
          isPausedRef.current || isHoveredRef.current ? 0 : ROTATION_SPEED;
        currentRotationSpeedRef.current +=
          (targetRotationSpeedRef.current - currentRotationSpeedRef.current) * PAUSE_SMOOTHING;

        // Advance rotationRef by smoothed speed, then directly assign
        rotationRef.current =
          (rotationRef.current + currentRotationSpeedRef.current * delta) % (2 * Math.PI);

        // Directly set the root rotation to rotationRef
        root.rotation.y = rotationRef.current;
      }

      // Update debug wireframe to show current bounding sphere position
      if (showDebugWireframe && scene && root && optimizedBoundsRef.current) {
        // Create or update the debug wireframe sphere
        const sphere = new THREE.Sphere();
        sphere.center.set(...optimizedBoundsRef.current.c);
        sphere.radius = optimizedBoundsRef.current.r;

        // Ensure the world matrix is up to date
        root.updateMatrixWorld(true);
        
        // Apply the molecule's current world transformation to the sphere
        sphere.applyMatrix4(root.matrixWorld);

        if (!debugWireframeRef.current) {
          // Create new wireframe
          const geometry = new THREE.SphereGeometry(sphere.radius, 32, 16);
          const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.6,
          });
          debugWireframeRef.current = new THREE.Mesh(geometry, material);
          scene.add(debugWireframeRef.current);
        } else {
          // Update existing wireframe
          const geometry = debugWireframeRef.current.geometry as THREE.SphereGeometry;
          if (Math.abs(geometry.parameters.radius - sphere.radius) > 0.1) {
            // Radius changed significantly, recreate geometry
            geometry.dispose();
            debugWireframeRef.current.geometry = new THREE.SphereGeometry(sphere.radius, 32, 16);
          }
          // Update position
          debugWireframeRef.current.position.copy(sphere.center);
        }
      } else if (debugWireframeRef.current && scene) {
        // Remove wireframe if disabled or no bounds available
        scene.remove(debugWireframeRef.current);
        debugWireframeRef.current.geometry.dispose();
        (debugWireframeRef.current.material as THREE.Material).dispose();
        debugWireframeRef.current = null;
      }

      // Always update controls and render the scene
      controls.update();
      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
      if (showAnnotationsRef.current && labelRenderer) {
        labelRenderer.render(scene, camera);
      }
    };

    (async () => {
      await init();
      animate();
    })();

    // Listen for requests to get the fitCameraToMolecule function
    const handleRequestFitCameraFunction = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.callback) {
        customEvent.detail.callback(fitCameraToMolecule);
      }
    };

    window.addEventListener('request-fit-camera-function', handleRequestFitCameraFunction);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      /* ---------- added: deep disposal ---------- */
      if (root) {
        root.traverse(obj => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(m => m.dispose());
            } else {
              (mesh.material as THREE.Material)?.dispose();
            }
          }
        });
      }
      /* ------------------------------------------ */

      // Store ref values at the start of cleanup
      const currentContainer = containerRef.current;
      const currentLabelContainer = labelContainerRef.current;

      // Safely remove renderer elements
      if (renderer?.domElement && currentContainer?.contains(renderer.domElement)) {
        currentContainer.removeChild(renderer.domElement);
      }
      if (
        showAnnotationsRef.current &&
        labelRenderer?.domElement &&
        currentLabelContainer?.contains(labelRenderer.domElement)
      ) {
        currentLabelContainer.removeChild(labelRenderer.domElement);
      }

      if (renderer) {
        renderer.dispose();
      }
      if (composer) {
        composer.dispose();
      }
      if (controls) {
        controls.dispose();
      }
      if (scene) {
        // Dispose environment map
        if (scene.environment?.dispose) {
          scene.environment.dispose();
        }
        scene.environment = null;
        scene.clear();
      }

      // Remove event listener
      window.removeEventListener('request-fit-camera-function', handleRequestFitCameraFunction);

      // Clear refs
      rendererRef.current = null;
      labelRendererRef.current = null;
      composerRef.current = null;
      outlinePassRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
      rootRef.current = null;

      // Clean up debug sphere
      if (debugSphereRef.current) {
        debugSphereRef.current.geometry.dispose();
        (debugSphereRef.current.material as THREE.Material).dispose();
        debugSphereRef.current = null;
      }

      // Clean up debug wireframe
      if (debugWireframeRef.current) {
        debugWireframeRef.current.geometry.dispose();
        (debugWireframeRef.current.material as THREE.Material).dispose();
        debugWireframeRef.current = null;
      }

      setStats(null);
    }; // eslint-disable-line react-hooks/exhaustive-deps
  }, [
    isLoading,
    pdbData,
    sdfData,
    enableRibbonOverlay,
    showAnnotations,
    enableHoverPause,
    enableHoverGlow,
    showDebugWireframe,
    currentFormat,
  ]); // Dependencies for useEffect

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await wrapperRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error attempting to toggle fullscreen:', err);
      }
    }
  };

  const togglePause = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(isPausedRef.current); // Update UI state
  };

  const toggleInfo = () => {
    setIsInfoOpen(!isInfoOpen);
  };

  const toggleFormat = () => {
    if (bothFormatsAvailable) {
      setCurrentFormat(currentFormat === 'PDB' ? 'SDF' : 'PDB');
    }
  };

  // Store camera and scene references for hover detection
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const debugSphereRef = useRef<THREE.Mesh | null>(null);
  const debugWireframeRef = useRef<THREE.Mesh | null>(null);

  // Precise molecule hover detection using raycasting
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!enableHoverPause || !containerRef.current || !cameraRef.current || !rootRef.current)
      return;

    // Safety check: don't run hover detection during loading or if scene isn't ready
    if (isLoading || !rendererRef.current || rootRef.current.children.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const sphere = new THREE.Sphere();

    if (optimizedBounds) {
      // Create a sphere from the pre-calculated, object-local bounds
      sphere.center.set(...optimizedBounds.c);
      sphere.radius = optimizedBounds.r;

      // Ensure the world matrix is up to date before applying transformation
      // This is critical because we directly modify root.rotation.y in the animation loop
      rootRef.current.updateMatrixWorld(true);

      // Apply the molecule's current world transformation to the sphere
      // This ensures the bounding sphere rotates with the molecule
      sphere.applyMatrix4(rootRef.current.matrixWorld);
    } else {
      // Fallback for safety, though it shouldn't be needed
      new THREE.Box3().setFromObject(rootRef.current).getBoundingSphere(sphere);
    }

    // Debug: log sphere info and optionally visualize
    if (showHoverDebug && sceneRef.current) {
      // Add debug sphere visualization if enabled
      if (debugSphereRef.current) {
        sceneRef.current.remove(debugSphereRef.current);
        debugSphereRef.current.geometry.dispose();
        (debugSphereRef.current.material as THREE.Material).dispose();
      }

      // Create new debug sphere that shows the rotated bounding sphere
      const debugGeometry = new THREE.SphereGeometry(sphere.radius, 32, 32);
      const debugMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
      });
      debugSphereRef.current = new THREE.Mesh(debugGeometry, debugMaterial);
      debugSphereRef.current.position.copy(sphere.center);
      sceneRef.current.add(debugSphereRef.current);

      // Log debug info about the rotated bounds
      if (process.env.NODE_ENV !== 'production') {
        console.log('=== HOVER DEBUG INFO ===');
        console.log('Rotation (Y):', rootRef.current.rotation.y.toFixed(3));
        console.log('Sphere center:', sphere.center.toArray().map(v => v.toFixed(2)));
        console.log('Sphere radius:', sphere.radius.toFixed(2));
        console.log('========================');
      }
    }

    // Check if ray intersects with the bounding sphere
    const ray = raycaster.ray;
    const isHoveringMolecule = ray.intersectsSphere(sphere);

    setIsHovered(isHoveringMolecule);
  };

  useEffect(() => {
    isHoveredRef.current = isHovered;

    // Apply glow effect if enabled
    if (enableHoverGlow && outlinePassRef.current) {
      if (isHovered) {
        // Add steady golden glow (no pulsing)
        outlinePassRef.current.selectedObjects = [rootRef.current!];
        outlinePassRef.current.edgeStrength = 2.5;
        outlinePassRef.current.edgeGlow = 0.8;
        outlinePassRef.current.edgeThickness = 1.5;
        outlinePassRef.current.pulsePeriod = 0; // No pulsing - steady glow
        outlinePassRef.current.visibleEdgeColor.setHex(0xffd700); // Golden color
        outlinePassRef.current.hiddenEdgeColor.setHex(0xffa500); // Slightly darker gold for hidden edges
      } else {
        // Remove glow
        outlinePassRef.current.selectedObjects = [];
      }
    }
  }, [isHovered, enableHoverGlow]);

  const handleMouseLeave = () => {
    if (!enableHoverPause) return;
    setIsHovered(false);
  };



  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Add spacebar pause/unpause functionality
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle spacebar if no text input is focused
      if (event.code === 'Space') {
        const activeElement = document.activeElement;
        const isTextInputFocused = 
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement instanceof HTMLSelectElement ||
          (activeElement && activeElement.getAttribute('contenteditable') === 'true');

        if (!isTextInputFocused) {
          event.preventDefault(); // Prevent page scroll
          togglePause();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty dependency array since togglePause doesn't depend on props/state
  useEffect(() => {
    if (!wrapperRef.current) return;
    const wrapper = wrapperRef.current;

    // Hide any existing molecule elements
    wrapper.querySelectorAll('.molecule').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });

    // Create or update the molecule title
    if (!captionRef.current) {
      const c = document.createElement('div');
      c.className = 'molecule-title';
      wrapper.appendChild(c);
      captionRef.current = c;
    }
    captionRef.current!.textContent = title;

    // Ensure title is visible after molecule loads
    if (!isLoading && captionRef.current) {
      captionRef.current.style.display = '';
      captionRef.current.style.opacity = '1';
    }
  }, [title, isLoading]);

  // The outer wrapper helps position the label absolutely
  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full rounded-xl overflow-hidden bg-[#050505] flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Loading Facts overlay */}
      <LoadingFacts isVisible={isLoading} showFacts={true} />

      {/* Only render molecule viewer content when not loading */}
      {!isLoading && (
        <>
          {/* 3D container */}
          <div ref={containerRef} className="absolute inset-0" />
          {/* Label renderer container */}
          <div ref={labelContainerRef} className="absolute inset-0 pointer-events-none" />
          {/* Control buttons */}
          <div className="absolute top-4 right-4 z-20 flex space-x-2">
            {/* Pause/Play button */}
            <button
              onClick={togglePause}
              className="p-2 rounded-lg text-white hover:text-gray-300
                        transition-colors duration-200"
              title={isPaused ? 'Play Animation' : 'Pause Animation'}
            >
              {isPaused ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
            {/* Info button */}
            <button
              onClick={toggleInfo}
              className="p-2 rounded-lg text-white hover:text-gray-300 transition-colors duration-200"
              title={isInfoOpen ? 'Hide Info' : 'Show Info'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-9-3a1 1 0 112 0 1 1 0 01-2 0zm2 8a1 1 0 11-2 0v-4a1 1 0 112 0v4z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {/* Fullscreen button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-white hover:text-gray-300
                        transition-colors duration-200"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a2 2 0 012-2h2V3H7a4 4 0 00-4 4v2h2zm10 0V7a2 2 0 00-2-2h-2V3h2a4 4 0 014 4v2h-2zm-10 2H3v2a4 4 0 004 4h2v-2H7a2 2 0 01-2-2v-2zm10 0h2v2a4 4 0 01-4 4h-2v-2z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
            {/* Format toggle button - only show if both PDB and SDF are available */}
            {bothFormatsAvailable && (
              <button
                onClick={toggleFormat}
                className="p-2 rounded-lg text-white hover:text-gray-300
                          transition-colors duration-200 bg-gray-700 bg-opacity-50"
                title={`Switch to ${currentFormat === 'PDB' ? 'SDF' : 'PDB'} format`}
              >
                <div className="text-xs font-mono font-bold">{currentFormat}</div>
              </button>
            )}
          </div>
          {moleculeInfo && (
            <div
              className={`absolute left-0 right-0 bottom-0 bg-gray-800 bg-opacity-90 text-white text-xs p-3 transition-transform duration-300 ${isInfoOpen ? 'translate-y-0' : 'translate-y-full'}`}
            >
              {/* Common fields */}
              {moleculeInfo.formula && <div className="mb-1">Formula: {moleculeInfo.formula}</div>}
              {moleculeInfo.formula_weight && typeof moleculeInfo.formula_weight === 'number' && (
                <div className="mb-1">MW: {moleculeInfo.formula_weight.toFixed(2)} kDa</div>
              )}

              {/* Small molecule specific fields */}
              {moleculeInfo.canonical_smiles && (
                <div className="mb-1 break-all">SMILES: {moleculeInfo.canonical_smiles}</div>
              )}
              {moleculeInfo.inchi && (
                <div className="mb-1 break-all">InChI: {moleculeInfo.inchi}</div>
              )}
              {moleculeInfo.synonyms && moleculeInfo.synonyms.length > 0 && (
                <div className="mb-1">Synonyms: {moleculeInfo.synonyms.slice(0, 3).join(', ')}</div>
              )}

              {/* Macromolecule specific fields */}
              {moleculeInfo.full_description && (
                <div className="mb-1">Description: {moleculeInfo.full_description}</div>
              )}
              {moleculeInfo.resolution && typeof moleculeInfo.resolution === 'number' && (
                <div className="mb-1">Resolution: {moleculeInfo.resolution.toFixed(1)} Å</div>
              )}
              {moleculeInfo.experimental_method && (
                <div className="mb-1">Method: {moleculeInfo.experimental_method}</div>
              )}
              {moleculeInfo.chain_count && (
                <div className="mb-1">Chains: {moleculeInfo.chain_count}</div>
              )}
              {moleculeInfo.organism_scientific && (
                <div className="mb-1">
                  Source: {moleculeInfo.organism_scientific}
                  {moleculeInfo.organism_common && ` (${moleculeInfo.organism_common})`}
                </div>
              )}
              {moleculeInfo.keywords && moleculeInfo.keywords.length > 0 && (
                <div className="mb-1">Keywords: {moleculeInfo.keywords.join(', ')}</div>
              )}
              {moleculeInfo.publication_year && (
                <div className="mb-1">
                  Published: {moleculeInfo.publication_year}
                  {moleculeInfo.publication_doi && (
                    <a
                      href={`https://doi.org/${moleculeInfo.publication_doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-300 hover:text-blue-400"
                    >
                      DOI
                    </a>
                  )}
                </div>
              )}
              {stats && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 text-[11px]">
                  <div>Atoms: {stats.atomCount}</div>
                  <div>Bonds: {stats.bondCount}</div>
                  {stats.averageBondLength !== undefined && (
                    <div className="col-span-2">
                      Avg bond length: {stats.averageBondLength.toFixed(2)} Å
                    </div>
                  )}
                  {stats.averageBondAngle !== undefined && (
                    <div className="col-span-2">
                      Avg bond angle: {stats.averageBondAngle.toFixed(1)}°
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
