import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCanvasStore } from '../../../src/stores/canvasStore';
import { useHistoryStore } from '../../../src/stores/historyStore';
import { useClipboardStore } from '../../../src/stores/clipboardStore';
import { useViewportStore } from '../../../src/stores/viewportStore';
import { useSelectionStore } from '../../../src/stores/selectionStore';
import { useGroupStore } from '../../../src/stores/groupStore';
import type { RectangleObject, EllipseObject, TextObject, CanvasObject } from '../../../src/types/canvas';

// Helper to reset stores between tests
const resetStore = () => {
  // Reset main canvas store
  useCanvasStore.setState({
    objects: new Map(),
    activeTool: 'select',
    cursorPosition: null,
    isInitialized: false,
    isSyncing: false,
    isApplyingRemoteChanges: false,
    spatialIndex: null,
  });
  // Reset viewport store
  useViewportStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    showMinimap: false,
  });
  // Reset selection store
  useSelectionStore.setState({
    selectedIds: new Set(),
  });
  // Reset group store
  useGroupStore.setState({
    editingGroupId: null,
  });
  // Reset history store
  useHistoryStore.setState({
    past: [],
    future: [],
    maxSize: 50,
    isUndoRedoing: false,
  });
  // Reset clipboard store
  useClipboardStore.setState({
    items: [],
    pasteCount: 0,
  });
};

// Factory functions for creating test objects
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

const createEllipse = (id: string, overrides?: Partial<EllipseObject>): EllipseObject => ({
  id,
  type: 'ellipse',
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

const createText = (id: string, overrides?: Partial<TextObject>): TextObject => ({
  id,
  type: 'text',
  x: 0,
  y: 0,
  width: 100,
  height: 24,
  rotation: 0,
  opacity: 1,
  zIndex: 1,
  text: 'Test text',
  fontSize: 16,
  fontFamily: 'Inter, sans-serif',
  textAlign: 'left',
  fill: '#ffffff',
  ...overrides,
});

describe('canvasStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('has empty objects map', () => {
      const { objects } = useCanvasStore.getState();
      expect(objects.size).toBe(0);
    });

    it('has empty selection', () => {
      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(0);
    });

    it('has default viewport at origin with 100% zoom', () => {
      const { viewport } = useViewportStore.getState();
      expect(viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('has select tool active by default', () => {
      const { activeTool } = useCanvasStore.getState();
      expect(activeTool).toBe('select');
    });
  });

  describe('addObject', () => {
    it('adds object to the store', () => {
      const store = useCanvasStore.getState();
      const rect = createRectangle('rect-1');

      store.addObject(rect);

      const { objects } = useCanvasStore.getState();
      expect(objects.has('rect-1')).toBe(true);
      expect(objects.get('rect-1')).toMatchObject({
        id: 'rect-1',
        type: 'rectangle',
        width: 100,
        height: 100,
      });
    });

    it('adds multiple objects with unique IDs', () => {
      const store = useCanvasStore.getState();

      store.addObject(createRectangle('rect-1'));
      store.addObject(createRectangle('rect-2'));
      store.addObject(createEllipse('ellipse-1'));

      const { objects } = useCanvasStore.getState();
      expect(objects.size).toBe(3);
      expect(objects.has('rect-1')).toBe(true);
      expect(objects.has('rect-2')).toBe(true);
      expect(objects.has('ellipse-1')).toBe(true);
    });

    it('pushes history when adding object', () => {
      const store = useCanvasStore.getState();

      store.addObject(createRectangle('rect-1'));

      const { past } = useHistoryStore.getState();
      expect(past.length).toBeGreaterThan(0);
    });

    it('does not add object when isApplyingRemoteChanges is true', () => {
      useCanvasStore.setState({ isApplyingRemoteChanges: true });
      const store = useCanvasStore.getState();

      store.addObject(createRectangle('rect-1'));

      const { objects } = useCanvasStore.getState();
      expect(objects.size).toBe(0);
    });
  });

  describe('updateObject', () => {
    beforeEach(() => {
      const store = useCanvasStore.getState();
      store.addObject(createRectangle('rect-1', { x: 100, y: 100 }));
    });

    it('updates existing object properties', () => {
      const store = useCanvasStore.getState();

      store.updateObject('rect-1', { x: 200, y: 300 });

      const { objects } = useCanvasStore.getState();
      const obj = objects.get('rect-1');
      expect(obj?.x).toBe(200);
      expect(obj?.y).toBe(300);
    });

    it('preserves unmodified properties', () => {
      const store = useCanvasStore.getState();

      store.updateObject('rect-1', { x: 200 });

      const { objects } = useCanvasStore.getState();
      const obj = objects.get('rect-1') as RectangleObject;
      expect(obj.y).toBe(100); // Original value
      expect(obj.width).toBe(100);
      expect(obj.fill).toBe('#4a4a4a');
    });

    it('does nothing for non-existent object', () => {
      const store = useCanvasStore.getState();
      const objectsBefore = useCanvasStore.getState().objects.size;

      store.updateObject('non-existent', { x: 200 });

      expect(useCanvasStore.getState().objects.size).toBe(objectsBefore);
    });

    it('does not update when isApplyingRemoteChanges is true', () => {
      useCanvasStore.setState({ isApplyingRemoteChanges: true });
      const store = useCanvasStore.getState();

      store.updateObject('rect-1', { x: 999 });

      const { objects } = useCanvasStore.getState();
      expect(objects.get('rect-1')?.x).toBe(100); // Unchanged
    });
  });

  describe('updateObjects (batch update)', () => {
    beforeEach(() => {
      const store = useCanvasStore.getState();
      store.addObject(createRectangle('rect-1', { x: 0, y: 0 }));
      store.addObject(createRectangle('rect-2', { x: 100, y: 100 }));
      store.addObject(createRectangle('rect-3', { x: 200, y: 200 }));
    });

    it('updates multiple objects at once', () => {
      const store = useCanvasStore.getState();

      store.updateObjects([
        { id: 'rect-1', changes: { x: 50 } },
        { id: 'rect-2', changes: { x: 150 } },
        { id: 'rect-3', changes: { x: 250 } },
      ]);

      const { objects } = useCanvasStore.getState();
      expect(objects.get('rect-1')?.x).toBe(50);
      expect(objects.get('rect-2')?.x).toBe(150);
      expect(objects.get('rect-3')?.x).toBe(250);
    });

    it('skips non-existent objects in batch', () => {
      const store = useCanvasStore.getState();

      store.updateObjects([
        { id: 'rect-1', changes: { x: 50 } },
        { id: 'non-existent', changes: { x: 999 } },
        { id: 'rect-2', changes: { x: 150 } },
      ]);

      const { objects } = useCanvasStore.getState();
      expect(objects.get('rect-1')?.x).toBe(50);
      expect(objects.get('rect-2')?.x).toBe(150);
      expect(objects.has('non-existent')).toBe(false);
    });
  });

  describe('deleteObject', () => {
    beforeEach(() => {
      const store = useCanvasStore.getState();
      store.addObject(createRectangle('rect-1'));
      store.addObject(createRectangle('rect-2'));
    });

    it('removes object from store', () => {
      const store = useCanvasStore.getState();

      store.deleteObject('rect-1');

      const { objects } = useCanvasStore.getState();
      expect(objects.has('rect-1')).toBe(false);
      expect(objects.has('rect-2')).toBe(true);
    });

    it('removes object from selection if selected', () => {
      useSelectionStore.setState({ selectedIds: new Set(['rect-1', 'rect-2']) });
      const store = useCanvasStore.getState();

      store.deleteObject('rect-1');

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.has('rect-1')).toBe(false);
      expect(selectedIds.has('rect-2')).toBe(true);
    });

    it('pushes history before deleting', () => {
      const historyLengthBefore = useHistoryStore.getState().past.length;
      const store = useCanvasStore.getState();

      store.deleteObject('rect-1');

      expect(useHistoryStore.getState().past.length).toBeGreaterThan(historyLengthBefore);
    });
  });

  describe('deleteSelectedObjects', () => {
    beforeEach(() => {
      const store = useCanvasStore.getState();
      store.addObject(createRectangle('rect-1'));
      store.addObject(createRectangle('rect-2'));
      store.addObject(createRectangle('rect-3'));
      store.setSelection(['rect-1', 'rect-2']);
    });

    it('deletes all selected objects', () => {
      const store = useCanvasStore.getState();

      store.deleteSelectedObjects();

      const { objects } = useCanvasStore.getState();
      const { selectedIds } = useSelectionStore.getState();
      expect(objects.has('rect-1')).toBe(false);
      expect(objects.has('rect-2')).toBe(false);
      expect(objects.has('rect-3')).toBe(true); // Not selected
      expect(selectedIds.size).toBe(0);
    });

    it('does nothing when no selection', () => {
      useSelectionStore.setState({ selectedIds: new Set() });
      const objectsBefore = useCanvasStore.getState().objects.size;
      const store = useCanvasStore.getState();

      store.deleteSelectedObjects();

      expect(useCanvasStore.getState().objects.size).toBe(objectsBefore);
    });
  });

  describe('setSelection', () => {
    beforeEach(() => {
      const store = useCanvasStore.getState();
      store.addObject(createRectangle('rect-1'));
      store.addObject(createRectangle('rect-2'));
      store.addObject(createRectangle('rect-3'));
    });

    it('sets selected IDs', () => {
      const store = useCanvasStore.getState();

      store.setSelection(['rect-1', 'rect-2']);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(2);
      expect(selectedIds.has('rect-1')).toBe(true);
      expect(selectedIds.has('rect-2')).toBe(true);
    });

    it('clears previous selection', () => {
      const store = useCanvasStore.getState();
      store.setSelection(['rect-1']);

      store.setSelection(['rect-2']);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.has('rect-1')).toBe(false);
      expect(selectedIds.has('rect-2')).toBe(true);
    });

    it('allows empty selection', () => {
      const store = useCanvasStore.getState();
      store.setSelection(['rect-1', 'rect-2']);

      store.setSelection([]);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(0);
    });
  });

  describe('setViewport', () => {
    it('updates viewport position', () => {
      const store = useCanvasStore.getState();

      store.setViewport({ x: 100, y: 200 });

      const { viewport } = useViewportStore.getState();
      expect(viewport.x).toBe(100);
      expect(viewport.y).toBe(200);
      expect(viewport.zoom).toBe(1); // Unchanged
    });

    it('updates viewport zoom', () => {
      const store = useCanvasStore.getState();

      store.setViewport({ zoom: 2 });

      const { viewport } = useViewportStore.getState();
      expect(viewport.zoom).toBe(2);
      expect(viewport.x).toBe(0); // Unchanged
      expect(viewport.y).toBe(0); // Unchanged
    });

    it('updates multiple viewport properties', () => {
      const store = useCanvasStore.getState();

      store.setViewport({ x: 50, y: 75, zoom: 1.5 });

      const { viewport } = useViewportStore.getState();
      expect(viewport).toEqual({ x: 50, y: 75, zoom: 1.5 });
    });
  });

  describe('setActiveTool', () => {
    it('changes the active tool', () => {
      const store = useCanvasStore.getState();

      store.setActiveTool('rectangle');
      expect(useCanvasStore.getState().activeTool).toBe('rectangle');

      store.setActiveTool('text');
      expect(useCanvasStore.getState().activeTool).toBe('text');

      store.setActiveTool('hand');
      expect(useCanvasStore.getState().activeTool).toBe('hand');
    });
  });

  describe('History (Undo/Redo)', () => {
    describe('pushHistory', () => {
      it('creates a snapshot of current state', () => {
        const store = useCanvasStore.getState();
        store.addObject(createRectangle('rect-1'));
        const historyBefore = useHistoryStore.getState().past.length;

        // Manually push (addObject already pushes, so we force another)
        store.pushHistory();

        expect(useHistoryStore.getState().past.length).toBe(historyBefore + 1);
      });

      it('does not push when isUndoRedoing is true', () => {
        const store = useCanvasStore.getState();
        store.addObject(createRectangle('rect-1'));
        const historyBefore = useHistoryStore.getState().past.length;

        useHistoryStore.setState({ isUndoRedoing: true });
        store.pushHistory();

        expect(useHistoryStore.getState().past.length).toBe(historyBefore);
      });
    });

    describe('canUndo / canRedo', () => {
      it('canUndo returns false when no history', () => {
        const store = useCanvasStore.getState();
        expect(store.canUndo()).toBe(false);
      });

      it('canUndo returns true when history exists', () => {
        const store = useCanvasStore.getState();
        store.addObject(createRectangle('rect-1'));

        expect(store.canUndo()).toBe(true);
      });

      it('canRedo returns false initially', () => {
        const store = useCanvasStore.getState();
        store.addObject(createRectangle('rect-1'));

        expect(store.canRedo()).toBe(false);
      });
    });
  });

  describe('Clipboard (Copy/Paste)', () => {
    beforeEach(() => {
      const store = useCanvasStore.getState();
      store.addObject(createRectangle('rect-1', { x: 100, y: 100 }));
      store.addObject(createRectangle('rect-2', { x: 200, y: 200 }));
      store.setSelection(['rect-1']);
    });

    describe('copySelection', () => {
      it('copies selected objects to clipboard', () => {
        const store = useCanvasStore.getState();

        store.copySelection();

        const { items } = useClipboardStore.getState();
        expect(items.length).toBe(1);
        expect(items[0].id).toBe('rect-1');
      });

      it('copies multiple selected objects', () => {
        const store = useCanvasStore.getState();
        store.setSelection(['rect-1', 'rect-2']);

        store.copySelection();

        const { items } = useClipboardStore.getState();
        expect(items.length).toBe(2);
      });

      it('does nothing when nothing selected', () => {
        const store = useCanvasStore.getState();
        store.setSelection([]);

        store.copySelection();

        const { items } = useClipboardStore.getState();
        expect(items.length).toBe(0);
      });
    });

    describe('paste', () => {
      it('pastes objects with offset', () => {
        const store = useCanvasStore.getState();
        store.copySelection();
        const objectCountBefore = useCanvasStore.getState().objects.size;

        store.paste();

        const { objects } = useCanvasStore.getState();
        expect(objects.size).toBe(objectCountBefore + 1);
      });

      it('creates new IDs for pasted objects', () => {
        const store = useCanvasStore.getState();
        store.copySelection();

        store.paste();

        const { objects } = useCanvasStore.getState();
        const ids = Array.from(objects.keys());
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length); // All IDs unique
      });

      it('selects pasted objects', () => {
        const store = useCanvasStore.getState();
        store.copySelection();

        store.paste();

        const { objects } = useCanvasStore.getState();
        const { selectedIds } = useSelectionStore.getState();
        // Should have exactly one selected (the pasted one)
        expect(selectedIds.size).toBe(1);
        // The selected ID should not be 'rect-1' (original)
        expect(selectedIds.has('rect-1')).toBe(false);
      });
    });

    describe('duplicate', () => {
      it('duplicates selected objects', () => {
        const store = useCanvasStore.getState();
        const objectCountBefore = useCanvasStore.getState().objects.size;

        store.duplicate();

        expect(useCanvasStore.getState().objects.size).toBe(objectCountBefore + 1);
      });
    });
  });

  describe('Alignment', () => {
    beforeEach(() => {
      const store = useCanvasStore.getState();
      // Create objects at different positions
      store.addObject(createRectangle('rect-1', { x: 0, y: 0, width: 50, height: 50 }));
      store.addObject(createRectangle('rect-2', { x: 100, y: 100, width: 50, height: 50 }));
      store.addObject(createRectangle('rect-3', { x: 200, y: 200, width: 50, height: 50 }));
      store.setSelection(['rect-1', 'rect-2', 'rect-3']);
    });

    it('aligns objects to left', () => {
      const store = useCanvasStore.getState();

      store.alignObjects('left');

      const { objects } = useCanvasStore.getState();
      expect(objects.get('rect-1')?.x).toBe(0);
      expect(objects.get('rect-2')?.x).toBe(0);
      expect(objects.get('rect-3')?.x).toBe(0);
    });

    it('aligns objects to right', () => {
      const store = useCanvasStore.getState();

      store.alignObjects('right');

      const { objects } = useCanvasStore.getState();
      // All should align to rightmost edge (200 + 50 = 250)
      expect(objects.get('rect-1')?.x).toBe(200); // 250 - 50
      expect(objects.get('rect-2')?.x).toBe(200);
      expect(objects.get('rect-3')?.x).toBe(200);
    });

    it('aligns objects to top', () => {
      const store = useCanvasStore.getState();

      store.alignObjects('top');

      const { objects } = useCanvasStore.getState();
      expect(objects.get('rect-1')?.y).toBe(0);
      expect(objects.get('rect-2')?.y).toBe(0);
      expect(objects.get('rect-3')?.y).toBe(0);
    });

    it('aligns objects to bottom', () => {
      const store = useCanvasStore.getState();

      store.alignObjects('bottom');

      const { objects } = useCanvasStore.getState();
      // All should align to bottommost edge (200 + 50 = 250)
      expect(objects.get('rect-1')?.y).toBe(200);
      expect(objects.get('rect-2')?.y).toBe(200);
      expect(objects.get('rect-3')?.y).toBe(200);
    });

    it('requires at least 2 objects for alignment', () => {
      const store = useCanvasStore.getState();
      store.setSelection(['rect-1']);
      const obj1Before = { ...store.objects.get('rect-1') };

      store.alignObjects('left');

      // Position should be unchanged
      expect(useCanvasStore.getState().objects.get('rect-1')?.x).toBe(obj1Before.x);
    });
  });

  describe('Distribution', () => {
    beforeEach(() => {
      const store = useCanvasStore.getState();
      store.addObject(createRectangle('rect-1', { x: 0, y: 0, width: 50, height: 50 }));
      store.addObject(createRectangle('rect-2', { x: 50, y: 50, width: 50, height: 50 }));
      store.addObject(createRectangle('rect-3', { x: 200, y: 200, width: 50, height: 50 }));
      store.setSelection(['rect-1', 'rect-2', 'rect-3']);
    });

    it('distributes objects horizontally', () => {
      const store = useCanvasStore.getState();

      store.distributeObjects('horizontal');

      const { objects } = useCanvasStore.getState();
      // Objects should be evenly spaced
      const positions = [
        objects.get('rect-1')?.x ?? 0,
        objects.get('rect-2')?.x ?? 0,
        objects.get('rect-3')?.x ?? 0,
      ].sort((a, b) => a - b);

      // Gap between first and second should equal gap between second and third
      const gap1 = positions[1] - positions[0];
      const gap2 = positions[2] - positions[1];
      expect(gap1).toBeCloseTo(gap2, 1);
    });

    it('requires at least 3 objects for distribution', () => {
      const store = useCanvasStore.getState();
      store.setSelection(['rect-1', 'rect-2']);
      const obj1Before = { ...store.objects.get('rect-1') };
      const obj2Before = { ...store.objects.get('rect-2') };

      store.distributeObjects('horizontal');

      // Positions should be unchanged
      expect(useCanvasStore.getState().objects.get('rect-1')?.x).toBe(obj1Before.x);
      expect(useCanvasStore.getState().objects.get('rect-2')?.x).toBe(obj2Before.x);
    });
  });

  describe('Z-Index Ordering', () => {
    beforeEach(() => {
      const store = useCanvasStore.getState();
      store.addObject(createRectangle('rect-1', { zIndex: 1 }));
      store.addObject(createRectangle('rect-2', { zIndex: 2 }));
      store.addObject(createRectangle('rect-3', { zIndex: 3 }));
    });

    it('reorders object to new z-index', () => {
      const store = useCanvasStore.getState();

      store.reorderObject('rect-1', 3);

      const { objects } = useCanvasStore.getState();
      expect(objects.get('rect-1')?.zIndex).toBe(3);
    });

    it('getNextZIndex returns incrementing value', () => {
      const store = useCanvasStore.getState();

      const z1 = store.getNextZIndex();
      store.addObject(createRectangle('rect-4', { zIndex: z1 }));
      const z2 = store.getNextZIndex();

      expect(z2).toBeGreaterThan(z1);
    });
  });

  describe('Cursor Position', () => {
    it('sets cursor position', () => {
      const store = useCanvasStore.getState();

      store.setCursorPosition({ x: 150, y: 250 });

      const { cursorPosition } = useCanvasStore.getState();
      expect(cursorPosition).toEqual({ x: 150, y: 250 });
    });

    it('clears cursor position with null', () => {
      const store = useCanvasStore.getState();
      store.setCursorPosition({ x: 100, y: 100 });

      store.setCursorPosition(null);

      const { cursorPosition } = useCanvasStore.getState();
      expect(cursorPosition).toBeNull();
    });
  });

  describe('Group Editing', () => {
    it('enters group edit mode', () => {
      const store = useCanvasStore.getState();
      // Add a group object (simplified)
      store.addObject({
        id: 'group-1',
        type: 'group',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        children: ['rect-1'],
      } as CanvasObject);

      store.enterGroupEditMode('group-1');

      expect(useGroupStore.getState().editingGroupId).toBe('group-1');
    });

    it('exits group edit mode', () => {
      const store = useCanvasStore.getState();
      store.addObject({
        id: 'group-1',
        type: 'group',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        children: [],
      } as CanvasObject);
      store.enterGroupEditMode('group-1');

      store.exitGroupEditMode();

      expect(useGroupStore.getState().editingGroupId).toBeNull();
    });
  });

  describe('Minimap Toggle', () => {
    it('toggles minimap visibility', () => {
      const store = useCanvasStore.getState();
      expect(useViewportStore.getState().showMinimap).toBe(false);

      store.toggleMinimap();
      expect(useViewportStore.getState().showMinimap).toBe(true);

      store.toggleMinimap();
      expect(useViewportStore.getState().showMinimap).toBe(false);
    });
  });
});
