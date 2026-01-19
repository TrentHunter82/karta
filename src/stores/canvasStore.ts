import { create } from 'zustand';
import * as Y from 'yjs';
import type { CanvasObject, Viewport, ToolType, GroupObject } from '../types/canvas';
import { getYdoc } from './collaborationStore';
import { useToastStore } from './toastStore';
import { QuadTree, type Bounds } from '../utils/quadtree';

// Serializable snapshot of canvas state for history
interface HistorySnapshot {
  objects: Array<[string, CanvasObject]>;
}

// Helper to calculate bounding box of objects
const calculateBoundingBox = (objects: CanvasObject[]): { x: number; y: number; width: number; height: number } => {
  if (objects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  objects.forEach(obj => {
    minX = Math.min(minX, obj.x);
    minY = Math.min(minY, obj.y);
    maxX = Math.max(maxX, obj.x + obj.width);
    maxY = Math.max(maxY, obj.y + obj.height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

interface CanvasState {
  // State
  objects: Map<string, CanvasObject>;
  selectedIds: Set<string>;
  viewport: Viewport;
  activeTool: ToolType;
  cursorPosition: { x: number; y: number } | null;
  showMinimap: boolean;

  // Yjs sync state
  isInitialized: boolean;
  isSyncing: boolean;
  isApplyingRemoteChanges: boolean;

  // History state for undo/redo
  history: HistorySnapshot[];
  historyIndex: number;
  isUndoRedoing: boolean;

  // Clipboard state for copy/paste
  clipboard: CanvasObject[];

  // Group editing state
  editingGroupId: string | null;

  // Spatial indexing for performance
  spatialIndex: QuadTree<CanvasObject & Bounds> | null;

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
  resetYjsSync: () => void;

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

  // Alignment and distribution actions
  alignObjects: (alignment: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => void;
  distributeObjects: (direction: 'horizontal' | 'vertical') => void;

  // Grouping actions
  groupSelection: () => void;
  ungroupSelection: () => void;
  enterGroupEditMode: (groupId: string) => void;
  exitGroupEditMode: () => void;
  getAbsolutePosition: (obj: CanvasObject) => { x: number; y: number };

  // Zoom actions
  zoomToFit: () => void;
  zoomToSelection: () => void;
  setZoomPreset: (zoom: number) => void;
  toggleMinimap: () => void;

  // Spatial indexing actions
  rebuildSpatialIndex: () => void;
  querySpatialIndex: (bounds: Bounds) => CanvasObject[];
}

// Get Yjs shared types for objects (using getter to always get current ydoc after reconnection)
const getYObjects = () => getYdoc().getMap<Y.Map<unknown>>('objects');

// History configuration
const MAX_HISTORY_SIZE = 50;

// Debounced Yjs sync configuration
const SYNC_DEBOUNCE_MS = 50; // Batch updates within 50ms window
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingUpdates: Map<string, Record<string, unknown>> = new Map();

// Queue an update for debounced Yjs sync
const queueYjsUpdate = (id: string, changes: Record<string, unknown>) => {
  // Merge with pending updates for same object
  const existing = pendingUpdates.get(id) || {};
  pendingUpdates.set(id, { ...existing, ...changes });

  // Debounce sync
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    flushYjsUpdates();
  }, SYNC_DEBOUNCE_MS);
};

// Flush all pending Yjs updates in a single transaction
const flushYjsUpdates = () => {
  if (pendingUpdates.size === 0) return;

  const updates = new Map(pendingUpdates);
  pendingUpdates.clear();
  syncTimeout = null;

  // Batch all updates in single transaction
  getYdoc().transact(() => {
    updates.forEach((changes, id) => {
      const yMap = getYObjects().get(id);
      if (yMap) {
        Object.entries(changes).forEach(([key, value]) => {
          yMap.set(key, value);
        });
      }
    });
  });

  console.log(`[CanvasStore] Flushed ${updates.size} debounced Yjs updates`);
};

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

// Helper to validate object has required base properties
const isValidBaseObject = (obj: Record<string, unknown>): boolean => {
  return (
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number' &&
    typeof obj.rotation === 'number' &&
    typeof obj.opacity === 'number' &&
    typeof obj.zIndex === 'number'
  );
};

// Helper to validate type-specific properties
const isValidTypeSpecificProps = (obj: Record<string, unknown>): boolean => {
  switch (obj.type) {
    case 'rectangle':
    case 'ellipse':
      return true; // No additional required props
    case 'text':
      return (
        typeof obj.text === 'string' &&
        typeof obj.fontSize === 'number' &&
        typeof obj.fontFamily === 'string' &&
        (obj.textAlign === 'left' || obj.textAlign === 'center' || obj.textAlign === 'right')
      );
    case 'frame':
      return typeof obj.name === 'string';
    case 'path':
      return (
        Array.isArray(obj.points) &&
        obj.points.every((p: unknown) => {
          const point = p as Record<string, unknown>;
          return typeof point?.x === 'number' && typeof point?.y === 'number';
        })
      );
    case 'image':
    case 'video':
      return typeof obj.src === 'string';
    case 'group':
      return Array.isArray(obj.children);
    case 'line':
      return (
        typeof obj.x1 === 'number' &&
        typeof obj.y1 === 'number' &&
        typeof obj.x2 === 'number' &&
        typeof obj.y2 === 'number'
      );
    case 'arrow':
      return (
        typeof obj.x1 === 'number' &&
        typeof obj.y1 === 'number' &&
        typeof obj.x2 === 'number' &&
        typeof obj.y2 === 'number'
      );
    case 'polygon':
      return typeof obj.sides === 'number';
    case 'star':
      return typeof obj.points === 'number' && typeof obj.innerRadius === 'number';
    default:
      return false; // Unknown type
  }
};

// Helper to convert Yjs map to CanvasObject with runtime validation
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

  // Validate required base fields
  if (!isValidBaseObject(obj)) {
    console.warn('[CanvasStore] Invalid object from Yjs: missing or invalid base properties', obj.id);
    return null;
  }

  // Validate type-specific fields
  if (!isValidTypeSpecificProps(obj)) {
    console.warn('[CanvasStore] Invalid object from Yjs: missing or invalid type-specific properties', obj.id, obj.type);
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
  showMinimap: false,
  isInitialized: false,
  isSyncing: false,
  isApplyingRemoteChanges: false,

  // History state
  history: [],
  historyIndex: -1,
  isUndoRedoing: false,

  // Clipboard state
  clipboard: [],

  // Group editing state
  editingGroupId: null,

  // Spatial index initial state
  spatialIndex: null,

  // Initialize Yjs synchronization
  initializeYjsSync: () => {
    const state = get();
    if (state.isInitialized) return;

    console.log('[CanvasStore] Initializing Yjs sync...');

    // Load existing objects from Yjs
    const initialObjects = new Map<string, CanvasObject>();
    getYObjects().forEach((yMap, id) => {
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

    // Rebuild spatial index after loading objects
    get().rebuildSpatialIndex();

    // Observe changes from Yjs (remote changes)
    getYObjects().observe((event) => {
      // Skip if we're the origin of this change
      if (event.transaction.local) {
        return;
      }

      console.log('[CanvasStore] Received remote Yjs changes');
      set({ isApplyingRemoteChanges: true });

      try {
        const currentState = get();
        const newObjects = new Map(currentState.objects);

        event.changes.keys.forEach((change, key) => {
          if (change.action === 'add' || change.action === 'update') {
            const yMap = getYObjects().get(key);
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
        // Rebuild spatial index after remote changes
        get().rebuildSpatialIndex();
      } finally {
        set({ isApplyingRemoteChanges: false });
      }
    });

    // Also observe deep changes within each object's Y.Map
    getYObjects().observeDeep((events) => {
      // Skip if we're the origin of this change or applying remote changes
      if (events[0]?.transaction.local || get().isApplyingRemoteChanges) {
        return;
      }

      console.log('[CanvasStore] Received deep remote Yjs changes');
      set({ isApplyingRemoteChanges: true });

      try {
        const currentState = get();
        const newObjects = new Map(currentState.objects);

        // Find which objects were updated
        const updatedIds = new Set<string>();
        const yObjectsRef = getYObjects();
        for (const event of events) {
          // Walk up to find the object ID
          let target = event.target;
          while (target && target.parent && target.parent !== yObjectsRef) {
            target = target.parent;
          }
          // Get the key in yObjects
          if (target && target.parent === yObjectsRef) {
            yObjectsRef.forEach((yMap, id) => {
              if (yMap === target) {
                updatedIds.add(id);
              }
            });
          }
        }

        // Reload updated objects
        for (const id of updatedIds) {
          const yMap = getYObjects().get(id);
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
          // Rebuild spatial index after deep remote changes
          get().rebuildSpatialIndex();
        }
      } finally {
        set({ isApplyingRemoteChanges: false });
      }
    });
  },

  // Reset Yjs sync state for reconnection
  resetYjsSync: () => {
    console.log('[CanvasStore] Resetting Yjs sync state...');
    set({
      isInitialized: false,
      objects: new Map(),
      selectedIds: new Set(),
      history: [],
      historyIndex: -1,
    });
  },

  // Actions
  addObject: (object) => {
    // Skip if we're applying remote changes
    if (get().isApplyingRemoteChanges) {
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
    getYdoc().transact(() => {
      const yMap = new Y.Map<unknown>();
      const plainObj = objectToYjs(object);
      for (const [key, value] of Object.entries(plainObj)) {
        yMap.set(key, value);
      }
      getYObjects().set(object.id, yMap);
    });

    console.log(`[CanvasStore] Added object: ${object.id}`, { type: object.type, width: object.width, height: object.height });

    // Update spatial index
    get().rebuildSpatialIndex();
  },

  updateObject: (id, updates) => {
    // Skip if we're applying remote changes
    if (get().isApplyingRemoteChanges) {
      return;
    }

    const state = get();
    const existingObject = state.objects.get(id);
    if (!existingObject) return;

    // Log dimension updates for debugging
    if ('width' in updates || 'height' in updates) {
      console.log(`[CanvasStore] updateObject dimensions:`, { id, oldWidth: existingObject.width, oldHeight: existingObject.height, newWidth: updates.width, newHeight: updates.height });
    }

    const updatedObject = { ...existingObject, ...updates } as CanvasObject;

    set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.set(id, updatedObject);
      return { objects: newObjects };
    });

    // Queue debounced Yjs sync
    queueYjsUpdate(id, updates);
  },

  updateObjects: (updates) => {
    // Skip if we're applying remote changes
    if (get().isApplyingRemoteChanges) {
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

    // Queue debounced Yjs sync for all updates
    for (const { id, changes } of updates) {
      queueYjsUpdate(id, changes);
    }
  },

  deleteObject: (id) => {
    // Skip if we're applying remote changes
    if (get().isApplyingRemoteChanges) {
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
    getYdoc().transact(() => {
      getYObjects().delete(id);
    });

    console.log(`[CanvasStore] Deleted object: ${id}`);

    // Update spatial index
    get().rebuildSpatialIndex();
  },

  deleteSelectedObjects: () => {
    // Skip if we're applying remote changes
    if (get().isApplyingRemoteChanges) {
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
    getYdoc().transact(() => {
      for (const id of idsToDelete) {
        getYObjects().delete(id);
      }
    });

    // Show toast notification
    const count = idsToDelete.length;
    useToastStore.getState().addToast({
      message: `Deleted ${count} object${count > 1 ? 's' : ''}`,
      type: 'info'
    });

    console.log(`[CanvasStore] Deleted ${idsToDelete.length} selected objects`);

    // Update spatial index
    get().rebuildSpatialIndex();
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
    if (get().isApplyingRemoteChanges) {
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
    getYdoc().transact(() => {
      for (const update of zIndexUpdates) {
        const yMap = getYObjects().get(update.id);
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
    if (state.isUndoRedoing || state.isApplyingRemoteChanges) {
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
      getYdoc().transact(() => {
        // Delete objects that don't exist in the snapshot
        const snapshotIds = new Set(snapshot.objects.map(([id]) => id));
        getYObjects().forEach((_, id) => {
          if (!snapshotIds.has(id)) {
            getYObjects().delete(id);
          }
        });

        // Add/update objects from snapshot
        for (const [id, obj] of snapshot.objects) {
          const yMap = getYObjects().get(id);
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
            getYObjects().set(id, newYMap);
          }
        }
      });

      set({
        objects: newObjects,
        historyIndex: targetIndex - 1,
      });

      // Show toast notification
      useToastStore.getState().addToast({
        message: 'Undid changes',
        type: 'info',
        duration: 2000
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
      getYdoc().transact(() => {
        // Delete objects that don't exist in the snapshot
        const snapshotIds = new Set(snapshot.objects.map(([id]) => id));
        getYObjects().forEach((_, id) => {
          if (!snapshotIds.has(id)) {
            getYObjects().delete(id);
          }
        });

        // Add/update objects from snapshot
        for (const [id, obj] of snapshot.objects) {
          const yMap = getYObjects().get(id);
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
            getYObjects().set(id, newYMap);
          }
        }
      });

      set({
        objects: newObjects,
        historyIndex: targetIndex - 1,
      });

      // Show toast notification
      useToastStore.getState().addToast({
        message: 'Redid changes',
        type: 'info',
        duration: 2000
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

    // Show toast notification
    const count = copiedObjects.length;
    useToastStore.getState().addToast({
      message: `Copied ${count} object${count > 1 ? 's' : ''}`,
      type: 'info'
    });

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
      getYdoc().transact(() => {
        const yMap = new Y.Map<unknown>();
        const plainObj = objectToYjs(newObj);
        for (const [key, value] of Object.entries(plainObj)) {
          yMap.set(key, value);
        }
        getYObjects().set(newId, yMap);
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

    // Show toast notification
    const count = newIds.length;
    useToastStore.getState().addToast({
      message: `Pasted ${count} object${count > 1 ? 's' : ''}`,
      type: 'success'
    });

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
      getYdoc().transact(() => {
        const yMap = new Y.Map<unknown>();
        const plainObj = objectToYjs(newObj);
        for (const [key, value] of Object.entries(plainObj)) {
          yMap.set(key, value);
        }
        getYObjects().set(newId, yMap);
      });

      newIds.push(newId);
    }

    // Select duplicated objects
    set({ selectedIds: new Set(newIds) });

    // Show toast notification
    const count = newIds.length;
    useToastStore.getState().addToast({
      message: `Duplicated ${count} object${count > 1 ? 's' : ''}`,
      type: 'success'
    });

    console.log(`[CanvasStore] Duplicated ${newIds.length} objects`);
  },

  // Alignment and distribution actions
  alignObjects: (alignment) => {
    // Skip if we're applying remote changes
    if (get().isApplyingRemoteChanges) {
      return;
    }

    const state = get();
    const selectedObjects = Array.from(state.selectedIds)
      .map(id => state.objects.get(id))
      .filter((obj): obj is CanvasObject => obj !== undefined);

    if (selectedObjects.length < 2) return;

    // Push history before aligning
    get().pushHistory();

    // Helper to get rotated bounding box
    const getRotatedBounds = (obj: CanvasObject): { minX: number; maxX: number; minY: number; maxY: number } => {
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      const angle = (obj.rotation || 0) * Math.PI / 180;

      if (angle === 0) {
        return {
          minX: obj.x,
          maxX: obj.x + obj.width,
          minY: obj.y,
          maxY: obj.y + obj.height
        };
      }

      const corners = [
        { x: obj.x, y: obj.y },
        { x: obj.x + obj.width, y: obj.y },
        { x: obj.x + obj.width, y: obj.y + obj.height },
        { x: obj.x, y: obj.y + obj.height }
      ].map(corner => {
        const dx = corner.x - cx;
        const dy = corner.y - cy;
        return {
          x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
          y: cy + dx * Math.sin(angle) + dy * Math.cos(angle)
        };
      });

      return {
        minX: Math.min(...corners.map(c => c.x)),
        maxX: Math.max(...corners.map(c => c.x)),
        minY: Math.min(...corners.map(c => c.y)),
        maxY: Math.max(...corners.map(c => c.y))
      };
    };

    let updates: Array<{ id: string; changes: Partial<CanvasObject> }> = [];

    switch (alignment) {
      case 'left': {
        const minX = Math.min(...selectedObjects.map(obj => getRotatedBounds(obj).minX));
        updates = selectedObjects.map(obj => {
          const bounds = getRotatedBounds(obj);
          const offset = bounds.minX - obj.x;
          return {
            id: obj.id,
            changes: { x: minX - offset }
          };
        });
        break;
      }
      case 'right': {
        const maxX = Math.max(...selectedObjects.map(obj => getRotatedBounds(obj).maxX));
        updates = selectedObjects.map(obj => {
          const bounds = getRotatedBounds(obj);
          const offset = bounds.maxX - obj.x;
          return {
            id: obj.id,
            changes: { x: maxX - offset }
          };
        });
        break;
      }
      case 'top': {
        const minY = Math.min(...selectedObjects.map(obj => getRotatedBounds(obj).minY));
        updates = selectedObjects.map(obj => {
          const bounds = getRotatedBounds(obj);
          const offset = bounds.minY - obj.y;
          return {
            id: obj.id,
            changes: { y: minY - offset }
          };
        });
        break;
      }
      case 'bottom': {
        const maxY = Math.max(...selectedObjects.map(obj => getRotatedBounds(obj).maxY));
        updates = selectedObjects.map(obj => {
          const bounds = getRotatedBounds(obj);
          const offset = bounds.maxY - obj.y;
          return {
            id: obj.id,
            changes: { y: maxY - offset }
          };
        });
        break;
      }
      case 'centerH': {
        const centers = selectedObjects.map(obj => {
          const bounds = getRotatedBounds(obj);
          return (bounds.minX + bounds.maxX) / 2;
        });
        const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
        updates = selectedObjects.map(obj => {
          const bounds = getRotatedBounds(obj);
          const currentCenter = (bounds.minX + bounds.maxX) / 2;
          const offset = currentCenter - obj.x;
          return {
            id: obj.id,
            changes: { x: avgCenter - offset }
          };
        });
        break;
      }
      case 'centerV': {
        const centers = selectedObjects.map(obj => {
          const bounds = getRotatedBounds(obj);
          return (bounds.minY + bounds.maxY) / 2;
        });
        const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
        updates = selectedObjects.map(obj => {
          const bounds = getRotatedBounds(obj);
          const currentCenter = (bounds.minY + bounds.maxY) / 2;
          const offset = currentCenter - obj.y;
          return {
            id: obj.id,
            changes: { y: avgCenter - offset }
          };
        });
        break;
      }
    }

    // Update local state
    set((s) => {
      const newObjects = new Map(s.objects);
      for (const { id, changes } of updates) {
        const existingObject = newObjects.get(id);
        if (existingObject) {
          newObjects.set(id, { ...existingObject, ...changes } as CanvasObject);
        }
      }
      return { objects: newObjects };
    });

    // Sync to Yjs
    getYdoc().transact(() => {
      for (const { id, changes } of updates) {
        const yMap = getYObjects().get(id);
        if (yMap) {
          for (const [key, value] of Object.entries(changes)) {
            yMap.set(key, value);
          }
        }
      }
    });

    console.log(`[CanvasStore] Aligned ${updates.length} objects: ${alignment}`);
  },

  distributeObjects: (direction) => {
    // Skip if we're applying remote changes
    if (get().isApplyingRemoteChanges) {
      return;
    }

    const state = get();
    const selectedObjects = Array.from(state.selectedIds)
      .map(id => state.objects.get(id))
      .filter((obj): obj is CanvasObject => obj !== undefined);

    if (selectedObjects.length < 3) return;

    // Push history before distributing
    get().pushHistory();

    // Helper to get rotated bounding box
    const getRotatedBounds = (obj: CanvasObject): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } => {
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      const angle = (obj.rotation || 0) * Math.PI / 180;

      if (angle === 0) {
        return {
          minX: obj.x,
          maxX: obj.x + obj.width,
          minY: obj.y,
          maxY: obj.y + obj.height,
          width: obj.width,
          height: obj.height
        };
      }

      const corners = [
        { x: obj.x, y: obj.y },
        { x: obj.x + obj.width, y: obj.y },
        { x: obj.x + obj.width, y: obj.y + obj.height },
        { x: obj.x, y: obj.y + obj.height }
      ].map(corner => {
        const dx = corner.x - cx;
        const dy = corner.y - cy;
        return {
          x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
          y: cy + dx * Math.sin(angle) + dy * Math.cos(angle)
        };
      });

      const minX = Math.min(...corners.map(c => c.x));
      const maxX = Math.max(...corners.map(c => c.x));
      const minY = Math.min(...corners.map(c => c.y));
      const maxY = Math.max(...corners.map(c => c.y));

      return {
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX,
        height: maxY - minY
      };
    };

    let updates: Array<{ id: string; changes: Partial<CanvasObject> }> = [];

    if (direction === 'horizontal') {
      // Sort by X position (using bounding box)
      const sortedObjects = [...selectedObjects].sort((a, b) => {
        return getRotatedBounds(a).minX - getRotatedBounds(b).minX;
      });

      const first = sortedObjects[0];
      const last = sortedObjects[sortedObjects.length - 1];
      const firstBounds = getRotatedBounds(first);
      const lastBounds = getRotatedBounds(last);

      // Calculate total width of all objects (using bounding boxes)
      const totalObjectWidth = sortedObjects.reduce((sum, obj) => sum + getRotatedBounds(obj).width, 0);

      // Calculate available space for gaps
      const totalSpace = lastBounds.maxX - firstBounds.minX;
      const gapSpace = totalSpace - totalObjectWidth;
      const gap = gapSpace / (sortedObjects.length - 1);

      // Position each object
      let currentX = firstBounds.minX;
      updates = sortedObjects.map(obj => {
        const bounds = getRotatedBounds(obj);
        const offset = bounds.minX - obj.x;
        const update = { id: obj.id, changes: { x: currentX - offset } };
        currentX += bounds.width + gap;
        return update;
      });
    } else {
      // Sort by Y position (using bounding box)
      const sortedObjects = [...selectedObjects].sort((a, b) => {
        return getRotatedBounds(a).minY - getRotatedBounds(b).minY;
      });

      const first = sortedObjects[0];
      const last = sortedObjects[sortedObjects.length - 1];
      const firstBounds = getRotatedBounds(first);
      const lastBounds = getRotatedBounds(last);

      // Calculate total height of all objects (using bounding boxes)
      const totalObjectHeight = sortedObjects.reduce((sum, obj) => sum + getRotatedBounds(obj).height, 0);

      // Calculate available space for gaps
      const totalSpace = lastBounds.maxY - firstBounds.minY;
      const gapSpace = totalSpace - totalObjectHeight;
      const gap = gapSpace / (sortedObjects.length - 1);

      // Position each object
      let currentY = firstBounds.minY;
      updates = sortedObjects.map(obj => {
        const bounds = getRotatedBounds(obj);
        const offset = bounds.minY - obj.y;
        const update = { id: obj.id, changes: { y: currentY - offset } };
        currentY += bounds.height + gap;
        return update;
      });
    }

    // Update local state
    set((s) => {
      const newObjects = new Map(s.objects);
      for (const { id, changes } of updates) {
        const existingObject = newObjects.get(id);
        if (existingObject) {
          newObjects.set(id, { ...existingObject, ...changes } as CanvasObject);
        }
      }
      return { objects: newObjects };
    });

    // Sync to Yjs
    getYdoc().transact(() => {
      for (const { id, changes } of updates) {
        const yMap = getYObjects().get(id);
        if (yMap) {
          for (const [key, value] of Object.entries(changes)) {
            yMap.set(key, value);
          }
        }
      }
    });

    console.log(`[CanvasStore] Distributed ${updates.length} objects: ${direction}`);
  },

  // Grouping actions
  getAbsolutePosition: (obj: CanvasObject) => {
    const state = get();
    if (!obj.parentId) {
      return { x: obj.x, y: obj.y };
    }

    const parent = state.objects.get(obj.parentId);
    if (!parent) {
      return { x: obj.x, y: obj.y };
    }

    const parentPos = state.getAbsolutePosition(parent);
    return {
      x: parentPos.x + obj.x,
      y: parentPos.y + obj.y
    };
  },

  groupSelection: () => {
    const state = get();
    const selectedIds = Array.from(state.selectedIds);

    if (selectedIds.length < 2) {
      useToastStore.getState().addToast({
        message: 'Select at least 2 objects to group',
        type: 'info'
      });
      return;
    }

    // Skip if we're applying remote changes
    if (state.isApplyingRemoteChanges) {
      return;
    }

    state.pushHistory();

    // Get selected objects
    const selectedObjects = selectedIds
      .map(id => state.objects.get(id))
      .filter((obj): obj is CanvasObject => obj !== undefined);

    // Calculate bounding box of all selected objects (using absolute positions)
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedObjects.forEach(obj => {
      const absPos = state.getAbsolutePosition(obj);
      minX = Math.min(minX, absPos.x);
      minY = Math.min(minY, absPos.y);
      maxX = Math.max(maxX, absPos.x + obj.width);
      maxY = Math.max(maxY, absPos.y + obj.height);
    });

    const bounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };

    // Create group object
    const groupId = crypto.randomUUID();
    const group: GroupObject = {
      id: groupId,
      type: 'group',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      rotation: 0,
      opacity: 1,
      zIndex: state.getNextZIndex(),
      children: selectedIds,
      visible: true,
      locked: false
    };

    // Update local state
    const newObjects = new Map(state.objects);
    newObjects.set(groupId, group);

    // Update children to store relative positions and set parentId
    selectedIds.forEach(id => {
      const obj = newObjects.get(id);
      if (obj) {
        const absPos = state.getAbsolutePosition(obj);
        newObjects.set(id, {
          ...obj,
          parentId: groupId,
          // Convert to relative position within group
          x: absPos.x - bounds.x,
          y: absPos.y - bounds.y
        });
      }
    });

    set({
      objects: newObjects,
      selectedIds: new Set([groupId])
    });

    // Sync to Yjs
    getYdoc().transact(() => {
      // Add group object
      const yGroupMap = new Y.Map<unknown>();
      const plainGroup = objectToYjs(group);
      for (const [key, value] of Object.entries(plainGroup)) {
        yGroupMap.set(key, value);
      }
      getYObjects().set(groupId, yGroupMap);

      // Update children
      selectedIds.forEach(id => {
        const yMap = getYObjects().get(id);
        const localObj = newObjects.get(id);
        if (yMap && localObj) {
          yMap.set('parentId', groupId);
          yMap.set('x', localObj.x);
          yMap.set('y', localObj.y);
        }
      });
    });

    useToastStore.getState().addToast({
      message: `Grouped ${selectedIds.length} objects`,
      type: 'success'
    });

    console.log(`[CanvasStore] Created group with ${selectedIds.length} children`);
  },

  ungroupSelection: () => {
    const state = get();
    const selectedIds = Array.from(state.selectedIds);

    // Skip if we're applying remote changes
    if (state.isApplyingRemoteChanges) {
      return;
    }

    // Check if any selected objects are groups
    const groupsToUngroup = selectedIds.filter(id => {
      const obj = state.objects.get(id);
      return obj?.type === 'group';
    });

    if (groupsToUngroup.length === 0) {
      useToastStore.getState().addToast({
        message: 'No groups selected to ungroup',
        type: 'info'
      });
      return;
    }

    state.pushHistory();

    const newObjects = new Map(state.objects);
    const newSelectedIds = new Set<string>();

    selectedIds.forEach(id => {
      const obj = state.objects.get(id);
      if (obj?.type === 'group') {
        const group = obj as GroupObject;

        // Get group's absolute position
        const groupAbsPos = state.getAbsolutePosition(group);

        // Convert children back to absolute positions
        group.children.forEach(childId => {
          const child = newObjects.get(childId);
          if (child) {
            newObjects.set(childId, {
              ...child,
              x: child.x + groupAbsPos.x,
              y: child.y + groupAbsPos.y,
              parentId: undefined
            });
            newSelectedIds.add(childId);
          }
        });

        // Remove the group object
        newObjects.delete(id);
      } else {
        newSelectedIds.add(id);
      }
    });

    set({
      objects: newObjects,
      selectedIds: newSelectedIds
    });

    // Sync to Yjs
    getYdoc().transact(() => {
      groupsToUngroup.forEach(groupId => {
        const group = state.objects.get(groupId) as GroupObject | undefined;
        if (group) {
          // Update children
          group.children.forEach(childId => {
            const yMap = getYObjects().get(childId);
            const localObj = newObjects.get(childId);
            if (yMap && localObj) {
              yMap.set('x', localObj.x);
              yMap.set('y', localObj.y);
              yMap.delete('parentId');
            }
          });

          // Delete the group
          getYObjects().delete(groupId);
        }
      });
    });

    useToastStore.getState().addToast({
      message: `Ungrouped ${groupsToUngroup.length} group${groupsToUngroup.length > 1 ? 's' : ''}`,
      type: 'success'
    });

    console.log(`[CanvasStore] Ungrouped ${groupsToUngroup.length} groups`);
  },

  enterGroupEditMode: (groupId: string) => {
    const state = get();
    const group = state.objects.get(groupId);
    if (group?.type !== 'group') {
      return;
    }

    set({
      editingGroupId: groupId,
      selectedIds: new Set() // Clear selection when entering edit mode
    });

    console.log(`[CanvasStore] Entered group edit mode for ${groupId}`);
  },

  exitGroupEditMode: () => {
    const state = get();
    if (!state.editingGroupId) {
      return;
    }

    // Select the group when exiting edit mode
    set({
      editingGroupId: null,
      selectedIds: new Set([state.editingGroupId])
    });

    console.log(`[CanvasStore] Exited group edit mode`);
  },

  // Zoom actions
  zoomToFit: () => {
    const state = get();
    const objects = Array.from(state.objects.values());

    if (objects.length === 0) {
      // Reset to center with 100% zoom
      set({ viewport: { x: 0, y: 0, zoom: 1 } });
      return;
    }

    // Calculate bounding box of all objects
    const bounds = calculateBoundingBox(objects);

    // Get canvas dimensions (subtract toolbar + properties panel width and topbar + statusbar height)
    const canvasWidth = window.innerWidth - 260;
    const canvasHeight = window.innerHeight - 80;

    // Calculate zoom to fit with padding
    const padding = 50;
    const scaleX = (canvasWidth - padding * 2) / bounds.width;
    const scaleY = (canvasHeight - padding * 2) / bounds.height;
    const zoom = Math.min(scaleX, scaleY, 5); // Cap at 500%

    // Calculate center position
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    // Set viewport to center content
    const viewportX = -centerX + (canvasWidth / 2) / zoom;
    const viewportY = -centerY + (canvasHeight / 2) / zoom;

    set({
      viewport: {
        x: viewportX,
        y: viewportY,
        zoom: Math.max(0.1, Math.min(zoom, 5))
      }
    });

    console.log(`[CanvasStore] Zoom to fit: ${Math.round(zoom * 100)}%`);
  },

  zoomToSelection: () => {
    const state = get();
    const selectedObjects = Array.from(state.selectedIds)
      .map(id => state.objects.get(id))
      .filter((obj): obj is CanvasObject => obj !== undefined);

    if (selectedObjects.length === 0) {
      // Fall back to zoom to fit all
      get().zoomToFit();
      return;
    }

    const bounds = calculateBoundingBox(selectedObjects);

    // Get canvas dimensions
    const canvasWidth = window.innerWidth - 260;
    const canvasHeight = window.innerHeight - 80;
    const padding = 50;

    const scaleX = (canvasWidth - padding * 2) / bounds.width;
    const scaleY = (canvasHeight - padding * 2) / bounds.height;
    const zoom = Math.min(scaleX, scaleY, 5);

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    const viewportX = -centerX + (canvasWidth / 2) / zoom;
    const viewportY = -centerY + (canvasHeight / 2) / zoom;

    set({
      viewport: {
        x: viewportX,
        y: viewportY,
        zoom: Math.max(0.1, Math.min(zoom, 5))
      }
    });

    console.log(`[CanvasStore] Zoom to selection: ${Math.round(zoom * 100)}%`);
  },

  setZoomPreset: (zoom: number) => {
    const state = get();
    const { viewport } = state;

    // Get canvas dimensions
    const canvasWidth = window.innerWidth - 260;
    const canvasHeight = window.innerHeight - 80;

    // Calculate current center in canvas coordinates
    const centerX = -viewport.x + canvasWidth / 2 / viewport.zoom;
    const centerY = -viewport.y + canvasHeight / 2 / viewport.zoom;

    // Calculate new viewport to keep the center fixed
    const newX = -centerX + canvasWidth / 2 / zoom;
    const newY = -centerY + canvasHeight / 2 / zoom;

    set({
      viewport: {
        x: newX,
        y: newY,
        zoom: Math.max(0.1, Math.min(zoom, 5))
      }
    });

    console.log(`[CanvasStore] Set zoom preset: ${Math.round(zoom * 100)}%`);
  },

  toggleMinimap: () => {
    set((state) => ({
      showMinimap: !state.showMinimap
    }));
  },

  // Spatial indexing implementation
  rebuildSpatialIndex: () => {
    const state = get();
    const objects = Array.from(state.objects.values());

    if (objects.length === 0) {
      set({ spatialIndex: null });
      return;
    }

    // Calculate world bounds from all objects
    const bounds = calculateBoundingBox(objects);

    // Expand bounds for future objects (add padding)
    const expandedBounds: Bounds = {
      x: bounds.x - 1000,
      y: bounds.y - 1000,
      width: bounds.width + 2000,
      height: bounds.height + 2000
    };

    // Create new quadtree with expanded bounds
    const index = new QuadTree<CanvasObject & Bounds>(expandedBounds);

    // Insert all objects into the spatial index
    objects.forEach(obj => {
      // Add Bounds properties to CanvasObject
      const item = obj as CanvasObject & Bounds;
      index.insert(item);
    });

    set({ spatialIndex: index });
    console.log(`[CanvasStore] Rebuilt spatial index with ${objects.length} objects`);
  },

  querySpatialIndex: (bounds: Bounds): CanvasObject[] => {
    const state = get();
    if (!state.spatialIndex) {
      // Fallback to linear search if no spatial index
      return Array.from(state.objects.values()).filter(obj => {
        return !(
          obj.x + obj.width < bounds.x ||
          obj.x > bounds.x + bounds.width ||
          obj.y + obj.height < bounds.y ||
          obj.y > bounds.y + bounds.height
        );
      });
    }
    return state.spatialIndex.query(bounds) as CanvasObject[];
  },
}));
