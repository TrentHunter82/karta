import { FrameTool } from '../../../src/tools/FrameTool';
import type { ToolContext } from '../../../src/tools/types';
import { createMockContext, createMockMouseEvent, createMockKeyboardEvent } from './testUtils';

describe('FrameTool', () => {
  let tool: FrameTool;
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

    tool = new FrameTool(mockContext);
  });

  describe('initialization', () => {
    it('has the correct name', () => {
      expect(tool.name).toBe('frame');
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

    it('creates a preview frame', () => {
      const event = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(event);

      expect(mockContext.addObject).toHaveBeenCalled();
      const addedObj = vi.mocked(mockContext.addObject).mock.calls[0][0];
      expect(addedObj.type).toBe('frame');
      expect(addedObj.name).toBe('Frame');
      expect(addedObj.fill).toBe('#2a2a2a');
      expect(addedObj.stroke).toBe('#3a3a3a');
    });

    it('does not handle non-left mouse button', () => {
      const event = createMockMouseEvent({ button: 2 });
      const result = tool.onMouseDown(event);

      expect(result.handled).toBe(false);
    });
  });

  describe('onMouseMove', () => {
    it('updates preview frame dimensions', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      const moveEvent = createMockMouseEvent({ canvasX: 250, canvasY: 200 });
      const result = tool.onMouseMove(moveEvent);

      expect(result.handled).toBe(true);
      const updateCall = vi.mocked(mockContext.updateObject).mock.calls[0];
      expect(updateCall[1].width).toBe(200);
      expect(updateCall[1].height).toBe(150);
    });

    it('handles negative drag direction', () => {
      const downEvent = createMockMouseEvent({ canvasX: 250, canvasY: 200 });
      tool.onMouseDown(downEvent);

      const moveEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseMove(moveEvent);

      const updateCall = vi.mocked(mockContext.updateObject).mock.calls[0];
      expect(updateCall[1].x).toBe(50);
      expect(updateCall[1].y).toBe(50);
      expect(updateCall[1].width).toBe(200);
      expect(updateCall[1].height).toBe(150);
    });

    it('does not update when not drawing', () => {
      const moveEvent = createMockMouseEvent({ canvasX: 150, canvasY: 100 });
      const result = tool.onMouseMove(moveEvent);

      expect(result.handled).toBe(false);
    });
  });

  describe('onMouseUp', () => {
    it('finalizes frame creation and switches to select tool', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

      const moveEvent = createMockMouseEvent({ canvasX: 250, canvasY: 200 });
      tool.onMouseMove(moveEvent);

      const upEvent = createMockMouseEvent();
      const result = tool.onMouseUp(upEvent);

      expect(result.handled).toBe(true);
      expect(mockContext.setSelection).toHaveBeenCalled();
      expect(mockContext.setActiveTool).toHaveBeenCalledWith('select');
    });

    it('deletes frame if too small', () => {
      const downEvent = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(downEvent);

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
  });
});
