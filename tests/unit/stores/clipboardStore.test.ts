import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useClipboardStore } from '../../../src/stores/clipboardStore';
import type { RectangleObject, CanvasObject } from '../../../src/types/canvas';

// Helper to reset store between tests
const resetStore = () => {
  useClipboardStore.setState({
    items: [],
    pasteCount: 0,
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

describe('clipboardStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('has empty items array', () => {
      const { items } = useClipboardStore.getState();
      expect(items).toEqual([]);
    });

    it('has zero paste count', () => {
      const { pasteCount } = useClipboardStore.getState();
      expect(pasteCount).toBe(0);
    });

    it('hasItems returns false initially', () => {
      const store = useClipboardStore.getState();
      expect(store.hasItems()).toBe(false);
    });
  });

  describe('copy', () => {
    it('stores deep clones of objects', () => {
      const store = useClipboardStore.getState();
      const rect = createRectangle('rect-1', { x: 100 });

      store.copy([rect]);

      // Modify original
      rect.x = 200;

      // Clipboard should have original value
      const { items } = useClipboardStore.getState();
      expect(items[0].x).toBe(100);
    });

    it('stores multiple objects', () => {
      const store = useClipboardStore.getState();
      const rect1 = createRectangle('rect-1');
      const rect2 = createRectangle('rect-2');

      store.copy([rect1, rect2]);

      const { items } = useClipboardStore.getState();
      expect(items.length).toBe(2);
    });

    it('resets paste count', () => {
      useClipboardStore.setState({ pasteCount: 5 });
      const store = useClipboardStore.getState();

      store.copy([createRectangle('rect-1')]);

      const { pasteCount } = useClipboardStore.getState();
      expect(pasteCount).toBe(0);
    });

    it('does nothing for empty array', () => {
      const store = useClipboardStore.getState();

      store.copy([]);

      const { items } = useClipboardStore.getState();
      expect(items.length).toBe(0);
    });

    it('replaces previous clipboard contents', () => {
      const store = useClipboardStore.getState();
      store.copy([createRectangle('rect-1')]);

      store.copy([createRectangle('rect-2'), createRectangle('rect-3')]);

      const { items } = useClipboardStore.getState();
      expect(items.length).toBe(2);
      expect(items[0].id).toBe('rect-2');
    });
  });

  describe('paste', () => {
    it('creates new objects with new IDs', () => {
      const store = useClipboardStore.getState();
      store.copy([createRectangle('rect-1')]);

      let pastedObjects: CanvasObject[] = [];
      const getNextZIndex = vi.fn().mockReturnValue(10);
      const addObjects = vi.fn((objs) => { pastedObjects = objs; });
      const setSelection = vi.fn();

      store.paste(getNextZIndex, addObjects, setSelection);

      expect(pastedObjects.length).toBe(1);
      expect(pastedObjects[0].id).not.toBe('rect-1');
    });

    it('offsets position based on paste count', () => {
      const store = useClipboardStore.getState();
      store.copy([createRectangle('rect-1', { x: 100, y: 100 })]);

      let pastedObjects: CanvasObject[] = [];
      const getNextZIndex = vi.fn().mockReturnValue(10);
      const addObjects = vi.fn((objs) => { pastedObjects = objs; });
      const setSelection = vi.fn();

      // First paste - offset of 10
      store.paste(getNextZIndex, addObjects, setSelection);
      expect(pastedObjects[0].x).toBe(110);
      expect(pastedObjects[0].y).toBe(110);

      // Second paste - offset of 20 from original
      store.paste(getNextZIndex, addObjects, setSelection);
      expect(pastedObjects[0].x).toBe(120);
      expect(pastedObjects[0].y).toBe(120);
    });

    it('assigns new z-indexes', () => {
      const store = useClipboardStore.getState();
      store.copy([createRectangle('rect-1', { zIndex: 1 })]);

      let pastedObjects: CanvasObject[] = [];
      const getNextZIndex = vi.fn().mockReturnValue(50);
      const addObjects = vi.fn((objs) => { pastedObjects = objs; });
      const setSelection = vi.fn();

      store.paste(getNextZIndex, addObjects, setSelection);

      expect(pastedObjects[0].zIndex).toBe(50);
    });

    it('selects pasted objects', () => {
      const store = useClipboardStore.getState();
      store.copy([createRectangle('rect-1'), createRectangle('rect-2')]);

      let selectedIds: string[] = [];
      const getNextZIndex = vi.fn().mockReturnValue(10);
      const addObjects = vi.fn();
      const setSelection = vi.fn((ids) => { selectedIds = ids; });

      store.paste(getNextZIndex, addObjects, setSelection);

      expect(selectedIds.length).toBe(2);
      expect(setSelection).toHaveBeenCalled();
    });

    it('does nothing when clipboard empty', () => {
      const store = useClipboardStore.getState();
      const getNextZIndex = vi.fn();
      const addObjects = vi.fn();
      const setSelection = vi.fn();

      store.paste(getNextZIndex, addObjects, setSelection);

      expect(addObjects).not.toHaveBeenCalled();
      expect(setSelection).not.toHaveBeenCalled();
    });

    it('increments paste count', () => {
      const store = useClipboardStore.getState();
      store.copy([createRectangle('rect-1')]);

      const getNextZIndex = vi.fn().mockReturnValue(10);
      const addObjects = vi.fn();
      const setSelection = vi.fn();

      store.paste(getNextZIndex, addObjects, setSelection);
      expect(useClipboardStore.getState().pasteCount).toBe(1);

      store.paste(getNextZIndex, addObjects, setSelection);
      expect(useClipboardStore.getState().pasteCount).toBe(2);
    });
  });

  describe('duplicate', () => {
    it('creates offset copies with new IDs', () => {
      const store = useClipboardStore.getState();
      const rect = createRectangle('rect-1', { x: 100, y: 100 });

      let duplicatedObjects: CanvasObject[] = [];
      const getNextZIndex = vi.fn().mockReturnValue(10);
      const addObjects = vi.fn((objs) => { duplicatedObjects = objs; });
      const setSelection = vi.fn();

      store.duplicate([rect], getNextZIndex, addObjects, setSelection);

      expect(duplicatedObjects.length).toBe(1);
      expect(duplicatedObjects[0].id).not.toBe('rect-1');
    });

    it('selects duplicated objects', () => {
      const store = useClipboardStore.getState();
      const rect = createRectangle('rect-1');

      let selectedIds: string[] = [];
      const getNextZIndex = vi.fn().mockReturnValue(10);
      const addObjects = vi.fn();
      const setSelection = vi.fn((ids) => { selectedIds = ids; });

      store.duplicate([rect], getNextZIndex, addObjects, setSelection);

      expect(selectedIds.length).toBe(1);
    });

    it('assigns new z-indexes', () => {
      const store = useClipboardStore.getState();
      const rect = createRectangle('rect-1', { zIndex: 1 });

      let duplicatedObjects: CanvasObject[] = [];
      const getNextZIndex = vi.fn().mockReturnValue(99);
      const addObjects = vi.fn((objs) => { duplicatedObjects = objs; });
      const setSelection = vi.fn();

      store.duplicate([rect], getNextZIndex, addObjects, setSelection);

      expect(duplicatedObjects[0].zIndex).toBe(99);
    });

    it('does nothing for empty array', () => {
      const store = useClipboardStore.getState();
      const getNextZIndex = vi.fn();
      const addObjects = vi.fn();
      const setSelection = vi.fn();

      store.duplicate([], getNextZIndex, addObjects, setSelection);

      expect(addObjects).not.toHaveBeenCalled();
    });

    it('creates deep copies of objects', () => {
      const store = useClipboardStore.getState();
      const rect = createRectangle('rect-1', { x: 100 });

      let duplicatedObjects: CanvasObject[] = [];
      const getNextZIndex = vi.fn().mockReturnValue(10);
      const addObjects = vi.fn((objs) => { duplicatedObjects = objs; });
      const setSelection = vi.fn();

      store.duplicate([rect], getNextZIndex, addObjects, setSelection);

      // Modify original
      rect.x = 200;

      // Duplicated should have original value
      expect(duplicatedObjects[0].x).toBe(100);
    });
  });

  describe('clear', () => {
    it('clears items and resets paste count', () => {
      const store = useClipboardStore.getState();
      store.copy([createRectangle('rect-1')]);

      // Paste to increment count
      const getNextZIndex = vi.fn().mockReturnValue(10);
      const addObjects = vi.fn();
      const setSelection = vi.fn();
      store.paste(getNextZIndex, addObjects, setSelection);

      store.clear();

      const { items, pasteCount } = useClipboardStore.getState();
      expect(items.length).toBe(0);
      expect(pasteCount).toBe(0);
    });
  });

  describe('hasItems', () => {
    it('returns false when empty', () => {
      const store = useClipboardStore.getState();
      expect(store.hasItems()).toBe(false);
    });

    it('returns true when has items', () => {
      const store = useClipboardStore.getState();
      store.copy([createRectangle('rect-1')]);

      expect(store.hasItems()).toBe(true);
    });
  });

  describe('getItems', () => {
    it('returns current clipboard items', () => {
      const store = useClipboardStore.getState();
      const rect = createRectangle('rect-1');
      store.copy([rect]);

      const items = store.getItems();

      expect(items.length).toBe(1);
      expect(items[0].id).toBe('rect-1');
    });
  });
});
