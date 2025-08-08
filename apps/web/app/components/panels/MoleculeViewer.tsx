/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { loadSDF } from 'three-sdf-loader';
import { addEnvironment, deepDispose } from './threeHelpers';
import { LoadingFacts } from './LoadingFacts';
import { MoleculeInfo, MoleculeType, GroupDetectionResult, AtomHoverEvent } from '@/types';
import { detectFunctionalGroupsFromSdf } from '../../lib/chem-groups';
import {
  MoleculeStats,
  PDBData,
  Vec3,
  Bounds,
  boundingVolumes,
  extractAtomPositions,
  applyBoundsToGeometry,
  computeStatsFromGeometry,
  buildInstancedAtoms,
  setInstancedAtomColor,
  restoreInstancedAtomColor,
  buildMacromoleculeVisualization,
  buildRibbonOverlay,
  pruneIsolatedIons,
  selectOptimalFormat,
} from './moleculeUtils';

// Constants for animation
const ROTATION_SPEED = 0.1; // Rotations per second
const PAUSE_SMOOTHING = 0.15; // Smoothing factor for pause/play transitions
// Scene scaling to keep SDF and PDB render paths consistent
const POSITION_SCALE = 120; // Å → scene units

// Typed shape for userData attached to meshes/instanced meshes
interface AtomUserData {
  role?: 'atom' | 'atomsInstanced';
  atom?: { index: number; symbol?: string };
  instanceToAtomIndex?: Uint32Array;
  baseColors?: Float32Array;
}

type ChemistryAtomMeta = { index: number; element?: string; x?: number; y?: number; z?: number };

interface MoleculeViewerProps {
  isLoading?: boolean;
  pdbData: string;
  /** If provided, SDF format will be used instead of PDB */
  sdfData?: string | undefined;
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
  /** Molecule classification from LLM for smart format selection */
  moleculeType?: MoleculeType;
  // New interaction callbacks
  onHoverAtom?: (e: AtomHoverEvent | null) => void;
  onSelectAtom?: (indices: number[]) => void;
  onFirstFrameRendered?: () => void;
  enableInteraction?: boolean;
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
  showHoverDebug: _showHoverDebug = false,
  showDebugWireframe = false,
  moleculeType,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onHoverAtom: _onHoverAtom,
  onSelectAtom,
  onFirstFrameRendered,
  enableInteraction = true,
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
  const optimizedBoundsRef = useRef<Bounds | null>(null);
  // REMOVED: Manual format toggle - now uses smart automatic selection
  // const [currentFormat, setCurrentFormat] = useState<'PDB' | 'SDF'>('SDF');
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
  const isSceneReadyRef = useRef<boolean>(false);
  const firstFrameFiredRef = useRef<boolean>(false);
  const onFirstFrameCbRef = useRef<(() => void) | undefined>(undefined);

  // Smart format selection replaces manual toggle
  // REMOVED: bothFormatsAvailable and manual format preference
  // Format is now determined automatically by selectOptimalFormat()

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

      if (process.env.NODE_ENV !== 'production') {
        console.log('[MoleculeViewer] onResize', { width, height });
      }

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

    // Helper: force one render/update to ensure controls responsiveness after fit
    const forceRender = () => {
      if (!renderer || !scene || !camera) return;
      controls?.update();
      if (composer) composer.render();
      else renderer.render(scene, camera);
      if (showAnnotationsRef.current && labelRenderer) labelRenderer.render(scene, camera);
    };

    // Initialization
    const init = async () => {
      const containerEl = containerRef.current;
      const labelEl = labelContainerRef.current;
      const wrapperEl = wrapperRef.current;
      if (!containerEl || !labelEl || !wrapperEl) return;

      // Ensure the wrapper has a non-zero size before initializing
      const rect0 = wrapperEl.getBoundingClientRect();
      if (rect0.width < 2 || rect0.height < 2) {
        await new Promise<void>(resolve => {
          const ro = new ResizeObserver(entries => {
            const r = entries[0]?.contentRect;
            if (r && r.width >= 2 && r.height >= 2) {
              ro.disconnect();
              resolve();
            }
          });
          ro.observe(wrapperEl);
        });
      }

      // Initialize clock
      clockRef.current = new THREE.Clock();

      // Scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x18223b);
      sceneRef.current = scene;

      // Camera
      const rect = wrapperEl.getBoundingClientRect();
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
      try {
        renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
      } catch {
        /* noop */
      }
      try {
        // Ensure only a single canvas exists
        while (containerEl.firstChild) containerEl.removeChild(containerEl.firstChild);
        containerEl.appendChild(renderer.domElement);
      } catch {
        /* noop */
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('[MoleculeViewer] Renderer initialized', {
          size: {
            w: containerEl.clientWidth,
            h: containerEl.clientHeight,
          },
          dpr: window.devicePixelRatio,
        });
      }

      // Add environment reflections
      // Load environment map non-blocking so first render isn't delayed by network
      addEnvironment(renderer, scene).catch(() => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to load environment map, continuing with basic lighting');
        }
      });
      // forceRender uses outer scope variables; nothing else here

      composer = new EffectComposer(renderer);
      try {
        composer.setSize(containerEl.clientWidth, containerEl.clientHeight);
      } catch {
        /* noop */
      }
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      outlinePass = new OutlinePass(
        new THREE.Vector2(containerEl.clientWidth, containerEl.clientHeight),
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
        try {
          labelRenderer.setSize(labelEl.clientWidth, labelEl.clientHeight);
        } catch {
          /* noop */
        }
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0px';
        labelRenderer.domElement.style.pointerEvents = 'none';
        try {
          labelEl.appendChild(labelRenderer.domElement);
        } catch {
          /* noop */
        }
      }

      // Controls
      controls = new OrbitControls(camera, renderer.domElement);
      controls.minDistance = 400;
      controls.maxDistance = 1200;
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enablePan = false; // Disable panning to prevent off-center dragging

      if (process.env.NODE_ENV !== 'production') {
        console.log('[MoleculeViewer] OrbitControls configured', {
          minDistance: controls.minDistance,
          maxDistance: controls.maxDistance,
          enableDamping: controls.enableDamping,
          dampingFactor: controls.dampingFactor,
          enablePan: controls.enablePan,
        });
      }

      // Setup resize observer
      resizeObserver = new ResizeObserver(_entries => {
        // Use RAF to avoid multiple resize calls
        requestAnimationFrame(() => {
          onResize();
        });
      });
      resizeObserver.observe(wrapperEl);

      // Initial size
      onResize();

      // Hide canvas until molecule is fitted to avoid a pre-fit flicker frame
      try {
        renderer.domElement.style.visibility = 'hidden';
      } catch (e) {
        /* noop */
      }

      // Dev-only: pointer event reachability logging
      if (process.env.NODE_ENV !== 'production') {
        const logEvt = (type: string) => () => console.log(`[MoleculeViewer] ${type} event`);
        const el = renderer.domElement as HTMLElement & {
          __ml_evt_handlers__?: { [k: string]: EventListener };
        };
        const handlers: { [k: string]: EventListener } = {
          pointerdown: logEvt('pointerdown'),
          pointermove: logEvt('pointermove'),
          wheel: logEvt('wheel'),
        };
        el.addEventListener('pointerdown', handlers.pointerdown);
        el.addEventListener('pointermove', handlers.pointermove);
        el.addEventListener('wheel', handlers.wheel);
       // el.__ml_evt_handlers__ = handlers;
      }

      // Guard against overlays intercepting first frames of interaction
      try {
        const wrapperEl = wrapperRef.current as HTMLDivElement;
        const originalPe = wrapperEl.style.pointerEvents;
        if (process.env.NODE_ENV !== 'production') {
          console.log('[MoleculeViewer] PointerEvents guard start', {
            originalPe,
          });
        }
        wrapperEl.style.pointerEvents = 'none';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            wrapperEl.style.pointerEvents = 'auto';
            if (process.env.NODE_ENV !== 'production') {
              console.log('[MoleculeViewer] PointerEvents guard end', {
                restoredPe: wrapperEl.style.pointerEvents,
              });
            }
          });
        });
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('pointer-events guard failed', err);
        }
      }

      // Load molecule depending on format
      loadMolecule();

      // Store references for cleanup
      rendererRef.current = renderer;
      labelRendererRef.current = labelRenderer;
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
      // Mark scene as not ready to render until we finish camera fitting
      isSceneReadyRef.current = false;
      controls.reset();
      optimizedBoundsRef.current = null;
      // Use smart format selection based on molecule type and data quality
      const sdfAvailable = sdfData && sdfData.trim().length > 0;
      const pdbAvailable = pdbData && pdbData.trim().length > 0;
      const optimalFormat = selectOptimalFormat(pdbData, sdfData, moleculeType);
      const shouldUseSDF = optimalFormat === 'SDF';

      console.log('=== SMART FORMAT SELECTION ===');
      console.log('Molecule type:', moleculeType);
      console.log('PDB available:', pdbAvailable);
      console.log('SDF available:', sdfAvailable);
      console.log('Selected format:', optimalFormat);

      // For small molecules using PDB→SDF conversion, ensure we have proper SDF data
      const needsPDBToSDFConversion = false; // no implicit PDB→SDF conversion

      if (shouldUseSDF) {
        console.log('=== ATTEMPTING SDF LOADING ===');

        // Determine which SDF data to use
        let sdfToUse = sdfData;
        if (needsPDBToSDFConversion) {
          console.log('Converting 3D PDB to SDF format for small molecule');
          sdfToUse = pdbData; // Use PDB data as SDF (when it contains V2000 markers)
        }

        console.log(
          'SDF data source:',
          needsPDBToSDFConversion ? 'PDB→SDF conversion' : 'Direct SDF'
        );
        console.log('SDF data available:', !!sdfToUse);
        console.log('SDF data length:', sdfToUse?.length);

        try {
          // Use enhanced SDF loading
          const mol = loadSDF(sdfToUse!, {
            showHydrogen: true, // Show hydrogens for better molecular structure understanding
            addThreeCenterBonds: false, // Enable three-center bond detection (helps with diborane)
            layout: 'auto', // Auto-detect 2D vs 3D layout
            renderMultipleBonds: true,
            attachAtomData: true,
            attachProperties: true,
          });

          // Capture loader mappings if available (three-sdf-loader >= 0.4.0)
          try {
            const loadResult = (mol as any)?.userData?.loadResult as { mappings?: { instancedAtoms?: { mesh: THREE.InstancedMesh; instanceToAtomIndex: Uint32Array } } } | undefined;
            if (loadResult && loadResult.mappings && loadResult.mappings.instancedAtoms) {
              const inst = loadResult.mappings.instancedAtoms;
              sdfMappingsRef.current = {
                instanced: { mesh: inst.mesh, instanceToAtomIndex: inst.instanceToAtomIndex },
                atoms:
                  (((mol as unknown as { userData?: { chemistry?: { atoms?: ChemistryAtomMeta[] } } })
                    ?.userData?.chemistry?.atoms) as ChemistryAtomMeta[] | undefined) ?? [],
              };
              if (inst?.mesh) (inst.mesh.userData as AtomUserData).role = 'atomsInstanced';
            } else {
              // Fallback mapping
              const map = new Map<string, number>();
              const atomsMeta: ChemistryAtomMeta[] = [];
              let idxCounter = 0;
              mol.traverse((o: THREE.Object3D) => {
                const m = o as THREE.Mesh;
                const u = m.userData as AtomUserData;
                if (m.isMesh && u?.atom) {
                  const idx =
                    typeof u.atom.index === 'number'
                      ? u.atom.index
                      : idxCounter++;
                  map.set(m.uuid, idx);
                  atomsMeta[idx] = { index: idx, element: u.atom.symbol } as ChemistryAtomMeta;
                  (m.userData as AtomUserData).role = 'atom';
                }
              });
              sdfMappingsRef.current = { meshUuidToAtomIndex: map, atoms: atomsMeta };
            }
          } catch {
            sdfMappingsRef.current = null;
          }

          // Remove isolated ions after loading
          pruneIsolatedIons(mol);

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
              const mesh = obj as THREE.Mesh;
              const isAtom = !!((mesh.userData as { atom?: unknown } | undefined)?.atom);
              if (!isAtom) return;

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
                // const mesh = obj as THREE.Mesh;
               // console.log('Found mesh with geometry type:', mesh.geometry?.type);
              }
             // const asMesh = obj as THREE.Mesh;
             // const hasAtom = !!((asMesh.userData as { atom?: unknown } | undefined)?.atom);
              // if (hasAtom) {
              //   console.log('Atom mesh detected via userData.atom');
              // }
              // if ((obj as THREE.LineSegments).isLineSegments) {
              //   console.log('Found LineSegments (bond)');
              // }
              // if ((obj as THREE.Line).isLine) {
              //   console.log('Found Line (bond)');
              // }
            });
            console.log('Mol children:', mol.children.length);
            console.log('========================');
          }

          // Bring SDF to scene scale by uniformly scaling the parent group
          molGroup.scale.setScalar(POSITION_SCALE);
          molGroup.updateMatrixWorld(true);

          // Extract atom positions in world space after scaling
          const atomPositions = extractAtomPositions(molGroup);
          if (process.env.NODE_ENV !== 'production') {
            console.log('[MoleculeViewer] SDF atomPositions length:', atomPositions?.length);
          }
          const doFit = () => {
            if (atomPositions && atomPositions.length > 0) {
              if (process.env.NODE_ENV !== 'production') {
                console.log('Atom count:', atomPositions.length / 3);
              }
              fitCameraToMoleculeOptimized(atomPositions);
            } else {
              if (process.env.NODE_ENV !== 'production') {
                console.log('SDF: No atom positions extracted, using fallback method');
              }
              fitCameraToMolecule();
            }
          };
          // Ensure matrices are fully settled before fitting (double RAF)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              molGroup.updateMatrixWorld(true);
              doFit();
              // Reveal canvas and mark scene as ready only after fitting
              try {
                renderer.domElement.style.visibility = '';
              } catch (e) {
                /* noop */
              }
              isSceneReadyRef.current = true;
              // functional groups (async, best-effort)
              if (sdfData && sdfData.trim().length > 0) {
                // Client-only OCL for now to avoid bundling Node paths/wrapping RDKit on client
                detectFunctionalGroupsFromSdf(sdfData)
                  .then((res: GroupDetectionResult) => {
                    groupDetectionRef.current = res;
                    setHasGroups((res?.groups?.length || 0) > 0);
                    if (process.env.NODE_ENV !== 'production') {
                      console.log(`[FunctionalGroups][client] ${title}: ${res.groups.length} groups detected (OCL)`);
                    }
                  })
                  .catch(() => {
                    groupDetectionRef.current = { groups: [], atomToGroupIds: new Map() };
                    setHasGroups(false);
                  });
              } else {
                groupDetectionRef.current = { groups: [], atomToGroupIds: new Map() };
                setHasGroups(false);
              }
              forceRender();
            });
          });

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
          if (process.env.NODE_ENV !== 'production') {
            console.log('[MoleculeViewer] PDB loaded');
          }
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
              // Attach metadata for picking
              (atom.userData as AtomUserData).role = 'atom';
              (atom.userData as AtomUserData).atom = { index: i, symbol: json.atoms[i]?.[4] };
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
            const instanced = buildInstancedAtoms(
              sphereGeometry,
              positions as THREE.BufferAttribute,
              colors as THREE.BufferAttribute,
              json,
              enableLabelsThisModel,
              labelsGroup,
              root
            );
            pdbInstancedRef.current = { mesh: instanced.mesh, instanceToAtomIndex: instanced.instanceToAtomIndex };

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
            // Use enhanced macromolecule visualization for very large structures
            buildMacromoleculeVisualization(
              positions as THREE.BufferAttribute,
              colors as THREE.BufferAttribute,
              pdbData,
              root,
              outlinePassRef.current
            );
          }

          // Only draw ribbon overlay for large macromolecules (heuristic)
          const MIN_ATOMS_FOR_RIBBON = 500;
          if (enableRibbonOverlay && positions.count > MIN_ATOMS_FOR_RIBBON) {
            buildRibbonOverlay(pdbData, root);
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
          // Reveal canvas and mark scene as ready
          try {
            renderer.domElement.style.visibility = '';
          } catch (e) {
            /* noop */
          }
          isSceneReadyRef.current = true;
          forceRender();
          if (!firstFrameFiredRef.current) {
            firstFrameFiredRef.current = true;
            onFirstFrameCbRef.current?.();
          }
        }
      );
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

      controls.reset();
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      rotationRef.current = 0;
      currentRotationSpeedRef.current = 0;
      root.rotation.set(0, 0, 0);

      const bounds = boundingVolumes(atomPositions, vdwRadii);
      const center = new THREE.Vector3(...bounds.c);
      const radius = bounds.r;

      root.children.forEach(child => child.position.sub(center));

      const fov = (camera.fov * Math.PI) / 180;
      const dist = (radius * margin) / Math.sin(fov / 2);
      camera.position.set(0, 0, dist);
      camera.near = dist * 0.01;
      camera.far = dist * 10;
      camera.updateProjectionMatrix();

      controls.target.set(0, 0, 0);
      controls.minDistance = dist * 0.2;
      controls.maxDistance = dist * 5;
      controls.update();
      controls.saveState();

      const centredBounds: Bounds = {
        min: bounds.min.map((v, i) => v - bounds.c[i]) as Vec3,
        max: bounds.max.map((v, i) => v - bounds.c[i]) as Vec3,
        c: [0, 0, 0],
        r: bounds.r,
      };
      optimizedBoundsRef.current = centredBounds;

      // Ensure an immediate render so controls feel responsive after fit
      forceRender();

      return centredBounds;
    };

    /**
     * Re-fit camera & controls so the current molecule fully occupies the viewport.
     * Works for both Å-scale (small ligands) and 100 Å proteins without manual tweaks.
     * Fallback method using Three.js built-in bounding calculation
     */
    const fitCameraToMolecule = (margin = 1.15) => {
      if (!root) return;

      controls.reset();
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      rotationRef.current = 0;
      currentRotationSpeedRef.current = 0;
      root.rotation.set(0, 0, 0);

      const sphere = new THREE.Sphere();
      new THREE.Box3().setFromObject(root).getBoundingSphere(sphere);
      const { center, radius } = sphere;

      root.children.forEach(child => child.position.sub(center));

      const fov = (camera.fov * Math.PI) / 180;
      const dist = (radius * margin) / Math.sin(fov / 2);
      camera.position.set(0, 0, dist);
      camera.near = dist * 0.01;
      camera.far = dist * 10;
      camera.updateProjectionMatrix();

      controls.target.set(0, 0, 0);
      controls.minDistance = dist * 0.2;
      controls.maxDistance = dist * 5;
      controls.update();
      controls.saveState();

      // Immediate render to confirm control state
      forceRender();
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
      // Only render frames after the scene is ready (prevents pre-fit flicker)
      if (!isSceneReadyRef.current) {
        // Skip rendering until camera fit completed to avoid flicker
        return;
      }
      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
      if (showAnnotationsRef.current && labelRenderer) {
        labelRenderer.render(scene, camera);
      }
          if (!firstFrameFiredRef.current) {
            firstFrameFiredRef.current = true;
            onFirstFrameCbRef.current?.();
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
      // Capture refs at cleanup time start
      const cleanupContainer = containerRef.current;
      const cleanupLabel = labelContainerRef.current;
      const cleanupWrapper = wrapperRef.current;

      return () => {
      cancelAnimationFrame(animationId);
      resizeObserver?.disconnect();
      if (root) deepDispose(root);
        // detach canvases / CSS2D layer
        if (renderer?.domElement && cleanupContainer?.contains(renderer.domElement)) {
          cleanupContainer.removeChild(renderer.domElement);
      }
      if (
        showAnnotationsRef.current &&
        labelRenderer?.domElement &&
          cleanupLabel?.contains(labelRenderer.domElement)
      ) {
          cleanupLabel.removeChild(labelRenderer.domElement);
      }
      renderer?.dispose();
      composer?.dispose();
      controls?.dispose();
      if (scene?.environment?.dispose) scene.environment.dispose();
      scene && (scene.environment = null);
      scene?.clear();
      window.removeEventListener('request-fit-camera-function', handleRequestFitCameraFunction);
      rendererRef.current =
        labelRendererRef.current =
        composerRef.current =
        outlinePassRef.current =
        cameraRef.current =
        sceneRef.current =
        rootRef.current =
          null;
      debugSphereRef.current?.geometry.dispose();
      (debugSphereRef.current?.material as THREE.Material)?.dispose();
      debugSphereRef.current = null;
      debugWireframeRef.current?.geometry.dispose();
      (debugWireframeRef.current?.material as THREE.Material)?.dispose();
      debugWireframeRef.current = null;
        // Reset pointer-events to ensure no lingering blocking state
        if (cleanupWrapper) {
          cleanupWrapper.style.pointerEvents = 'auto';
        }
        // Remove dev-only event listeners
        if (renderer?.domElement) {
          const el = renderer.domElement as HTMLElement & {
            __ml_evt_handlers__?: { [k: string]: EventListener };
          };
          const handlers = el.__ml_evt_handlers__;
          if (handlers) {
            el.removeEventListener('pointerdown', handlers.pointerdown);
            el.removeEventListener('pointermove', handlers.pointermove);
            el.removeEventListener('wheel', handlers.wheel);
            delete el.__ml_evt_handlers__;
          }
        }
      setStats(null);
    }; // eslint-disable-line react-hooks/exhaustive-deps
  }, [
    isLoading,
    pdbData,
    sdfData,
    moleculeType,
    enableRibbonOverlay,
    showAnnotations,
    enableHoverPause,
    enableHoverGlow,
    showDebugWireframe,
    title,
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

  // REMOVED: Manual format toggle - now handled automatically
  // const toggleFormat = () => { ... }

  // Store camera and scene references for hover detection
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const debugSphereRef = useRef<THREE.Mesh | null>(null);
  const debugWireframeRef = useRef<THREE.Mesh | null>(null);

  // Picking & highlights
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseNdcRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const hoveredRef = useRef<{
    kind: 'instanced' | 'sdf-mesh';
    mesh?: THREE.Mesh | THREE.InstancedMesh;
    instanceId?: number;
  } | null>(null);
  const pdbInstancedRef = useRef<{ mesh: THREE.InstancedMesh | null; instanceToAtomIndex?: Uint32Array }>({ mesh: null });
  const sdfMappingsRef = useRef<{
    instanced?: { mesh: THREE.InstancedMesh; instanceToAtomIndex: Uint32Array } | null;
    meshUuidToAtomIndex?: Map<string, number>;
    atoms?: Array<{ index: number; element?: string; x?: number; y?: number; z?: number }>;
  } | null>(null);
  const groupDetectionRef = useRef<GroupDetectionResult | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; text: string; badges?: string[] }>({ visible: false, x: 0, y: 0, text: '' });
  const [isGroupMode, setIsGroupMode] = useState<boolean>(false);
  const [isAtomMode, setIsAtomMode] = useState<boolean>(true);
  const [hasGroups, setHasGroups] = useState<boolean>(false);
  const currentGroupInstancedRef = useRef<{ mesh: THREE.InstancedMesh; indices: number[] } | null>(null);
  const currentGroupMeshesRef = useRef<THREE.Mesh[] | null>(null);

  // Keep latest onFirstFrameRendered callback in a ref. Intentional: no effectful dependency needed.
  useEffect(() => {
    onFirstFrameCbRef.current = onFirstFrameRendered;
  }, [onFirstFrameRendered]);

  // Helpers for picking/highlighting
  const highlightColor = new THREE.Color(0xffd166);
  const groupHighlightColor = new THREE.Color(0x5dd39e);
  const clearHoverHighlight = () => {
    const cur = hoveredRef.current;
    if (!cur) return;
    if (cur.kind === 'instanced' && cur.instanceId != null && cur.mesh && (cur.mesh as any).isInstancedMesh) {
      restoreInstancedAtomColor(cur.mesh as THREE.InstancedMesh, cur.instanceId);
    } else if (cur.kind === 'sdf-mesh' && cur.mesh && (cur.mesh as any).material) {
      const mat = (cur.mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if ((mat as any).emissive) (mat as any).emissive.setRGB(0, 0, 0);
    }
    hoveredRef.current = null;
  };
  const clearGroupHighlight = () => {
    if (currentGroupInstancedRef.current) {
      const { mesh, indices } = currentGroupInstancedRef.current;
      for (const id of indices) restoreInstancedAtomColor(mesh, id);
      currentGroupInstancedRef.current = null;
    }
    if (currentGroupMeshesRef.current) {
      for (const m of currentGroupMeshesRef.current) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if ((mat as any).emissive) (mat as any).emissive.setRGB(0, 0, 0);
      }
      currentGroupMeshesRef.current = null;
    }
  };
  const applyHoverHighlight = (hit: { kind: 'instanced' | 'sdf-mesh'; mesh: any; instanceId?: number }) => {
    if (hit.kind === 'instanced' && hit.mesh && hit.instanceId != null) {
      setInstancedAtomColor(hit.mesh as THREE.InstancedMesh, hit.instanceId, highlightColor);
    } else if (hit.kind === 'sdf-mesh' && hit.mesh) {
      const mat = (hit.mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if ((mat as any).emissive) (mat as any).emissive.set(highlightColor);
    }
    hoveredRef.current = hit as any;
  };
  const applyGroupHighlight = (atomIndices: number[], pickedArg?: THREE.Intersection) => {
    clearGroupHighlight();
    const instancedMesh: THREE.InstancedMesh | null =
      (sdfMappingsRef.current?.instanced?.mesh as THREE.InstancedMesh) ||
      (pdbInstancedRef.current.mesh as THREE.InstancedMesh | null) ||
      (pickedArg && ((pickedArg.object as any).isInstancedMesh && (pickedArg.object as THREE.InstancedMesh)) ? (pickedArg.object as THREE.InstancedMesh) : null);
    if (instancedMesh) {
      const map: Uint32Array | undefined =
        (instancedMesh.userData && (instancedMesh.userData as any).instanceToAtomIndex) ||
        pdbInstancedRef.current.instanceToAtomIndex ||
        sdfMappingsRef.current?.instanced?.instanceToAtomIndex;
      const instanceIds: number[] = [];
      if (map) {
        for (let i = 0; i < map.length; i++) {
          if (atomIndices.includes(map[i])) instanceIds.push(i);
        }
      } else if (pickedArg && (pickedArg.object as any).isInstancedMesh && pickedArg.instanceId != null) {
        instanceIds.push(pickedArg.instanceId);
      }
      for (const id of instanceIds) setInstancedAtomColor(instancedMesh, id, groupHighlightColor);
      currentGroupInstancedRef.current = { mesh: instancedMesh, indices: instanceIds };
      return;
    }
    const meshes: THREE.Mesh[] = [];
    if (rootRef.current) {
      rootRef.current.traverse((o: THREE.Object3D) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && (m.userData as any)?.atom && typeof (m.userData as any).atom.index === 'number') {
          const idx = (m.userData as any).atom.index as number;
          if (atomIndices.includes(idx)) {
            const mat = m.material as THREE.MeshStandardMaterial;
            if ((mat as any).emissive) (mat as any).emissive.set(groupHighlightColor);
            meshes.push(m);
          }
        }
      });
    }
    currentGroupMeshesRef.current = meshes;
  };
  const resolveAtomIndexFromIntersection = (ix: THREE.Intersection): number | undefined => {
    const u = ix.object.userData as AtomUserData;
    if ((ix.object as any).isInstancedMesh && ix.instanceId != null) {
      const map: Uint32Array | undefined =
        (u && u.instanceToAtomIndex) ||
        pdbInstancedRef.current.instanceToAtomIndex ||
        sdfMappingsRef.current?.instanced?.instanceToAtomIndex;
      if (map) return map[ix.instanceId!];
    }
    const role = u?.role;
    if (role === 'atom') {
      const atom = u.atom;
      if (atom && typeof atom.index === 'number') return atom.index;
      const fallback = sdfMappingsRef.current?.meshUuidToAtomIndex?.get(ix.object.uuid);
      if (typeof fallback === 'number') return fallback;
    }
    return undefined;
  };
  const getAtomElement = (atomIndex: number | undefined) => {
    if (atomIndex == null) return undefined;
    const atomsMeta = sdfMappingsRef.current?.atoms;
    if (atomsMeta && atomsMeta[atomIndex]) return atomsMeta[atomIndex].element;
    return undefined;
  };
  const getGroupBadges = (atomIndex: number | undefined) => {
    if (atomIndex == null) return [] as string[];
    const map = groupDetectionRef.current?.atomToGroupIds;
    const ids = map?.get(atomIndex) || [];
    if (!groupDetectionRef.current?.groups?.length) return [];
    const byId = new Map(groupDetectionRef.current.groups.map(g => [g.id, g.name]));
    return ids.map(id => (byId.get(id) as string) || id);
  };

  const handlePointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!enableInteraction) return;
    if (!containerRef.current || !cameraRef.current || !rootRef.current) return;
    if (isLoading || !rendererRef.current || rootRef.current.children.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    mouseNdcRef.current.set(x, y);
    raycasterRef.current.setFromCamera(mouseNdcRef.current, cameraRef.current);

    const intersects = raycasterRef.current.intersectObjects(rootRef.current.children, true);
    if (!intersects.length) {
      clearHoverHighlight();
      clearGroupHighlight();
      setIsHovered(false);
      setTooltip(t => ({ ...t, visible: false }));
      return;
    }

    let picked: THREE.Intersection | undefined;
    for (const ix of intersects) {
      const o: any = ix.object;
      if (o?.isInstancedMesh || (o?.userData?.role === 'atom')) {
        picked = ix;
        break;
      }
    }
    if (!picked) {
      clearHoverHighlight();
      clearGroupHighlight();
      setIsHovered(false);
      setTooltip(t => ({ ...t, visible: false }));
      return;
    }

    const atomIndex = resolveAtomIndexFromIntersection(picked);
    const element = getAtomElement(atomIndex);
    const badges = getGroupBadges(atomIndex);

    clearHoverHighlight();
    clearGroupHighlight();

    if (isGroupMode) {
      if (!picked) {
        // safety: should not happen due to early return above
        return;
      }
      if (atomIndex != null && groupDetectionRef.current) {
        const ids = groupDetectionRef.current.atomToGroupIds.get(atomIndex) || [];
        if (ids.length > 0) {
          const gid = ids[0];
          const grp = groupDetectionRef.current.groups.find(g => g.id === gid);
          if (grp) applyGroupHighlight(grp.atoms, picked);
          setIsHovered(true);
          setTooltip({
            visible: true,
            x: event.clientX - rect.left + 12,
            y: event.clientY - rect.top + 12,
            text: grp ? `${grp.name}` : 'Group',
            badges: grp ? [grp.name] : [],
          });
          return;
        }
      }
      // No group context, fall through to atom highlight
    }

    if (isAtomMode) {
      if ((picked.object as any).isInstancedMesh && picked.instanceId != null) {
        applyHoverHighlight({ kind: 'instanced', mesh: picked.object, instanceId: picked.instanceId });
      } else {
        applyHoverHighlight({ kind: 'sdf-mesh', mesh: picked.object });
      }
    }

    setIsHovered(true);
    setTooltip({
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top + 12,
      text: element ? `${element} · #${atomIndex ?? '-'}` : `Atom #${atomIndex ?? '-'}`,
      badges,
    });
  };

  const handlePointerLeave = () => {
    if (!enableInteraction) return;
    clearHoverHighlight();
    clearGroupHighlight();
    setIsHovered(false);
    setTooltip(t => ({ ...t, visible: false }));
  };

  const handleClick = () => {
    if (!enableInteraction) return;
    const cur = hoveredRef.current;
    if (!cur) return;
    if (cur.kind === 'instanced' && cur.instanceId != null) {
      const map: Uint32Array | undefined =
        ((cur.mesh as any)?.userData && (cur.mesh as any).userData.instanceToAtomIndex) ||
        pdbInstancedRef.current.instanceToAtomIndex ||
        sdfMappingsRef.current?.instanced?.instanceToAtomIndex;
      const atomIndex = map ? map[cur.instanceId] : undefined;
      if (typeof atomIndex === 'number') {
        onSelectAtom?.([atomIndex]);
      }
    } else if (cur.kind === 'sdf-mesh' && (cur.mesh as any).userData?.atom?.index != null) {
      const idx = (cur.mesh as any).userData.atom.index as number;
      if (typeof idx === 'number') {
        onSelectAtom?.([idx]);
      }
    }
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

  // legacy onMouseLeave handler removed; using handlePointerLeave instead

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

  // Hide the floating bottom-left title when extra info panel is open
  useEffect(() => {
    if (!captionRef.current) return;
    if (isInfoOpen) {
      captionRef.current.style.opacity = '0';
      captionRef.current.style.visibility = 'hidden';
    } else {
      captionRef.current.style.visibility = 'visible';
      captionRef.current.style.opacity = '1';
    }
  }, [isInfoOpen]);

  // The outer wrapper helps position the label absolutely
  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full rounded-xl overflow-hidden bg-[#050505] flex flex-col"
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      onClick={handleClick}
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
          {/* Hover tooltip */}
          {tooltip.visible && (
            <div
              className="absolute z-30 text-xs px-2 py-1 rounded-md bg-black/75 text-white border border-white/10 pointer-events-none"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <div className="font-medium">{tooltip.text}</div>
              {tooltip.badges && tooltip.badges.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {tooltip.badges.map((b, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-white/10">
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
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
            {/* Functional Group mode toggle (only when interactive and groups exist) */}
            {enableInteraction && hasGroups && (
              <button
                onClick={() => {
                  const next = !isGroupMode;
                  setIsGroupMode(next);
                  if (!next) clearGroupHighlight();
                }}
                className={`p-2 rounded-lg transition-colors duration-200 ${isGroupMode ? 'text-green-300' : 'text-white hover:text-gray-300'}`}
                title={isGroupMode ? 'Disable functional group mode' : 'Enable functional group mode'}
              >
                {/* Atom icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12 2a1 1 0 011 1v1.06a7.003 7.003 0 015.94 5.94H20a1 1 0 110 2h-1.06a7.003 7.003 0 01-5.94 5.94V21a1 1 0 11-2 0v-1.06a7.003 7.003 0 01-5.94-5.94H4a1 1 0 110-2h1.06a7.003 7.003 0 015.94-5.94V3a1 1 0 011-1zm0 4a5 5 0 100 10A5 5 0 0012 6z" />
                </svg>
              </button>
            )}
            {/* Atom mode toggle (only when interactive) */}
            {enableInteraction && (
              <button
                onClick={() => {
                  const next = !isAtomMode;
                  setIsAtomMode(next);
                  if (!next) clearHoverHighlight();
                }}
                className={`p-2 rounded-lg transition-colors duration-200 ${isAtomMode ? 'text-blue-300' : 'text-white hover:text-gray-300'}`}
                title={isAtomMode ? 'Disable atom highlight mode' : 'Enable atom highlight mode'}
              >
                {/* Single atom dot icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </button>
            )}
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
            {/* REMOVED: Manual format toggle - now uses smart automatic selection */}
            {/* Format toggle button - only show if both PDB and SDF are available */}
            {/* {bothFormatsAvailable && (
              <button
                onClick={toggleFormat}
                className="p-2 rounded-lg text-white hover:text-gray-300
                          transition-colors duration-200 bg-gray-700 bg-opacity-50"
                title={`Switch to ${currentFormat === 'PDB' ? 'SDF' : 'PDB'} format`}
              >
                <div className="text-xs font-mono font-bold">{currentFormat}</div>
              </button>
            )} */}
          </div>
          {(moleculeInfo || hasGroups) && (
            <div
              className={`absolute z-20 left-4 right-4 bottom-4 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl text-white text-sm sm:text-[13px] p-4 sm:p-5 transform-gpu transition-all duration-500 ease-out ${isInfoOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-4 opacity-0 pointer-events-none'}`}
            >
              {/* Title inside panel */}
              <div className="mb-2">
                <div className="text-[11px] uppercase tracking-[0.12em] text-white/60">Molecule</div>
                <div className="text-base sm:text-lg font-semibold leading-tight">{title}</div>
              </div>
              <div className="h-px bg-white/10 my-3" />

              {/* Common fields */}
              {moleculeInfo?.formula && (
                <div className="mb-1">
                  <span className="text-white/60">Formula:</span> {moleculeInfo?.formula}
                </div>
              )}
              {moleculeInfo?.formula_weight && typeof moleculeInfo?.formula_weight === 'number' && (
                <div className="mb-1">
                  <span className="text-white/60">MW:</span> {moleculeInfo?.formula_weight.toFixed(2)} kDa
                </div>
              )}

              {/* Small molecule specific fields */}
              {moleculeInfo?.canonical_smiles && (
                <div className="mb-1 break-all">
                  <span className="text-white/60">SMILES:</span> {moleculeInfo?.canonical_smiles}
                </div>
              )}
              {moleculeInfo?.inchi && (
                <div className="mb-1 break-all">
                  <span className="text-white/60">InChI:</span> {moleculeInfo?.inchi}
                </div>
              )}
              {moleculeInfo?.synonyms && moleculeInfo?.synonyms.length > 0 && (
                <div className="mb-1">
                  <span className="text-white/60">Synonyms:</span> {moleculeInfo?.synonyms.slice(0, 3).join(', ')}
                </div>
              )}

              {/* Macromolecule specific fields */}
              {moleculeInfo?.full_description && (
                <div className="mb-1">
                  <span className="text-white/60">Description:</span> {moleculeInfo?.full_description}
                </div>
              )}
              {moleculeInfo?.resolution && typeof moleculeInfo?.resolution === 'number' && (
                <div className="mb-1">
                  <span className="text-white/60">Resolution:</span> {moleculeInfo?.resolution.toFixed(1)} Å
                </div>
              )}
              {moleculeInfo?.experimental_method && (
                <div className="mb-1">
                  <span className="text-white/60">Method:</span> {moleculeInfo?.experimental_method}
                </div>
              )}
              {moleculeInfo?.chain_count && (
                <div className="mb-1">
                  <span className="text-white/60">Chains:</span> {moleculeInfo?.chain_count}
                </div>
              )}
              {moleculeInfo?.organism_scientific && (
                <div className="mb-1">
                  <span className="text-white/60">Source:</span> {moleculeInfo?.organism_scientific}
                  {moleculeInfo?.organism_common && ` (${moleculeInfo?.organism_common})`}
                </div>
              )}
              {moleculeInfo?.keywords && moleculeInfo?.keywords.length > 0 && (
                <div className="mb-1">
                  <span className="text-white/60">Keywords:</span> {moleculeInfo?.keywords.join(', ')}
                </div>
              )}
              {moleculeInfo?.publication_year && (
                <div className="mb-1">
                  <span className="text-white/60">Published:</span> {moleculeInfo?.publication_year}
                  {moleculeInfo?.publication_doi && (
                    <a
                      href={`https://doi.org/${moleculeInfo?.publication_doi}`}
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

              {/* Functional groups list */}
              {hasGroups && groupDetectionRef.current && groupDetectionRef.current.groups.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-white/60 mb-1">Functional groups</div>
                  <div className="flex flex-wrap gap-1.5">
                    {groupDetectionRef.current.groups.map(g => (
                      <button
                        key={g.id}
                        className="px-1.5 py-0.5 rounded bg-white/10 text-xs hover:bg-white/20 transition-colors"
                        onClick={() => {
                          // Chip-click to jump-highlight a specific group
                          setIsGroupMode(true);
                          applyGroupHighlight(g.atoms);
                        }}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
