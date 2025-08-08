import * as THREE from 'three';
// @ts-expect-error - Three.js examples module not properly typed but works correctly
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

/** Load an HDRI and apply it as a PMREM‑filtered environment map */
export const addEnvironment = async (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  url = 'https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/hdri/venice_sunset_1k.hdr'
): Promise<void> =>
  new Promise((resolve, reject) => {
    new RGBELoader().load(
      url,
      (hdr: THREE.Texture) => {
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        pmrem.dispose();
        resolve();
      },
      undefined,
      (err: unknown) => reject(err)
    );
  });

/** Recursively dispose geometries, materials and textures */
export const deepDispose = (root: THREE.Object3D): void => {
  root.traverse(obj => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
      else (mesh.material as THREE.Material)?.dispose();
    }
  });
};
