import { RectangleTool } from '../../../src/tools/RectangleTool';
import type { ToolContext } from '../../../src/tools/types';
import { createMockContext, createMockMouseEvent, createMockKeyboardEvent, createRectangle } from './testUtils';

describe('RectangleTool', () => {
  let tool: RectangleTool;
  let mockContext: ToolContext;
  let objectsMap: Map<string, any>;

  beforeEach(() => {
    objectsMap = new Map();
    mockContext = createMockContext(objectsMap);
    // Mock addObject to add to our map
    vi.mocked(mockContext.addObject).mockImplementation((obj) => {
      objectsMap.set(obj.id, obj);
    });
    // Mock deleteObject to remove from our map
    vi.mocked(mockContext.deleteObject).mockImplementation((id) => {
      objectsMap.delete(id);
    });
    // Mock updateObject to update in our map
    vi.mocked(mockContext.updateObject).mockImplementation((id, changes) => {
      const obj = objectsMap.get(id);
      if (obj) {
        objectsMap.set(id, { ...obj, ...changes });
      }
    });

    tool = new RectangleTool(mockContext);
  });

  describe('initialization', () => {
    it('has the correct name', () => {
      expect(tool.name).toBe('rectangle');
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

    it('creates a preview rectangle', () => {
      const event = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(event);

      expect(mockContext.addObject).toHaveBeenCalled();
      const addedObj = vi.mocked(mockContext.addObject).mock.calls[0][0];
      expect(addedObj.type).toBe('rectangle');
      expect(addedObj.x).toBe(50);
      expect(addedObj.y).toBe(50);
      expect(addedObj.width).toBe(0);
      expect(addedObj.height).toBe(0);
    });

    it('does not handle non-left mouse button', () => {
      const event = createMockMouseEvent({ button: 2 }); // right button
      const result = tool.onMouseDown(event);

      expect(result.handled).toBe(false);
      expect(mockContext.addObject).not.toHaveBeenCalled();
    });
  });

  describe('onMouseMove', () => {
    it('updates preview rectangle dimensions', () => {
      // Start drawing
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      // Move to create rectangle
      const moveEvent = createMockMouseEvent({ canvasX: 150, canvasY: 100 });
      const result = tool.onMouseMove(moveEvent);

      expect(result.handled).toBe(true);
      expect(mockContext.updateObject).toHaveBeenCalled();
      const updateCall = vi.mocked(mockContext.updateObject).mock.calls[0];
      expect(updateCall[1].width).toBe(100); // 150 - 50
      expect(updateCall[1].height).toBe(50); // 100 - 50
    });

    it('handles negative drag direction (top-left)', () => {
      // Start drawing
      const downEvent = createMockMouseEvent({ canvasX: 150, canvasY: 100 });
      tool.onMouseDown(downEvent);

      // Move to create rectangle going up-left
      const moveEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseMove(moveEvent);

      const updateCall = vi.mocked(mockContext.updateObject).mock.calls[0];
      expect(updateCall[1].x).toBe(50); // Normalized position
      expect(updateCall[1].y).toBe(50);
      expect(updateCall[1].width).toBe(100);
      expect(updateCall[1].height).toBe(50);
    });

    it('constrains to square with shift key', () => {
      // Start drawing
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      // Move with shift to create square
      const moveEvent = createMockMouseEvent({
        canvasX: 150,
        canvasY: 80,
        shiftKey: true,
      });
      tool.onMouseMove(moveEvent);

      const updateCall = vi.mocked(mockContext.updateObject).mock.calls[0];
      // Should be a square - the larger dimension wins
      expect(updateCall[1].width).toBe(100); // max(100, 30) = 100
      expect(updateCall[1].height).toBe(100);
    });

    it('does not update when not drawing', () => {
      const moveEvent = createMockMouseEvent({ canvasX: 150, canvasY: 100 });
      const result = tool.onMouseMove(moveEvent);

      expect(result.handled).toBe(false);
      expect(mockContext.updateObject).not.toHaveBeenCalled();
    });
  });

  describe('onMouseUp', () => {
    it('finalizes rectangle creation and switches to select tool', () => {
      // Start drawing
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      // Create a valid size rectangle
      const moveEvent = createMockMouseEvent({ canvasX: 150, canvasY: 150 });
      tool.onMouseMove(moveEvent);

      // Finish drawing
      const upEvent = createMockMouseEvent();
      const result = tool.onMouseUp(upEvent);

      expect(result.handled).toBe(true);
      expect(mockContext.setSelection).toHaveBeenCalled();
      expect(mockContext.setActiveTool).toHaveBeenCalledWith('select');
    });

    it('deletes rectangle if too small', () => {
      // Start drawing
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      // Create a tiny rectangle (accidental click)
      const moveEvent = createMockMouseEvent({ canvasX: 52, canvasY: 52 });
      tool.onMouseMove(moveEvent);

      // Finish drawing
      const upEvent = createMockMouseEvent();
      tool.onMouseUp(upEvent);

      expect(mockContext.deleteObject).toHaveBeenCalled();
    });

    it('does not handle if not drawing', () => {
      const upEvent = createMockMouseEvent();
      const result = tool.onMouseUp(upEvent);

      expect(result.handled).toBe(false);
    });
  });

  describe('onKeyDown', () => {
    it('cancels drawing with Escape key', () => {
      // Start drawing
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      // Press Escape
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

    it('updates preview when Shift key is pressed during drawing', () => {
      // Start drawing
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      // Move first
      const moveEvent = createMockMouseEvent({ canvasX: 150, canvasY: 80 });
      tool.onMouseMove(moveEvent);

      // Then press Shift
      const shiftEvent = createMockKeyboardEvent({ key: 'Shift' });
      const result = tool.onKeyDown(shiftEvent);

      expect(result.handled).toBe(true);
      expect(result.requestRedraw).toBe(true);
    });
  });

  describe('onKeyUp', () => {
    it('updates preview when Shift key is released during drawing', () => {
      // Start drawing
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      // Move first
      const moveEvent = createMockMouseEvent({ canvasX: 150, canvasY: 80 });
      tool.onMouseMove(moveEvent);

      // Release Shift
      const shiftEvent = createMockKeyboardEvent({ key: 'Shift' });
      const result = tool.onKeyUp(shiftEvent);

      expect(result.handled).toBe(true);
      expect(result.requestRedraw).toBe(true);
    });
  });
});
