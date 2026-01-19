import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArrowTool } from '../../../src/tools/ArrowTool';
import type { ToolContext } from '../../../src/tools/types';
import { createMockContext, createMockMouseEvent, createMockKeyboardEvent } from './testUtils';

describe('ArrowTool', () => {
  let tool: ArrowTool;
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

    tool = new ArrowTool(mockContext);
  });

  describe('initialization', () => {
    it('has the correct name', () => {
      expect(tool.name).toBe('arrow');
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

    it('creates a preview arrow with correct properties', () => {
      const event = createMockMouseEvent({ canvasX: 50, canvasY: 50 });
      tool.onMouseDown(event);

      expect(mockContext.addObject).toHaveBeenCalled();
      const addedObj = vi.mocked(mockContext.addObject).mock.calls[0][0];
      expect(addedObj.type).toBe('arrow');
      expect(addedObj.arrowStart).toBe(false);
      expect(addedObj.arrowEnd).toBe(true);
      expect(addedObj.arrowSize).toBe(1);
    });

    it('does not handle non-left mouse button', () => {
      const event = createMockMouseEvent({ button: 2 });
      const result = tool.onMouseDown(event);

      expect(result.handled).toBe(false);
    });
  });

  describe('onMouseMove', () => {
    it('updates preview arrow endpoints', () => {
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

      const moveEvent = createMockMouseEvent({
        canvasX: 150,
        canvasY: 70,
        shiftKey: true,
      });
      tool.onMouseMove(moveEvent);

      expect(mockContext.updateObject).toHaveBeenCalled();
    });

    it('does not update when not drawing', () => {
      const moveEvent = createMockMouseEvent({ canvasX: 150, canvasY: 100 });
      const result = tool.onMouseMove(moveEvent);

      expect(result.handled).toBe(false);
    });
  });

  describe('onMouseUp', () => {
    it('finalizes arrow creation and switches to select tool', () => {
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

    it('deletes arrow if too short', () => {
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
