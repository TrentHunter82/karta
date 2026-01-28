import { HandTool } from '../../../src/tools/HandTool';
import type { ToolContext } from '../../../src/tools/types';
import { createMockContext, createMockMouseEvent } from './testUtils';

describe('HandTool', () => {
  let tool: HandTool;
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = createMockContext();
    tool = new HandTool(mockContext);
  });

  describe('initialization', () => {
    it('has the correct name', () => {
      expect(tool.name).toBe('hand');
    });

    it('initializes with grab cursor', () => {
      expect(tool.getCursor()).toBe('grab');
    });

    it('initializes with correct default state', () => {
      const state = tool.getState();
      expect(state.cursor).toBe('grab');
      expect(state.isActive).toBe(false);
    });
  });

  describe('onActivate', () => {
    it('sets cursor to grab on activation', () => {
      tool.onActivate();
      expect(mockContext.setCursor).toHaveBeenCalledWith('grab');
    });
  });

  describe('onMouseDown', () => {
    it('starts panning on left mouse button', () => {
      const event = createMockMouseEvent({ button: 0 });
      const result = tool.onMouseDown(event);

      expect(result.handled).toBe(true);
      expect(result.cursor).toBe('grabbing');
    });

    it('does not handle non-left mouse button', () => {
      const event = createMockMouseEvent({ button: 1 }); // middle button
      const result = tool.onMouseDown(event);

      expect(result.handled).toBe(false);
    });

    it('changes cursor to grabbing during pan', () => {
      const event = createMockMouseEvent({ button: 0 });
      tool.onMouseDown(event);

      expect(tool.getCursor()).toBe('grabbing');
    });
  });

  describe('onMouseMove', () => {
    it('pans viewport when panning is active', () => {
      // Start panning
      const downEvent = createMockMouseEvent({ screenX: 100, screenY: 100 });
      tool.onMouseDown(downEvent);

      // Move mouse
      const moveEvent = createMockMouseEvent({ screenX: 150, screenY: 175 });
      const result = tool.onMouseMove(moveEvent);

      expect(result.handled).toBe(true);
      expect(mockContext.setViewport).toHaveBeenCalledWith({
        x: 50, // 150 - 100 = 50 (at zoom 1)
        y: 75, // 175 - 100 = 75 (at zoom 1)
      });
    });

    it('does not pan when panning is not active', () => {
      const moveEvent = createMockMouseEvent({ screenX: 150, screenY: 175 });
      const result = tool.onMouseMove(moveEvent);

      expect(result.handled).toBe(false);
      expect(mockContext.setViewport).not.toHaveBeenCalled();
    });

    it('handles zoom factor correctly', () => {
      // Mock viewport with zoom 2
      vi.mocked(mockContext.getViewport).mockReturnValue({ x: 0, y: 0, zoom: 2 });

      // Start panning
      const downEvent = createMockMouseEvent({ screenX: 100, screenY: 100 });
      tool.onMouseDown(downEvent);

      // Move mouse
      const moveEvent = createMockMouseEvent({ screenX: 150, screenY: 175 });
      tool.onMouseMove(moveEvent);

      expect(mockContext.setViewport).toHaveBeenCalledWith({
        x: 25, // 50 / 2 = 25 (at zoom 2)
        y: 37.5, // 75 / 2 = 37.5 (at zoom 2)
      });
    });
  });

  describe('onMouseUp', () => {
    it('stops panning and restores grab cursor', () => {
      // Start panning
      const downEvent = createMockMouseEvent({ button: 0 });
      tool.onMouseDown(downEvent);

      // End panning
      const upEvent = createMockMouseEvent();
      const result = tool.onMouseUp(upEvent);

      expect(result.handled).toBe(true);
      expect(result.cursor).toBe('grab');
      expect(tool.getCursor()).toBe('grab');
    });

    it('does not handle if not panning', () => {
      const upEvent = createMockMouseEvent();
      const result = tool.onMouseUp(upEvent);

      expect(result.handled).toBe(false);
    });
  });

  describe('continuous panning', () => {
    it('updates last position on each move', () => {
      // Start panning
      const downEvent = createMockMouseEvent({ screenX: 100, screenY: 100 });
      tool.onMouseDown(downEvent);

      // First move
      const moveEvent1 = createMockMouseEvent({ screenX: 150, screenY: 150 });
      tool.onMouseMove(moveEvent1);

      // Second move - should calculate delta from previous position
      const moveEvent2 = createMockMouseEvent({ screenX: 200, screenY: 200 });
      tool.onMouseMove(moveEvent2);

      // The second call should use delta from 150,150 to 200,200
      expect(mockContext.setViewport).toHaveBeenLastCalledWith({
        x: 50, // 200 - 150 = 50
        y: 50, // 200 - 150 = 50
      });
    });
  });
});
