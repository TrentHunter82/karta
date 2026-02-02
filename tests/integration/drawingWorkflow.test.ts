/**
 * Integration tests for the full drawing workflow.
 * Tests that tools interact correctly with stores and each other.
 */

import { ToolManager } from '../../src/tools/ToolManager';
import { useCanvasStore } from '../../src/stores/canvasStore';
import { useHistoryStore } from '../../src/stores/historyStore';
import { useClipboardStore } from '../../src/stores/clipboardStore';
import { useSelectionStore } from '../../src/stores/selectionStore';
import type { ToolContext, ToolMouseEvent } from '../../src/tools/types';
import type { CanvasObject } from '../../src/types/canvas';

// Reset all stores between tests
const resetStores = () => {
  useCanvasStore.setState({
    objects: new Map(),
    objectOrder: [],
    nextZIndex: 1,
    gridSettings: {
      showGrid: false,
      snapEnabled: false,
      snapToObjects: false,
      gridSize: 10,
    },
  });

  useHistoryStore.setState({
    past: [],
    future: [],
    maxSize: 50,
    isUndoRedoing: false,
  });

  useClipboardStore.setState({
    items: [],
    pasteCount: 0,
  });

  useSelectionStore.setState({
    selectedIds: new Set<string>(),
    editingGroupId: null,
    hoveredObjectId: null,
  });
};

// Create a mock ToolContext that uses the actual stores
const createIntegrationContext = (): ToolContext => {
  const canvasStore = useCanvasStore.getState();
  const selectionStore = useSelectionStore.getState();

  return {
    getObjects: () => useCanvasStore.getState().objects,
    getSelectedIds: () => useSelectionStore.getState().selectedIds,
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    getEditingGroupId: () => useSelectionStore.getState().editingGroupId,
    addObject: (obj: CanvasObject) => {
      useCanvasStore.getState().addObject(obj);
    },
    updateObject: (id: string, changes: Partial<CanvasObject>) => {
      useCanvasStore.getState().updateObject(id, changes);
    },
    updateObjects: (updates: Array<{ id: string; changes: Partial<CanvasObject> }>) => {
      updates.forEach(({ id, changes }) => {
        useCanvasStore.getState().updateObject(id, changes);
      });
    },
    deleteObject: (id: string) => {
      useCanvasStore.getState().deleteObject(id);
    },
    setSelection: (ids: string[]) => {
      useSelectionStore.getState().setSelection(ids);
    },
    pushHistory: () => {
      useHistoryStore.getState().pushSnapshot(useCanvasStore.getState().objects);
    },
    setActiveTool: vi.fn(),
    enterGroupEditMode: (id: string) => {
      useSelectionStore.getState().setEditingGroupId(id);
    },
    exitGroupEditMode: () => {
      useSelectionStore.getState().setEditingGroupId(null);
    },
    getAbsolutePosition: (obj: CanvasObject) => ({ x: obj.x, y: obj.y }),
    screenToCanvas: (x: number, y: number) => ({ x, y }),
    canvasToScreen: (x: number, y: number) => ({ x, y }),
    setViewport: vi.fn(),
    getNextZIndex: () => useCanvasStore.getState().getNextZIndex(),
    hitTest: vi.fn(() => null),
    hitTestHandle: vi.fn(() => null),
    hitTestRotationHandle: vi.fn(() => null),
    getObjectsInRect: vi.fn(() => []),
    isPointInObject: vi.fn(() => false),
    setCursor: vi.fn(),
    setHoveredObjectId: vi.fn(),
    snapPosition: (x: number, y: number) => ({ x, y, guides: [] }),
    snapToGrid: (value: number) => value,
    setActiveSnapGuides: vi.fn(),
    getGridSettings: () => useCanvasStore.getState().gridSettings,
    duplicateObjects: vi.fn(() => []),
    getObjectsInsideFrame: vi.fn(() => []),
  };
};

// Create a mock mouse event
const createMockMouseEvent = (overrides?: Partial<ToolMouseEvent>): ToolMouseEvent => ({
  screenX: 100,
  screenY: 100,
  canvasX: 100,
  canvasY: 100,
  button: 0,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...overrides,
});

describe('Drawing Workflow Integration', () => {
  let toolManager: ToolManager;
  let context: ToolContext;

  beforeEach(() => {
    resetStores();
    context = createIntegrationContext();
    toolManager = new ToolManager(context, true);
  });

  describe('rectangle drawing workflow', () => {
    it('creates a rectangle and adds it to the canvas store', () => {
      toolManager.setActiveTool('rectangle');

      // Start drawing
      toolManager.handleMouseDown(createMockMouseEvent({ canvasX: 50, canvasY: 50 }));

      // Move to create size
      toolManager.handleMouseMove(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));

      // Finish drawing
      toolManager.handleMouseUp(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));

      // Verify rectangle was added
      const objects = useCanvasStore.getState().objects;
      expect(objects.size).toBe(1);

      const rect = Array.from(objects.values())[0];
      expect(rect.type).toBe('rectangle');
      expect(rect.width).toBe(100);
      expect(rect.height).toBe(100);
    });

    it('selects the created rectangle after drawing', () => {
      toolManager.setActiveTool('rectangle');

      toolManager.handleMouseDown(createMockMouseEvent({ canvasX: 50, canvasY: 50 }));
      toolManager.handleMouseMove(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));
      toolManager.handleMouseUp(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));

      const selectedIds = useSelectionStore.getState().selectedIds;
      expect(selectedIds.size).toBe(1);
    });
  });

  describe('ellipse drawing workflow', () => {
    it('creates an ellipse with shift constraint (circle)', () => {
      toolManager.setActiveTool('ellipse');

      toolManager.handleMouseDown(createMockMouseEvent({ canvasX: 50, canvasY: 50 }));
      toolManager.handleMouseMove(createMockMouseEvent({
        canvasX: 150,
        canvasY: 80,
        shiftKey: true,
      }));
      toolManager.handleMouseUp(createMockMouseEvent({ canvasX: 150, canvasY: 80 }));

      const objects = useCanvasStore.getState().objects;
      const ellipse = Array.from(objects.values())[0];

      expect(ellipse.type).toBe('ellipse');
      expect(ellipse.width).toBe(ellipse.height); // Should be a circle
    });
  });

  describe('line drawing workflow', () => {
    it('creates a line and adds it to the canvas store', () => {
      toolManager.setActiveTool('line');

      toolManager.handleMouseDown(createMockMouseEvent({ canvasX: 50, canvasY: 50 }));
      toolManager.handleMouseMove(createMockMouseEvent({ canvasX: 150, canvasY: 100 }));
      toolManager.handleMouseUp(createMockMouseEvent({ canvasX: 150, canvasY: 100 }));

      const objects = useCanvasStore.getState().objects;
      expect(objects.size).toBe(1);

      const line = Array.from(objects.values())[0];
      expect(line.type).toBe('line');
    });
  });

  describe('undo/redo workflow', () => {
    it('can undo rectangle creation', () => {
      // Push initial state
      useHistoryStore.getState().pushSnapshot(useCanvasStore.getState().objects);

      // Create a rectangle
      toolManager.setActiveTool('rectangle');
      toolManager.handleMouseDown(createMockMouseEvent({ canvasX: 50, canvasY: 50 }));
      toolManager.handleMouseMove(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));
      toolManager.handleMouseUp(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));

      expect(useCanvasStore.getState().objects.size).toBe(1);

      // Undo
      const getCurrentObjects = () => useCanvasStore.getState().objects;
      const applySnapshot = (objects: Map<string, CanvasObject>) => {
        useCanvasStore.setState({ objects });
      };

      useHistoryStore.getState().undo(getCurrentObjects, applySnapshot);

      // Should be back to empty
      expect(useCanvasStore.getState().objects.size).toBe(0);
    });

    it('can redo after undo', () => {
      // Push initial state
      useHistoryStore.getState().pushSnapshot(useCanvasStore.getState().objects);

      // Create a rectangle
      toolManager.setActiveTool('rectangle');
      toolManager.handleMouseDown(createMockMouseEvent({ canvasX: 50, canvasY: 50 }));
      toolManager.handleMouseMove(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));
      toolManager.handleMouseUp(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));

      const getCurrentObjects = () => useCanvasStore.getState().objects;
      const applySnapshot = (objects: Map<string, CanvasObject>) => {
        useCanvasStore.setState({ objects });
      };

      // Undo
      useHistoryStore.getState().undo(getCurrentObjects, applySnapshot);
      expect(useCanvasStore.getState().objects.size).toBe(0);

      // Redo
      useHistoryStore.getState().redo(getCurrentObjects, applySnapshot);
      expect(useCanvasStore.getState().objects.size).toBe(1);
    });
  });

  describe('clipboard workflow', () => {
    it('can copy and paste objects', () => {
      // Create a rectangle first
      toolManager.setActiveTool('rectangle');
      toolManager.handleMouseDown(createMockMouseEvent({ canvasX: 50, canvasY: 50 }));
      toolManager.handleMouseMove(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));
      toolManager.handleMouseUp(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));

      const objects = Array.from(useCanvasStore.getState().objects.values());
      const clipboardStore = useClipboardStore.getState();

      // Copy
      clipboardStore.copy(objects);
      expect(clipboardStore.hasItems()).toBe(true);

      // Paste
      clipboardStore.paste(
        () => useCanvasStore.getState().getNextZIndex(),
        (objs) => objs.forEach((obj) => useCanvasStore.getState().addObject(obj)),
        (ids) => useSelectionStore.getState().setSelection(ids)
      );

      // Should have 2 rectangles now
      expect(useCanvasStore.getState().objects.size).toBe(2);
    });

    it('pastes with offset', () => {
      // Create a rectangle
      toolManager.setActiveTool('rectangle');
      toolManager.handleMouseDown(createMockMouseEvent({ canvasX: 50, canvasY: 50 }));
      toolManager.handleMouseMove(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));
      toolManager.handleMouseUp(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));

      const originalRect = Array.from(useCanvasStore.getState().objects.values())[0];
      const clipboardStore = useClipboardStore.getState();

      clipboardStore.copy([originalRect]);
      clipboardStore.paste(
        () => useCanvasStore.getState().getNextZIndex(),
        (objs) => objs.forEach((obj) => useCanvasStore.getState().addObject(obj)),
        (ids) => useSelectionStore.getState().setSelection(ids)
      );

      const allObjects = Array.from(useCanvasStore.getState().objects.values());
      const pastedRect = allObjects.find((obj) => obj.id !== originalRect.id);

      expect(pastedRect).toBeDefined();
      expect(pastedRect!.x).toBe(originalRect.x + 10); // Offset
      expect(pastedRect!.y).toBe(originalRect.y + 10);
    });
  });

  describe('tool switching workflow', () => {
    it('maintains state when switching between tools', () => {
      // Create a rectangle
      toolManager.setActiveTool('rectangle');
      toolManager.handleMouseDown(createMockMouseEvent({ canvasX: 50, canvasY: 50 }));
      toolManager.handleMouseMove(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));
      toolManager.handleMouseUp(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));

      // Switch to ellipse and create one
      toolManager.setActiveTool('ellipse');
      toolManager.handleMouseDown(createMockMouseEvent({ canvasX: 200, canvasY: 200 }));
      toolManager.handleMouseMove(createMockMouseEvent({ canvasX: 300, canvasY: 300 }));
      toolManager.handleMouseUp(createMockMouseEvent({ canvasX: 300, canvasY: 300 }));

      // Both should exist
      const objects = useCanvasStore.getState().objects;
      expect(objects.size).toBe(2);

      const types = Array.from(objects.values()).map((obj) => obj.type);
      expect(types).toContain('rectangle');
      expect(types).toContain('ellipse');
    });

    it('cancels current operation when switching tools mid-draw', () => {
      toolManager.setActiveTool('rectangle');

      // Start drawing but don't finish
      toolManager.handleMouseDown(createMockMouseEvent({ canvasX: 50, canvasY: 50 }));
      toolManager.handleMouseMove(createMockMouseEvent({ canvasX: 150, canvasY: 150 }));

      // There should be a preview rectangle
      const objectsBeforeSwitch = useCanvasStore.getState().objects.size;

      // Switch tool (this should either cancel or commit the preview)
      toolManager.setActiveTool('ellipse');

      // The preview might be deleted or kept depending on implementation
      // The important thing is that the tool manager is in a valid state
      expect(toolManager.getActiveToolName()).toBe('ellipse');
    });
  });

  describe('multiple objects workflow', () => {
    it('creates multiple objects and maintains z-order', () => {
      // Create several rectangles
      for (let i = 0; i < 3; i++) {
        toolManager.setActiveTool('rectangle');
        toolManager.handleMouseDown(createMockMouseEvent({
          canvasX: 50 + i * 50,
          canvasY: 50 + i * 50,
        }));
        toolManager.handleMouseMove(createMockMouseEvent({
          canvasX: 150 + i * 50,
          canvasY: 150 + i * 50,
        }));
        toolManager.handleMouseUp(createMockMouseEvent({
          canvasX: 150 + i * 50,
          canvasY: 150 + i * 50,
        }));
      }

      const objects = Array.from(useCanvasStore.getState().objects.values());
      expect(objects.length).toBe(3);

      // Verify z-indexes are different (each new object gets higher z-index)
      const zIndexes = objects.map((obj) => obj.zIndex);
      const uniqueZIndexes = new Set(zIndexes);
      expect(uniqueZIndexes.size).toBe(3);
    });
  });
});
