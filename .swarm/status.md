# Swarm Status

## Goal
Polish and harden the Karta codebase - improve code quality, fix edge cases, no new features

## Phase
in-progress

## Session 6 — Completed Work

### Type Safety
- **Added 13 type guard functions** in `src/types/canvas.ts` (`isRectangleObject`, `isTextObject`, `isGroupObject`, `isLineOrArrow`, etc.) for discriminated union narrowing
- **Replaced ~35 `as` type casts** across 8 files with type guards and discriminated union auto-narrowing:
  - `exportUtils.ts`: Removed 12 casts (switch cases auto-narrow `CanvasObject`)
  - `Canvas.tsx`: Removed 11 casts (switch cases + type guard replacements)
  - `PropertiesPanel.tsx`: Removed 9 casts (switch cases + `.filter(isTextObject)` pattern)
  - `canvasStore.ts`, `groupStore.ts`, `LayerSection.tsx`, `SelectTool.ts`: Replaced `as GroupObject`/`as TextObject` with `isGroupObject()`/`isTextObject()` type guards
- Removed unnecessary type-only imports (`TextObject`, `GroupObject`, etc.) from files that no longer need them

### Magic Numbers Extraction
- **Created `src/constants/layout.ts`** with shared constants: `CANVAS_WIDTH_OFFSET`, `CANVAS_HEIGHT_OFFSET`, `TEMPLATE_PANEL_WIDTH`, `MIN_ZOOM`, `MAX_ZOOM`, `DEFAULT_VIEWPORT_PADDING`, `ANGLE_SNAP_45_RAD`, `ROTATION_SNAP_DEG`
- **Replaced hardcoded `260`/`80` layout offsets** in 4 files (Minimap.tsx, useKeyboardShortcuts.ts, TemplatePanel.tsx, viewportStore.ts) with shared constants
- **Replaced `Math.PI / 4` angle snaps** in LineTool.ts and ArrowTool.ts with `ANGLE_SNAP_45_RAD`
- **Replaced `15` rotation snap** in SelectTool.ts with `ROTATION_SNAP_DEG`
- **Deduplicated `MIN_ZOOM`/`MAX_ZOOM`** — removed duplicate definitions from Canvas.tsx and viewportStore.ts, now imported from shared constants

## Session 5 — Completed Work

### Performance
- **useKeyboardShortcuts.ts**: Refactored 23-item useEffect dependency array to use `useCanvasStore.getState()` inside handler. Dependency array now only contains `[onOpenShortcuts]`, eliminating frequent event listener re-registration.
- **React.memo**: Wrapped `ContextMenu` and `PropertiesPanel` components with `React.memo` to prevent unnecessary re-renders.
- **Minimap bounds memoization**: Wrapped `allObjects`, `contentBounds`, `viewportBounds`, `totalBounds`, and `scale` calculations in `useMemo` to avoid recalculating every render.

### Bug Fixes
- **Room ID validation**: Added alphanumeric + length check (`/^[a-zA-Z0-9]{1,32}$/`) in App.tsx. Invalid or missing room IDs now generate a fresh random ID instead of passing unsanitized hash to collaboration server.
- **isSpacePressed stuck state**: Added `window.blur` handler in Canvas.tsx to reset `isSpacePressed` and `isPanning` when the window loses focus, preventing stuck panning state after alt-tab.

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

### Medium Priority
1. ~~**106 type assertions** (`as` casts)~~ — **Reduced by ~35**: Added type guards and leveraged discriminated union narrowing. Remaining casts are mostly DOM casts (`as Node`, `as HTMLElement`), generic casts (`as unknown`, `as const`), and a few structural casts that can't be eliminated without larger refactors.

### Low Priority / Long-term
6. **Decompose large files**: Canvas.tsx (1,803 lines), canvasStore.ts (1,155 lines), SelectTool.ts (823 lines)
7. ~~**Extract magic numbers**~~ — **Partially done**: Layout offsets, zoom limits, angle snaps extracted to `src/constants/layout.ts`. Remaining: some local padding values and threshold constants that are only used once.
8. **22 empty test files** — all test suites are stubs with no test cases

### Not Issues
- Security: No XSS, eval, innerHTML, or hardcoded secrets found
- Event listener cleanup: All properly handled across all components
- Canvas rendering: Well-optimized with image/video caching, QuadTree spatial indexing
