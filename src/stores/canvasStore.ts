import { create } from 'zustand';
import type { CanvasObject, Viewport, ToolType } from '../types/canvas';

interface CanvasState {
  // State
  objects: Map<string, CanvasObject>;
  selectedIds: Set<string>;
  viewport: Viewport;
  activeTool: ToolType;
  cursorPosition: { x: number; y: number } | null;

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
}

export const useCanvasStore = create<CanvasState>((set) => ({
  // Initial state
  objects: new Map(),
  selectedIds: new Set(),
  viewport: { x: 0, y: 0, zoom: 1 },
  activeTool: 'select',
  cursorPosition: null,

  // Actions
  addObject: (object) =>
    set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.set(object.id, object);
      return { objects: newObjects };
    }),

  updateObject: (id, updates) =>
    set((state) => {
      const existingObject = state.objects.get(id);
      if (!existingObject) return state;

      const newObjects = new Map(state.objects);
      newObjects.set(id, { ...existingObject, ...updates } as CanvasObject);
      return { objects: newObjects };
    }),

  updateObjects: (updates) =>
    set((state) => {
      const newObjects = new Map(state.objects);
      for (const { id, changes } of updates) {
        const existingObject = newObjects.get(id);
        if (existingObject) {
          newObjects.set(id, { ...existingObject, ...changes } as CanvasObject);
        }
      }
      return { objects: newObjects };
    }),

  deleteObject: (id) =>
    set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.delete(id);

      const newSelectedIds = new Set(state.selectedIds);
      newSelectedIds.delete(id);

      return { objects: newObjects, selectedIds: newSelectedIds };
    }),

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

  reorderObject: (id, newZIndex) =>
    set((state) => {
      const targetObject = state.objects.get(id);
      if (!targetObject) return state;

      const oldZIndex = targetObject.zIndex;
      if (oldZIndex === newZIndex) return state;

      const newObjects = new Map(state.objects);

      // Shift other objects' zIndex values to make room
      if (newZIndex > oldZIndex) {
        // Moving up: shift objects between old and new position down
        for (const [objId, obj] of newObjects) {
          if (obj.zIndex > oldZIndex && obj.zIndex <= newZIndex) {
            newObjects.set(objId, { ...obj, zIndex: obj.zIndex - 1 } as CanvasObject);
          }
        }
      } else {
        // Moving down: shift objects between new and old position up
        for (const [objId, obj] of newObjects) {
          if (obj.zIndex >= newZIndex && obj.zIndex < oldZIndex) {
            newObjects.set(objId, { ...obj, zIndex: obj.zIndex + 1 } as CanvasObject);
          }
        }
      }

      // Set the target object to its new position
      newObjects.set(id, { ...targetObject, zIndex: newZIndex } as CanvasObject);

      return { objects: newObjects };
    }),

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
