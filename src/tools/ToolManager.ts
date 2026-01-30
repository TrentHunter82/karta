/**
 * Tool Manager
 *
 * Central coordinator for all canvas tools. Manages tool registration,
 * activation, and routes all mouse/keyboard events to the active tool.
 *
 * Key responsibilities:
 * - Register tool instances by name
 * - Handle tool switching with proper activate/deactivate lifecycle
 * - Route mouse events (down, move, up, double-click) to active tool
 * - Route keyboard events (down, up) to active tool
 * - Delegate overlay rendering to active tool
 *
 * Usage:
 * - Create with a ToolContext
 * - Default tools are auto-registered unless disabled
 * - Call setActiveTool() to switch tools
 * - Forward events via onMouseDown(), onMouseMove(), etc.
 *
 * @see Canvas.tsx - Creates and uses ToolManager
 * @see BaseTool.ts - Base class for all tools
 */
import type { BaseTool } from './BaseTool';
import type {
  ToolContext,
  ToolMouseEvent,
  ToolKeyboardEvent,
  ToolEventResult,
} from './types';
import { SelectTool } from './SelectTool';
import { HandTool } from './HandTool';
import { RectangleTool } from './RectangleTool';
import { EllipseTool } from './EllipseTool';
import { FrameTool } from './FrameTool';
import { LineTool } from './LineTool';
import { ArrowTool } from './ArrowTool';
import { TextTool } from './TextTool';
import { PenTool } from './PenTool';

/**
 * ToolManager handles registration, activation, and event routing for all tools.
 *
 * Responsibilities:
 * - Register tools by name
 * - Manage active tool switching
 * - Route mouse/keyboard events to the active tool
 * - Delegate overlay rendering to the active tool
 */
export class ToolManager {
  private tools: Map<string, BaseTool> = new Map();
  private activeTool: BaseTool | null = null;
  private activeToolName: string | null = null;
  private ctx: ToolContext;

  constructor(ctx: ToolContext, registerDefaultTools = true) {
    this.ctx = ctx;
    if (registerDefaultTools) {
      this.registerDefaultTools();
    }
  }

  /**
   * Register all default tools
   */
  private registerDefaultTools(): void {
    this.register(new SelectTool(this.ctx));
    this.register(new HandTool(this.ctx));
    this.register(new RectangleTool(this.ctx));
    this.register(new EllipseTool(this.ctx));
    this.register(new FrameTool(this.ctx));
    this.register(new LineTool(this.ctx));
    this.register(new ArrowTool(this.ctx));
    this.register(new TextTool(this.ctx));
    this.register(new PenTool(this.ctx));
  }

  /**
   * Get the ToolContext
   */
  getContext(): ToolContext {
    return this.ctx;
  }

  /**
   * Update the tool context (called when Canvas state changes)
   */
  updateContext(ctx: ToolContext): void {
    this.ctx = ctx;
    // Update context for all registered tools
    this.tools.forEach((tool) => tool.updateContext(ctx));
  }

  /**
   * Register a tool instance
   */
  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool by name
   */
  unregister(name: string): void {
    if (this.activeToolName === name) {
      this.activeTool?.onDeactivate();
      this.activeTool = null;
      this.activeToolName = null;
    }
    this.tools.delete(name);
  }

  /**
   * Get a registered tool by name
   */
  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Set the active tool by name
   */
  setActiveTool(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      console.warn(`[ToolManager] Unknown tool: ${name}`);
      return false;
    }

    // Deactivate current tool
    if (this.activeTool && this.activeTool !== tool) {
      this.activeTool.onDeactivate();
    }

    // Activate new tool
    this.activeTool = tool;
    this.activeToolName = name;
    this.activeTool.onActivate();

    return true;
  }

  /**
   * Get the currently active tool
   */
  getActiveTool(): BaseTool | null {
    return this.activeTool;
  }

  /**
   * Get the name of the currently active tool
   */
  getActiveToolName(): string | null {
    return this.activeToolName;
  }

  /**
   * Route mouse down event to active tool
   */
  handleMouseDown(e: ToolMouseEvent): ToolEventResult {
    if (!this.activeTool) {
      return { handled: false };
    }
    return this.activeTool.onMouseDown(e);
  }

  /**
   * Route mouse move event to active tool
   */
  handleMouseMove(e: ToolMouseEvent): ToolEventResult {
    if (!this.activeTool) {
      return { handled: false };
    }
    return this.activeTool.onMouseMove(e);
  }

  /**
   * Route mouse up event to active tool
   */
  handleMouseUp(e: ToolMouseEvent): ToolEventResult {
    if (!this.activeTool) {
      return { handled: false };
    }
    return this.activeTool.onMouseUp(e);
  }

  /**
   * Route key down event to active tool
   */
  handleKeyDown(e: ToolKeyboardEvent): ToolEventResult {
    if (!this.activeTool) {
      return { handled: false };
    }
    return this.activeTool.onKeyDown(e);
  }

  /**
   * Route key up event to active tool
   */
  handleKeyUp(e: ToolKeyboardEvent): ToolEventResult {
    if (!this.activeTool) {
      return { handled: false };
    }
    return this.activeTool.onKeyUp(e);
  }

  /**
   * Route double click event to active tool
   */
  handleDoubleClick(e: ToolMouseEvent): ToolEventResult {
    if (!this.activeTool) {
      return { handled: false };
    }
    return this.activeTool.onDoubleClick(e);
  }

  /**
   * Render active tool's overlay
   */
  renderOverlay(ctx: CanvasRenderingContext2D): void {
    this.activeTool?.renderOverlay(ctx);
  }

  /**
   * Get cursor for active tool
   */
  getCursor(): string {
    return this.activeTool?.getCursor() ?? 'default';
  }

  /**
   * Check if any tool operation is currently active
   */
  isOperationActive(): boolean {
    return this.activeTool?.isOperationActive() ?? false;
  }
}
