// Tool system types for Karta
import type { CanvasObject, Viewport, ToolType } from '../types/canvas';

/**
 * Bounds interface for rectangle regions
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Position interface for 2D coordinates
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Handle types for resize operations
 */
export type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;

/**
 * Rotation handle type
 */
export type RotationHandle = 'rotation' | null;

/**
 * Context provided to tools for accessing and modifying canvas state
 */
export interface ToolContext {
  // Read-only access to state
  getObjects: () => Map<string, CanvasObject>;
  getSelectedIds: () => Set<string>;
  getViewport: () => Viewport;
  getEditingGroupId: () => string | null;

  // State mutations (all go through store)
  addObject: (obj: CanvasObject) => void;
  updateObject: (id: string, changes: Partial<CanvasObject>) => void;
  updateObjects: (updates: Array<{ id: string; changes: Partial<CanvasObject> }>) => void;
  deleteObject: (id: string) => void;
  setSelection: (ids: string[]) => void;
  pushHistory: () => void;
  setActiveTool: (tool: ToolType) => void;

  // Group operations
  enterGroupEditMode: (groupId: string) => void;
  exitGroupEditMode: () => void;
  getAbsolutePosition: (obj: CanvasObject) => Position;

  // Coordinate conversion
  screenToCanvas: (x: number, y: number) => Position;
  canvasToScreen: (x: number, y: number) => Position;

  // Viewport
  setViewport: (updates: Partial<{ x: number; y: number; zoom: number }>) => void;

  // Utilities
  getNextZIndex: () => number;
  hitTest: (screenX: number, screenY: number) => CanvasObject | null;
  hitTestHandle: (screenX: number, screenY: number, obj: CanvasObject) => HandleType;
  hitTestRotationHandle: (screenX: number, screenY: number, obj: CanvasObject) => RotationHandle;
  getObjectsInRect: (x1: number, y1: number, x2: number, y2: number) => string[];
  isPointInObject: (pos: Position, obj: CanvasObject, absX?: number, absY?: number) => boolean;

  // Canvas element reference for cursor updates
  setCursor: (cursor: string) => void;
}

/**
 * Base state interface for all tools
 */
export interface ToolState {
  cursor: string;
  isActive: boolean;
  [key: string]: unknown; // Tool-specific state
}

/**
 * Mouse event data passed to tool handlers
 */
export interface ToolMouseEvent {
  screenX: number;
  screenY: number;
  canvasX: number;
  canvasY: number;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/**
 * Keyboard event data passed to tool handlers
 */
export interface ToolKeyboardEvent {
  key: string;
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
}

/**
 * Result of a tool event handler
 */
export interface ToolEventResult {
  handled: boolean;
  cursor?: string;
  requestRedraw?: boolean;
}

/**
 * Selection mode for SelectTool state machine
 */
export type SelectionMode =
  | 'idle'
  | 'dragging'
  | 'resizing'
  | 'rotating'
  | 'marquee';

/**
 * SelectTool specific state
 */
export interface SelectToolState extends ToolState {
  mode: SelectionMode;
  startPos: Position | null;
  lastPos: Position | null;
  dragStartCanvasPos: Position | null;

  // Resize state
  activeHandle: HandleType;
  resizeStartState: {
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize?: number;
  } | null;

  // Rotation state
  rotationStartAngle: number;
  rotationObjStartRotation: number;

  // Marquee state
  marqueeStart: Position | null;
  marqueeEnd: Position | null;
  marqueeShiftKey: boolean;

  // Double-click tracking
  lastClickTime: number;
  lastClickObjectId: string | null;
}
