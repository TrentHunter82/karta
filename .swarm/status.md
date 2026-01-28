# Swarm Status

## Goal
Polish and harden the Karta codebase - improve code quality, fix edge cases, no new features

## Phase
in-progress

## Session 4 — Completed Work

### Bug Fixes
- **Stale spatial index on object updates**: `updateObject` and `updateObjects` in canvasStore were not calling `rebuildSpatialIndex()`. After moving an object, the QuadTree still held old positions, making objects impossible to select/drag after first move. Added rebuild calls to both functions.
- **Snap-to-objects `visible` filter**: The filter `obj.visible` treated `undefined` as falsy, filtering out ALL objects (since `visible` is optional, default true). Changed to `obj.visible !== false`.

### Snap-to-Grid & Snap-to-Objects Wiring (Session 3→4)
- Wired `snapPosition`, `snapToGrid`, `setActiveSnapGuides`, `getGridSettings` into `ToolContext` interface and Canvas.tsx `createToolContext`
- SelectTool: Snap during drag (reference object snap) and resize (edge snap to grid)
- RectangleTool, FrameTool, LineTool, ArrowTool: Snap on mouseDown start position and mouseMove preview
- All tools clear snap guides on mouseUp/cancel

### CSS Polish
- Fixed `border-radius` inconsistencies in ContextMenu.css (hardcoded `6px` → `var(--radius-md)`)

### Documentation
- Replaced Vite boilerplate README with comprehensive project documentation

## Session 3 — Completed Work

### Bug Fixes
- **NumberInput.tsx crash fixed**: `localValue`/`setLocalValue` were undefined (renamed from `editValue` but references were missed). Replaced all 3 occurrences + added proper initialization on edit click.
- **PenTool continuous drawing**: Removed auto-switch to select tool on mouse up. Pen tool now stays active for continuous drawing. Cleared selection after stroke so no bounding box appears.

### Code Cleanup
- **Removed 26 console.log statements** across 8 files (canvasStore, collaborationStore, clipboardStore, viewportStore, groupStore, yjsUtils, textMeasurement, Canvas). Preserved all console.warn (validation) and console.error (real errors).
- **Removed dead code**: unused `displayValue` variable in NumberInput, commented-out `DISCONNECTION_TOAST_GRACE_PERIOD` constant in collaborationStore.

### Analysis Completed
Full codebase analysis covering quality, security, performance, and architecture. Key remaining items below.

## Remaining Work (prioritized)

### High Priority
1. **useKeyboardShortcuts.ts** — 20+ dependency array in useEffect (line 449) causes frequent event listener re-registration. Refactor to use `getState()` pattern.
2. **Room ID validation** — App.tsx:31 reads room ID from `window.location.hash` without validation. Add alphanumeric + length check.

### Medium Priority
3. **Add React.memo** to ContextMenu and PropertiesPanel components
4. **Memoize Minimap bounds** calculations (lines 77-94, runs every render)
5. **106 type assertions** (`as` casts) — consider type guard functions for canvas object types

### Low Priority / Long-term
6. **Decompose large files**: Canvas.tsx (1,803 lines), canvasStore.ts (1,155 lines), SelectTool.ts (823 lines)
7. **Extract magic numbers** to named constants (snap thresholds, padding values, retry counts)
8. **22 empty test files** — all test suites are stubs with no test cases

### Not Issues
- Security: No XSS, eval, innerHTML, or hardcoded secrets found
- Event listener cleanup: All properly handled across all components
- Canvas rendering: Well-optimized with image/video caching, QuadTree spatial indexing
