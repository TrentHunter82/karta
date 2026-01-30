/**
 * Ellipse Tool
 *
 * Creates ellipse/circle objects via click-and-drag.
 *
 * Behavior:
 * - Click and drag to define bounding box
 * - Hold Shift to constrain to circle (1:1 aspect ratio)
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
import type { EllipseObject } from '../types/canvas';

const MIN_OBJECT_SIZE = 10;

/**
 * EllipseTool state
 */
interface EllipseToolState extends ToolState {
  isDrawing: boolean;
  startPos: Position | null;
  endPos: Position | null;
  shiftKey: boolean;
  previewId: string | null;
}

/**
 * EllipseTool handles ellipse drawing via click and drag.
 * - Click and drag to draw an ellipse
 * - Shift key constrains to circle
 * - Escape cancels the current drawing
 * - Switches to select tool after creation
 */
export class EllipseTool extends BaseTool {
  protected declare state: EllipseToolState;

  get name(): string {
    return 'ellipse';
  }

  getInitialState(): EllipseToolState {
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
    // Clear selection when switching to ellipse tool
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
    this.state.shiftKey = e.shiftKey;

    // Create preview ellipse
    const id = crypto.randomUUID();
    this.state.previewId = id;

    const ellipse: EllipseObject = {
      id,
      type: 'ellipse',
      x: e.canvasX,
      y: e.canvasY,
      width: 0,
      height: 0,
      rotation: 0,
      opacity: 1,
      zIndex: this.ctx.getNextZIndex(),
      fill: '#4a4a4a',
      stroke: '#666666',
      strokeWidth: 0,
    };

    this.ctx.addObject(ellipse);

    return { handled: true };
  }

  onMouseMove(e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.startPos || !this.state.previewId) {
      return { handled: false };
    }

    this.state.endPos = { x: e.canvasX, y: e.canvasY };
    this.state.shiftKey = e.shiftKey;

    this.updatePreview();

    return { handled: true, requestRedraw: true };
  }

  onMouseUp(_e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.previewId) {
      return { handled: false };
    }

    const previewId = this.state.previewId;
    const obj = this.ctx.getObjects().get(previewId);

    // Check if ellipse is too small (accidental click)
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

    // Constrain to circle if shift is held
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
