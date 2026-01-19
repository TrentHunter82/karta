/**
 * History store for undo/redo functionality.
 *
 * Uses a snapshot-based approach where complete canvas state is saved
 * at each history point. Supports up to MAX_HISTORY_SIZE undo steps.
 */
import { create } from 'zustand';
import type { CanvasObject } from '../types/canvas';

/**
 * A point-in-time snapshot of canvas state.
 */
interface HistorySnapshot {
  /** All canvas objects as [id, object] pairs */
  objects: Array<[string, CanvasObject]>;
  /** When this snapshot was created */
  timestamp: number;
}

interface HistoryState {
  /** Past snapshots (for undo) - most recent at end */
  past: HistorySnapshot[];
  /** Future snapshots (for redo) - most recent at start */
  future: HistorySnapshot[];
  /** Maximum number of undo steps to keep */
  maxSize: number;
  /** Flag to prevent nested history operations */
  isUndoRedoing: boolean;

  /** Save current state as a new history snapshot */
  pushSnapshot: (objects: Map<string, CanvasObject>) => void;
  /** Restore previous state, moving current to future */
  undo: (
    getCurrentObjects: () => Map<string, CanvasObject>,
    applySnapshot: (objects: Map<string, CanvasObject>) => void
  ) => void;
  /** Restore next state, moving current to past */
  redo: (
    getCurrentObjects: () => Map<string, CanvasObject>,
    applySnapshot: (objects: Map<string, CanvasObject>) => void
  ) => void;
  /** Check if undo is available */
  canUndo: () => boolean;
  /** Check if redo is available */
  canRedo: () => boolean;
  /** Clear all history */
  clear: () => void;
  /** Set the undo/redo in progress flag */
  setIsUndoRedoing: (value: boolean) => void;
}

/** Maximum number of history snapshots to retain */
const MAX_HISTORY_SIZE = 50;

/**
 * Zustand store for managing undo/redo history.
 *
 * @example
 * ```tsx
 * const { pushSnapshot, undo, canUndo } = useHistoryStore.getState();
 *
 * // Before making changes
 * pushSnapshot(currentObjects);
 *
 * // Undo last change
 * if (canUndo()) {
 *   undo(getCurrentObjects, applySnapshot);
 * }
 * ```
 */
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
