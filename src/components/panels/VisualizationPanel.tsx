/* eslint-disable */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import * as THREE from 'three';
import { LoadingFacts } from './LoadingFacts';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// CSS styles for atom labels
const atomLabelStyles = `
  .atom-label {
    color: #fff;
    font-family: sans-serif;
    padding: 2px;
    background: rgba(0,0,0,0.6);
    border-radius: 3px;
    font-size: 12px;
    pointer-events: none;
    user-select: none;
  }
`;

// Extend Window interface to include PDBLoader and labelRenderer
declare global {
  interface Window {
    PDBLoader?: any;
    labelRenderer?: any;
    labelRendererResizeListener?: boolean;
    CSS2DRenderer?: any;
    CSS2DObject?: any;
    THREE?: any;
    createAtomLabel?: (position: any, text: string) => any;
  }
}

// Helper component to auto-fit camera to scene
const CameraController = () => {
  const { camera, scene } = useThree();
  
  useEffect(() => {
    requestAnimationFrame(() => {
      // Get all non-light objects in the scene
      const objects = scene.children.filter(child => !(child instanceof THREE.Light));
      
      if (objects.length > 0) {
        // Create bounding box for all objects
        const box = new THREE.Box3();
        objects.forEach(object => box.expandByObject(object));
        
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Calculate distance based on the diagonal of the bounding box
        const diagonal = Math.sqrt(
          size.x * size.x + 
          size.y * size.y + 
          size.z * size.z
        );
        
        // Increase the distance for larger molecules
        const scaleFactor = Math.max(1.2, Math.log10(diagonal) * 0.8);
        const distance = diagonal * scaleFactor;

        // Position camera using spherical coordinates for better viewing angle
        const theta = Math.PI / 4; // 45 degrees
        const phi = Math.PI / 6;   // 30 degrees
        
        camera.position.set(
          center.x + distance * Math.sin(theta) * Math.cos(phi),
          center.y + distance * Math.sin(phi),
          center.z + distance * Math.cos(theta) * Math.cos(phi)
        );

        // Look at the center point
        camera.lookAt(center);
        
        // Update the orbit controls target
        const controls = camera.userData.controls;
        if (controls) {
          controls.target.copy(center);
        }

        // Adjust camera's near and far planes based on molecule size
        camera.near = distance * 0.01;
        camera.far = distance * 10;
        camera.updateProjectionMatrix();
      }
    });
  }, [camera, scene]);

  return (
    <OrbitControls 
      makeDefault 
      autoRotate 
      autoRotateSpeed={1.5}
      enableDamping
      dampingFactor={0.05}
      minDistance={1} // Allow closer zoom
      maxDistance={1000} // Allow further zoom out
    />
  );
};

interface VisualizationPanelProps {
  script?: string;
  html?: string;
  title?: string;
  isLoading?: boolean;
  isInteractive?: boolean;
}

interface DynamicSceneComponentProps {
  code: string;
}

const DynamicSceneComponent: React.FC<DynamicSceneComponentProps> = ({ code }) => {
  const { scene, camera, gl: renderer } = useThree();
  const controls = useRef(null);
  const labelRendererRef = useRef<any>(null);

  // Add atom label styles to document
  useEffect(() => {
    // Add atom label styles if not already present
    if (!document.getElementById('atom-label-styles')) {
      const style = document.createElement('style');
      style.id = 'atom-label-styles';
      style.textContent = atomLabelStyles;
      document.head.appendChild(style);
    }

    return () => {
      // Clean up styles on unmount
      const styleElement = document.getElementById('atom-label-styles');
      if (styleElement) {
        styleElement.parentNode?.removeChild(styleElement);
      }
    };
  }, []);

  // Create a wrapper function that bridges Python and React code
  const createVisualizationWrapper = (pythonGeneratedCode: string) => {
    return function setupVisualization(
      THREE: any,
      scene: THREE.Scene,
      camera: THREE.Camera,
      controls: any,
      labelRenderer: any
    ) {
      // Ensure CSS2D structure and functions are available
      if (!window.CSS2DObject || !window.CSS2DRenderer) {
        console.error('CSS2D classes not available when creating visualization');
      }
      
      // Ensure the labelRenderer is set globally
      if (labelRenderer && !window.labelRenderer) {
        window.labelRenderer = labelRenderer;
      }
      
      // Create the config object that matches Python's expectations
      const config = {
        camera,
        controls,
        labelRenderer: window.labelRenderer || labelRenderer,
        enableAnnotations: true
      };

      // Log what we're using to create the visualization
      console.log('createMoleculeVisualization');

      // Create and execute the visualization function with both individual params and config
      const createMoleculeVisualization = new Function(
        'THREE',
        'scene',
        'camera',
        'controls',
        'config',
        `
        const options = config; // For compatibility with Python's code
        // Ensure CSS2D objects are accessible
        if (typeof CSS2DObject === 'undefined' && window.CSS2DObject) {
          const CSS2DObject = window.CSS2DObject;
        }
        
        // Set up helper function to create labels if needed
        if (!window.createAtomLabel) {
          window.createAtomLabel = function(position, text) {
            if (!window.CSS2DObject) return null;
            
            const div = document.createElement('div');
            div.className = 'atom-label';
            div.textContent = text;
            const label = new window.CSS2DObject(div);
            label.position.copy(position);
            return label;
          };
        }
        
        ${pythonGeneratedCode}
        `
      );

      try {
        return createMoleculeVisualization(THREE, scene, camera, controls, config);
      } catch (error) {
        console.error('Error in visualization (detailed):', {
          error,
          cameraExists: !!camera,
          controlsExists: !!controls,
          configExists: !!config,
          configCamera: !!config.camera,
          configControls: !!config.controls,
          labelRendererExists: !!labelRenderer,
          globalLabelRendererExists: !!window.labelRenderer,
          pythonCodeLength: pythonGeneratedCode.length
        });
        throw error;
      }
    };
  };

  // Set up animation loop for CSS2D renderer
  useFrame(() => {
    if (labelRendererRef.current && camera && scene) {
      labelRendererRef.current.render(scene, camera);
      
      // Also render the global renderer if it exists but is different from our ref
      if (window.labelRenderer && window.labelRenderer !== labelRendererRef.current) {
        window.labelRenderer.render(scene, camera);
      }
    }
  });

  useEffect(() => {
    if (!code || !scene || !camera || !renderer || !controls.current) return;

    async function setupScene() {
      try {
        // Import PDBLoader and CSS2D renderers dynamically
        console.log('Importing PDBLoader and CSS2DRenderer');
        const { PDBLoader } = await import('three/addons/loaders/PDBLoader.js');
        const { CSS2DRenderer, CSS2DObject } = await import('three/addons/renderers/CSS2DRenderer.js');
        
        // Store in window for global access
        window.PDBLoader = PDBLoader;
        window.CSS2DRenderer = CSS2DRenderer;
        window.CSS2DObject = CSS2DObject;
        window.THREE = THREE;
        
        // Set up CSS2DRenderer for labels
        const container = document.querySelector('#container');
        if (container) {
          console.log('Container found, setting up CSS2DRenderer');
          
          // Clean up existing labelRenderer if it exists
          if (labelRendererRef.current) {
            try {
              container.removeChild(labelRendererRef.current.domElement);
            } catch (e) {
              console.warn('Error removing existing labelRenderer:', e);
            }
            labelRendererRef.current = null;
          }
          
          // Create new CSS2DRenderer
          const labelRenderer = new CSS2DRenderer();
          const rect = container.getBoundingClientRect();
          labelRenderer.setSize(rect.width, rect.height);
          labelRenderer.domElement.style.position = 'absolute';
          labelRenderer.domElement.style.top = '0px';
          labelRenderer.domElement.style.left = '0px';
          labelRenderer.domElement.style.width = '100%';
          labelRenderer.domElement.style.height = '100%';
          labelRenderer.domElement.style.pointerEvents = 'none';
          labelRenderer.domElement.style.zIndex = '10';
          
          container.appendChild(labelRenderer.domElement);
          labelRendererRef.current = labelRenderer;
          
          // Make it available globally as the backend code expects
          window.labelRenderer = labelRenderer;
          console.log('CSS2DRenderer attached to DOM');

          // Add resize listener for labelRenderer
          const handleResize = () => {
            const rect = container.getBoundingClientRect();
            labelRenderer.setSize(rect.width, rect.height);
          };
          window.addEventListener('resize', handleResize);

          try {
            // Create and execute the visualization
            console.log('Setting up visualization');
            // Log setup state
            console.log('CSS2D initialization check:', {
              labelRendererExists: !!labelRenderer,
              globalLabelRendererExists: !!window.labelRenderer,
              CSS2DRendererExists: !!window.CSS2DRenderer,
              CSS2DObjectExists: !!window.CSS2DObject,
              threeExists: !!THREE,
              globalThreeExists: !!window.THREE,
            });
            
            const setupVisualization = createVisualizationWrapper(code);
            setupVisualization(THREE, scene, camera, controls.current, labelRenderer);
            console.log('Visualization setup complete');
          } catch (error) {
            console.error('Error executing visualization code:', error);
          }

          // Clean up function
          return () => {
            window.removeEventListener('resize', handleResize);
          };
        }
      } catch (error) {
        console.error('Error setting up scene:', error);
      }
    }

    setupScene();

    // Clean up function for unmounting
    return () => {
      console.log('Cleaning up scene');
      scene.children.slice().forEach(child => {
        if (!(child instanceof THREE.Light)) {
          scene.remove(child);
        }
      });
      
      // Clean up global objects
      delete window.PDBLoader;
      delete window.CSS2DRenderer;
      delete window.CSS2DObject;
      delete window.THREE;
      delete window.createAtomLabel;
      
      // Clean up CSS2DRenderer
      const container = document.querySelector('#container');
      if (container && labelRendererRef.current) {
        try {
          container.removeChild(labelRendererRef.current.domElement);
        } catch (e) {
          console.warn('Error removing labelRenderer:', e);
        }
        labelRendererRef.current = null;
        window.labelRenderer = null;
      }
    };
  }, [code, scene, camera, renderer, controls]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[1, 1, 1]} intensity={1} />
      <directionalLight position={[-1, -1, -1]} intensity={0.4} />
      <OrbitControls
        ref={controls}
        makeDefault
        autoRotate
        autoRotateSpeed={1.5}
        enableDamping
        dampingFactor={0.05}
        minDistance={1}
        maxDistance={1000}
      />
    </>
  );
};

export const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ 
  script,
  html,
  title,
  isLoading = false,
  isInteractive = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);


  const DynamicScene = useMemo(() => {
    if (!script) return null;
      return () => <DynamicSceneComponent code={script} />;
  }, [script]);

  const handleExpand = () => {
    setIsTransitioning(true);
    setIsExpanded(!isExpanded);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // For non-interactive mode (direct geometry rendering)
  if (!isInteractive) {
    return (
      <div className="absolute inset-0">
        <div className={`transition-all duration-300 bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden
          ${isExpanded ? 'fixed inset-0 z-50 m-0' : 'absolute inset-0 m-2'}`}
        >
          {/* Expand/Collapse button */}
          <button
            onClick={handleExpand}
            className="absolute top-2 right-2 z-10 p-2 text-gray-400 hover:text-white transition-colors"
            aria-label={isExpanded ? 'Collapse visualization' : 'Expand visualization'}
          >
            {isExpanded ? (
              <ArrowsPointingInIcon className="w-6 h-6" />
            ) : (
              <ArrowsPointingOutIcon className="w-6 h-6" />
            )}
          </button>

          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90 z-20">
              <LoadingFacts isVisible={isLoading} showFacts={true} />
            </div>
          )}

          {/* Three.js scene */}
          {title && (
            <div className="absolute top-2 left-2 z-10 bg-gray-800/80 px-3 py-1.5 rounded-lg">
              <h3 className="text-sm font-medium text-white truncate max-w-[80%]">{title}</h3>
            </div>
          )}
          <div 
            id="container" 
            className="w-full h-full relative overflow-hidden"
            style={{
              boxSizing: 'border-box',
              padding: 0,
              margin: 0,
              transform: 'none',
              willChange: 'transform'
            }}
          >
            <Canvas 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%',
                transform: 'none',
                willChange: 'transform'
              }}
            >
              <CameraController />
              {DynamicScene && <DynamicScene />}
            </Canvas>
          </div>
        </div>
      </div>
    );
  }

  // For interactive mode (animation with controls)
  return (
    <div className="absolute inset-0">
      <div className={`transition-all duration-300 bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden
        ${isExpanded ? 'fixed inset-0 z-50 m-0' : 'absolute inset-0 m-2'}`}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={handleExpand}
          className="absolute top-2 right-2 z-10 p-2 text-gray-400 hover:text-white transition-colors"
          aria-label={isExpanded ? 'Collapse visualization' : 'Expand visualization'}
        >
          {isExpanded ? (
            <ArrowsPointingInIcon className="w-6 h-6" />
          ) : (
            <ArrowsPointingOutIcon className="w-6 h-6" />
          )}
        </button>

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90 z-20">
            <LoadingFacts isVisible={isLoading} showFacts={true} />
          </div>
        )}

        {/* Three.js scene */}
        <div 
          id="container" 
          className="w-full h-full relative overflow-hidden"
          style={{
            boxSizing: 'border-box',
            padding: 0,
            margin: 0,
            transform: 'none',
            willChange: 'transform'
          }}
        >
          <Canvas 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%',
              transform: 'none',
              willChange: 'transform'
            }}
          >
            <CameraController />
            {DynamicScene && <DynamicScene />}
          </Canvas>
        </div>
      </div>
    </div>
  );
}; 


// JS code 

function createMoleculeVisualization(THREE, scene, options = {}) {
  console.log('createMoleculeVisualization');
  // Configuration options with defaults
  const config = {
      enableAnnotations: true,  // Toggle atomic annotations
      scaleFactor: 0.25,       // Scale factor to control molecule size (reduced from 0.6)
      camera: null,           // Camera instance (optional)
      controls: null,         // Controls instance (optional)
      ...options
  };
  
  // Create a group for the molecule
  const root = new THREE.Group();
  scene.add(root);
  
  // Store labels in a separate group for easier toggling
  const labelsGroup = new THREE.Group();
  root.add(labelsGroup);
  
  // Set a public property to allow external toggling of annotations
  root.enableAnnotations = config.enableAnnotations;

  // Add molecule label styles if not already present
  if (!document.getElementById('molecule-label-style')) {
      const style = document.createElement('style');
      style.id = 'molecule-label-style';
      style.textContent = `
          #container {
              position: relative;
              width: 100%;
              height: 100vh;
          }
          #molecule-label {
              position: absolute;
              bottom: 20px;
              left: 50%;
              transform: translateX(-50%);
              color: white;
              font-family: Arial, sans-serif;
              font-size: 18px;
              background-color: rgba(0, 0, 0, 0.7);
              padding: 10px 20px;
              border-radius: 5px;
              z-index: 1000;
              pointer-events: none;
              text-align: center;
              max-width: 80%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
          }
          .atom-label {
              text-shadow: -1px 1px 1px rgb(0,0,0);
              margin-left: 5px;
              font-size: 14px;
              color: white;
              pointer-events: none;
          }
      `;
      document.head.appendChild(style);
  }

  // Add molecule label if not already present
  if (!document.getElementById('molecule-label')) {
      const container = document.querySelector('#container');
      if (container) {
          const labelContainer = document.createElement('div');
          labelContainer.innerHTML = `<div id="molecule-label">Tetraphenylporphyrin</div>`;
          container.appendChild(labelContainer.firstChild);
      }
  }

  // Set up CSS2D renderer for atom labels if it doesn't exist yet
  if (config.enableAnnotations && !window.labelRenderer && typeof THREE.CSS2DRenderer !== 'undefined') {
      window.labelRenderer = new THREE.CSS2DRenderer();
      const updateLabelRendererSize = () => {
          const container = document.querySelector('#container');
          if (container) {
              const rect = container.getBoundingClientRect();
              window.labelRenderer.setSize(rect.width, rect.height);
          }
      };
      updateLabelRendererSize();
      window.labelRenderer.domElement.style.position = 'absolute';
      window.labelRenderer.domElement.style.top = '0px';
      window.labelRenderer.domElement.style.pointerEvents = 'none';
      const container = document.querySelector('#container');
      if (container) {
          container.appendChild(window.labelRenderer.domElement);
      } else {
          document.body.appendChild(window.labelRenderer.domElement);
      }
      
      // Add resize listener for labelRenderer if not already present
      if (!window.labelRendererResizeListener) {
          window.labelRendererResizeListener = true;
          window.addEventListener('resize', updateLabelRendererSize);
      }
  }

  // Convert SDF -> PDB in Python, embed it here
  const pdbData = `COMPND    86280046
HETATM    1  N1  UNL     1       4.604   1.473   0.000  1.00  0.00           N  
HETATM    2  N2  UNL     1       7.909  -1.812   0.000  1.00  0.00           N  
HETATM    3  N3  UNL     1       4.442  -1.405   0.000  1.00  0.00           N  
HETATM    4  N4  UNL     1       7.758   1.092   0.000  1.00  0.00           N  
HETATM    5  C1  UNL     1       3.176   1.372   0.000  1.00  0.00           C  
HETATM    6  C2  UNL     1       4.981   2.790   0.000  1.00  0.00           C  
HETATM    7  C3  UNL     1       7.438  -3.090   0.000  1.00  0.00           C  
HETATM    8  C4  UNL     1       9.253  -1.690   0.000  1.00  0.00           C  
HETATM    9  C5  UNL     1       2.270  -0.014   0.000  1.00  0.00           C  
HETATM   10  C6  UNL     1       6.469   3.440   0.000  1.00  0.00           C  
HETATM   11  C7  UNL     1       5.791  -3.730   0.000  1.00  0.00           C  
HETATM   12  C8  UNL     1      10.100  -0.283   0.000  1.00  0.00           C  
HETATM   13  C9  UNL     1       3.102  -1.127   0.000  1.00  0.00           C  
HETATM   14  C10 UNL     1       7.448   2.496   0.000  1.00  0.00           C  
HETATM   15  C11 UNL     1       4.707  -2.787   0.000  1.00  0.00           C  
HETATM   16  C12 UNL     1       9.221   0.792   0.000  1.00  0.00           C  
HETATM   17  C13 UNL     1       2.736   2.637   0.000  1.00  0.00           C  
HETATM   18  C14 UNL     1       3.841   3.492   0.000  1.00  0.00           C  
HETATM   19  C15 UNL     1       8.652  -3.718   0.000  1.00  0.00           C  
HETATM   20  C16 UNL     1       9.781  -2.909   0.000  1.00  0.00           C  
CONECT    3   13   13   15
CONECT    4   14   14   16
CONECT    5    9    9   17
CONECT    6   10   10   18
CONECT    7   11   19   19
CONECT    8   12   20   20
END
`;
  
  // Create and configure the PDB loader
  let loader;
  if (typeof THREE.PDBLoader !== 'undefined') {
      loader = new THREE.PDBLoader();
  } else if (typeof window !== 'undefined' && window.PDBLoader) {
      // If we manually attached PDBLoader to the window
      loader = new window.PDBLoader();
  } else if (typeof PDBLoader !== 'undefined') {
      loader = new PDBLoader();
  } else {
      console.error('PDBLoader not found. Make sure it is loaded first.');
      return root;
  }
  
  const pdbBlob = new Blob([pdbData], { type: 'text/plain' });
  const pdbUrl = URL.createObjectURL(pdbBlob);

  // Load and process the PDB data
  loader.load(pdbUrl, function (pdb) {
      const geometryAtoms = pdb.geometryAtoms;
      const geometryBonds = pdb.geometryBonds;
      const json = pdb.json;

      const sphereGeometry = new THREE.IcosahedronGeometry(1, 3);
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
      const offset = new THREE.Vector3();

      geometryAtoms.computeBoundingBox();
      geometryAtoms.boundingBox.getCenter(offset).negate();

      geometryAtoms.translate(offset.x, offset.y, offset.z);
      geometryBonds.translate(offset.x, offset.y, offset.z);

      let positions = geometryAtoms.getAttribute('position');
      const colors = geometryAtoms.getAttribute('color');

      const position = new THREE.Vector3();
      const color = new THREE.Color();

      // Add atoms and their labels
      for (let i = 0; i < positions.count; i++) {
          position.x = positions.getX(i);
          position.y = positions.getY(i);
          position.z = positions.getZ(i);

          color.r = colors.getX(i);
          color.g = colors.getY(i);
          color.b = colors.getZ(i);

          const material = new THREE.MeshPhongMaterial({ color: color });
          const object = new THREE.Mesh(sphereGeometry, material);
          object.position.copy(position);
          object.position.multiplyScalar(1.5 * config.scaleFactor);
          object.scale.multiplyScalar(0.75 * config.scaleFactor);
          root.add(object);
          
          // Create atom annotation using CSS2DObject if available
          if (config.enableAnnotations && typeof THREE.CSS2DObject !== 'undefined') {
              const atom = json.atoms[i];
              const atomSymbol = atom ? (atom[4] || '') : '';
              
              if (atomSymbol) {
                  const text = document.createElement('div');
                  text.className = 'atom-label';
                  text.textContent = atomSymbol;
                  text.style.color = `rgb(${Math.round(color.r*255)},${Math.round(color.g*255)},${Math.round(color.b*255)})`;
                  
                  // Create CSS2DObject and attach it directly to the scene (not labelsGroup)
                  // This ensures it's not affected by group transformations
                  const label = new THREE.CSS2DObject(text);
                  label.position.copy(object.position);
                  scene.add(label);
                  
                  // Add reference to the label in the labelsGroup array for toggling
                  if (!labelsGroup.labels) labelsGroup.labels = [];
                  labelsGroup.labels.push(label);
              }
          }
      }

      // Add bonds
      positions = geometryBonds.getAttribute('position');
      const start = new THREE.Vector3();
      const end = new THREE.Vector3();

      for (let i = 0; i < positions.count; i += 2) {
          start.x = positions.getX(i);
          start.y = positions.getY(i);
          start.z = positions.getZ(i);

          end.x = positions.getX(i + 1);
          end.y = positions.getY(i + 1);
          end.z = positions.getZ(i + 1);

          start.multiplyScalar(1.5 * config.scaleFactor);
          end.multiplyScalar(1.5 * config.scaleFactor);

          const object = new THREE.Mesh(
              boxGeometry,
              new THREE.MeshPhongMaterial({ color: 0xffffff })
          );
          object.position.copy(start);
          object.position.lerp(end, 0.5);
          object.scale.set(0.25 * config.scaleFactor, 0.25 * config.scaleFactor, start.distanceTo(end));
          object.lookAt(end);
          root.add(object);
      }

      // Clean up
      URL.revokeObjectURL(pdbUrl);
      
      // Set initial visibility based on config
      labelsGroup.visible = config.enableAnnotations;

      // Fit camera to the molecule after loading
      root.fitCameraToMolecule();
  });
  
  // Add a method to toggle annotations visibility
  root.toggleAnnotations = function(enable) {
      if (typeof enable === 'boolean') {
          root.enableAnnotations = enable;
      } else {
          root.enableAnnotations = !root.enableAnnotations;
      }
      
      // Toggle visibility of each label in the labels array
      if (labelsGroup.labels && Array.isArray(labelsGroup.labels)) {
          labelsGroup.labels.forEach(label => {
              label.visible = root.enableAnnotations;
          });
      }
      
      return root.enableAnnotations;
  };

  // Add method to fit camera to molecule
  root.fitCameraToMolecule = function() {
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
      const distance = diagonal * scaleFactor;
      
      // Position camera using spherical coordinates
      const theta = Math.PI / 4; // 45 degrees
      const phi = Math.PI / 6;   // 30 degrees
      
      config.camera.position.set(
          center.x + distance * Math.sin(theta) * Math.cos(phi),
          center.y + distance * Math.sin(phi),
          center.z + distance * Math.cos(theta) * Math.cos(phi)
      );
      
      config.camera.lookAt(center);
      config.controls.target.copy(center);
      
      // Adjust near/far planes
      config.camera.near = distance * 0.01;
      config.camera.far = distance * 10;
      config.camera.updateProjectionMatrix();
      
      // Update controls min/max distance
      config.controls.minDistance = distance * 0.1;
      config.controls.maxDistance = distance * 5;
      config.controls.update();
  };
  
  // Return the root group for external control
  return root;
}

// Function to make sure CSS2DRenderer is included in render loop
function setupAnnotationRenderer(renderer, scene, camera) {
  if (!renderer || !scene || !camera) {
      console.error('setupAnnotationRenderer requires renderer, scene, and camera parameters');
      return;
  }
  const originalRender = renderer.render.bind(renderer);
  renderer.render = function(scene, camera) {
      originalRender(scene, camera);
      if (window.labelRenderer) {
          window.labelRenderer.render(scene, camera);
      }
  };
}

createMoleculeVisualization(THREE, scene, {
camera,
controls
});
