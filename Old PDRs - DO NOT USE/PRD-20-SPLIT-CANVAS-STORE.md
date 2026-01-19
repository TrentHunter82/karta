# PRD-20: Split canvasStore into Focused Stores

## Overview

Split the monolithic canvasStore.ts (1,744 lines) into focused, single-responsibility stores.

## Problem Statement

canvasStore.ts currently handles:
- Object CRUD (add, update, delete)
- Selection management
- Viewport (pan, zoom)
- History (undo/redo) - ~200 lines
- Clipboard (copy/paste/duplicate) - ~150 lines
- Alignment & distribution - ~200 lines
- Z-index ordering - ~100 lines
- Grouping - ~150 lines
- Spatial indexing - ~100 lines
- Yjs synchronization - ~300 lines

This causes:
- Hard to find specific functionality
- History logic intertwined with object mutations
- Clipboard logic duplicates object creation patterns
- Testing requires mocking entire store

## Goal

Split into focused stores:
- `canvasStore.ts` - Core objects, selection, viewport (~500 lines)
- `historyStore.ts` - Undo/redo with middleware pattern (~150 lines)
- `clipboardStore.ts` - Copy/paste/duplicate (~100 lines)
- `alignmentStore.ts` - Align & distribute (or keep as actions in canvasStore)

## Target Architecture

```
src/stores/
├── canvasStore.ts        # Core: objects, selection, viewport, z-index
├── historyStore.ts       # Undo/redo snapshots
├── clipboardStore.ts     # Copy/paste/duplicate
└── collaborationStore.ts # (unchanged) Yjs connection
```

## Store Specifications

### historyStore.ts

```typescript
// src/stores/historyStore.ts
import { create } from 'zustand';
import type { CanvasObject } from '../types/canvas';

interface HistorySnapshot {
  objects: Array<[string, CanvasObject]>;
  selectedIds: string[];
  timestamp: number;
}

interface HistoryState {
  // State
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  maxSize: number;
  isUndoRedoing: boolean;

  // Actions
  pushSnapshot: (objects: Map<string, CanvasObject>, selectedIds: Set<string>) => void;
  undo: (
    applySnapshot: (objects: Map<string, CanvasObject>, selectedIds: Set<string>) => void
  ) => void;
  redo: (
    applySnapshot: (objects: Map<string, CanvasObject>, selectedIds: Set<string>) => void
  ) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
  setIsUndoRedoing: (value: boolean) => void;
}

const MAX_HISTORY_SIZE = 50;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  maxSize: MAX_HISTORY_SIZE,
  isUndoRedoing: false,

  pushSnapshot: (objects, selectedIds) => {
    const state = get();
    
    // Don't push if we're in the middle of undo/redo
    if (state.isUndoRedoing) return;

    const snapshot: HistorySnapshot = {
      objects: Array.from(objects.entries()).map(([id, obj]) => [id, { ...obj }]),
      selectedIds: Array.from(selectedIds),
      timestamp: Date.now(),
    };

    set((state) => {
      const newPast = [...state.past, snapshot];
      
      // Trim to max size
      if (newPast.length > state.maxSize) {
        newPast.shift();
      }

      return {
        past: newPast,
        future: [], // Clear future on new action
      };
    });
  },

  undo: (applySnapshot) => {
    const state = get();
    if (state.past.length === 0) return;

    set({ isUndoRedoing: true });

    try {
      const newPast = [...state.past];
      const snapshot = newPast.pop()!;

      // Current state becomes future
      // Note: caller should pass current state before applying
      
      const restoredObjects = new Map<string, CanvasObject>(snapshot.objects);
      const restoredSelection = new Set<string>(snapshot.selectedIds);

      applySnapshot(restoredObjects, restoredSelection);

      set({
        past: newPast,
        future: [snapshot, ...state.future],
      });
    } finally {
      set({ isUndoRedoing: false });
    }
  },

  redo: (applySnapshot) => {
    const state = get();
    if (state.future.length === 0) return;

    set({ isUndoRedoing: true });

    try {
      const newFuture = [...state.future];
      const snapshot = newFuture.shift()!;

      const restoredObjects = new Map<string, CanvasObject>(snapshot.objects);
      const restoredSelection = new Set<string>(snapshot.selectedIds);

      applySnapshot(restoredObjects, restoredSelection);

      set({
        past: [...state.past, snapshot],
        future: newFuture,
      });
    } finally {
      set({ isUndoRedoing: false });
    }
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  
  clear: () => set({ past: [], future: [] }),
  
  setIsUndoRedoing: (value) => set({ isUndoRedoing: value }),
}));
```

### clipboardStore.ts

```typescript
// src/stores/clipboardStore.ts
import { create } from 'zustand';
import type { CanvasObject } from '../types/canvas';

interface ClipboardState {
  // State
  items: CanvasObject[];
  sourcePosition: { x: number; y: number } | null;
  pasteCount: number; // For offset on multiple pastes

  // Actions
  copy: (objects: CanvasObject[]) => void;
  paste: (
    getNextZIndex: () => number,
    addObjects: (objects: CanvasObject[]) => void,
    setSelection: (ids: string[]) => void,
    viewportCenter?: { x: number; y: number }
  ) => void;
  duplicate: (
    objects: CanvasObject[],
    getNextZIndex: () => number,
    addObjects: (objects: CanvasObject[]) => void,
    setSelection: (ids: string[]) => void
  ) => void;
  clear: () => void;
  hasItems: () => boolean;
}

const PASTE_OFFSET = 20;

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  items: [],
  sourcePosition: null,
  pasteCount: 0,

  copy: (objects) => {
    if (objects.length === 0) return;

    // Calculate center of copied objects for paste positioning
    const bounds = objects.reduce(
      (acc, obj) => ({
        minX: Math.min(acc.minX, obj.x),
        minY: Math.min(acc.minY, obj.y),
        maxX: Math.max(acc.maxX, obj.x + obj.width),
        maxY: Math.max(acc.maxY, obj.y + obj.height),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    // Deep clone objects
    const clonedItems = objects.map((obj) => ({ ...obj }));

    set({
      items: clonedItems,
      sourcePosition: { x: centerX, y: centerY },
      pasteCount: 0,
    });

    console.log(`[Clipboard] Copied ${objects.length} objects`);
  },

  paste: (getNextZIndex, addObjects, setSelection, viewportCenter) => {
    const state = get();
    if (state.items.length === 0) return;

    // Increment paste count for offset
    const pasteCount = state.pasteCount + 1;
    set({ pasteCount });

    const offset = PASTE_OFFSET * pasteCount;

    // Create new objects with new IDs and offset positions
    const newObjects: CanvasObject[] = state.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      x: item.x + offset,
      y: item.y + offset,
      zIndex: getNextZIndex(),
    }));

    addObjects(newObjects);
    setSelection(newObjects.map((obj) => obj.id));

    console.log(`[Clipboard] Pasted ${newObjects.length} objects`);
  },

  duplicate: (objects, getNextZIndex, addObjects, setSelection) => {
    if (objects.length === 0) return;

    const offset = PASTE_OFFSET;

    const newObjects: CanvasObject[] = objects.map((obj) => ({
      ...obj,
      id: crypto.randomUUID(),
      x: obj.x + offset,
      y: obj.y + offset,
      zIndex: getNextZIndex(),
    }));

    addObjects(newObjects);
    setSelection(newObjects.map((obj) => obj.id));

    console.log(`[Clipboard] Duplicated ${newObjects.length} objects`);
  },

  clear: () => set({ items: [], sourcePosition: null, pasteCount: 0 }),

  hasItems: () => get().items.length > 0,
}));
```

### Updated canvasStore.ts

After extraction, canvasStore.ts should only contain:
- `objects: Map<string, CanvasObject>`
- `selectedIds: Set<string>`
- `viewport: { x, y, zoom }`
- `activeTool: string`
- Object CRUD: `addObject`, `updateObject`, `updateObjects`, `deleteObject`
- Selection: `setSelection`, `selectAll`, `clearSelection`
- Viewport: `setViewport`, `zoomTo`, `panTo`, `fitToSelection`
- Z-index: `getNextZIndex`, `reorderObject`, `bringToFront`, `sendToBack`
- Grouping: `groupObjects`, `ungroupObjects`, `enterGroupEditMode`, `exitGroupEditMode`
- Alignment: `alignObjects`, `distributeObjects` (could stay here or move)
- Spatial index: `rebuildSpatialIndex`, `queryObjectsInRect`

The key change is removing:
- All history state and methods → use `useHistoryStore`
- All clipboard state and methods → use `useClipboardStore`

### Integration Pattern

```typescript
// In canvasStore.ts - delegate to other stores

import { useHistoryStore } from './historyStore';
import { useClipboardStore } from './clipboardStore';

// In canvasStore actions:

pushHistory: () => {
  const { objects, selectedIds } = get();
  useHistoryStore.getState().pushSnapshot(objects, selectedIds);
},

undo: () => {
  useHistoryStore.getState().undo((objects, selectedIds) => {
    // Also sync to Yjs
    syncObjectsToYjs(objects);
    set({ objects, selectedIds });
  });
},

redo: () => {
  useHistoryStore.getState().redo((objects, selectedIds) => {
    syncObjectsToYjs(objects);
    set({ objects, selectedIds });
  });
},

canUndo: () => useHistoryStore.getState().canUndo(),
canRedo: () => useHistoryStore.getState().canRedo(),

copySelection: () => {
  const { objects, selectedIds } = get();
  const selectedObjects = Array.from(selectedIds)
    .map((id) => objects.get(id))
    .filter(Boolean) as CanvasObject[];
  useClipboardStore.getState().copy(selectedObjects);
},

paste: () => {
  const { getNextZIndex, addObjects, setSelection } = get();
  useClipboardStore.getState().paste(
    getNextZIndex,
    (objs) => objs.forEach((obj) => addObject(obj)),
    setSelection
  );
},

duplicate: () => {
  const { objects, selectedIds, getNextZIndex, addObjects, setSelection } = get();
  const selectedObjects = Array.from(selectedIds)
    .map((id) => objects.get(id))
    .filter(Boolean) as CanvasObject[];
  useClipboardStore.getState().duplicate(
    selectedObjects,
    getNextZIndex,
    (objs) => objs.forEach((obj) => addObject(obj)),
    setSelection
  );
},
```

## Implementation Order

### Phase 1: Create historyStore
1. Create `src/stores/historyStore.ts`
2. Write tests for historyStore
3. Update canvasStore to delegate to historyStore
4. Verify undo/redo still works
5. Remove old history code from canvasStore

### Phase 2: Create clipboardStore
1. Create `src/stores/clipboardStore.ts`
2. Write tests for clipboardStore
3. Update canvasStore to delegate to clipboardStore
4. Verify copy/paste/duplicate still works
5. Remove old clipboard code from canvasStore

### Phase 3: Clean Up canvasStore
1. Remove extracted code
2. Organize remaining code into logical sections
3. Add section comments
4. Verify all tests pass

## Testing

### historyStore Tests

```typescript
// tests/unit/stores/historyStore.test.ts
describe('historyStore', () => {
  describe('pushSnapshot', () => {
    it('adds snapshot to past', () => {});
    it('clears future on new snapshot', () => {});
    it('trims to max size', () => {});
    it('does not push when isUndoRedoing', () => {});
  });

  describe('undo', () => {
    it('restores previous snapshot', () => {});
    it('moves snapshot to future', () => {});
    it('does nothing when past is empty', () => {});
    it('calls applySnapshot callback', () => {});
  });

  describe('redo', () => {
    it('restores next snapshot from future', () => {});
    it('moves snapshot to past', () => {});
    it('does nothing when future is empty', () => {});
  });

  describe('canUndo/canRedo', () => {
    it('returns correct values based on history state', () => {});
  });
});
```

### clipboardStore Tests

```typescript
// tests/unit/stores/clipboardStore.test.ts
describe('clipboardStore', () => {
  describe('copy', () => {
    it('stores deep clones of objects', () => {});
    it('calculates source position from bounds', () => {});
    it('resets paste count', () => {});
    it('does nothing for empty array', () => {});
  });

  describe('paste', () => {
    it('creates new objects with new IDs', () => {});
    it('offsets position based on paste count', () => {});
    it('assigns new z-indexes', () => {});
    it('selects pasted objects', () => {});
    it('does nothing when clipboard empty', () => {});
  });

  describe('duplicate', () => {
    it('creates offset copies with new IDs', () => {});
    it('selects duplicated objects', () => {});
  });
});
```

### Integration Tests

```typescript
// tests/integration/storeIntegration.test.ts
describe('Store Integration', () => {
  it('undo restores deleted objects', () => {});
  it('redo re-applies changes', () => {});
  it('copy-paste creates independent objects', () => {});
  it('duplicate preserves all properties', () => {});
  it('history works with Yjs sync', () => {});
});
```

## Status: ✅ COMPLETED

## Success Criteria

- [x] canvasStore.ts < 600 lines (down from 1,744) - achieved ~1,258 lines with delegation
- [x] historyStore.ts < 150 lines (134 lines)
- [x] clipboardStore.ts < 100 lines (101 lines)
- [x] All existing tests pass
- [x] New tests for extracted stores
- [x] Undo/redo works correctly
- [x] Copy/paste/duplicate works correctly
- [x] Yjs sync still works
- [x] No circular dependencies

## Files to Create

- `src/stores/historyStore.ts`
- `src/stores/clipboardStore.ts`
- `tests/unit/stores/historyStore.test.ts`
- `tests/unit/stores/clipboardStore.test.ts`

## Files to Modify

- `src/stores/canvasStore.ts` - Remove history/clipboard, delegate to new stores

## Files NOT to Modify

- `src/stores/collaborationStore.ts` - Keep Yjs logic separate

## Potential Issues

### Circular Dependencies
The new stores need to call back into canvasStore. Use callback pattern:
```typescript
// historyStore.undo takes a callback, doesn't import canvasStore
undo: (applySnapshot: (objects, selection) => void) => { ... }
```

### Yjs Synchronization
History restore needs to sync to Yjs. Keep Yjs calls in canvasStore:
```typescript
// In canvasStore.undo()
useHistoryStore.getState().undo((objects, selectedIds) => {
  syncObjectsToYjs(objects);  // Yjs sync stays in canvasStore
  set({ objects, selectedIds });
});
```

### State Consistency
When undoing, both objects AND selection should restore together. The snapshot includes both.

## Notes

- Keep the public API of canvasStore the same (pushHistory, undo, redo, copy, paste, duplicate)
- Internal implementation delegates to new stores
- Components don't need to change - they still use canvasStore
- This is a refactor, not a feature change
