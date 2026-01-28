# Agent Guidelines

## Project Overview
Karta is a Figma/Canva-style visual ideation canvas built with React 19, TypeScript, Vite 7, Zustand 5, and HTML Canvas 2D. Real-time collaboration via Yjs + y-websocket.

## Project Patterns

- **State management**: Zustand stores in `src/stores/`. Main store is `canvasStore.ts` (1,155+ lines — god store, decomposition needed). Selection state is separate in `selectionStore.ts`. Prefer `getState()` inside event handlers over subscribing to many selectors (see `useKeyboardShortcuts.ts` refactor).
- **Tool system**: Class-based tools extending `BaseTool` in `src/tools/`. `ToolManager` routes events to the active tool. `ToolContext` interface provides store access to tools without direct store imports.
- **Canvas rendering**: Custom HTML Canvas 2D renderer in `Canvas.tsx` (1,800+ lines). Uses `requestAnimationFrame` loop. `QuadTree` spatial index for O(log n) hit testing.
- **Object types**: Discriminated union on `type` field (`rectangle`, `ellipse`, `line`, `arrow`, `frame`, `pen`, `text`, `image`, `video`, `group`). Defined in `src/types/canvas.ts`. Use type guard functions (`isTextObject`, `isGroupObject`, `isLineOrArrow`, etc.) instead of `as` casts — they narrow the type safely.
- **Shared constants**: Layout offsets, zoom limits, and angle snap values live in `src/constants/layout.ts`. Import from there instead of hardcoding values like `260`, `80`, `Math.PI / 4`.
- **Extracted utilities**: Z-order calculations in `src/utils/zOrderUtils.ts`, snap logic in `src/utils/snapUtils.ts`. These are pure functions extracted from canvasStore — test them directly rather than through the store.
- **Yjs integration**: Objects stored in Y.Map, synced via y-websocket. `queueYjsUpdate` batches changes. `isApplyingRemoteChanges` flag prevents echo loops.

## Conventions

- CSS custom properties for theming: `--color-bg-*`, `--color-text-*`, `--color-border`, `--radius-*`, `--color-accent` (#FF5500)
- Font: JetBrains Mono
- Dark theme inspired by Teenage Engineering
- Optional properties with boolean defaults: use `!== false` pattern (e.g., `obj.visible !== false`) since `undefined` means "default true"
- Spatial index must be rebuilt after any object position/size change — call `rebuildSpatialIndex()` in `addObject`, `updateObject`, `updateObjects`, `deleteObject`
- Use type guards from `src/types/canvas.ts` (e.g., `isGroupObject(obj)`) instead of `as GroupObject` casts. The discriminated union auto-narrows in switch/case blocks — no cast needed there.

## Gotchas

- **Spatial index staleness**: `updateObject`/`updateObjects` must call `rebuildSpatialIndex()` or hit testing breaks. This was a bug fixed in session 4.
- **`obj.visible` is optional (default true)**: Never use `obj.visible` as a truthy check — use `obj.visible !== false`. Same for `obj.locked`.
- **`snapToObjects` defaults to `true`** in `gridSettings` — this is intentional so new users get alignment guides.
- **`isSpacePressed` stuck state (FIXED)**: Window blur handler added in session 5 resets `isSpacePressed` and `isPanning` on focus loss.
- **Canvas.tsx `toolContext` memoization**: The `useMemo` for `createToolContext` has many dependencies. If callbacks inside it use stale closures, tools will get outdated state.
- **canvasStore circular dependency**: `collaborationStore` imports from `canvasStore` and vice versa. Use lazy `getState()` calls to avoid import cycles.
- **Test infrastructure**: Vitest 4 with `globals: true` — do NOT import `describe`/`it`/`expect`/`vi` from `'vitest'` in test files (causes "No test suite found" error). 27 test files, 487 tests passing.
