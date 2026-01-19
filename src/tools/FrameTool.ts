// FrameTool - handles frame drawing
import { BaseTool } from './BaseTool';
import type {
  ToolState,
  ToolMouseEvent,
  ToolKeyboardEvent,
  ToolEventResult,
  Position,
} from './types';
import type { FrameObject } from '../types/canvas';

const MIN_OBJECT_SIZE = 10;

/**
 * FrameTool state
 */
interface FrameToolState extends ToolState {
  isDrawing: boolean;
  startPos: Position | null;
  endPos: Position | null;
  previewId: string | null;
}

/**
 * FrameTool handles frame drawing via click and drag.
 * - Click and drag to draw a frame
 * - Escape cancels the current drawing
 * - Switches to select tool after creation
 * - Frame is created with default name "Frame"
 */
export class FrameTool extends BaseTool {
  protected declare state: FrameToolState;

  get name(): string {
    return 'frame';
  }

  getInitialState(): FrameToolState {
    return {
      cursor: 'crosshair',
      isActive: false,
      isDrawing: false,
      startPos: null,
      endPos: null,
      previewId: null,
    };
  }

  onActivate(): void {
    super.onActivate();
    this.setCursor('crosshair');
    // Clear selection when switching to frame tool
    this.ctx.setSelection([]);
  }

  onMouseDown(e: ToolMouseEvent): ToolEventResult {
    // Only handle left mouse button
    if (e.button !== 0) {
      return { handled: false };
    }

    this.state.isDrawing = true;
    this.state.startPos = { x: e.canvasX, y: e.canvasY };
    this.state.endPos = { x: e.canvasX, y: e.canvasY };

    // Create preview frame
    const id = crypto.randomUUID();
    this.state.previewId = id;

    const frame: FrameObject = {
      id,
      type: 'frame',
      x: e.canvasX,
      y: e.canvasY,
      width: 0,
      height: 0,
      rotation: 0,
      opacity: 1,
      zIndex: this.ctx.getNextZIndex(),
      fill: '#2a2a2a',
      stroke: '#3a3a3a',
      strokeWidth: 1,
      name: 'Frame',
    };

    this.ctx.addObject(frame);

    return { handled: true };
  }

  onMouseMove(e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.startPos || !this.state.previewId) {
      return { handled: false };
    }

    this.state.endPos = { x: e.canvasX, y: e.canvasY };

    this.updatePreview();

    return { handled: true, requestRedraw: true };
  }

  onMouseUp(_e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.previewId) {
      return { handled: false };
    }

    const previewId = this.state.previewId;
    const obj = this.ctx.getObjects().get(previewId);

    // Check if frame is too small (accidental click)
    if (obj && obj.width < MIN_OBJECT_SIZE && obj.height < MIN_OBJECT_SIZE) {
      this.ctx.deleteObject(previewId);
    } else if (obj) {
      // Select the new object and switch to select tool
      this.ctx.setSelection([previewId]);
      this.ctx.setActiveTool('select');
    }

    // Reset state
    this.state.isDrawing = false;
    this.state.startPos = null;
    this.state.endPos = null;
    this.state.previewId = null;

    return { handled: true };
  }

  onKeyDown(e: ToolKeyboardEvent): ToolEventResult {
    // Escape cancels drawing
    if (e.key === 'Escape' && this.state.isDrawing && this.state.previewId) {
      this.ctx.deleteObject(this.state.previewId);
      this.state.isDrawing = false;
      this.state.startPos = null;
      this.state.endPos = null;
      this.state.previewId = null;
      return { handled: true };
    }

    return { handled: false };
  }

  private updatePreview(): void {
    if (!this.state.startPos || !this.state.endPos || !this.state.previewId) {
      return;
    }

    const start = this.state.startPos;
    const end = this.state.endPos;

    // Calculate dimensions
    const width = end.x - start.x;
    const height = end.y - start.y;

    // Normalize to positive width/height
    const x = width >= 0 ? start.x : start.x + width;
    const y = height >= 0 ? start.y : start.y + height;
    const shapeWidth = Math.abs(width);
    const shapeHeight = Math.abs(height);

    this.ctx.updateObject(this.state.previewId, {
      x,
      y,
      width: shapeWidth,
      height: shapeHeight,
    });
  }
}
