import { ToolManager } from '../../../src/tools/ToolManager';
import { BaseTool } from '../../../src/tools/BaseTool';
import type {
  ToolContext,
  ToolState,
  ToolMouseEvent,
  ToolEventResult,
} from '../../../src/tools/types';

// Mock tool implementation for testing
class MockTool extends BaseTool {
  get name(): string {
    return 'mock';
  }

  getInitialState(): ToolState {
    return {
      cursor: 'default',
      isActive: false,
    };
  }

  onMouseDown = vi.fn((): ToolEventResult => ({ handled: true }));
  onMouseMove = vi.fn((): ToolEventResult => ({ handled: true }));
  onMouseUp = vi.fn((): ToolEventResult => ({ handled: true }));
  onActivate = vi.fn();
  onDeactivate = vi.fn();
}

class AnotherMockTool extends BaseTool {
  get name(): string {
    return 'another';
  }

  getInitialState(): ToolState {
    return {
      cursor: 'crosshair',
      isActive: false,
    };
  }

  onMouseDown(): ToolEventResult {
    return { handled: false };
  }
  onMouseMove(): ToolEventResult {
    return { handled: false };
  }
  onMouseUp(): ToolEventResult {
    return { handled: false };
  }
}

// Create a mock ToolContext
const createMockContext = (): ToolContext => ({
  getObjects: vi.fn(() => new Map()),
  getSelectedIds: vi.fn(() => new Set()),
  getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  getEditingGroupId: vi.fn(() => null),
  addObject: vi.fn(),
  updateObject: vi.fn(),
  updateObjects: vi.fn(),
  deleteObject: vi.fn(),
  setSelection: vi.fn(),
  pushHistory: vi.fn(),
  setActiveTool: vi.fn(),
  enterGroupEditMode: vi.fn(),
  exitGroupEditMode: vi.fn(),
  getAbsolutePosition: vi.fn((obj) => ({ x: obj.x, y: obj.y })),
  screenToCanvas: vi.fn((x, y) => ({ x, y })),
  canvasToScreen: vi.fn((x, y) => ({ x, y })),
  setViewport: vi.fn(),
  getNextZIndex: vi.fn(() => 1),
  hitTest: vi.fn(() => null),
  hitTestHandle: vi.fn(() => null),
  hitTestRotationHandle: vi.fn(() => null),
  getObjectsInRect: vi.fn(() => []),
  isPointInObject: vi.fn(() => false),
  setCursor: vi.fn(),
});

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

describe('ToolManager', () => {
  let manager: ToolManager;
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = createMockContext();
    // Pass false to disable auto-registration of default tools for testing
    manager = new ToolManager(mockContext, false);
  });

  describe('constructor', () => {
    it('creates a ToolManager with the provided context', () => {
      expect(manager).toBeDefined();
      expect(manager.getContext()).toBe(mockContext);
    });

    it('has no active tool initially', () => {
      expect(manager.getActiveTool()).toBeNull();
      expect(manager.getActiveToolName()).toBeNull();
    });

    it('registers default tools when registerDefaultTools is true', () => {
      const managerWithDefaults = new ToolManager(mockContext, true);
      const toolNames = managerWithDefaults.getToolNames();

      expect(toolNames).toContain('select');
      expect(toolNames).toContain('hand');
      expect(toolNames).toContain('rectangle');
      expect(toolNames).toContain('ellipse');
      expect(toolNames).toContain('frame');
      expect(toolNames).toContain('line');
      expect(toolNames).toContain('arrow');
      expect(toolNames).toContain('text');
      expect(toolNames).toContain('pen');
      expect(toolNames.length).toBe(9);
    });

    it('does not register default tools when registerDefaultTools is false', () => {
      const managerWithoutDefaults = new ToolManager(mockContext, false);
      expect(managerWithoutDefaults.getToolNames().length).toBe(0);
    });
  });

  describe('register', () => {
    it('registers a tool by name', () => {
      const mockTool = new MockTool(mockContext);
      manager.register(mockTool);

      expect(manager.getTool('mock')).toBe(mockTool);
      expect(manager.getToolNames()).toContain('mock');
    });

    it('registers multiple tools', () => {
      const mockTool = new MockTool(mockContext);
      const anotherTool = new AnotherMockTool(mockContext);

      manager.register(mockTool);
      manager.register(anotherTool);

      expect(manager.getToolNames()).toHaveLength(2);
      expect(manager.getToolNames()).toContain('mock');
      expect(manager.getToolNames()).toContain('another');
    });
  });

  describe('unregister', () => {
    it('removes a registered tool', () => {
      const mockTool = new MockTool(mockContext);
      manager.register(mockTool);
      manager.unregister('mock');

      expect(manager.getTool('mock')).toBeUndefined();
      expect(manager.getToolNames()).not.toContain('mock');
    });

    it('deactivates the tool if it was active', () => {
      const mockTool = new MockTool(mockContext);
      manager.register(mockTool);
      manager.setActiveTool('mock');
      manager.unregister('mock');

      expect(manager.getActiveTool()).toBeNull();
      expect(manager.getActiveToolName()).toBeNull();
    });
  });

  describe('setActiveTool', () => {
    it('activates a registered tool', () => {
      const mockTool = new MockTool(mockContext);
      manager.register(mockTool);

      const result = manager.setActiveTool('mock');

      expect(result).toBe(true);
      expect(manager.getActiveTool()).toBe(mockTool);
      expect(manager.getActiveToolName()).toBe('mock');
      expect(mockTool.onActivate).toHaveBeenCalled();
    });

    it('returns false for unknown tool', () => {
      const result = manager.setActiveTool('unknown');

      expect(result).toBe(false);
      expect(manager.getActiveTool()).toBeNull();
    });

    it('deactivates previous tool when switching', () => {
      const mockTool = new MockTool(mockContext);
      const anotherTool = new AnotherMockTool(mockContext);

      manager.register(mockTool);
      manager.register(anotherTool);

      manager.setActiveTool('mock');
      manager.setActiveTool('another');

      expect(mockTool.onDeactivate).toHaveBeenCalled();
      expect(manager.getActiveTool()).toBe(anotherTool);
    });
  });

  describe('event routing', () => {
    it('routes mouse down to active tool', () => {
      const mockTool = new MockTool(mockContext);
      manager.register(mockTool);
      manager.setActiveTool('mock');

      const event = createMockMouseEvent();
      const result = manager.handleMouseDown(event);

      expect(mockTool.onMouseDown).toHaveBeenCalledWith(event);
      expect(result.handled).toBe(true);
    });

    it('routes mouse move to active tool', () => {
      const mockTool = new MockTool(mockContext);
      manager.register(mockTool);
      manager.setActiveTool('mock');

      const event = createMockMouseEvent();
      const result = manager.handleMouseMove(event);

      expect(mockTool.onMouseMove).toHaveBeenCalledWith(event);
      expect(result.handled).toBe(true);
    });

    it('routes mouse up to active tool', () => {
      const mockTool = new MockTool(mockContext);
      manager.register(mockTool);
      manager.setActiveTool('mock');

      const event = createMockMouseEvent();
      const result = manager.handleMouseUp(event);

      expect(mockTool.onMouseUp).toHaveBeenCalledWith(event);
      expect(result.handled).toBe(true);
    });

    it('returns handled=false when no tool is active', () => {
      const event = createMockMouseEvent();

      expect(manager.handleMouseDown(event).handled).toBe(false);
      expect(manager.handleMouseMove(event).handled).toBe(false);
      expect(manager.handleMouseUp(event).handled).toBe(false);
    });
  });

  describe('getCursor', () => {
    it('returns default when no tool is active', () => {
      expect(manager.getCursor()).toBe('default');
    });

    it('returns active tool cursor', () => {
      const mockTool = new MockTool(mockContext);
      manager.register(mockTool);
      manager.setActiveTool('mock');

      expect(manager.getCursor()).toBe('default');
    });
  });

  describe('isOperationActive', () => {
    it('returns false when no tool is active', () => {
      expect(manager.isOperationActive()).toBe(false);
    });

    it('returns false when tool is not in active operation', () => {
      const mockTool = new MockTool(mockContext);
      manager.register(mockTool);
      manager.setActiveTool('mock');

      expect(manager.isOperationActive()).toBe(false);
    });
  });
});
