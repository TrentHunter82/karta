import { LineTool } from '../../../src/tools/LineTool';
import type { ToolContext } from '../../../src/tools/types';
import { createMockContext, createMockMouseEvent, createMockKeyboardEvent } from './testUtils';

describe('LineTool', () => {
  let tool: LineTool;
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

    tool = new LineTool(mockContext);
  });

  describe('initialization', () => {
    it('has the correct name', () => {
      expect(tool.name).toBe('line');
    });

    it('initializes with crosshair cursor', () => {
      expect(tool.getCursor()).toBe('crosshair');
    });
  });

  describe('onActivate', () => {
    it('clears selection on activation', () => {
      tool.onActivate();
      expect(mockContext.setSelection).toHaveBeenCalledWith([]);
    });
  });

  describe('onMouseDown', () => {
    it('starts drawing on left mouse button', () => {
      const event = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      const result = tool.onMouseDown(event);

      expect(result.handled).toBe(true);
    });

    it('creates a preview line', () => {
      const event = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(event);

      expect(mockContext.addObject).toHaveBeenCalled();
      const addedObj = vi.mocked(mockContext.addObject).mock.calls[0][0];
      expect(addedObj.type).toBe('line');
      expect(addedObj.stroke).toBe('#ffffff');
      expect(addedObj.strokeWidth).toBe(2);
    });

    it('does not handle non-left mouse button', () => {
      const event = createMockMouseEvent({ button: 2 });
      const result = tool.onMouseDown(event);

      expect(result.handled).toBe(false);
    });
  });

  describe('onMouseMove', () => {
    it('updates preview line endpoints', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      const moveEvent = createMockMouseEvent({ canvasX: 150, canvasY: 100 });
      const result = tool.onMouseMove(moveEvent);

      expect(result.handled).toBe(true);
      expect(mockContext.updateObject).toHaveBeenCalled();
    });

    it('constrains to 45° angles with shift key', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      // Move at approximately 30° angle (should snap to 0°)
      const moveEvent = createMockMouseEvent({
        canvasX: 150,
        canvasY: 70,
        shiftKey: true,
      });
      tool.onMouseMove(moveEvent);

      // The line should be constrained - check that update was called
      expect(mockContext.updateObject).toHaveBeenCalled();
    });

    it('does not update when not drawing', () => {
      const moveEvent = createMockMouseEvent({ canvasX: 150, canvasY: 100 });
      const result = tool.onMouseMove(moveEvent);

      expect(result.handled).toBe(false);
    });
  });

  describe('onMouseUp', () => {
    it('finalizes line creation and switches to select tool', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      const moveEvent = createMockMouseEvent({ canvasX: 150, canvasY: 100 });
      tool.onMouseMove(moveEvent);

      const upEvent = createMockMouseEvent();
      const result = tool.onMouseUp(upEvent);

      expect(result.handled).toBe(true);
      expect(mockContext.setSelection).toHaveBeenCalled();
      expect(mockContext.setActiveTool).toHaveBeenCalledWith('select');
    });

    it('deletes line if too short', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      // Create a tiny line
      const moveEvent = createMockMouseEvent({ canvasX: 52, canvasY: 52 });
      tool.onMouseMove(moveEvent);

      tool.onMouseUp(createMockMouseEvent());

      expect(mockContext.deleteObject).toHaveBeenCalled();
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

    it('tracks Shift key state during drawing', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      const shiftEvent = createMockKeyboardEvent({ key: 'Shift' });
      const result = tool.onKeyDown(shiftEvent);

      expect(result.handled).toBe(true);
    });
  });

  describe('line calculations', () => {
    it('calculates correct bounding box for line', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      const moveEvent = createMockMouseEvent({ canvasX: 150, canvasY: 100 });
      tool.onMouseMove(moveEvent);

      const updateCall = vi.mocked(mockContext.updateObject).mock.calls[0];
      // Bounding box should be from (50,50) to (150,100)
      expect(updateCall[1].x).toBe(50);
      expect(updateCall[1].y).toBe(50);
      expect(updateCall[1].width).toBe(100);
      expect(updateCall[1].height).toBe(50);
    });

    it('calculates correct relative endpoints', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      const moveEvent = createMockMouseEvent({ canvasX: 150, canvasY: 100 });
      tool.onMouseMove(moveEvent);

      const updateCall = vi.mocked(mockContext.updateObject).mock.calls[0];
      // Start point relative to bounding box origin
      expect(updateCall[1].x1).toBe(0); // 50 - 50 = 0
      expect(updateCall[1].y1).toBe(0); // 50 - 50 = 0
      // End point relative to bounding box origin
      expect(updateCall[1].x2).toBe(100); // 150 - 50 = 100
      expect(updateCall[1].y2).toBe(50); // 100 - 50 = 50
    });
  });
});
