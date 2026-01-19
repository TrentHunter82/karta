import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TextTool } from '../../../src/tools/TextTool';
import type { ToolContext } from '../../../src/tools/types';
import { createMockContext, createMockMouseEvent } from './testUtils';

describe('TextTool', () => {
  let tool: TextTool;
  let mockContext: ToolContext;
  let objectsMap: Map<string, any>;

  beforeEach(() => {
    objectsMap = new Map();
    mockContext = createMockContext(objectsMap);
    vi.mocked(mockContext.addObject).mockImplementation((obj) => {
      objectsMap.set(obj.id, obj);
    });

    tool = new TextTool(mockContext);
  });

  describe('initialization', () => {
    it('has the correct name', () => {
      expect(tool.name).toBe('text');
    });

    it('initializes with text cursor', () => {
      expect(tool.getCursor()).toBe('text');
    });

    it('initializes with correct default state', () => {
      const state = tool.getState();
      expect(state.cursor).toBe('text');
      expect(state.isActive).toBe(false);
    });
  });

  describe('onActivate', () => {
    it('sets cursor to text on activation', () => {
      tool.onActivate();
      expect(mockContext.setCursor).toHaveBeenCalledWith('text');
    });
  });

  describe('onMouseDown', () => {
    it('creates a text object on left mouse button', () => {
      const event = createMockMouseEvent({ canvasX: 100, canvasY: 150 });
      const result = tool.onMouseDown(event);

      expect(result.handled).toBe(true);
      expect(mockContext.addObject).toHaveBeenCalled();
    });

    it('creates text object with correct properties', () => {
      const event = createMockMouseEvent({ canvasX: 100, canvasY: 150 });
      tool.onMouseDown(event);

      const addedObj = vi.mocked(mockContext.addObject).mock.calls[0][0];
      expect(addedObj.type).toBe('text');
      expect(addedObj.x).toBe(100);
      expect(addedObj.y).toBe(150);
      expect(addedObj.text).toBe('');
      expect(addedObj.fontSize).toBe(16);
      expect(addedObj.fontFamily).toBe('Inter, system-ui, sans-serif');
      expect(addedObj.fill).toBe('#ffffff');
      expect(addedObj.textAlign).toBe('left');
    });

    it('selects the new text object', () => {
      const event = createMockMouseEvent({ canvasX: 100, canvasY: 150 });
      tool.onMouseDown(event);

      expect(mockContext.setSelection).toHaveBeenCalled();
      const selectionCall = vi.mocked(mockContext.setSelection).mock.calls[0];
      expect(selectionCall[0].length).toBe(1);
    });

    it('switches to select tool after creation', () => {
      const event = createMockMouseEvent({ canvasX: 100, canvasY: 150 });
      tool.onMouseDown(event);

      expect(mockContext.setActiveTool).toHaveBeenCalledWith('select');
    });

    it('requests redraw to trigger text editing', () => {
      const event = createMockMouseEvent({ canvasX: 100, canvasY: 150 });
      const result = tool.onMouseDown(event);

      expect(result.requestRedraw).toBe(true);
    });

    it('does not handle non-left mouse button', () => {
      const event = createMockMouseEvent({ button: 2 });
      const result = tool.onMouseDown(event);

      expect(result.handled).toBe(false);
      expect(mockContext.addObject).not.toHaveBeenCalled();
    });
  });

  describe('onMouseMove', () => {
    it('does not handle mouse move events', () => {
      const event = createMockMouseEvent();
      const result = tool.onMouseMove(event);

      expect(result.handled).toBe(false);
    });
  });

  describe('onMouseUp', () => {
    it('does not handle mouse up events', () => {
      const event = createMockMouseEvent();
      const result = tool.onMouseUp(event);

      expect(result.handled).toBe(false);
    });
  });

  describe('text object defaults', () => {
    it('creates text with default dimensions', () => {
      const event = createMockMouseEvent({ canvasX: 100, canvasY: 150 });
      tool.onMouseDown(event);

      const addedObj = vi.mocked(mockContext.addObject).mock.calls[0][0];
      expect(addedObj.width).toBe(100);
      expect(addedObj.height).toBe(24);
    });

    it('creates text with correct font properties', () => {
      const event = createMockMouseEvent({ canvasX: 100, canvasY: 150 });
      tool.onMouseDown(event);

      const addedObj = vi.mocked(mockContext.addObject).mock.calls[0][0];
      expect(addedObj.fontWeight).toBe(400);
      expect(addedObj.fontStyle).toBe('normal');
      expect(addedObj.textDecoration).toBe('none');
      expect(addedObj.lineHeight).toBe(1.2);
    });
  });
});
