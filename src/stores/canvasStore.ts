import { create } from 'zustand';
import type { CanvasObject, Viewport, ToolType } from '../types/canvas';

interface CanvasState {
  // State
  objects: Map<string, CanvasObject>;
  selectedIds: Set<string>;
  viewport: Viewport;
  activeTool: ToolType;

  // Actions
  addObject: (object: CanvasObject) => void;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  deleteObject: (id: string) => void;
  setSelection: (ids: string[]) => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  setActiveTool: (tool: ToolType) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  // Initial state
  objects: new Map(),
  selectedIds: new Set(),
  viewport: { x: 0, y: 0, zoom: 1 },
  activeTool: 'select',

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
}));
