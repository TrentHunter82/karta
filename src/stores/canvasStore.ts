import { create } from 'zustand';
import * as Y from 'yjs';
import type { CanvasObject, Viewport, ToolType, GroupObject } from '../types/canvas';
import { getYdoc } from './collaborationStore';
import { useToastStore } from './toastStore';
import { QuadTree, type Bounds } from '../utils/quadtree';
import { useHistoryStore } from './historyStore';
import { useClipboardStore } from './clipboardStore';
import { useViewportStore } from './viewportStore';
import { useSelectionStore, calculateAlignmentUpdates, calculateDistributionUpdates, type AlignmentType, type DistributionDirection } from './selectionStore';
import { useGroupStore, getAbsolutePosition, calculateGroupData, calculateUngroupData } from './groupStore';
import { objectToYjs, yjsToObject, createYjsUpdateQueue } from '../utils/yjsUtils';
import { calculateBoundingBox, sanitizeCoordinates, getRotatedBoundingBox } from '../utils/geometryUtils';

/**
 * Configuration for the canvas grid overlay and snapping behavior.
 */
export interface GridSettings {
  /** Whether the grid is visible on the canvas */
  visible: boolean;
  /** Grid cell size in pixels */
  size: number;
  /** Whether objects snap to grid lines when moved */
  snapEnabled: boolean;
  /** Whether objects snap to edges of other objects */
  snapToObjects: boolean;
}

/**
 * Visual guide line shown during snap operations.
 * Helps users see alignment with grid or other objects.
 */
export interface SnapGuide {
  /** Direction of the guide line */
  type: 'horizontal' | 'vertical';
  /** Position in canvas coordinates */
  position: number;
  /** ID of the object this guide aligns with (if snap-to-object) */
  sourceId?: string;
}

interface CanvasState {
  // State
  objects: Map<string, CanvasObject>;
  activeTool: ToolType;
  cursorPosition: { x: number; y: number } | null;

  // Grid and snap settings
  gridSettings: GridSettings;
  activeSnapGuides: SnapGuide[];

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
  getObjectsInsideFrame: (frameId: string) => string[];
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

  // Z-order actions
  bringToFront: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  sendToBack: () => void;

  // Selection actions
  selectAll: () => void;

  // Grid and snap actions
  setGridVisible: (visible: boolean) => void;
  setGridSize: (size: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapToObjects: (enabled: boolean) => void;
  setActiveSnapGuides: (guides: SnapGuide[]) => void;
  snapToGrid: (value: number) => number;
  snapPosition: (x: number, y: number, skipSnap?: boolean) => { x: number; y: number; guides: SnapGuide[] };

  // Spatial indexing actions
  rebuildSpatialIndex: () => void;
  querySpatialIndex: (bounds: Bounds) => CanvasObject[];
}

// Get Yjs shared types for objects
const getYObjects = () => getYdoc().getMap<Y.Map<unknown>>('objects');

// Create debounced Yjs update queue
const yjsUpdateQueue = createYjsUpdateQueue(getYdoc, getYObjects);
const queueYjsUpdate = yjsUpdateQueue.queueUpdate;

/**
 * Main Zustand store for canvas state management.
 *
 * Manages all canvas objects, selection, viewport, and tool state.
 * Handles bidirectional synchronization with Yjs for real-time collaboration.
 *
 * @example
 * ```tsx
 * // Access state
 * const objects = useCanvasStore(state => state.objects);
 * const activeTool = useCanvasStore(state => state.activeTool);
 *
 * // Call actions
 * const { addObject, setActiveTool } = useCanvasStore.getState();
 * addObject(newRectangle);
 * setActiveTool('select');
 * ```
 */
export const useCanvasStore = create<CanvasState>((set, get) => ({
  // Initial state
  objects: new Map(),
  activeTool: 'select',
  cursorPosition: null,
  isInitialized: false,
  isSyncing: false,
  isApplyingRemoteChanges: false,
  spatialIndex: null,

  // Grid and snap initial state
  gridSettings: {
    visible: false,
    size: 20,
    snapEnabled: false,
    snapToObjects: true,
  },
  activeSnapGuides: [],

  // Backward compatible accessors
  get selectedIds() { return useSelectionStore.getState().selectedIds; },
  get viewport() { return useViewportStore.getState().viewport; },
  get showMinimap() { return useViewportStore.getState().showMinimap; },
  get editingGroupId() { return useGroupStore.getState().editingGroupId; },

  initializeYjsSync: () => {
    const state = get();
    if (state.isInitialized) return;

    const initialObjects = new Map<string, CanvasObject>();
    getYObjects().forEach((yMap, id) => {
      const obj = yjsToObject(yMap);
      if (obj) {
        initialObjects.set(id, obj);
      }
    });

    set({ objects: initialObjects, isInitialized: true });
    get().rebuildSpatialIndex();

    // Observe changes from Yjs (remote changes)
    getYObjects().observe((event) => {
      if (event.transaction.local) return;

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
    useHistoryStore.getState().clear();
    useSelectionStore.getState().clearSelection();
    set({ isInitialized: false, objects: new Map() });
  },

  addObject: (object) => {
    if (get().isApplyingRemoteChanges) return;

    // Sanitize coordinates to prevent extreme position issues
    const sanitizedObject = sanitizeCoordinates(object);

    get().pushHistory();

    set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.set(sanitizedObject.id, sanitizedObject);
      return { objects: newObjects };
    });

    getYdoc().transact(() => {
      const yMap = new Y.Map<unknown>();
      const plainObj = objectToYjs(sanitizedObject);
      for (const [key, value] of Object.entries(plainObj)) {
        yMap.set(key, value);
      }
      getYObjects().set(sanitizedObject.id, yMap);
    });

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

  getObjectsInsideFrame: (frameId: string): string[] => {
    const state = useCanvasStore.getState();
    const frame = state.objects.get(frameId);
    if (!frame || frame.type !== 'frame') return [];

    const containedIds: string[] = [];

    for (const [id, obj] of state.objects) {
      // Skip the frame itself, groups, other frames, and objects with parents
      if (id === frameId || obj.type === 'frame' || obj.type === 'group' || obj.parentId) {
        continue;
      }

      // Check if object's center is inside frame bounds
      const centerX = obj.x + obj.width / 2;
      const centerY = obj.y + obj.height / 2;

      if (
        centerX >= frame.x &&
        centerX <= frame.x + frame.width &&
        centerY >= frame.y &&
        centerY <= frame.y + frame.height
      ) {
        containedIds.push(id);
      }
    }

    return containedIds;
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

  // Z-order actions
  bringToFront: () => {
    const state = get();
    const selectedIds = useSelectionStore.getState().selectedIds;
    if (selectedIds.size === 0) return;

    get().pushHistory();

    let maxZ = -1;
    for (const obj of state.objects.values()) {
      if (obj.zIndex > maxZ) maxZ = obj.zIndex;
    }

    const updates: Array<{ id: string; changes: Partial<CanvasObject> }> = [];
    selectedIds.forEach(id => {
      maxZ++;
      updates.push({ id, changes: { zIndex: maxZ } });
    });

    get().updateObjects(updates);
  },

  bringForward: () => {
    const state = get();
    const selectedIds = useSelectionStore.getState().selectedIds;
    if (selectedIds.size === 0) return;

    get().pushHistory();

    const sortedObjects = Array.from(state.objects.values()).sort((a, b) => a.zIndex - b.zIndex);

    let maxSelectedZ = -1;
    selectedIds.forEach(id => {
      const obj = state.objects.get(id);
      if (obj && obj.zIndex > maxSelectedZ) maxSelectedZ = obj.zIndex;
    });

    const objAbove = sortedObjects.find(obj => obj.zIndex > maxSelectedZ && !selectedIds.has(obj.id));
    if (!objAbove) return;

    const updates: Array<{ id: string; changes: Partial<CanvasObject> }> = [];
    selectedIds.forEach(id => {
      const obj = state.objects.get(id);
      if (obj) {
        updates.push({ id, changes: { zIndex: obj.zIndex + 1 } });
      }
    });
    updates.push({ id: objAbove.id, changes: { zIndex: objAbove.zIndex - selectedIds.size } });

    get().updateObjects(updates);
  },

  sendBackward: () => {
    const state = get();
    const selectedIds = useSelectionStore.getState().selectedIds;
    if (selectedIds.size === 0) return;

    get().pushHistory();

    const sortedObjects = Array.from(state.objects.values()).sort((a, b) => a.zIndex - b.zIndex);

    let minSelectedZ = Infinity;
    selectedIds.forEach(id => {
      const obj = state.objects.get(id);
      if (obj && obj.zIndex < minSelectedZ) minSelectedZ = obj.zIndex;
    });

    const objBelow = sortedObjects.reverse().find(obj => obj.zIndex < minSelectedZ && !selectedIds.has(obj.id));
    if (!objBelow) return;

    const updates: Array<{ id: string; changes: Partial<CanvasObject> }> = [];
    selectedIds.forEach(id => {
      const obj = state.objects.get(id);
      if (obj) {
        updates.push({ id, changes: { zIndex: obj.zIndex - 1 } });
      }
    });
    updates.push({ id: objBelow.id, changes: { zIndex: objBelow.zIndex + selectedIds.size } });

    get().updateObjects(updates);
  },

  sendToBack: () => {
    const state = get();
    const selectedIds = useSelectionStore.getState().selectedIds;
    if (selectedIds.size === 0) return;

    get().pushHistory();

    let minZ = Infinity;
    for (const obj of state.objects.values()) {
      if (obj.zIndex < minZ) minZ = obj.zIndex;
    }

    const updates: Array<{ id: string; changes: Partial<CanvasObject> }> = [];
    let newZ = minZ - selectedIds.size;
    selectedIds.forEach(id => {
      updates.push({ id, changes: { zIndex: newZ } });
      newZ++;
    });

    get().updateObjects(updates);
  },

  // Selection actions
  selectAll: () => {
    const state = get();
    const editingGroupId = useGroupStore.getState().editingGroupId;

    if (editingGroupId) {
      const group = state.objects.get(editingGroupId);
      if (group?.type === 'group') {
        // Type narrow to GroupObject to access children property
        const groupObj = group as GroupObject;
        useSelectionStore.getState().setSelection(groupObj.children);
      }
    } else {
      const topLevelIds = Array.from(state.objects.values())
        .filter(obj => !obj.parentId)
        .map(obj => obj.id);
      useSelectionStore.getState().setSelection(topLevelIds);
    }
  },

  // Grid and snap actions
  setGridVisible: (visible) => set(state => ({
    gridSettings: { ...state.gridSettings, visible }
  })),

  setGridSize: (size) => set(state => ({
    gridSettings: { ...state.gridSettings, size: Math.max(5, Math.min(100, size)) }
  })),

  setSnapEnabled: (enabled) => set(state => ({
    gridSettings: { ...state.gridSettings, snapEnabled: enabled }
  })),

  setSnapToObjects: (enabled) => set(state => ({
    gridSettings: { ...state.gridSettings, snapToObjects: enabled }
  })),

  setActiveSnapGuides: (guides) => set({ activeSnapGuides: guides }),

  snapToGrid: (value) => {
    const { gridSettings } = get();
    if (!gridSettings.snapEnabled) return value;
    return Math.round(value / gridSettings.size) * gridSettings.size;
  },

  snapPosition: (x, y, skipSnap = false) => {
    const state = get();
    const { gridSettings } = state;
    const guides: SnapGuide[] = [];

    if (skipSnap || (!gridSettings.snapEnabled && !gridSettings.snapToObjects)) {
      return { x, y, guides };
    }

    let snappedX = x;
    let snappedY = y;

    if (gridSettings.snapEnabled) {
      snappedX = Math.round(x / gridSettings.size) * gridSettings.size;
      snappedY = Math.round(y / gridSettings.size) * gridSettings.size;
    }

    if (gridSettings.snapToObjects) {
      const selectedIds = useSelectionStore.getState().selectedIds;
      const snapThreshold = 8;

      const otherObjects = Array.from(state.objects.values())
        .filter(obj => !selectedIds.has(obj.id) && obj.visible && !obj.parentId);

      for (const obj of otherObjects) {
        const objLeft = obj.x;
        const objCenter = obj.x + obj.width / 2;
        const objRight = obj.x + obj.width;

        if (Math.abs(x - objLeft) < snapThreshold) {
          snappedX = objLeft;
          guides.push({ type: 'vertical', position: objLeft, sourceId: obj.id });
        } else if (Math.abs(x - objCenter) < snapThreshold) {
          snappedX = objCenter;
          guides.push({ type: 'vertical', position: objCenter, sourceId: obj.id });
        } else if (Math.abs(x - objRight) < snapThreshold) {
          snappedX = objRight;
          guides.push({ type: 'vertical', position: objRight, sourceId: obj.id });
        }

        const objTop = obj.y;
        const objMiddle = obj.y + obj.height / 2;
        const objBottom = obj.y + obj.height;

        if (Math.abs(y - objTop) < snapThreshold) {
          snappedY = objTop;
          guides.push({ type: 'horizontal', position: objTop, sourceId: obj.id });
        } else if (Math.abs(y - objMiddle) < snapThreshold) {
          snappedY = objMiddle;
          guides.push({ type: 'horizontal', position: objMiddle, sourceId: obj.id });
        } else if (Math.abs(y - objBottom) < snapThreshold) {
          snappedY = objBottom;
          guides.push({ type: 'horizontal', position: objBottom, sourceId: obj.id });
        }
      }
    }

    return { x: snappedX, y: snappedY, guides };
  },

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
      // Use rotation-aware bounding box for spatial indexing
      const rotatedBounds = getRotatedBoundingBox(obj.x, obj.y, obj.width, obj.height, obj.rotation);
      // Create a wrapped object with rotation-aware bounds for the QuadTree
      const objWithRotatedBounds = {
        ...obj,
        x: rotatedBounds.x,
        y: rotatedBounds.y,
        width: rotatedBounds.width,
        height: rotatedBounds.height,
      };
      index.insert(objWithRotatedBounds as CanvasObject & Bounds);
    });

    set({ spatialIndex: index });
  },

  querySpatialIndex: (bounds: Bounds): CanvasObject[] => {
    const state = get();
    if (!state.spatialIndex) {
      // Fallback: use rotation-aware AABB intersection test
      return Array.from(state.objects.values()).filter(obj => {
        const rotatedBounds = getRotatedBoundingBox(obj.x, obj.y, obj.width, obj.height, obj.rotation);
        return !(
          rotatedBounds.x + rotatedBounds.width < bounds.x ||
          rotatedBounds.x > bounds.x + bounds.width ||
          rotatedBounds.y + rotatedBounds.height < bounds.y ||
          rotatedBounds.y > bounds.y + bounds.height
        );
      });
    }
    return state.spatialIndex.query(bounds) as CanvasObject[];
  },
}));
