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

export default function MoleculeViewer({
  isLoading = false,
  pdbData,
  sdfData,
  title,
  showAnnotations = true,
  moleculeInfo,
  enableRibbonOverlay = false,
}: MoleculeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement | null>(null);
  const labelContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [stats, setStats] = useState<MoleculeStats | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const rotationRef = useRef<number>(0);
  const clockRef = useRef<THREE.Clock | null>(null);
  const targetRotationSpeedRef = useRef<number>(0);
  const currentRotationSpeedRef = useRef<number>(0);

  // Use refs to prevent scene rebuilds on pause/play and annotation toggle
  const isPausedRef = useRef(false);
  const showAnnotationsRef = useRef(showAnnotations);

  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);

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
    const addEnvironment = async (renderer: THREE.WebGLRenderer, scene: THREE.Scene): Promise<void> => {
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

      // Camera
      const rect = wrapperRef.current.getBoundingClientRect();
      camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 1, 5000);
      camera.position.z = 800;

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
        console.warn('Failed to load environment map, continuing with basic lighting');
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
      // Detect SDF format: if sdfData prop supplied or pdbData doesn't start with 'COMPND'/'HEADER'
      const sdfAvailable = sdfData && sdfData.trim().length > 0;

      if (sdfAvailable) {
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

          // Log layout detection and molecule structure for debugging
          if (process.env.NODE_ENV !== 'production') {
            console.log('=== SDF LAYOUT DETECTION ===');
            console.log('Layout mode:', mol.userData.layoutMode);
            console.log('Properties:', mol.userData.properties);

            // Count atoms and bonds for debugging
            let atomCount = 0;
            let bondCount = 0;
            const atomTypes: string[] = [];

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
              if (
                (obj as THREE.LineSegments).isLineSegments ||
                ((obj as THREE.Mesh).isMesh &&
                  (obj as THREE.Mesh).geometry?.type === 'CylinderGeometry')
              ) {
                bondCount++;
              }
            });

            console.log('Atoms found:', atomCount);
            console.log('Atom types:', atomTypes);
            console.log('Bonds found:', bondCount);
            console.log('============================');
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

          recenterRoot();          // <-- NEW
          fitCameraToMolecule();
          labelsGroup.visible = config.enableAnnotations;
          setStats(null);
          return; // done
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('Failed to load SDF molecule:', e);
          }
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

          if (enableRibbonOverlay) {
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

          // Fit camera to the molecule after loading
          recenterRoot();          // <-- NEW
          fitCameraToMolecule();
        }
      );
    };

    /** Move the geometric centre of `root` to (0,0,0) and keep OrbitControls happy */
    const recenterRoot = () => {
      const box   = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());

      // Shift every child back so that the overall centre sits on the world origin
      root.children.forEach(child => child.position.sub(center));

      // Ensure OrbitControls continues to rotate around the new pivot
      controls.target.set(0, 0, 0);
      controls.update();
    };

    /**
     * Re-fit camera & controls so the current molecule fully occupies the viewport.
     * Works for both Å-scale (small ligands) and 100 Å proteins without manual tweaks.
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

      /* ---------- move everything so that centre sits on (0,0,0) ---------- */
      root.position.sub(center);          // translate children instead of camera

      /* ---------- place camera ---------- */
      const fov   = (camera.fov * Math.PI) / 180;          // vertical FOV in rad
      const dist  = (radius * margin) / Math.sin(fov / 2); // basic geometry
      camera.position.set(0, 0, dist);
      camera.near = dist * 0.01;
      camera.far  = dist * 10;
      camera.updateProjectionMatrix();

      /* ---------- orbit controls ---------- */
      controls.target.set(0, 0, 0);
      controls.minDistance = dist * 0.2;
      controls.maxDistance = dist * 5;
      controls.update();
      controls.saveState();               // new baseline
    };

    // Animation loop
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (root && clockRef.current) {
        const delta = clockRef.current.getDelta();

        // Update rotation speed with smooth interpolation
        targetRotationSpeedRef.current = isPausedRef.current ? 0 : ROTATION_SPEED;
        currentRotationSpeedRef.current +=
          (targetRotationSpeedRef.current - currentRotationSpeedRef.current) * PAUSE_SMOOTHING;

        // Advance rotationRef by smoothed speed, then directly assign
        rotationRef.current =
          (rotationRef.current + currentRotationSpeedRef.current * delta) % (2 * Math.PI);

        // Directly set the root rotation to rotationRef
        root.rotation.y = rotationRef.current;
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
      const currentContainerRef = containerRef.current;
      const currentRendererRef = rendererRef.current;
      const currentLabelContainerRef = labelContainerRef.current;
      const currentLabelRendererRef = labelRendererRef.current;

      // Safely remove renderer elements
      if (
        currentRendererRef?.domElement &&
        currentContainerRef?.contains(currentRendererRef.domElement)
      ) {
        currentContainerRef.removeChild(currentRendererRef.domElement);
      }
      if (
        showAnnotationsRef.current &&
        currentLabelRendererRef?.domElement &&
        currentLabelContainerRef?.contains(currentLabelRendererRef.domElement)
      ) {
        currentLabelContainerRef.removeChild(currentLabelRendererRef.domElement);
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
      setStats(null);
    }; // eslint-disable-line react-hooks/exhaustive-deps
  }, [isLoading, pdbData, sdfData, enableRibbonOverlay]); // Removed isPaused and showAnnotations to prevent scene rebuilds

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.querySelectorAll('.molecule').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
    if (!captionRef.current) {
      const c = document.createElement('div');
      c.className = 'molecule-title';
      container.appendChild(c);
      captionRef.current = c;
    }
    captionRef.current!.textContent = title;
  }, [title]);

  // The outer wrapper helps position the label absolutely
  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full rounded-xl overflow-hidden bg-[#050505] flex flex-col"
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
          </div>
          {moleculeInfo && (
            <div
              className={`absolute left-0 right-0 bottom-0 bg-gray-800 bg-opacity-90 text-white text-xs p-3 transition-transform duration-300 ${isInfoOpen ? 'translate-y-0' : 'translate-y-full'}`}
            >
              {/* Common fields */}
              {moleculeInfo.formula && <div className="mb-1">Formula: {moleculeInfo.formula}</div>}
              {moleculeInfo.formula_weight && (
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
              {moleculeInfo.resolution && (
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
