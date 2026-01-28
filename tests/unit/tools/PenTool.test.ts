import { PenTool } from '../../../src/tools/PenTool';
import type { ToolContext } from '../../../src/tools/types';
import { createMockContext, createMockMouseEvent, createMockKeyboardEvent } from './testUtils';

describe('PenTool', () => {
  let tool: PenTool;
  let mockContext: ToolContext;
  let objectsMap: Map<string, any>;

  beforeEach(() => {
    objectsMap = new Map();
    mockContext = createMockContext(objectsMap);
    vi.mocked(mockContext.addObject).mockImplementation((obj) => {
      objectsMap.set(obj.id, obj);
    });
    vi.mocked(mockContext.deleteObject).mockImplementation((id) => {
      objectsMap.delete(id);
    });
    vi.mocked(mockContext.updateObject).mockImplementation((id, changes) => {
      const obj = objectsMap.get(id);
      if (obj) {
        objectsMap.set(id, { ...obj, ...changes });
      }
    });

    tool = new PenTool(mockContext);
  });

  describe('initialization', () => {
    it('has the correct name', () => {
      expect(tool.name).toBe('pen');
    });

    it('initializes with crosshair cursor', () => {
      expect(tool.getCursor()).toBe('crosshair');
    });

    it('initializes with correct default state', () => {
      const state = tool.getState();
      expect(state.cursor).toBe('crosshair');
      expect(state.isActive).toBe(false);
    });
  });

  describe('onActivate', () => {
    it('clears selection on activation', () => {
      tool.onActivate();
      expect(mockContext.setSelection).toHaveBeenCalledWith([]);
    });

    it('sets cursor to crosshair', () => {
      tool.onActivate();
      expect(mockContext.setCursor).toHaveBeenCalledWith('crosshair');
    });
  });

  describe('onMouseDown', () => {
    it('starts drawing on left mouse button', () => {
      const event = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      const result = tool.onMouseDown(event);

      expect(result.handled).toBe(true);
    });

    it('creates a preview path', () => {
      const event = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(event);

      expect(mockContext.addObject).toHaveBeenCalled();
      const addedObj = vi.mocked(mockContext.addObject).mock.calls[0][0];
      expect(addedObj.type).toBe('path');
      expect(addedObj.stroke).toBe('#ffffff');
      expect(addedObj.strokeWidth).toBe(2);
    });

    it('starts with initial point', () => {
      const event = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(event);

      const addedObj = vi.mocked(mockContext.addObject).mock.calls[0][0];
      expect(addedObj.points).toHaveLength(1);
      expect(addedObj.points[0]).toEqual({ x: 0, y: 0 });
    });

    it('does not handle non-left mouse button', () => {
      const event = createMockMouseEvent({ button: 2 });
      const result = tool.onMouseDown(event);

      expect(result.handled).toBe(false);
      expect(mockContext.addObject).not.toHaveBeenCalled();
    });
  });

  describe('onMouseMove', () => {
    it('adds points while drawing', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      const moveEvent1 = createMockMouseEvent({ canvasX: 75, canvasY: 60 });
      tool.onMouseMove(moveEvent1);

      const moveEvent2 = createMockMouseEvent({ canvasX: 100, canvasY: 75 });
      const result = tool.onMouseMove(moveEvent2);

      expect(result.handled).toBe(true);
      expect(mockContext.updateObject).toHaveBeenCalled();
    });

    it('updates path bounding box and points', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      const moveEvent = createMockMouseEvent({ canvasX: 100, canvasY: 100 });
      tool.onMouseMove(moveEvent);

      const updateCall = vi.mocked(mockContext.updateObject).mock.calls[0];
      // Bounding box should encompass all points
      expect(updateCall[1].x).toBe(50);
      expect(updateCall[1].y).toBe(50);
      expect(updateCall[1].width).toBe(50);
      expect(updateCall[1].height).toBe(50);
      // Points should be normalized to bounding box
      expect(updateCall[1].points).toBeDefined();
    });

    it('does not update when not drawing', () => {
      const moveEvent = createMockMouseEvent({ canvasX: 100, canvasY: 100 });
      const result = tool.onMouseMove(moveEvent);

      expect(result.handled).toBe(false);
      expect(mockContext.updateObject).not.toHaveBeenCalled();
    });
  });

  describe('onMouseUp', () => {
    it('finalizes path creation and stays in pen tool', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      const moveEvent = createMockMouseEvent({ canvasX: 100, canvasY: 100 });
      tool.onMouseMove(moveEvent);

      const upEvent = createMockMouseEvent();
      const result = tool.onMouseUp(upEvent);

      expect(result.handled).toBe(true);
      // PenTool stays active for continuous drawing (fixed in session 3)
      expect(mockContext.setActiveTool).not.toHaveBeenCalled();
    });

    it('deletes path if too few points', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      // Don't add any additional points
      tool.onMouseUp(createMockMouseEvent());

      expect(mockContext.deleteObject).toHaveBeenCalled();
    });

    it('does not delete path with enough points', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      // Add at least one more point
      const moveEvent = createMockMouseEvent({ canvasX: 100, canvasY: 100 });
      tool.onMouseMove(moveEvent);

      tool.onMouseUp(createMockMouseEvent());

      expect(mockContext.deleteObject).not.toHaveBeenCalled();
    });

    it('does not handle if not drawing', () => {
      const upEvent = createMockMouseEvent();
      const result = tool.onMouseUp(upEvent);

      expect(result.handled).toBe(false);
    });
  });

  describe('onKeyDown', () => {
    it('cancels drawing with Escape key', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      const escEvent = createMockKeyboardEvent({ key: 'Escape' });
      const result = tool.onKeyDown(escEvent);

      expect(result.handled).toBe(true);
      expect(mockContext.deleteObject).toHaveBeenCalled();
    });

    it('does not cancel if not drawing', () => {
      const escEvent = createMockKeyboardEvent({ key: 'Escape' });
      const result = tool.onKeyDown(escEvent);

      expect(result.handled).toBe(false);
      expect(mockContext.deleteObject).not.toHaveBeenCalled();
    });
  });

  describe('path calculations', () => {
    it('normalizes points relative to bounding box', () => {
      const downEvent = createMockMouseEvent({ canvasX: 100, canvasY: 100 });
      tool.onMouseDown(downEvent);

      const moveEvent1 = createMockMouseEvent({ canvasX: 150, canvasY: 120 });
      tool.onMouseMove(moveEvent1);

      const moveEvent2 = createMockMouseEvent({ canvasX: 200, canvasY: 150 });
      tool.onMouseMove(moveEvent2);

      // Get the last update call
      const updateCalls = vi.mocked(mockContext.updateObject).mock.calls;
      const lastUpdate = updateCalls[updateCalls.length - 1];

      // Bounding box should start at min x,y
      expect(lastUpdate[1].x).toBe(100);
      expect(lastUpdate[1].y).toBe(100);

      // Points should be normalized (first point at 0,0)
      expect(lastUpdate[1].points[0]).toEqual({ x: 0, y: 0 });
    });
  });
});
