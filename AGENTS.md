# Agent Guidelines

## Project Overview
Karta is a Figma/Canva-style visual ideation canvas built with React 19, TypeScript, Vite 7, Zustand 5, and HTML Canvas 2D. Real-time collaboration via Yjs + y-websocket.

## Project Patterns

- **State management**: Zustand stores in `src/stores/`. Main store is `canvasStore.ts` (1,155+ lines — god store, decomposition needed). Selection state is separate in `selectionStore.ts`.
- **Tool system**: Class-based tools extending `BaseTool` in `src/tools/`. `ToolManager` routes events to the active tool. `ToolContext` interface provides store access to tools without direct store imports.
- **Canvas rendering**: Custom HTML Canvas 2D renderer in `Canvas.tsx` (1,800+ lines). Uses `requestAnimationFrame` loop. `QuadTree` spatial index for O(log n) hit testing.
- **Object types**: Discriminated union on `type` field (`rectangle`, `ellipse`, `line`, `arrow`, `frame`, `pen`, `text`, `image`, `video`, `group`). Defined in `src/types/canvas.ts`.
- **Yjs integration**: Objects stored in Y.Map, synced via y-websocket. `queueYjsUpdate` batches changes. `isApplyingRemoteChanges` flag prevents echo loops.

## Conventions

- CSS custom properties for theming: `--color-bg-*`, `--color-text-*`, `--color-border`, `--radius-*`, `--color-accent` (#FF5500)
- Font: JetBrains Mono
- Dark theme inspired by Teenage Engineering
- Optional properties with boolean defaults: use `!== false` pattern (e.g., `obj.visible !== false`) since `undefined` means "default true"
- Spatial index must be rebuilt after any object position/size change — call `rebuildSpatialIndex()` in `addObject`, `updateObject`, `updateObjects`, `deleteObject`

## Gotchas

- **Spatial index staleness**: `updateObject`/`updateObjects` must call `rebuildSpatialIndex()` or hit testing breaks. This was a bug fixed in session 4.
- **`obj.visible` is optional (default true)**: Never use `obj.visible` as a truthy check — use `obj.visible !== false`. Same for `obj.locked`.
- **`snapToObjects` defaults to `true`** in `gridSettings` — this is intentional so new users get alignment guides.
- **`isSpacePressed` can get stuck**: If the user alt-tabs while holding space, `keyUp` never fires. The canvas panning state will persist incorrectly. Consider adding a window blur handler.
- **Canvas.tsx `toolContext` memoization**: The `useMemo` for `createToolContext` has many dependencies. If callbacks inside it use stale closures, tools will get outdated state.
- **canvasStore circular dependency**: `collaborationStore` imports from `canvasStore` and vice versa. Use lazy `getState()` calls to avoid import cycles.
- **22 empty test files**: All test suites in `tests/` are stubs with no actual test cases.
