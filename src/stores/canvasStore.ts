import { create } from 'zustand';
import * as Y from 'yjs';
import type { CanvasObject, Viewport, ToolType } from '../types/canvas';
import { ydoc } from './collaborationStore';

// Serializable snapshot of canvas state for history
interface HistorySnapshot {
  objects: Array<[string, CanvasObject]>;
}

interface CanvasState {
  // State
  objects: Map<string, CanvasObject>;
  selectedIds: Set<string>;
  viewport: Viewport;
  activeTool: ToolType;
  cursorPosition: { x: number; y: number } | null;

  // Yjs sync state
  isInitialized: boolean;
  isSyncing: boolean;

  // History state for undo/redo
  history: HistorySnapshot[];
  historyIndex: number;
  isUndoRedoing: boolean;

  // Clipboard state for copy/paste
  clipboard: CanvasObject[];

  // Actions
  addObject: (object: CanvasObject) => void;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  updateObjects: (updates: Array<{ id: string; changes: Partial<CanvasObject> }>) => void;
  deleteObject: (id: string) => void;
  deleteSelectedObjects: () => void;
  setSelection: (ids: string[]) => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  setActiveTool: (tool: ToolType) => void;
  reorderObject: (id: string, newZIndex: number) => void;
  getNextZIndex: () => number;
  setCursorPosition: (position: { x: number; y: number } | null) => void;
  initializeYjsSync: () => void;

  // History actions
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Clipboard actions
  copySelection: () => void;
  paste: () => void;
  duplicate: () => void;
}

// Get Yjs shared types for objects
const yObjects = ydoc.getMap<Y.Map<unknown>>('objects');

// Flag to prevent sync loops - when we're applying remote changes, don't sync back
let isApplyingRemoteChanges = false;

// History configuration
const MAX_HISTORY_SIZE = 50;

// Helper to convert CanvasObject to plain object for Yjs storage
const objectToYjs = (obj: CanvasObject): Record<string, unknown> => {
  // Create a plain object copy for Yjs
  const plainObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'points' && Array.isArray(value)) {
      // Convert points array to Y.Array for path objects
      plainObj[key] = value.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
    } else {
      plainObj[key] = value;
    }
  }
  return plainObj;
};

// Helper to convert Yjs map to CanvasObject
const yjsToObject = (yMap: Y.Map<unknown>): CanvasObject | null => {
  const obj: Record<string, unknown> = {};
  yMap.forEach((value, key) => {
    if (key === 'points' && Array.isArray(value)) {
      obj[key] = value.map((p: unknown) => {
        const point = p as { x: number; y: number };
        return { x: point.x, y: point.y };
      });
    } else {
      obj[key] = value;
    }
  });

  // Validate required fields
  if (!obj.id || !obj.type) {
    return null;
  }

  return obj as unknown as CanvasObject;
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // Initial state
  objects: new Map(),
  selectedIds: new Set(),
  viewport: { x: 0, y: 0, zoom: 1 },
  activeTool: 'select',
  cursorPosition: null,
  isInitialized: false,
  isSyncing: false,

  // History state
  history: [],
  historyIndex: -1,
  isUndoRedoing: false,

  // Clipboard state
  clipboard: [],

  // Initialize Yjs synchronization
  initializeYjsSync: () => {
    const state = get();
    if (state.isInitialized) return;

    console.log('[CanvasStore] Initializing Yjs sync...');

    // Load existing objects from Yjs
    const initialObjects = new Map<string, CanvasObject>();
    yObjects.forEach((yMap, id) => {
      const obj = yjsToObject(yMap);
      if (obj) {
        initialObjects.set(id, obj);
      }
    });

    set({
      objects: initialObjects,
      isInitialized: true,
    });

    console.log(`[CanvasStore] Loaded ${initialObjects.size} objects from Yjs`);

    // Observe changes from Yjs (remote changes)
    yObjects.observe((event) => {
      // Skip if we're the origin of this change
      if (event.transaction.local) {
        return;
      }

      console.log('[CanvasStore] Received remote Yjs changes');
      isApplyingRemoteChanges = true;

      try {
        const currentState = get();
        const newObjects = new Map(currentState.objects);

        event.changes.keys.forEach((change, key) => {
          if (change.action === 'add' || change.action === 'update') {
            const yMap = yObjects.get(key);
            if (yMap) {
              const obj = yjsToObject(yMap);
              if (obj) {
                newObjects.set(key, obj);
                console.log(`[CanvasStore] Remote ${change.action}: ${key}`);
              }
            }
          } else if (change.action === 'delete') {
            newObjects.delete(key);
            console.log(`[CanvasStore] Remote delete: ${key}`);
          }
        });

        set({ objects: newObjects });
      } finally {
        isApplyingRemoteChanges = false;
      }
    });

    // Also observe deep changes within each object's Y.Map
    yObjects.observeDeep((events) => {
      // Skip if we're the origin of this change or applying remote changes
      if (events[0]?.transaction.local || isApplyingRemoteChanges) {
        return;
      }

      console.log('[CanvasStore] Received deep remote Yjs changes');
      isApplyingRemoteChanges = true;

      try {
        const currentState = get();
        const newObjects = new Map(currentState.objects);

        // Find which objects were updated
        const updatedIds = new Set<string>();
        for (const event of events) {
          // Walk up to find the object ID
          let target = event.target;
          while (target && target.parent && target.parent !== yObjects) {
            target = target.parent;
          }
          // Get the key in yObjects
          if (target && target.parent === yObjects) {
            yObjects.forEach((yMap, id) => {
              if (yMap === target) {
                updatedIds.add(id);
              }
            });
          }
        }

        // Reload updated objects
        for (const id of updatedIds) {
          const yMap = yObjects.get(id);
          if (yMap) {
            const obj = yjsToObject(yMap);
            if (obj) {
              newObjects.set(id, obj);
              console.log(`[CanvasStore] Remote deep update: ${id}`);
            }
          }
        }

        if (updatedIds.size > 0) {
          set({ objects: newObjects });
        }
      } finally {
        isApplyingRemoteChanges = false;
      }
    });
  },

  // Actions
  addObject: (object) => {
    // Skip if we're applying remote changes
    if (isApplyingRemoteChanges) {
      return;
    }

    // Push history before adding object
    get().pushHistory();

    set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.set(object.id, object);
      return { objects: newObjects };
    });

    // Sync to Yjs
    ydoc.transact(() => {
      const yMap = new Y.Map<unknown>();
      const plainObj = objectToYjs(object);
      for (const [key, value] of Object.entries(plainObj)) {
        yMap.set(key, value);
      }
      yObjects.set(object.id, yMap);
    });

    console.log(`[CanvasStore] Added object: ${object.id}`);
  },

  updateObject: (id, updates) => {
    // Skip if we're applying remote changes
    if (isApplyingRemoteChanges) {
      return;
    }

    const state = get();
    const existingObject = state.objects.get(id);
    if (!existingObject) return;

    const updatedObject = { ...existingObject, ...updates } as CanvasObject;

    set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.set(id, updatedObject);
      return { objects: newObjects };
    });

    // Sync to Yjs
    ydoc.transact(() => {
      const yMap = yObjects.get(id);
      if (yMap) {
        for (const [key, value] of Object.entries(updates)) {
          yMap.set(key, value);
        }
      }
    });
  },

  updateObjects: (updates) => {
    // Skip if we're applying remote changes
    if (isApplyingRemoteChanges) {
      return;
    }

    set((state) => {
      const newObjects = new Map(state.objects);
      for (const { id, changes } of updates) {
        const existingObject = newObjects.get(id);
        if (existingObject) {
          newObjects.set(id, { ...existingObject, ...changes } as CanvasObject);
        }
      }
      return { objects: newObjects };
    });

    // Sync to Yjs
    ydoc.transact(() => {
      for (const { id, changes } of updates) {
        const yMap = yObjects.get(id);
        if (yMap) {
          for (const [key, value] of Object.entries(changes)) {
            yMap.set(key, value);
          }
        }
      }
    });
  },

  deleteObject: (id) => {
    // Skip if we're applying remote changes
    if (isApplyingRemoteChanges) {
      return;
    }

    // Push history before deleting object
    get().pushHistory();

    set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.delete(id);

      const newSelectedIds = new Set(state.selectedIds);
      newSelectedIds.delete(id);

      return { objects: newObjects, selectedIds: newSelectedIds };
    });

    // Sync to Yjs
    ydoc.transact(() => {
      yObjects.delete(id);
    });

    console.log(`[CanvasStore] Deleted object: ${id}`);
  },

  deleteSelectedObjects: () => {
    // Skip if we're applying remote changes
    if (isApplyingRemoteChanges) {
      return;
    }

    const state = get();
    const idsToDelete = Array.from(state.selectedIds);
    if (idsToDelete.length === 0) {
      return;
    }

    // Push history once before deleting all selected objects
    get().pushHistory();

    set((state) => {
      const newObjects = new Map(state.objects);
      for (const id of idsToDelete) {
        newObjects.delete(id);
      }
      return { objects: newObjects, selectedIds: new Set() };
    });

    // Sync to Yjs
    ydoc.transact(() => {
      for (const id of idsToDelete) {
        yObjects.delete(id);
      }
    });

    console.log(`[CanvasStore] Deleted ${idsToDelete.length} selected objects`);
  },

  setSelection: (ids) =>
    set(() => ({
      selectedIds: new Set(ids),
    })),

  setViewport: (viewportUpdates) =>
    set((state) => ({
      viewport: { ...state.viewport, ...viewportUpdates },
    })),

  setActiveTool: (tool) =>
    set(() => ({
      activeTool: tool,
    })),

  reorderObject: (id, newZIndex) => {
    // Skip if we're applying remote changes
    if (isApplyingRemoteChanges) {
      return;
    }

    const state = get();
    const targetObject = state.objects.get(id);
    if (!targetObject) return;

    const oldZIndex = targetObject.zIndex;
    if (oldZIndex === newZIndex) return;

    // Push history before reordering
    get().pushHistory();

    const newObjects = new Map(state.objects);
    const zIndexUpdates: Array<{ id: string; zIndex: number }> = [];

    // Shift other objects' zIndex values to make room
    if (newZIndex > oldZIndex) {
      // Moving up: shift objects between old and new position down
      for (const [objId, obj] of newObjects) {
        if (obj.zIndex > oldZIndex && obj.zIndex <= newZIndex) {
          const newZ = obj.zIndex - 1;
          newObjects.set(objId, { ...obj, zIndex: newZ } as CanvasObject);
          zIndexUpdates.push({ id: objId, zIndex: newZ });
        }
      }
    } else {
      // Moving down: shift objects between new and old position up
      for (const [objId, obj] of newObjects) {
        if (obj.zIndex >= newZIndex && obj.zIndex < oldZIndex) {
          const newZ = obj.zIndex + 1;
          newObjects.set(objId, { ...obj, zIndex: newZ } as CanvasObject);
          zIndexUpdates.push({ id: objId, zIndex: newZ });
        }
      }
    }

    // Set the target object to its new position
    newObjects.set(id, { ...targetObject, zIndex: newZIndex } as CanvasObject);
    zIndexUpdates.push({ id, zIndex: newZIndex });

    set({ objects: newObjects });

    // Sync all zIndex changes to Yjs
    ydoc.transact(() => {
      for (const update of zIndexUpdates) {
        const yMap = yObjects.get(update.id);
        if (yMap) {
          yMap.set('zIndex', update.zIndex);
        }
      }
    });
  },

  getNextZIndex: () => {
    const state = useCanvasStore.getState();
    let maxZIndex = -1;
    for (const obj of state.objects.values()) {
      if (obj.zIndex > maxZIndex) {
        maxZIndex = obj.zIndex;
      }
    }
    return maxZIndex + 1;
  },

  setCursorPosition: (position) =>
    set(() => ({
      cursorPosition: position,
    })),

  // History actions
  pushHistory: () => {
    const state = get();
    // Don't push history if we're currently doing undo/redo or applying remote changes
    if (state.isUndoRedoing || isApplyingRemoteChanges) {
      return;
    }

    // Create snapshot of current objects state
    const snapshot: HistorySnapshot = {
      objects: Array.from(state.objects.entries()).map(([id, obj]) => [id, { ...obj }]),
    };

    // Truncate any "future" history if we're not at the end
    const newHistory = state.history.slice(0, state.historyIndex + 1);

    // Add the new snapshot
    newHistory.push(snapshot);

    // Trim to max size (keep most recent)
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift();
    }

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex < 0) {
      return; // Nothing to undo
    }

    set({ isUndoRedoing: true });

    try {
      // If we're at the latest state, save current state first so we can redo
      if (state.historyIndex === state.history.length - 1) {
        const currentSnapshot: HistorySnapshot = {
          objects: Array.from(state.objects.entries()).map(([id, obj]) => [id, { ...obj }]),
        };
        const newHistory = [...state.history, currentSnapshot];
        set({ history: newHistory });
      }

      // Get the previous state
      const targetIndex = state.historyIndex;
      const snapshot = state.history[targetIndex];

      // Restore the state
      const newObjects = new Map<string, CanvasObject>(snapshot.objects);

      // Sync to Yjs
      ydoc.transact(() => {
        // Delete objects that don't exist in the snapshot
        const snapshotIds = new Set(snapshot.objects.map(([id]) => id));
        yObjects.forEach((_, id) => {
          if (!snapshotIds.has(id)) {
            yObjects.delete(id);
          }
        });

        // Add/update objects from snapshot
        for (const [id, obj] of snapshot.objects) {
          const yMap = yObjects.get(id);
          if (yMap) {
            // Update existing
            const plainObj = objectToYjs(obj);
            for (const [key, value] of Object.entries(plainObj)) {
              yMap.set(key, value);
            }
          } else {
            // Add new
            const newYMap = new Y.Map<unknown>();
            const plainObj = objectToYjs(obj);
            for (const [key, value] of Object.entries(plainObj)) {
              newYMap.set(key, value);
            }
            yObjects.set(id, newYMap);
          }
        }
      });

      set({
        objects: newObjects,
        historyIndex: targetIndex - 1,
      });

      console.log(`[CanvasStore] Undo to history index ${targetIndex - 1}`);
    } finally {
      set({ isUndoRedoing: false });
    }
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 2) {
      return; // Nothing to redo
    }

    set({ isUndoRedoing: true });

    try {
      // Get the next state
      const targetIndex = state.historyIndex + 2;
      const snapshot = state.history[targetIndex];

      // Restore the state
      const newObjects = new Map<string, CanvasObject>(snapshot.objects);

      // Sync to Yjs
      ydoc.transact(() => {
        // Delete objects that don't exist in the snapshot
        const snapshotIds = new Set(snapshot.objects.map(([id]) => id));
        yObjects.forEach((_, id) => {
          if (!snapshotIds.has(id)) {
            yObjects.delete(id);
          }
        });

        // Add/update objects from snapshot
        for (const [id, obj] of snapshot.objects) {
          const yMap = yObjects.get(id);
          if (yMap) {
            // Update existing
            const plainObj = objectToYjs(obj);
            for (const [key, value] of Object.entries(plainObj)) {
              yMap.set(key, value);
            }
          } else {
            // Add new
            const newYMap = new Y.Map<unknown>();
            const plainObj = objectToYjs(obj);
            for (const [key, value] of Object.entries(plainObj)) {
              newYMap.set(key, value);
            }
            yObjects.set(id, newYMap);
          }
        }
      });

      set({
        objects: newObjects,
        historyIndex: targetIndex - 1,
      });

      console.log(`[CanvasStore] Redo to history index ${targetIndex - 1}`);
    } finally {
      set({ isUndoRedoing: false });
    }
  },

  canUndo: () => {
    const state = get();
    return state.historyIndex >= 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 2;
  },

  // Clipboard actions
  copySelection: () => {
    const state = get();
    if (state.selectedIds.size === 0) {
      return;
    }

    // Copy selected objects (deep clone)
    const copiedObjects: CanvasObject[] = [];
    for (const id of state.selectedIds) {
      const obj = state.objects.get(id);
      if (obj) {
        copiedObjects.push(JSON.parse(JSON.stringify(obj)));
      }
    }

    set({ clipboard: copiedObjects });
    console.log(`[CanvasStore] Copied ${copiedObjects.length} objects to clipboard`);
  },

  paste: () => {
    const state = get();
    if (state.clipboard.length === 0) {
      return;
    }

    // Push history before pasting
    get().pushHistory();

    const newIds: string[] = [];
    let nextZIndex = get().getNextZIndex();

    for (const clipObj of state.clipboard) {
      // Create new ID and apply offset
      const newId = crypto.randomUUID();
      const newObj: CanvasObject = {
        ...clipObj,
        id: newId,
        x: clipObj.x + 10,
        y: clipObj.y + 10,
        zIndex: nextZIndex++,
      };

      // Add to local state
      set((s) => {
        const newObjects = new Map(s.objects);
        newObjects.set(newId, newObj);
        return { objects: newObjects };
      });

      // Sync to Yjs
      ydoc.transact(() => {
        const yMap = new Y.Map<unknown>();
        const plainObj = objectToYjs(newObj);
        for (const [key, value] of Object.entries(plainObj)) {
          yMap.set(key, value);
        }
        yObjects.set(newId, yMap);
      });

      newIds.push(newId);
    }

    // Update clipboard with new positions (for successive pastes)
    const updatedClipboard = state.clipboard.map((obj) => ({
      ...obj,
      x: obj.x + 10,
      y: obj.y + 10,
    }));

    // Select pasted objects
    set({ selectedIds: new Set(newIds), clipboard: updatedClipboard });

    console.log(`[CanvasStore] Pasted ${newIds.length} objects`);
  },

  duplicate: () => {
    const state = get();
    if (state.selectedIds.size === 0) {
      return;
    }

    // Push history before duplicating
    get().pushHistory();

    const newIds: string[] = [];
    let nextZIndex = get().getNextZIndex();

    for (const id of state.selectedIds) {
      const obj = state.objects.get(id);
      if (!obj) continue;

      // Create new ID - duplicate in place (no offset)
      const newId = crypto.randomUUID();
      const newObj: CanvasObject = {
        ...JSON.parse(JSON.stringify(obj)),
        id: newId,
        zIndex: nextZIndex++,
      };

      // Add to local state
      set((s) => {
        const newObjects = new Map(s.objects);
        newObjects.set(newId, newObj);
        return { objects: newObjects };
      });

      // Sync to Yjs
      ydoc.transact(() => {
        const yMap = new Y.Map<unknown>();
        const plainObj = objectToYjs(newObj);
        for (const [key, value] of Object.entries(plainObj)) {
          yMap.set(key, value);
        }
        yObjects.set(newId, yMap);
      });

      newIds.push(newId);
    }

    // Select duplicated objects
    set({ selectedIds: new Set(newIds) });

    console.log(`[CanvasStore] Duplicated ${newIds.length} objects`);
  },
}));
