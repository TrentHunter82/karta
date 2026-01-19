// Shared test utilities for tool tests
import { vi } from 'vitest';
import type { ToolContext, ToolMouseEvent, ToolKeyboardEvent } from '../../../src/tools/types';
import type {
  RectangleObject,
  EllipseObject,
  TextObject,
  FrameObject,
  LineObject,
  ArrowObject,
  PathObject,
  CanvasObject
} from '../../../src/types/canvas';

// Factory functions for creating test objects
export const createRectangle = (id: string, overrides?: Partial<RectangleObject>): RectangleObject => ({
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

export const createEllipse = (id: string, overrides?: Partial<EllipseObject>): EllipseObject => ({
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

export const createText = (id: string, overrides?: Partial<TextObject>): TextObject => ({
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
  fontWeight: 400,
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  lineHeight: 1.2,
  fill: '#ffffff',
  ...overrides,
});

export const createFrame = (id: string, overrides?: Partial<FrameObject>): FrameObject => ({
  id,
  type: 'frame',
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  rotation: 0,
  opacity: 1,
  zIndex: 1,
  fill: '#2a2a2a',
  stroke: '#3a3a3a',
  strokeWidth: 1,
  name: 'Frame',
  ...overrides,
});

export const createLine = (id: string, overrides?: Partial<LineObject>): LineObject => ({
  id,
  type: 'line',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  zIndex: 1,
  stroke: '#ffffff',
  strokeWidth: 2,
  x1: 0,
  y1: 0,
  x2: 100,
  y2: 100,
  ...overrides,
});

export const createArrow = (id: string, overrides?: Partial<ArrowObject>): ArrowObject => ({
  id,
  type: 'arrow',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  zIndex: 1,
  stroke: '#ffffff',
  strokeWidth: 2,
  x1: 0,
  y1: 0,
  x2: 100,
  y2: 100,
  arrowStart: false,
  arrowEnd: true,
  arrowSize: 1,
  ...overrides,
});

export const createPath = (id: string, overrides?: Partial<PathObject>): PathObject => ({
  id,
  type: 'path',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  zIndex: 1,
  stroke: '#ffffff',
  strokeWidth: 2,
  points: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 100 }],
  ...overrides,
});

// Create a mock ToolContext
export const createMockContext = (
  objects: Map<string, CanvasObject> = new Map(),
  selectedIds: Set<string> = new Set()
): ToolContext => ({
  getObjects: vi.fn(() => objects),
  getSelectedIds: vi.fn(() => selectedIds),
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
export const createMockMouseEvent = (overrides?: Partial<ToolMouseEvent>): ToolMouseEvent => ({
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

// Create a mock keyboard event
export const createMockKeyboardEvent = (overrides?: Partial<ToolKeyboardEvent>): ToolKeyboardEvent => ({
  key: '',
  code: '',
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  repeat: false,
  ...overrides,
});
