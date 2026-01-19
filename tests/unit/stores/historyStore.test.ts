import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useHistoryStore } from '../../../src/stores/historyStore';
import type { RectangleObject, CanvasObject } from '../../../src/types/canvas';

// Helper to reset store between tests
const resetStore = () => {
  useHistoryStore.setState({
    past: [],
    future: [],
    maxSize: 50,
    isUndoRedoing: false,
  });
};

// Factory function for creating test objects
const createRectangle = (id: string, overrides?: Partial<RectangleObject>): RectangleObject => ({
  id,
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  zIndex: 1,
  fill: '#4a4a4a',
  ...overrides,
});

describe('historyStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('has empty past array', () => {
      const { past } = useHistoryStore.getState();
      expect(past).toEqual([]);
    });

    it('has empty future array', () => {
      const { future } = useHistoryStore.getState();
      expect(future).toEqual([]);
    });

    it('has default max size of 50', () => {
      const { maxSize } = useHistoryStore.getState();
      expect(maxSize).toBe(50);
    });

    it('is not in undo/redo mode initially', () => {
      const { isUndoRedoing } = useHistoryStore.getState();
      expect(isUndoRedoing).toBe(false);
    });
  });

  describe('pushSnapshot', () => {
    it('adds snapshot to past', () => {
      const store = useHistoryStore.getState();
      const objects = new Map<string, CanvasObject>([
        ['rect-1', createRectangle('rect-1')],
      ]);

      store.pushSnapshot(objects);

      const { past } = useHistoryStore.getState();
      expect(past.length).toBe(1);
      expect(past[0].objects.length).toBe(1);
      expect(past[0].objects[0][0]).toBe('rect-1');
    });

    it('clears future on new snapshot', () => {
      // Set up initial state with future
      useHistoryStore.setState({
        future: [{
          objects: [['old', createRectangle('old')]],
          timestamp: Date.now(),
        }],
      });

      const store = useHistoryStore.getState();
      const objects = new Map<string, CanvasObject>([
        ['rect-1', createRectangle('rect-1')],
      ]);

      store.pushSnapshot(objects);

      const { future } = useHistoryStore.getState();
      expect(future.length).toBe(0);
    });

    it('trims to max size', () => {
      useHistoryStore.setState({ maxSize: 3 });

      const store = useHistoryStore.getState();

      // Push 5 snapshots
      for (let i = 0; i < 5; i++) {
        const objects = new Map<string, CanvasObject>([
          [`rect-${i}`, createRectangle(`rect-${i}`)],
        ]);
        store.pushSnapshot(objects);
      }

      const { past } = useHistoryStore.getState();
      expect(past.length).toBe(3);
      // Should keep the most recent ones (rect-2, rect-3, rect-4)
      expect(past[0].objects[0][0]).toBe('rect-2');
      expect(past[2].objects[0][0]).toBe('rect-4');
    });

    it('does not push when isUndoRedoing', () => {
      useHistoryStore.setState({ isUndoRedoing: true });

      const store = useHistoryStore.getState();
      const objects = new Map<string, CanvasObject>([
        ['rect-1', createRectangle('rect-1')],
      ]);

      store.pushSnapshot(objects);

      const { past } = useHistoryStore.getState();
      expect(past.length).toBe(0);
    });

    it('creates deep clone of objects', () => {
      const store = useHistoryStore.getState();
      const rect = createRectangle('rect-1', { x: 100 });
      const objects = new Map<string, CanvasObject>([['rect-1', rect]]);

      store.pushSnapshot(objects);

      // Modify original object
      rect.x = 200;

      // Snapshot should still have original value
      const { past } = useHistoryStore.getState();
      expect(past[0].objects[0][1].x).toBe(100);
    });
  });

  describe('undo', () => {
    it('restores previous snapshot', () => {
      // Push initial snapshot
      const store = useHistoryStore.getState();
      const initialObjects = new Map<string, CanvasObject>([
        ['rect-1', createRectangle('rect-1', { x: 0 })],
      ]);
      store.pushSnapshot(initialObjects);

      // Track what applySnapshot receives
      let appliedObjects: Map<string, CanvasObject> | null = null;
      const getCurrentObjects = () => new Map<string, CanvasObject>([
        ['rect-1', createRectangle('rect-1', { x: 100 })],
      ]);
      const applySnapshot = (objects: Map<string, CanvasObject>) => {
        appliedObjects = objects;
      };

      store.undo(getCurrentObjects, applySnapshot);

      expect(appliedObjects).not.toBeNull();
      expect(appliedObjects!.get('rect-1')?.x).toBe(0);
    });

    it('moves current state to future', () => {
      const store = useHistoryStore.getState();
      const initialObjects = new Map<string, CanvasObject>([
        ['rect-1', createRectangle('rect-1', { x: 0 })],
      ]);
      store.pushSnapshot(initialObjects);

      const getCurrentObjects = () => new Map<string, CanvasObject>([
        ['rect-1', createRectangle('rect-1', { x: 100 })],
      ]);
      const applySnapshot = vi.fn();

      store.undo(getCurrentObjects, applySnapshot);

      const { future } = useHistoryStore.getState();
      expect(future.length).toBe(1);
      expect(future[0].objects[0][1].x).toBe(100);
    });

    it('does nothing when past is empty', () => {
      const store = useHistoryStore.getState();
      const getCurrentObjects = vi.fn();
      const applySnapshot = vi.fn();

      store.undo(getCurrentObjects, applySnapshot);

      expect(applySnapshot).not.toHaveBeenCalled();
    });

    it('calls applySnapshot callback', () => {
      const store = useHistoryStore.getState();
      const initialObjects = new Map<string, CanvasObject>([
        ['rect-1', createRectangle('rect-1')],
      ]);
      store.pushSnapshot(initialObjects);

      const getCurrentObjects = () => new Map();
      const applySnapshot = vi.fn();

      store.undo(getCurrentObjects, applySnapshot);

      expect(applySnapshot).toHaveBeenCalledTimes(1);
    });

    it('sets isUndoRedoing during operation', () => {
      const store = useHistoryStore.getState();
      const initialObjects = new Map<string, CanvasObject>([
        ['rect-1', createRectangle('rect-1')],
      ]);
      store.pushSnapshot(initialObjects);

      let wasUndoRedoing = false;
      const getCurrentObjects = () => new Map();
      const applySnapshot = () => {
        wasUndoRedoing = useHistoryStore.getState().isUndoRedoing;
      };

      store.undo(getCurrentObjects, applySnapshot);

      expect(wasUndoRedoing).toBe(true);
      expect(useHistoryStore.getState().isUndoRedoing).toBe(false);
    });
  });

  describe('redo', () => {
    it('restores next snapshot from future', () => {
      // Set up state with future
      useHistoryStore.setState({
        future: [{
          objects: [['rect-1', createRectangle('rect-1', { x: 200 })]],
          timestamp: Date.now(),
        }],
      });

      const store = useHistoryStore.getState();
      let appliedObjects: Map<string, CanvasObject> | null = null;
      const getCurrentObjects = () => new Map<string, CanvasObject>([
        ['rect-1', createRectangle('rect-1', { x: 0 })],
      ]);
      const applySnapshot = (objects: Map<string, CanvasObject>) => {
        appliedObjects = objects;
      };

      store.redo(getCurrentObjects, applySnapshot);

      expect(appliedObjects).not.toBeNull();
      expect(appliedObjects!.get('rect-1')?.x).toBe(200);
    });

    it('moves current state to past', () => {
      useHistoryStore.setState({
        future: [{
          objects: [['rect-1', createRectangle('rect-1', { x: 200 })]],
          timestamp: Date.now(),
        }],
      });

      const store = useHistoryStore.getState();
      const getCurrentObjects = () => new Map<string, CanvasObject>([
        ['rect-1', createRectangle('rect-1', { x: 0 })],
      ]);
      const applySnapshot = vi.fn();

      store.redo(getCurrentObjects, applySnapshot);

      const { past } = useHistoryStore.getState();
      expect(past.length).toBe(1);
      expect(past[0].objects[0][1].x).toBe(0);
    });

    it('does nothing when future is empty', () => {
      const store = useHistoryStore.getState();
      const getCurrentObjects = vi.fn();
      const applySnapshot = vi.fn();

      store.redo(getCurrentObjects, applySnapshot);

      expect(applySnapshot).not.toHaveBeenCalled();
    });

    it('sets isUndoRedoing during operation', () => {
      useHistoryStore.setState({
        future: [{
          objects: [['rect-1', createRectangle('rect-1')]],
          timestamp: Date.now(),
        }],
      });

      const store = useHistoryStore.getState();
      let wasUndoRedoing = false;
      const getCurrentObjects = () => new Map();
      const applySnapshot = () => {
        wasUndoRedoing = useHistoryStore.getState().isUndoRedoing;
      };

      store.redo(getCurrentObjects, applySnapshot);

      expect(wasUndoRedoing).toBe(true);
      expect(useHistoryStore.getState().isUndoRedoing).toBe(false);
    });
  });

  describe('canUndo / canRedo', () => {
    it('canUndo returns false when past is empty', () => {
      const store = useHistoryStore.getState();
      expect(store.canUndo()).toBe(false);
    });

    it('canUndo returns true when past has items', () => {
      const store = useHistoryStore.getState();
      const objects = new Map<string, CanvasObject>([
        ['rect-1', createRectangle('rect-1')],
      ]);
      store.pushSnapshot(objects);

      expect(store.canUndo()).toBe(true);
    });

    it('canRedo returns false when future is empty', () => {
      const store = useHistoryStore.getState();
      expect(store.canRedo()).toBe(false);
    });

    it('canRedo returns true when future has items', () => {
      useHistoryStore.setState({
        future: [{
          objects: [['rect-1', createRectangle('rect-1')]],
          timestamp: Date.now(),
        }],
      });

      const store = useHistoryStore.getState();
      expect(store.canRedo()).toBe(true);
    });
  });

  describe('clear', () => {
    it('clears both past and future', () => {
      useHistoryStore.setState({
        past: [{
          objects: [['rect-1', createRectangle('rect-1')]],
          timestamp: Date.now(),
        }],
        future: [{
          objects: [['rect-2', createRectangle('rect-2')]],
          timestamp: Date.now(),
        }],
      });

      const store = useHistoryStore.getState();
      store.clear();

      const { past, future } = useHistoryStore.getState();
      expect(past.length).toBe(0);
      expect(future.length).toBe(0);
    });
  });

  describe('setIsUndoRedoing', () => {
    it('sets isUndoRedoing flag', () => {
      const store = useHistoryStore.getState();

      store.setIsUndoRedoing(true);
      expect(useHistoryStore.getState().isUndoRedoing).toBe(true);

      store.setIsUndoRedoing(false);
      expect(useHistoryStore.getState().isUndoRedoing).toBe(false);
    });
  });
});
