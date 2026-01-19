import { create } from 'zustand';
import * as Y from 'yjs';
import type { CanvasObject, Viewport, ToolType } from '../types/canvas';
import { getYdoc } from './collaborationStore';
import { useToastStore } from './toastStore';
import { QuadTree, type Bounds } from '../utils/quadtree';
import { useHistoryStore } from './historyStore';
import { useClipboardStore } from './clipboardStore';
import { useViewportStore } from './viewportStore';
import { useSelectionStore, calculateAlignmentUpdates, calculateDistributionUpdates, type AlignmentType, type DistributionDirection } from './selectionStore';
import { useGroupStore, getAbsolutePosition, calculateGroupData, calculateUngroupData } from './groupStore';

interface CanvasState {
  // State
  objects: Map<string, CanvasObject>;
  activeTool: ToolType;
  cursorPosition: { x: number; y: number } | null;

  // Yjs sync state
  isInitialized: boolean;
  isSyncing: boolean;
  isApplyingRemoteChanges: boolean;

  // Spatial indexing for performance
  spatialIndex: QuadTree<CanvasObject & Bounds> | null;

  // Accessors for backward compatibility (delegate to other stores)
  readonly selectedIds: Set<string>;
  readonly viewport: Viewport;
  readonly showMinimap: boolean;
  readonly editingGroupId: string | null;

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
  alignObjects: (alignment: AlignmentType) => void;
  distributeObjects: (direction: DistributionDirection) => void;

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

// Get Yjs shared types for objects
const getYObjects = () => getYdoc().getMap<Y.Map<unknown>>('objects');

// Debounced Yjs sync configuration
const SYNC_DEBOUNCE_MS = 50;
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingUpdates: Map<string, Record<string, unknown>> = new Map();

const queueYjsUpdate = (id: string, changes: Record<string, unknown>) => {
  const existing = pendingUpdates.get(id) || {};
  pendingUpdates.set(id, { ...existing, ...changes });

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    flushYjsUpdates();
  }, SYNC_DEBOUNCE_MS);
};

const flushYjsUpdates = () => {
  if (pendingUpdates.size === 0) return;

  const updates = new Map(pendingUpdates);
  pendingUpdates.clear();
  syncTimeout = null;

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

const objectToYjs = (obj: CanvasObject): Record<string, unknown> => {
  const plainObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'points' && Array.isArray(value)) {
      plainObj[key] = value.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
    } else {
      plainObj[key] = value;
    }
  }
  return plainObj;
};

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

const isValidTypeSpecificProps = (obj: Record<string, unknown>): boolean => {
  switch (obj.type) {
    case 'rectangle':
    case 'ellipse':
      return true;
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
      return false;
  }
};

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

  if (!isValidBaseObject(obj)) {
    console.warn('[CanvasStore] Invalid object from Yjs: missing or invalid base properties', obj.id);
    return null;
  }

  if (!isValidTypeSpecificProps(obj)) {
    console.warn('[CanvasStore] Invalid object from Yjs: missing or invalid type-specific properties', obj.id, obj.type);
    return null;
  }

  return obj as unknown as CanvasObject;
};

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

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // Initial state
  objects: new Map(),
  activeTool: 'select',
  cursorPosition: null,
  isInitialized: false,
  isSyncing: false,
  isApplyingRemoteChanges: false,
  spatialIndex: null,

  // Backward compatible accessors
  get selectedIds() { return useSelectionStore.getState().selectedIds; },
  get viewport() { return useViewportStore.getState().viewport; },
  get showMinimap() { return useViewportStore.getState().showMinimap; },
  get editingGroupId() { return useGroupStore.getState().editingGroupId; },

  initializeYjsSync: () => {
    const state = get();
    if (state.isInitialized) return;

    console.log('[CanvasStore] Initializing Yjs sync...');

    const initialObjects = new Map<string, CanvasObject>();
    getYObjects().forEach((yMap, id) => {
      const obj = yjsToObject(yMap);
      if (obj) {
        initialObjects.set(id, obj);
      }
    });

    set({ objects: initialObjects, isInitialized: true });
    console.log(`[CanvasStore] Loaded ${initialObjects.size} objects from Yjs`);
    get().rebuildSpatialIndex();

    // Observe changes from Yjs (remote changes)
    getYObjects().observe((event) => {
      if (event.transaction.local) return;

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
              }
            }
          } else if (change.action === 'delete') {
            newObjects.delete(key);
          }
        });

        set({ objects: newObjects });
        get().rebuildSpatialIndex();
      } finally {
        set({ isApplyingRemoteChanges: false });
      }
    });

    // Observe deep changes within each object's Y.Map
    getYObjects().observeDeep((events) => {
      if (events[0]?.transaction.local || get().isApplyingRemoteChanges) return;

      console.log('[CanvasStore] Received deep remote Yjs changes');
      set({ isApplyingRemoteChanges: true });

      try {
        const currentState = get();
        const newObjects = new Map(currentState.objects);
        const updatedIds = new Set<string>();
        const yObjectsRef = getYObjects();

        for (const event of events) {
          let target = event.target;
          while (target && target.parent && target.parent !== yObjectsRef) {
            target = target.parent;
          }
          if (target && target.parent === yObjectsRef) {
            yObjectsRef.forEach((yMap, id) => {
              if (yMap === target) {
                updatedIds.add(id);
              }
            });
          }
        }

        for (const id of updatedIds) {
          const yMap = getYObjects().get(id);
          if (yMap) {
            const obj = yjsToObject(yMap);
            if (obj) {
              newObjects.set(id, obj);
            }
          }
        }

        if (updatedIds.size > 0) {
          set({ objects: newObjects });
          get().rebuildSpatialIndex();
        }
      } finally {
        set({ isApplyingRemoteChanges: false });
      }
    });
  },

  resetYjsSync: () => {
    console.log('[CanvasStore] Resetting Yjs sync state...');
    useHistoryStore.getState().clear();
    useSelectionStore.getState().clearSelection();
    set({ isInitialized: false, objects: new Map() });
  },

  addObject: (object) => {
    if (get().isApplyingRemoteChanges) return;

    get().pushHistory();

    set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.set(object.id, object);
      return { objects: newObjects };
    });

    getYdoc().transact(() => {
      const yMap = new Y.Map<unknown>();
      const plainObj = objectToYjs(object);
      for (const [key, value] of Object.entries(plainObj)) {
        yMap.set(key, value);
      }
      getYObjects().set(object.id, yMap);
    });

    console.log(`[CanvasStore] Added object: ${object.id}`, { type: object.type });
    get().rebuildSpatialIndex();
  },

  updateObject: (id, updates) => {
    if (get().isApplyingRemoteChanges) return;

    const state = get();
    const existingObject = state.objects.get(id);
    if (!existingObject) return;

    const updatedObject = { ...existingObject, ...updates } as CanvasObject;

    set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.set(id, updatedObject);
      return { objects: newObjects };
    });

    queueYjsUpdate(id, updates);
  },

  updateObjects: (updates) => {
    if (get().isApplyingRemoteChanges) return;

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

    for (const { id, changes } of updates) {
      queueYjsUpdate(id, changes);
    }
  },

  deleteObject: (id) => {
    if (get().isApplyingRemoteChanges) return;

    get().pushHistory();

    set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.delete(id);
      return { objects: newObjects };
    });

    useSelectionStore.getState().removeFromSelection([id]);

    getYdoc().transact(() => {
      getYObjects().delete(id);
    });

    console.log(`[CanvasStore] Deleted object: ${id}`);
    get().rebuildSpatialIndex();
  },

  deleteSelectedObjects: () => {
    if (get().isApplyingRemoteChanges) return;

    const selectedIds = useSelectionStore.getState().selectedIds;
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    get().pushHistory();

    set((state) => {
      const newObjects = new Map(state.objects);
      for (const id of idsToDelete) {
        newObjects.delete(id);
      }
      return { objects: newObjects };
    });

    useSelectionStore.getState().clearSelection();

    getYdoc().transact(() => {
      for (const id of idsToDelete) {
        getYObjects().delete(id);
      }
    });

    useToastStore.getState().addToast({
      message: `Deleted ${idsToDelete.length} object${idsToDelete.length > 1 ? 's' : ''}`,
      type: 'info'
    });

    get().rebuildSpatialIndex();
  },

  setSelection: (ids) => useSelectionStore.getState().setSelection(ids),

  setViewport: (updates) => useViewportStore.getState().setViewport(updates),

  setActiveTool: (tool) => set({ activeTool: tool }),

  reorderObject: (id, newZIndex) => {
    if (get().isApplyingRemoteChanges) return;

    const state = get();
    const targetObject = state.objects.get(id);
    if (!targetObject) return;

    const oldZIndex = targetObject.zIndex;
    if (oldZIndex === newZIndex) return;

    get().pushHistory();

    const newObjects = new Map(state.objects);
    const zIndexUpdates: Array<{ id: string; zIndex: number }> = [];

    if (newZIndex > oldZIndex) {
      for (const [objId, obj] of newObjects) {
        if (obj.zIndex > oldZIndex && obj.zIndex <= newZIndex) {
          const newZ = obj.zIndex - 1;
          newObjects.set(objId, { ...obj, zIndex: newZ } as CanvasObject);
          zIndexUpdates.push({ id: objId, zIndex: newZ });
        }
      }
    } else {
      for (const [objId, obj] of newObjects) {
        if (obj.zIndex >= newZIndex && obj.zIndex < oldZIndex) {
          const newZ = obj.zIndex + 1;
          newObjects.set(objId, { ...obj, zIndex: newZ } as CanvasObject);
          zIndexUpdates.push({ id: objId, zIndex: newZ });
        }
      }
    }

    newObjects.set(id, { ...targetObject, zIndex: newZIndex } as CanvasObject);
    zIndexUpdates.push({ id, zIndex: newZIndex });

    set({ objects: newObjects });

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

  setCursorPosition: (position) => set({ cursorPosition: position }),

  // History actions
  pushHistory: () => {
    const state = get();
    if (state.isApplyingRemoteChanges) return;
    useHistoryStore.getState().pushSnapshot(state.objects);
  },

  undo: () => {
    const historyStore = useHistoryStore.getState();
    if (!historyStore.canUndo()) return;

    historyStore.undo(
      () => get().objects,
      (newObjects) => {
        getYdoc().transact(() => {
          const snapshotIds = new Set(newObjects.keys());
          getYObjects().forEach((_, id) => {
            if (!snapshotIds.has(id)) {
              getYObjects().delete(id);
            }
          });

          for (const [id, obj] of newObjects) {
            const yMap = getYObjects().get(id);
            const plainObj = objectToYjs(obj);
            if (yMap) {
              for (const [key, value] of Object.entries(plainObj)) {
                yMap.set(key, value);
              }
            } else {
              const newYMap = new Y.Map<unknown>();
              for (const [key, value] of Object.entries(plainObj)) {
                newYMap.set(key, value);
              }
              getYObjects().set(id, newYMap);
            }
          }
        });

        set({ objects: newObjects });
      }
    );

    useToastStore.getState().addToast({ message: 'Undid changes', type: 'info', duration: 2000 });
  },

  redo: () => {
    const historyStore = useHistoryStore.getState();
    if (!historyStore.canRedo()) return;

    historyStore.redo(
      () => get().objects,
      (newObjects) => {
        getYdoc().transact(() => {
          const snapshotIds = new Set(newObjects.keys());
          getYObjects().forEach((_, id) => {
            if (!snapshotIds.has(id)) {
              getYObjects().delete(id);
            }
          });

          for (const [id, obj] of newObjects) {
            const yMap = getYObjects().get(id);
            const plainObj = objectToYjs(obj);
            if (yMap) {
              for (const [key, value] of Object.entries(plainObj)) {
                yMap.set(key, value);
              }
            } else {
              const newYMap = new Y.Map<unknown>();
              for (const [key, value] of Object.entries(plainObj)) {
                newYMap.set(key, value);
              }
              getYObjects().set(id, newYMap);
            }
          }
        });

        set({ objects: newObjects });
      }
    );

    useToastStore.getState().addToast({ message: 'Redid changes', type: 'info', duration: 2000 });
  },

  canUndo: () => useHistoryStore.getState().canUndo(),
  canRedo: () => useHistoryStore.getState().canRedo(),

  // Clipboard actions
  copySelection: () => {
    const state = get();
    const selectedIds = useSelectionStore.getState().selectedIds;
    if (selectedIds.size === 0) return;

    const selectedObjects: CanvasObject[] = [];
    for (const id of selectedIds) {
      const obj = state.objects.get(id);
      if (obj) selectedObjects.push(obj);
    }

    useClipboardStore.getState().copy(selectedObjects);
    useToastStore.getState().addToast({
      message: `Copied ${selectedObjects.length} object${selectedObjects.length > 1 ? 's' : ''}`,
      type: 'info'
    });
  },

  paste: () => {
    const clipboardStore = useClipboardStore.getState();
    if (!clipboardStore.hasItems()) return;

    get().pushHistory();

    clipboardStore.paste(
      () => get().getNextZIndex(),
      (newObjects) => {
        for (const newObj of newObjects) {
          set((s) => {
            const objs = new Map(s.objects);
            objs.set(newObj.id, newObj);
            return { objects: objs };
          });

          getYdoc().transact(() => {
            const yMap = new Y.Map<unknown>();
            const plainObj = objectToYjs(newObj);
            for (const [key, value] of Object.entries(plainObj)) {
              yMap.set(key, value);
            }
            getYObjects().set(newObj.id, yMap);
          });
        }
      },
      (ids) => useSelectionStore.getState().setSelection(ids)
    );

    useToastStore.getState().addToast({
      message: `Pasted ${clipboardStore.getItems().length} object${clipboardStore.getItems().length > 1 ? 's' : ''}`,
      type: 'success'
    });
  },

  duplicate: () => {
    const state = get();
    const selectedIds = useSelectionStore.getState().selectedIds;
    if (selectedIds.size === 0) return;

    get().pushHistory();

    const selectedObjects: CanvasObject[] = [];
    for (const id of selectedIds) {
      const obj = state.objects.get(id);
      if (obj) selectedObjects.push(obj);
    }

    useClipboardStore.getState().duplicate(
      selectedObjects,
      () => get().getNextZIndex(),
      (newObjects) => {
        for (const newObj of newObjects) {
          set((s) => {
            const objs = new Map(s.objects);
            objs.set(newObj.id, newObj);
            return { objects: objs };
          });

          getYdoc().transact(() => {
            const yMap = new Y.Map<unknown>();
            const plainObj = objectToYjs(newObj);
            for (const [key, value] of Object.entries(plainObj)) {
              yMap.set(key, value);
            }
            getYObjects().set(newObj.id, yMap);
          });
        }
      },
      (ids) => useSelectionStore.getState().setSelection(ids)
    );

    useToastStore.getState().addToast({
      message: `Duplicated ${selectedObjects.length} object${selectedObjects.length > 1 ? 's' : ''}`,
      type: 'success'
    });
  },

  // Alignment and distribution (using calculation functions from selectionStore)
  alignObjects: (alignment) => {
    if (get().isApplyingRemoteChanges) return;

    const state = get();
    const selectedIds = useSelectionStore.getState().selectedIds;
    const selectedObjects = Array.from(selectedIds)
      .map(id => state.objects.get(id))
      .filter((obj): obj is CanvasObject => obj !== undefined);

    const updates = calculateAlignmentUpdates(selectedObjects, alignment);
    if (updates.length === 0) return;

    get().pushHistory();
    get().updateObjects(updates);

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
    if (get().isApplyingRemoteChanges) return;

    const state = get();
    const selectedIds = useSelectionStore.getState().selectedIds;
    const selectedObjects = Array.from(selectedIds)
      .map(id => state.objects.get(id))
      .filter((obj): obj is CanvasObject => obj !== undefined);

    const updates = calculateDistributionUpdates(selectedObjects, direction);
    if (updates.length === 0) return;

    get().pushHistory();
    get().updateObjects(updates);

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

  // Grouping actions (using calculation functions from groupStore)
  getAbsolutePosition: (obj: CanvasObject) => getAbsolutePosition(obj, get().objects),

  groupSelection: () => {
    const state = get();
    const selectedIds = Array.from(useSelectionStore.getState().selectedIds);

    if (selectedIds.length < 2) {
      useToastStore.getState().addToast({ message: 'Select at least 2 objects to group', type: 'info' });
      return;
    }

    if (state.isApplyingRemoteChanges) return;

    const groupData = calculateGroupData(selectedIds, state.objects, state.getNextZIndex());
    if (!groupData) return;

    state.pushHistory();

    const { group, childUpdates } = groupData;
    const newObjects = new Map(state.objects);
    newObjects.set(group.id, group);

    for (const { id, changes } of childUpdates) {
      const obj = newObjects.get(id);
      if (obj) {
        newObjects.set(id, { ...obj, ...changes } as CanvasObject);
      }
    }

    set({ objects: newObjects });
    useSelectionStore.getState().setSelection([group.id]);

    getYdoc().transact(() => {
      const yGroupMap = new Y.Map<unknown>();
      const plainGroup = objectToYjs(group);
      for (const [key, value] of Object.entries(plainGroup)) {
        yGroupMap.set(key, value);
      }
      getYObjects().set(group.id, yGroupMap);

      for (const { id, changes } of childUpdates) {
        const yMap = getYObjects().get(id);
        if (yMap) {
          for (const [key, value] of Object.entries(changes)) {
            yMap.set(key, value as unknown);
          }
        }
      }
    });

    useToastStore.getState().addToast({ message: `Grouped ${selectedIds.length} objects`, type: 'success' });
  },

  ungroupSelection: () => {
    const state = get();
    const selectedIds = Array.from(useSelectionStore.getState().selectedIds);

    if (state.isApplyingRemoteChanges) return;

    const groupsToUngroup = selectedIds.filter(id => {
      const obj = state.objects.get(id);
      return obj?.type === 'group';
    });

    if (groupsToUngroup.length === 0) {
      useToastStore.getState().addToast({ message: 'No groups selected to ungroup', type: 'info' });
      return;
    }

    state.pushHistory();

    const ungroupData = calculateUngroupData(groupsToUngroup, state.objects);
    const newObjects = new Map(state.objects);

    for (const { id, changes } of ungroupData.childUpdates) {
      const obj = newObjects.get(id);
      if (obj) {
        newObjects.set(id, { ...obj, ...changes } as CanvasObject);
      }
    }

    for (const groupId of ungroupData.groupsToDelete) {
      newObjects.delete(groupId);
    }

    set({ objects: newObjects });
    useSelectionStore.getState().setSelection(ungroupData.newSelectedIds);

    getYdoc().transact(() => {
      for (const { id, changes } of ungroupData.childUpdates) {
        const yMap = getYObjects().get(id);
        if (yMap) {
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined) {
              yMap.delete(key);
            } else {
              yMap.set(key, value as unknown);
            }
          }
        }
      }

      for (const groupId of ungroupData.groupsToDelete) {
        getYObjects().delete(groupId);
      }
    });

    useToastStore.getState().addToast({
      message: `Ungrouped ${groupsToUngroup.length} group${groupsToUngroup.length > 1 ? 's' : ''}`,
      type: 'success'
    });
  },

  enterGroupEditMode: (groupId) => {
    const group = get().objects.get(groupId);
    if (group?.type !== 'group') return;

    useGroupStore.getState().enterGroupEditMode(groupId);
    useSelectionStore.getState().clearSelection();
  },

  exitGroupEditMode: () => {
    const groupId = useGroupStore.getState().editingGroupId;
    if (groupId) {
      useSelectionStore.getState().setSelection([groupId]);
    }
    useGroupStore.getState().exitGroupEditMode();
  },

  // Zoom actions (delegate to viewportStore)
  zoomToFit: () => {
    const objects = Array.from(get().objects.values());
    useViewportStore.getState().zoomToFit(objects);
  },

  zoomToSelection: () => {
    const state = get();
    const selectedIds = useSelectionStore.getState().selectedIds;
    const objects = Array.from(state.objects.values());
    useViewportStore.getState().zoomToSelection(objects, selectedIds);
  },

  setZoomPreset: (zoom) => useViewportStore.getState().setZoomPreset(zoom),

  toggleMinimap: () => useViewportStore.getState().toggleMinimap(),

  // Spatial indexing
  rebuildSpatialIndex: () => {
    const state = get();
    const objects = Array.from(state.objects.values());

    if (objects.length === 0) {
      set({ spatialIndex: null });
      return;
    }

    const bounds = calculateBoundingBox(objects);
    const expandedBounds: Bounds = {
      x: bounds.x - 1000,
      y: bounds.y - 1000,
      width: bounds.width + 2000,
      height: bounds.height + 2000
    };

    const index = new QuadTree<CanvasObject & Bounds>(expandedBounds);
    objects.forEach(obj => {
      index.insert(obj as CanvasObject & Bounds);
    });

    set({ spatialIndex: index });
  },

  querySpatialIndex: (bounds: Bounds): CanvasObject[] => {
    const state = get();
    if (!state.spatialIndex) {
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
