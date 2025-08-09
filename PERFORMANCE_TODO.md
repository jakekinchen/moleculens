# Mode: PLAN

Here’s a tight audit report of what’s off and what to fix, plus a concrete, prioritized plan. I won’t make edits until you approve.

### Critical functional issues found

- Research flow
  - In `app/research/page.tsx` we expect `{ id }` from the API, but `app/api/figure/route.ts` returns the server response (likely `{ spec_id, ... }`) or `{ status: 'queued' }` → route will not navigate. Needs consistent response shape and a viewer route.
  - Missing viewer page `app/f/[spec_id]/page.tsx` to show queued/ready figures; the Research submit currently has nowhere to go.

- Global layout
  - Header fix applied as Client Component; functions removed from server layout. Good, but page-level “Time Machine” open logic is severed. Either:
    - Keep global header “dumb” (current), or
    - Add a client-side event bridge (custom event listener) in pages that need time-machine.

- First-load SDF rendering bug (caffeine)
  - Despite our scaling/world-space/deferred-fit changes, you still see:
    - Tiny atoms/labels, no bonds, controls feel disabled on the inaugural render only.
  - Likely causes remaining:
    - Bonds are Line/LineSegments (pixel-width) and never get a “thick” representation; scaling doesn’t affect stroke width.
    - The initial SDF hierarchy differs from subsequent loads (geometries and userData), so our “what-to-scale” logic misses key objects.
    - Overlay intercepting pointer events on first frame; RAF defer not late enough; OrbitControls min/max derived from wrong bounds.
  - Required fix direction:
    - Replace line bonds with cylinder meshes for SDF molecules (ensures visible, scalable bonds).
    - Use userData-based atom/bond detection (don’t rely solely on geometry type).
    - Double-defer fit (two nested requestAnimationFrame) after traversal/scaling and ensure overlay pointer-events is disabled as soon as possible.
    - Explicitly set OrbitControls limits after fit and call controls.update().

### Design/UI/UX issues

- Research page UI
  - Look matches dark theme; good. But it lacks “advanced options” (render modes/outputs, dpi, transparency, presets, annotations, 3D representation, lighting/camera).
  - No quick examples chips; no recent submissions; no status/queued viewer.

- Consistency
  - Header still contains settings state that isn’t wired to anything globally; we can hide or wire it into a shared store later.
  - Minor lint warnings: unused handlers/setters.

### Proposed fix plan (prioritized)

1) Research end-to-end
- Unify API schema:
  - `app/api/figure/route.ts`: always return `{ spec_id }` (and pass through other fields as needed).
  - `app/research/page.tsx`: use `{ spec_id }` and route to `/f/${spec_id}`.
- Add viewer route:
  - `app/f/[spec_id]/page.tsx`: poll `PYMOL_SERVER_BASE_URL/v1/figure/[spec_id]` until ready; show queued state; render assets (links/images).
  - Provide “Back to Research” and copy/share link.

2) First-load SDF render robustness
- In `MoleculeViewer` SDF branch:
  - Traverse the SDF object:
    - For meshes with `userData.atom`: set atom radius (ATOM_SCALE) and position multiply (POSITION_SCALE).
    - For bonds:
      - If they are line segments/lines, replace each with cylinders (two-ended bonds; split for double/triple if possible) with scalable radius (similar to PDB path).
      - If already cylinder meshes, scale uniformly with POSITION_SCALE.
  - After traversal:
    - `object.updateMatrixWorld(true)`; then double `requestAnimationFrame` before fit.
    - Recompute bounds with world positions; set OrbitControls min/max and call `controls.update()`.
  - Overlay safety:
    - Ensure initial overlay has `pointer-events: none` or is removed before user interaction (first deferred fit).

3) Research page enhancements
- Add advanced options group:
  - Render modes, outputs, DPI, transparent background, style preset, annotations (functional groups, charge labels, atom numbers), 3D representation, lighting, camera hints.
- Add “Examples” chips (Caffeine, Aspirin, Glucose) to prefill values.
- Add “Recent submissions” (session storage) to quickly navigate to past `spec_id`s.

4) Global layout polish
- Keep global header simple (nav + modals). For pages that need “Time Machine”, we’ll render their own page-local trigger or add a client bridge that listens for a custom event.
- Remove unused handlers or wire them into a central store if you want global settings to influence pages.

5) Code hygiene
- Clear lint warnings in touched files.
- Ensure tree-shaken imports; remove remnants from the monorepo structure (already removed).
- Quick build to verify no server/client directive leaks.

If you approve, I’ll implement items 1–2 first (functional fixes), then 3 (UX upgrades), and close with 4–5.