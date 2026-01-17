import { create } from 'zustand';
import * as Y from 'yjs';
import type { CanvasObject, Viewport, ToolType } from '../types/canvas';
import { ydoc } from './collaborationStore';

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

  // Actions
  addObject: (object: CanvasObject) => void;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  updateObjects: (updates: Array<{ id: string; changes: Partial<CanvasObject> }>) => void;
  deleteObject: (id: string) => void;
  setSelection: (ids: string[]) => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  setActiveTool: (tool: ToolType) => void;
  reorderObject: (id: string, newZIndex: number) => void;
  getNextZIndex: () => number;
  setCursorPosition: (position: { x: number; y: number } | null) => void;
  initializeYjsSync: () => void;
}

// Get Yjs shared types for objects
const yObjects = ydoc.getMap<Y.Map<unknown>>('objects');

// Flag to prevent sync loops - when we're applying remote changes, don't sync back
let isApplyingRemoteChanges = false;

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
}));
