

Title: Implement atom/group hover-pick highlighting and chemical semantics mapping for 3D molecules

Context

- Current viewers
  - `app/components/panels/MoleculeViewer.tsx`
    - Renders small molecules (SDF/PDB) using Three.js directly: `WebGLRenderer`, `OrbitControls`, `EffectComposer`, `OutlinePass`.
    - Animation loop renders only once the scene is ready via `isSceneReadyRef` to prevent pre-fit flicker.
    - Hover detection currently checks only a global bounding sphere with a `Raycaster`; there is no per-atom picking or highlighting.
    - Atom building
      - SDF path: `three-sdf-loader` builds a mesh hierarchy; many atom meshes expose `mesh.userData.atom` (symbol, possibly index). Labels are added via `CSS2DObject` by traversing meshes with `userData.atom.symbol`.
      - PDB path: `PDBLoader` provides atom positions/colors in attributes; `moleculeUtils.buildInstancedAtoms(...)` creates a `THREE.InstancedMesh` of spheres. Bonds exist in loader output but are not clearly pickable yet.
  - `app/components/panels/MacromoleculeViewer3DMol.tsx`
    - Uses 3Dmol.js; supports selection/hover callbacks natively, but we have not wired them yet.

- Utilities and data
  - `app/components/panels/moleculeUtils.ts`
    - `buildInstancedAtoms(...)` creates `InstancedMesh` for atoms; does not currently return a mapping for picking.
    - `extractAtomPositions`, `applyBoundsToGeometry`, `computeStatsFromGeometry`, `pruneIsolatedIons`, `buildMacromoleculeVisualization`, `buildRibbonOverlay`, `selectOptimalFormat`.
  - `app/lib/pubchem.ts`
    - For small molecules, fetches 3D SDF from PubChem/NIST/CACTUS; also fetches `MoleculeInfo` including `canonical_smiles`, etc.
  - `app/types/index.ts`
    - `MoleculeInfo` includes SMILES fields that can be used for substructure detection.

What to build

- Precise hover/pick
  - SDF path:
    - Raycast against per-atom meshes created by `three-sdf-loader`. Standardize on reading `mesh.userData.atom` (symbol/index). On hit, extract atom index and symbol.
  - PDB path (instanced atoms):
    - Use Three.js instanced-mesh raycasting (gives `instanceId`). Maintain `instanceId → atom metadata` mapping from `PDBLoader`’s `json.atoms`.
  - Optional bonds:
    - If bonds are rendered as meshes, attach metadata for picking; else derive neighbors from adjacency when needed.

- Chemical semantics (functional groups, moieties)
  - Programmatic (primary):
    - Use `canonical_smiles` or the SDF molfile with OpenChemLib (already used for 2D) to parse a graph and run SMARTS patterns for groups (hydroxyl, carbonyl, carboxylate, amine, amide, nitro, halogen, aromatic rings, heterocycles, etc.).
    - Prefer SDF-derived indices for stable mapping to 3D; ensure index alignment.
    - Produce `{ id, name, atoms: number[], bonds?: number[], description?: string, smarts?: string }` for each group.
  - LLM-assisted (fallback):
    - If programmatic detection fails, provide atom-indexed molfile to GPT-5 to propose groups with explicit atom index arrays. Validate locally via adjacency/types before accepting.

- Highlighting strategy
  - Single-atom hover: change color of the atom instance (PDB) via `setColorAt` + `instanceColor.needsUpdate`, or adjust material/emissive for SDF mesh. Optionally OutlinePass for SDF.
  - Group highlight: iterate atom indices; for instancing, either recolor selected instances or use an overlay instanced mesh. For SDF, collect meshes into a temp `Group` for OutlinePass.
  - Tooltip overlay showing atom symbol/index and group chips.

- Macromolecules (3Dmol)
  - Use 3Dmol hover/select APIs and emit consistent events for tooltips/panels.

Key code touchpoints

- `app/components/panels/MoleculeViewer.tsx`
  - Replace bounding-sphere hover with true raycasting: `raycaster.intersectObjects(rootRef.current.children, true)`.
  - Branch by hit type:
    - SDF `Mesh` with `userData.atom` → extract metadata.
    - PDB `InstancedMesh` → use `instanceId` to lookup metadata.
  - Maintain last hovered atom and clear on leave; trigger highlight updates.
  - Emit `onHoverAtom`, `onSelectAtom`, and optional `onHoverGroup`/`onSelectGroup` events.

- `app/components/panels/moleculeUtils.ts`
  - Extend `buildInstancedAtoms(...)` to return `{ mesh, instanceToAtom: Map<number, AtomMeta> }` and set `mesh.userData.role = 'atoms'`.
  - Add adjacency builder (from PDB/SDF bonds) and group detection module using SMARTS via OpenChemLib.

- `app/lib/pubchem.ts`
  - Ensure `MoleculeInfo.canonical_smiles` is present when available; no code changes required otherwise.

Data and events

- Derived per-molecule data:
  - `atomIndexToMetadata[]` (symbol, coords, optional charge), `adjacencyList[]`, `groups[]`.
- Runtime state:
  - `hoveredAtomIndex?`, `hoveredGroupId?`, `selectedAtomIndices?`, `selectedGroupId?`.
- Events:
  - `onHoverAtom(atomIndex, metadata)`, `onHoverGroup(groupId, group)`, `onSelectAtom(indices)`, `onSelectGroup(groupId)`, `onFirstFrameRendered()`.

Algorithm sketch (programmatic)

1) After SDF/PDB load, build atom index mapping:
   - SDF: traverse meshes, read `userData.atom`; map `mesh.uuid → {atomIndex, symbol}`.
   - PDB: capture `InstancedMesh` and build `instanceId → {atomIndex, symbol}` from `json.atoms`.
2) Build adjacency from bond tables; fallback to distance heuristics only if necessary.
3) Run SMARTS detection (OpenChemLib) on SDF or SMILES to produce functional groups as atom index sets; cache by CID/hash.
4) Pointer move → Raycaster intersect → resolve atom index → update highlight and tooltip.
5) Optional group hover/selection: toggle highlight across atom index sets.

Performance & UX

- Reuse a singleton `Raycaster`; throttle pointermove work.
- Keep first-frame signal precise via `onFirstFrameRendered` to hide page overlay.
- For large molecules, prefer per-instance color updates over heavy OutlinePass; optionally prepare an overlay instanced mesh for selection.

Trade-offs: programmatic vs LLM

- Programmatic (SMARTS) is deterministic and fast after precompute; requires maintaining a pattern library and careful index alignment.
- LLM adds flexibility for complex moieties/mechanisms but needs schema-constrained outputs (atom index arrays) and local validation; higher latency/cost.

Acceptance criteria

- Hovering any visible atom highlights exactly that atom in both SDF and PDB paths.
- Tooltip shows atom symbol/index and any detected group badges.
- Known test molecules (e.g., ethanol, nitrobenzene) detect groups correctly and highlight them on demand.
- Macromolecule path uses 3Dmol hover/select for residues/atoms with consistent UI.
- Smooth interaction at 60 FPS for small/medium molecules; acceptable responsiveness for large ones.

Open questions

- Confirm `three-sdf-loader` consistently provides `userData.atom` with stable indices; if not, define our own indexing step on load.
- Decide initial highlight approach for instanced atoms (per-instance color vs overlay) and whether bond picking is in scope for v1.
- Define the initial SMARTS set and how to version it.
