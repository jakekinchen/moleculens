

Goal  
Keep the viewer looking “molecular” yet keep frame-rates high for huge macromolecules (tens-of-thousands of atoms).

Key idea  
Rendering one THREE.Mesh per atom kills performance.  Two alternatives that slot into the existing code with minimal upheaval:

1. GPU Instancing  
   • Replace the per-atom loop with a single `THREE.InstancedMesh` (one low-poly icosahedron).  
   • Each instance gets its own matrix + vertex-color attribute, so visual fidelity is the same but draw-calls drop to 1.  

2. Point Cloud fallback (even lighter)  
   • For extremely big models (e.g. > 20 k atoms) skip spheres altogether and create a `THREE.Points` with per-vertex colours.  
   • No lighting, but still looks acceptable at that scale.

Proposed thresholds  
• 0 – 5 k atoms → current sphere-per-atom route (already fast).  
• 5 k – 20 k  → InstancedMesh spheres.  
• > 20 k    → coloured Points cloud, bonds omitted.

Minimal code changes  
A. In `MoleculeViewer.tsx → loadMolecule()`  
   1. Detect `positions.count`.  
   2. Branch to:  
      a. existing Mesh loop (small),  
      b. `buildInstancedAtoms(...)`,  
      c. or `buildPointsCloud(...)`.  
   3. Skip bond generation for the Points branch.  
B. Implement two helper functions inside the same file; no new deps.  
C. Controls, labels, camera logic remain untouched.

Expected impact  
• Draw-call count collapses from ~70 k to 1.  
• GPU memory drops because geometry is reused.  
• CPU build time improves (no thousands of `new Mesh`).  

Next step  
If this plan looks good, patch `MoleculeViewer.tsx` accordingly.
