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
import { LoadingFacts } from './LoadingFacts';
import ScrollingText from './ScrollingText';

// Constants for animation
const ROTATION_SPEED = 0.1; // Rotations per second
const ROTATION_SMOOTHING = 0.1; // Lower = smoother transitions
const PAUSE_SMOOTHING = 0.15; // Smoothing factor for pause/play transitions

interface MoleculeViewerProps {
  isLoading?: boolean;
  pdbData: string;
  title: string;
  /**
   * Whether atom symbol labels should be rendered.  For macromolecules we
   * disable this to improve performance.  Defaults to true.
   */
  showAnnotations?: boolean;
  moleculeInfo?: any | null;
  /** Enable experimental ribbon/cartoon rendering */
  enableRibbonOverlay?: boolean;
}

export default function MoleculeViewer({
  isLoading = false,
  pdbData,
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
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const rotationRef = useRef<number>(0);
  const clockRef = useRef<THREE.Clock | null>(null);
  const targetRotationSpeedRef = useRef<number>(0);
  const currentRotationSpeedRef = useRef<number>(0);

  const [jobId, setJobId] = useState<string | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [isRecording, setIsRecording] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const paddingBottom = isFullscreen ? '0px' : '56.25%'; // eslint-disable-line @typescript-eslint/no-unused-vars

  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);

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

    const config = { enableAnnotations: showAnnotations };

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

      if (showAnnotations && labelRenderer) {
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
      if (showAnnotations && labelRenderer) {
        labelRenderer.render(scene, camera);
      }
    };

    // Initialization
    const init = () => {
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

      // Lights
      const light1 = new THREE.DirectionalLight(0xffffff, 2.5);
      light1.position.set(1, 1, 1);
      scene.add(light1);
      const light2 = new THREE.DirectionalLight(0xffffff, 1.5);
      light2.position.set(-1, -1, 1);
      scene.add(light2);

      // Root group
      root = new THREE.Group();
      labelsGroup = new THREE.Group();
      root.add(labelsGroup);
      scene.add(root);

      // Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      containerRef.current.appendChild(renderer.domElement);

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
      if (showAnnotations) {
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
      resizeObserver = new ResizeObserver(entries => {
        // eslint-disable-line @typescript-eslint/no-unused-vars
        // Use RAF to avoid multiple resize calls
        requestAnimationFrame(() => {
          onResize();
        });
      });
      resizeObserver.observe(wrapperRef.current);

      // Initial size
      onResize();

      // Load molecule (Propane)
      loadMolecule();

      // Store references for cleanup
      rendererRef.current = renderer;
      labelRendererRef.current = labelRenderer;
    };

    const buildInstancedAtoms = (
      sphereGeometry: THREE.IcosahedronGeometry,
      positions: THREE.BufferAttribute,
      colors: THREE.BufferAttribute,
      json: any,
      enableLabels: boolean
    ) => {
      const material = new THREE.MeshPhongMaterial({ vertexColors: true });
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
            text.style.color = `rgb(${Math.round(color.r * 255)}, ${Math.round(
              color.g * 255
            )}, ${Math.round(color.b * 255)})`;
            text.style.textShadow = '-1px 1px 1px rgb(0,0,0)';
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
        const material = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.6 });
        const mesh = new THREE.Mesh(geometry, material);
        root.add(mesh);
      });
    };

    // PDB loader
    const loadMolecule = () => {
      const pdbBlob = new Blob([pdbData], { type: 'text/plain' });
      const pdbUrl = URL.createObjectURL(pdbBlob);

      const loader = new PDBLoader();
      loader.load(pdbUrl, (pdb: any) => {
        // eslint-disable-line @typescript-eslint/no-explicit-any
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

            const atomMaterial = new THREE.MeshPhongMaterial({ color });
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
                text.style.color = `rgb(${Math.round(color.r * 255)}, ${Math.round(
                  color.g * 255
                )}, ${Math.round(color.b * 255)})`;
                text.style.textShadow = '-1px 1px 1px rgb(0,0,0)';
                text.style.fontSize = '14px';
                text.style.pointerEvents = 'none';

                const label = new CSS2DObject(text);
                label.position.copy(atom.position);
                labelsGroup.add(label);
              }
            }
          }

          // Bonds
          positions = geometryBonds.getAttribute('position');
          const start = new THREE.Vector3();
          const end = new THREE.Vector3();

          for (let i = 0; i < positions.count; i += 2) {
            start.set(positions.getX(i), positions.getY(i), positions.getZ(i)).multiplyScalar(120);
            end
              .set(positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1))
              .multiplyScalar(120);

            const bondMesh = new THREE.Mesh(
              boxGeometry,
              new THREE.MeshPhongMaterial({ color: 0xffffff })
            );
            bondMesh.position.copy(start).lerp(end, 0.5);
            bondMesh.scale.set(8, 8, start.distanceTo(end));
            bondMesh.lookAt(end);
            root.add(bondMesh);
          }
        } else if (positions.count <= POINTS_THRESHOLD) {
          buildInstancedAtoms(sphereGeometry, positions, colors, json, enableLabelsThisModel);

          // Bonds for instanced meshes
          positions = geometryBonds.getAttribute('position');
          const start = new THREE.Vector3();
          const end = new THREE.Vector3();

          for (let i = 0; i < positions.count; i += 2) {
            start.set(positions.getX(i), positions.getY(i), positions.getZ(i)).multiplyScalar(120);
            end
              .set(positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1))
              .multiplyScalar(120);

            const bondMesh = new THREE.Mesh(
              boxGeometry,
              new THREE.MeshPhongMaterial({ color: 0xffffff })
            );
            bondMesh.position.copy(start).lerp(end, 0.5);
            bondMesh.scale.set(8, 8, start.distanceTo(end));
            bondMesh.lookAt(end);
            root.add(bondMesh);
          }
        } else {
          buildPointsCloud(positions, colors);
        }

        if (enableRibbonOverlay) {
          buildRibbonOverlay(pdbData);
        }

        URL.revokeObjectURL(pdbUrl);
        labelsGroup.visible = config.enableAnnotations;

        // Fit camera to the molecule after loading
        fitCameraToMolecule();
      });
    };

    // Function to fit camera to molecule
    const fitCameraToMolecule = (closenessFactor = 0.5) => {
      if (!root) return;

      // Create a bounding box for all objects in the scene
      const box = new THREE.Box3();
      root.children.forEach(child => {
        if (!(child instanceof THREE.Light)) {
          box.expandByObject(child);
        }
      });

      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Calculate distance based on diagonal
      const diagonal = Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z);

      // Increase distance for larger molecules using log scale
      const scaleFactor = Math.max(1.2, Math.log10(diagonal) * 0.8);

      // Apply closeness factor to bring camera closer or further
      const distance = diagonal * scaleFactor * closenessFactor;

      // Position camera using spherical coordinates
      const theta = Math.PI / 4; // 45 degrees
      const phi = Math.PI / 6; // 30 degrees

      camera.position.set(
        center.x + distance * Math.sin(theta) * Math.cos(phi),
        center.y + distance * Math.sin(phi),
        center.z + distance * Math.cos(theta) * Math.cos(phi)
      );

      camera.lookAt(center);
      controls.target.copy(center);

      // Adjust near/far planes
      camera.near = distance * 0.01;
      camera.far = distance * 10;
      camera.updateProjectionMatrix();

      // Update controls min/max distance
      controls.minDistance = distance * 0.1;
      controls.maxDistance = distance * 5;
      controls.update();
    };

    // Animation loop
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (root && clockRef.current) {
        const delta = clockRef.current.getDelta();

        // Update rotation speed with smooth interpolation
        targetRotationSpeedRef.current = isPaused ? 0 : ROTATION_SPEED;
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
      if (showAnnotations && labelRenderer) {
        labelRenderer.render(scene, camera);
      }
    };

    init();
    animate();

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
        showAnnotations &&
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
        scene.clear();
      }

      // Remove event listener
      window.removeEventListener('request-fit-camera-function', handleRequestFitCameraFunction);

      // Clear refs
      rendererRef.current = null;
      labelRendererRef.current = null;
      composerRef.current = null;
      outlinePassRef.current = null;
    }; // eslint-disable-line react-hooks/exhaustive-deps
  }, [isLoading, pdbData, isPaused, showAnnotations, enableRibbonOverlay]); // Add isPaused and showAnnotations to dependencies

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
      console.error('Error attempting to toggle fullscreen:', err);
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
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
          {/* Molecule label - Updated to use ScrollingText */}
          <div
            className="absolute bottom-5 left-1/2 transform -translate-x-1/2 
                       text-white px-5 py-2.5 rounded-lg z-20 
                       pointer-events-none text-center max-w-[80%] 
                       text-base md:text-lg whitespace-nowrap overflow-hidden"
            // Removed truncate, overflow will be handled by ScrollingText
            // Ensure this div provides a clear width for ScrollingText to measure against.
            // Text-align might need to be left if ScrollingText doesn't center its content naturally.
          >
            <ScrollingText text={title} />
          </div>
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
