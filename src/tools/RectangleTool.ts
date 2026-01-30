/**
 * Rectangle Tool
 *
 * Creates rectangle objects via click-and-drag.
 *
 * Behavior:
 * - Click and drag to define bounds
 * - Hold Shift to constrain to square (1:1 aspect ratio)
 * - Escape cancels drawing
 * - Switches to select tool after creation
 * - Minimum size enforced to prevent tiny objects
 */
import { BaseTool } from './BaseTool';
import type {
  ToolState,
  ToolMouseEvent,
  ToolKeyboardEvent,
  ToolEventResult,
  Position,
} from './types';
import type { RectangleObject } from '../types/canvas';

const MIN_OBJECT_SIZE = 10;

/**
 * RectangleTool state
 */
interface RectangleToolState extends ToolState {
  isDrawing: boolean;
  startPos: Position | null;
  endPos: Position | null;
  shiftKey: boolean;
  previewId: string | null;
}

/**
 * RectangleTool handles rectangle drawing via click and drag.
 * - Click and drag to draw a rectangle
 * - Shift key constrains to square
 * - Escape cancels the current drawing
 * - Switches to select tool after creation
 */
export class RectangleTool extends BaseTool {
  protected declare state: RectangleToolState;

  get name(): string {
    return 'rectangle';
  }

  getInitialState(): RectangleToolState {
    return {
      cursor: 'crosshair',
      isActive: false,
      isDrawing: false,
      startPos: null,
      endPos: null,
      shiftKey: false,
      previewId: null,
    };
  }

  onActivate(): void {
    super.onActivate();
    this.setCursor('crosshair');
    // Clear selection when switching to rectangle tool
    this.ctx.setSelection([]);
  }

  onMouseDown(e: ToolMouseEvent): ToolEventResult {
    // Only handle left mouse button
    if (e.button !== 0) {
      return { handled: false };
    }

    this.state.isDrawing = true;
    const snapped = this.ctx.snapPosition(e.canvasX, e.canvasY);
    this.state.startPos = { x: snapped.x, y: snapped.y };
    this.state.endPos = { x: snapped.x, y: snapped.y };
    this.state.shiftKey = e.shiftKey;

    // Create preview rectangle
    const id = crypto.randomUUID();
    this.state.previewId = id;

    const rect: RectangleObject = {
      id,
      type: 'rectangle',
      x: snapped.x,
      y: snapped.y,
      width: 0,
      height: 0,
      rotation: 0,
      opacity: 1,
      zIndex: this.ctx.getNextZIndex(),
      fill: '#4a4a4a',
      stroke: '#666666',
      strokeWidth: 0,
    };

    this.ctx.addObject(rect);

    return { handled: true };
  }

  onMouseMove(e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.startPos || !this.state.previewId) {
      return { handled: false };
    }

    const snapped = this.ctx.snapPosition(e.canvasX, e.canvasY);
    this.state.endPos = { x: snapped.x, y: snapped.y };
    this.state.shiftKey = e.shiftKey;
    this.ctx.setActiveSnapGuides(snapped.guides);

    this.updatePreview();

    return { handled: true, requestRedraw: true };
  }

  onMouseUp(_e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.previewId) {
      return { handled: false };
    }

    const previewId = this.state.previewId;
    const obj = this.ctx.getObjects().get(previewId);

    // Check if rectangle is too small (accidental click)
    if (obj && obj.width < MIN_OBJECT_SIZE && obj.height < MIN_OBJECT_SIZE) {
      this.ctx.deleteObject(previewId);
    } else if (obj) {
      // Select the new object and switch to select tool
      this.ctx.setSelection([previewId]);
      this.ctx.setActiveTool('select');
    }

    // Reset state
    this.ctx.setActiveSnapGuides([]);
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

    // Update preview when shift key changes during drawing
    if (e.key === 'Shift' && this.state.isDrawing) {
      this.state.shiftKey = true;
      this.updatePreview();
      return { handled: true, requestRedraw: true };
    }

    return { handled: false };
  }

  onKeyUp(e: ToolKeyboardEvent): ToolEventResult {
    // Update preview when shift key is released during drawing
    if (e.key === 'Shift' && this.state.isDrawing) {
      this.state.shiftKey = false;
      this.updatePreview();
      return { handled: true, requestRedraw: true };
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
    let width = end.x - start.x;
    let height = end.y - start.y;

    // Constrain to square if shift is held
    if (this.state.shiftKey) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = width >= 0 ? size : -size;
      height = height >= 0 ? size : -size;
    }

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
