/**
 * Base Tool
 *
 * Abstract base class that all canvas tools must extend. Provides the
 * standard interface for mouse/keyboard event handling and tool state.
 *
 * Key responsibilities:
 * - Define tool lifecycle (activate, deactivate, reset)
 * - Provide mouse event hooks (onMouseDown, onMouseMove, onMouseUp)
 * - Provide keyboard event hooks (onKeyDown, onKeyUp)
 * - Manage tool-specific state and cursor
 * - Provide render overlay hook for tool-specific visuals
 *
 * Subclass requirements:
 * - Implement `name` getter for tool identification
 * - Implement `getInitialState()` for tool-specific state
 * - Override mouse handlers as needed for tool behavior
 *
 * @see ToolManager.ts - Registers and routes events to tools
 * @see types.ts - ToolContext, ToolState, event types
 */
import type {
  ToolContext,
  ToolState,
  ToolMouseEvent,
  ToolKeyboardEvent,
  ToolEventResult,
  Position,
} from './types';

/**
 * Abstract base class for all canvas tools.
 *
 * Tools handle mouse and keyboard interactions, manage their own state,
 * and communicate with the canvas through the ToolContext.
 *
 * Subclasses must implement:
 * - name: unique identifier for the tool
 * - getInitialState(): returns the initial state for the tool
 * - onMouseDown, onMouseMove, onMouseUp: core mouse handlers
 */
export abstract class BaseTool {
  protected ctx: ToolContext;
  protected state: ToolState;

  constructor(ctx: ToolContext) {
    this.ctx = ctx;
    this.state = this.getInitialState();
  }

  /**
   * Unique name identifier for this tool
   */
  abstract get name(): string;

  /**
   * Returns the initial state for this tool
   */
  abstract getInitialState(): ToolState;

  /**
   * Handle mouse down event
   * @returns true if the event was handled, false to let other handlers try
   */
  abstract onMouseDown(e: ToolMouseEvent): ToolEventResult;

  /**
   * Handle mouse move event
   * @returns true if the event was handled
   */
  abstract onMouseMove(e: ToolMouseEvent): ToolEventResult;

  /**
   * Handle mouse up event
   * @returns true if the event was handled
   */
  abstract onMouseUp(e: ToolMouseEvent): ToolEventResult;

  /**
   * Called when this tool becomes active
   */
  onActivate(): void {
    this.state = this.getInitialState();
    this.state.isActive = true;
  }

  /**
   * Called when this tool is deactivated
   */
  onDeactivate(): void {
    this.state.isActive = false;
  }

  /**
   * Handle key down event
   * @returns true if the event was handled
   */
  onKeyDown(_e: ToolKeyboardEvent): ToolEventResult {
    return { handled: false };
  }

  /**
   * Handle key up event
   * @returns true if the event was handled
   */
  onKeyUp(_e: ToolKeyboardEvent): ToolEventResult {
    return { handled: false };
  }

  /**
   * Handle double click event
   * @returns true if the event was handled
   */
  onDoubleClick(_e: ToolMouseEvent): ToolEventResult {
    return { handled: false };
  }

  /**
   * Render tool-specific overlay (selection handles, guides, preview shapes, etc.)
   * @param ctx The 2D rendering context
   */
  renderOverlay(_ctx: CanvasRenderingContext2D): void {
    // Default: no overlay
  }

  /**
   * Get the current cursor for this tool
   */
  getCursor(): string {
    return this.state.cursor;
  }

  /**
   * Get the current state of this tool
   */
  getState(): ToolState {
    return this.state;
  }

  /**
   * Check if the tool is currently active (handling an operation)
   */
  isOperationActive(): boolean {
    return this.state.isActive;
  }

  /**
   * Update the tool context (called when Canvas state changes)
   */
  updateContext(ctx: ToolContext): void {
    this.ctx = ctx;
  }

  /**
   * Helper: Convert screen coordinates to canvas coordinates
   */
  protected screenToCanvas(screenX: number, screenY: number): Position {
    return this.ctx.screenToCanvas(screenX, screenY);
  }

  /**
   * Helper: Convert canvas coordinates to screen coordinates
   */
  protected canvasToScreen(canvasX: number, canvasY: number): Position {
    return this.ctx.canvasToScreen(canvasX, canvasY);
  }

  /**
   * Helper: Update cursor
   */
  protected setCursor(cursor: string): void {
    this.state.cursor = cursor;
    this.ctx.setCursor(cursor);
  }
}
