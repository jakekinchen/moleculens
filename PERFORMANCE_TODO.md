# MoleculeLens Performance & Cleanup TODO

## Priority 1: Critical Performance Issues (Do First) ✅ COMPLETED

- [x] **Fix MoleculeViewer.tsx main useEffect dependencies**
  - [x] Convert `isPaused` to useRef to prevent scene rebuilds on pause/play
  - [x] Convert `showAnnotations` to useRef to prevent scene rebuilds on label toggle
  - [x] Remove `isPaused` and `showAnnotations` from useEffect dependency array
  - [x] Update `togglePause()` to use ref pattern
  - [x] Update annotation toggle logic to use ref pattern

## Priority 2: GPU Instancing Implementation (Core Performance Goal)

- [x] **Create GPU instancing helper functions**
  - [x] Implement `buildInstancedAtoms()` for 5k-20k atoms using THREE.InstancedMesh
  - [x] Implement `buildPointsCloud()` for >20k atoms using THREE.Points
  - [x] Add proper cleanup for instanced geometries
- [ ] **Complete automatic path selection logic** ⏳
  - [ ] Finish implementing atom count detection branching in loadMolecule()
  - [ ] Test performance thresholds with real large molecule datasets
- [ ] **Modify rendering pipeline**
  - [ ] Update bond generation to skip for point cloud mode
  - [ ] Ensure camera controls work with all rendering modes

## Priority 3: Memory Leaks & Resource Management

- [x] **Fix environment map disposal in MoleculeViewer.tsx**
  - [x] Add `scene.environment?.dispose()` in cleanup block
  - [x] Set `scene.environment = null` after disposal
- [ ] **Implement progressive asset loading**
  - [ ] Cache HDRI via THREE.CubeTextureLoader
  - [ ] Reuse cached assets across viewer instances
  - [ ] Prevent redundant network requests for environment maps

## Priority 4: Code Cleanup & Type Safety

- [x] **Remove unused code in MoleculeViewer.tsx**
  - [x] Delete unused locals: `jobId`, `isRecording`, `audioAnalyser`, `paddingBottom`
- [ ] **Remove unused code in InputPanel.tsx** ⏳
  - [ ] Remove `pollForUpdates` and `pollJobStatus` import (dead code)
  - [ ] Remove `audioAnalyser` state and `prevAudioValuesRef`
  - [ ] Replace magic number `8` with `const VIS_BARS = 8`
- [ ] **Fix file download safety** ❌
  - [ ] Sanitize `title` in `handleDownload()` for filesystem safety
  - [ ] Handle special characters that break on Windows/macOS
- [ ] **Fix prop-driven label toggle** ⚠️
  - [ ] Add lightweight effect to react to showAnnotations prop changes
  - [ ] Toggle labelsGroup.visible and CSS2DRenderer DOM element
  - [ ] Avoid full scene remount when parent toggles annotations

## Priority 5: Production Polish

- [ ] **Remove debug logging** ⏳
  - [ ] Guard `console.log` statements behind `process.env.NODE_ENV !== 'production'`
  - [ ] Clean up SDF branch and recorder debug output
  - [ ] Implement proper error logging for production
- [ ] **Accessibility improvements** ⏳
  - [ ] Add `aria-live="polite"` to error containers
  - [ ] Add `aria-live="polite"` to "Converting speech to text..." status
  - [ ] Ensure screen readers announce state changes
- [ ] **Effect optimization** ⏳
  - [x] Split heavy Three.js scene setup from lightweight UI concerns
  - [x] Keep scene effect keyed only on `pdbData`, `sdfData`, `enableRibbonOverlay`
  - [ ] Move UI-only concerns (`isPaused`, `isFullscreen`) to separate effects/refs (optional)
- [ ] **Magic number cleanup** ⏳
  - [ ] Replace hardcoded `8` in audio visualization with `const VIS_BARS = 8`
  - [ ] Centralize other magic numbers for maintainability

## Expected Performance Impact

- **Draw calls**: Reduce from ~70k to 1 (GPU instancing)
- **Memory**: Significant reduction through geometry reuse
- **CPU**: Faster build times, no thousands of `new Mesh()` calls
- **UI responsiveness**: Eliminate scene rebuilds on pause/play/annotation toggle
- **Resource leaks**: Zero residual WebGL allocations

## Success Criteria

- [ ] No TypeScript/ESLint warnings
- [ ] Smooth 60fps for molecules up to 20k atoms
- [ ] No memory leaks during molecule switching
- [ ] Predictable camera reset behavior
- [ ] Production-ready error handling and logging
