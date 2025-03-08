import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// @ts-ignore
import { PDBLoader } from 'three/examples/jsm/loaders/PDBLoader';
// @ts-ignore
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { LoadingFacts } from './LoadingFacts';


interface MoleculeViewerProps {
  isLoading?: boolean;
  pdbData: string;
  title: string;
}

export default function MoleculeViewer({ isLoading = false, pdbData, title }: MoleculeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  
  const [jobId, setJobId] = useState<string | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [isRecording, setIsRecording] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const paddingBottom = isFullscreen ? '0px' : '56.25%'; // eslint-disable-line @typescript-eslint/no-unused-vars


  useEffect(() => {
    if (isLoading) return; // Don't initialize Three.js when loading

    let camera: THREE.PerspectiveCamera;
    let scene: THREE.Scene;
    let renderer: THREE.WebGLRenderer;
    let labelRenderer: CSS2DRenderer;
    let controls: OrbitControls;
    let root: THREE.Group;
    let labelsGroup: THREE.Group;
    let animationId: number;
    let resizeObserver: ResizeObserver;

    const config = { enableAnnotations: true };
    const rotationSpeed = 0.0025;

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
      
      labelRenderer.setSize(width, height);
      labelRenderer.domElement.style.width = '100%';
      labelRenderer.domElement.style.height = '100%';
      
      // Force a render to update the view
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };

    // Initialization
    const init = () => {
      if (!containerRef.current || !labelContainerRef.current || !wrapperRef.current) return;

      // Scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x18223b)

      // Camera
      const rect = wrapperRef.current.getBoundingClientRect();
      camera = new THREE.PerspectiveCamera(
        50,
        rect.width / rect.height,
        1,
        5000
      );
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
      renderer.setSize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
      containerRef.current.appendChild(renderer.domElement);

      // CSS2D renderer
      labelRenderer = new CSS2DRenderer();
      labelRenderer.setSize(
        labelContainerRef.current.clientWidth,
        labelContainerRef.current.clientHeight
      );
      labelRenderer.domElement.style.position = 'absolute';
      labelRenderer.domElement.style.top = '0px';
      labelRenderer.domElement.style.pointerEvents = 'none';
      labelContainerRef.current.appendChild(labelRenderer.domElement);

      // Controls
      controls = new OrbitControls(camera, renderer.domElement);
      controls.minDistance = 400;
      controls.maxDistance = 1200;
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;

      // Setup resize observer
      resizeObserver = new ResizeObserver((entries) => { // eslint-disable-line @typescript-eslint/no-unused-vars
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

    // PDB loader
    const loadMolecule = () => {
      const pdbBlob = new Blob([pdbData], { type: 'text/plain' });
      const pdbUrl = URL.createObjectURL(pdbBlob);

      const loader = new PDBLoader();
      loader.load(pdbUrl, (pdb: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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

        // Atoms
        for (let i = 0; i < positions.count; i++) {
          position.set(positions.getX(i), positions.getY(i), positions.getZ(i));
          color.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i));

          const atomMaterial = new THREE.MeshPhongMaterial({ color });
          const atom = new THREE.Mesh(sphereGeometry, atomMaterial);
          atom.position.copy(position).multiplyScalar(120);
          atom.scale.setScalar(40);
          root.add(atom);

          // Labels
          if (config.enableAnnotations && json.atoms[i]) {
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
          start
            .set(positions.getX(i), positions.getY(i), positions.getZ(i))
            .multiplyScalar(120);
          end
            .set(
              positions.getX(i + 1),
              positions.getY(i + 1),
              positions.getZ(i + 1)
            )
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
      const diagonal = Math.sqrt(
        size.x * size.x + 
        size.y * size.y + 
        size.z * size.z
      );
      
      // Increase distance for larger molecules using log scale
      const scaleFactor = Math.max(1.2, Math.log10(diagonal) * 0.8);
      
      // Apply closeness factor to bring camera closer or further
      const distance = diagonal * scaleFactor * closenessFactor;
      
      // Position camera using spherical coordinates
      const theta = Math.PI / 4; // 45 degrees
      const phi = Math.PI / 6;   // 30 degrees
      
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
      if (root) root.rotation.y += rotationSpeed;
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
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
      if (currentRendererRef?.domElement && currentContainerRef?.contains(currentRendererRef.domElement)) {
        currentContainerRef.removeChild(currentRendererRef.domElement);
      }
      if (currentLabelRendererRef?.domElement && currentLabelContainerRef?.contains(currentLabelRendererRef.domElement)) {
        currentLabelContainerRef.removeChild(currentLabelRendererRef.domElement);
      }

      if (renderer) {
        renderer.dispose();
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
    }; // eslint-disable-line react-hooks/exhaustive-deps
  }, [isLoading, pdbData]); // Add pdbData to dependencies

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
  

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    


    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);


  // The outer wrapper helps position the label absolutely
  return (
    <div ref={wrapperRef} className="relative w-full h-full rounded-xl overflow-hidden bg-[#050505] flex flex-col">
      {/* Loading Facts overlay */}
      <LoadingFacts 
        isVisible={isLoading} 
        showFacts={true}
      />
      
      {/* Only render molecule viewer content when not loading */}
      {!isLoading && (
        <>
          {/* 3D container */}
          <div ref={containerRef} className="absolute inset-0" />
          {/* Label renderer container */}
          <div 
            ref={labelContainerRef} 
            className="absolute inset-0 pointer-events-none" 
          />
          {/* Molecule label */}
          <div
            className="absolute bottom-5 left-1/2 transform -translate-x-1/2 
                       text-white px-5 py-2.5 rounded-lg z-20 
                       pointer-events-none text-center max-w-[80%] 
                       truncate text-base md:text-lg"
          >
            {title}
          </div>
          {/* Control buttons */}
          <div className="absolute top-4 right-4 z-20 flex space-x-2">
            {/* Fullscreen button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-white hover:text-gray-300
                        transition-colors duration-200"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a2 2 0 012-2h2V3H7a4 4 0 00-4 4v2h2zm10 0V7a2 2 0 00-2-2h-2V3h2a4 4 0 014 4v2h-2zm-10 2H3v2a4 4 0 004 4h2v-2H7a2 2 0 01-2-2v-2zm10 0h2v2a4 4 0 01-4 4h-2v-2h2a2 2 0 002-2v-2z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}