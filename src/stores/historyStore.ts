// src/stores/historyStore.ts
import { create } from 'zustand';
import type { CanvasObject } from '../types/canvas';

interface HistorySnapshot {
  objects: Array<[string, CanvasObject]>;
  timestamp: number;
}

interface HistoryState {
  // State
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  maxSize: number;
  isUndoRedoing: boolean;

  // Actions
  pushSnapshot: (objects: Map<string, CanvasObject>) => void;
  undo: (
    getCurrentObjects: () => Map<string, CanvasObject>,
    applySnapshot: (objects: Map<string, CanvasObject>) => void
  ) => void;
  redo: (
    getCurrentObjects: () => Map<string, CanvasObject>,
    applySnapshot: (objects: Map<string, CanvasObject>) => void
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

  pushSnapshot: (objects) => {
    const state = get();

    // Don't push if we're in the middle of undo/redo
    if (state.isUndoRedoing) return;

    const snapshot: HistorySnapshot = {
      objects: Array.from(objects.entries()).map(([id, obj]) => [id, { ...obj }]),
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

  undo: (getCurrentObjects, applySnapshot) => {
    const state = get();
    if (state.past.length === 0) return;

    set({ isUndoRedoing: true });

    try {
      const newPast = [...state.past];
      const snapshotToRestore = newPast.pop()!;

      // Save current state to future before restoring
      const currentObjects = getCurrentObjects();
      const currentSnapshot: HistorySnapshot = {
        objects: Array.from(currentObjects.entries()).map(([id, obj]) => [id, { ...obj }]),
        timestamp: Date.now(),
      };

      const restoredObjects = new Map<string, CanvasObject>(snapshotToRestore.objects);

      applySnapshot(restoredObjects);

      set({
        past: newPast,
        future: [currentSnapshot, ...state.future],
      });
    } finally {
      set({ isUndoRedoing: false });
    }
  },

  redo: (getCurrentObjects, applySnapshot) => {
    const state = get();
    if (state.future.length === 0) return;

    set({ isUndoRedoing: true });

    try {
      const newFuture = [...state.future];
      const snapshotToRestore = newFuture.shift()!;

      // Save current state to past before restoring
      const currentObjects = getCurrentObjects();
      const currentSnapshot: HistorySnapshot = {
        objects: Array.from(currentObjects.entries()).map(([id, obj]) => [id, { ...obj }]),
        timestamp: Date.now(),
      };

      const restoredObjects = new Map<string, CanvasObject>(snapshotToRestore.objects);

      applySnapshot(restoredObjects);

      set({
        past: [...state.past, currentSnapshot],
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
