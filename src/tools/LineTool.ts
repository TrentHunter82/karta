/**
 * Line Tool
 *
 * Creates line objects via click-and-drag.
 *
 * Behavior:
 * - Click to set start point, drag to set end point
 * - Hold Shift to snap to 45-degree angles
 * - Escape cancels drawing
 * - Switches to select tool after creation
 *
 * @see ArrowTool.ts - Similar but with arrowhead
 */
import { BaseTool } from './BaseTool';
import { ANGLE_SNAP_45_RAD } from '../constants/layout';
import type {
  ToolState,
  ToolMouseEvent,
  ToolKeyboardEvent,
  ToolEventResult,
  Position,
} from './types';
import type { LineObject } from '../types/canvas';

const MIN_OBJECT_SIZE = 10;

/**
 * LineTool state
 */
interface LineToolState extends ToolState {
  isDrawing: boolean;
  startPos: Position | null;
  endPos: Position | null;
  shiftKey: boolean;
  previewId: string | null;
}

/**
 * LineTool handles line drawing via click and drag.
 * - Click and drag to draw a line
 * - Shift key constrains to 45° angles
 * - Escape cancels the current drawing
 * - Switches to select tool after creation
 */
export class LineTool extends BaseTool {
  protected declare state: LineToolState;

  get name(): string {
    return 'line';
  }

  getInitialState(): LineToolState {
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
    // Clear selection when switching to line tool
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

    // Create preview line
    const id = crypto.randomUUID();
    this.state.previewId = id;

    const line: LineObject = {
      id,
      type: 'line',
      x: snapped.x,
      y: snapped.y,
      width: 1,
      height: 1,
      rotation: 0,
      opacity: 1,
      zIndex: this.ctx.getNextZIndex(),
      stroke: '#ffffff',
      strokeWidth: 2,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
    };

    this.ctx.addObject(line);

    return { handled: true };
  }

  onMouseMove(e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.startPos || !this.state.previewId) {
      return { handled: false };
    }

    let endX = e.canvasX;
    let endY = e.canvasY;

    // Shift key constrains to 45° angles
    if (e.shiftKey) {
      const dx = endX - this.state.startPos.x;
      const dy = endY - this.state.startPos.y;
      const angle = Math.atan2(dy, dx);
      const length = Math.sqrt(dx * dx + dy * dy);
      // Snap to 45° increments
      const snappedAngle = Math.round(angle / ANGLE_SNAP_45_RAD) * ANGLE_SNAP_45_RAD;
      endX = this.state.startPos.x + length * Math.cos(snappedAngle);
      endY = this.state.startPos.y + length * Math.sin(snappedAngle);
    }

    const snapped = this.ctx.snapPosition(endX, endY);
    this.state.endPos = { x: snapped.x, y: snapped.y };
    this.state.shiftKey = e.shiftKey;
    this.ctx.setActiveSnapGuides(snapped.guides);

    this.updatePreview();

    return { handled: true, requestRedraw: true };
  }

  onMouseUp(_e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.previewId || !this.state.startPos || !this.state.endPos) {
      return { handled: false };
    }

    const previewId = this.state.previewId;
    const dx = this.state.endPos.x - this.state.startPos.x;
    const dy = this.state.endPos.y - this.state.startPos.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Check if line is too short (accidental click)
    if (length < MIN_OBJECT_SIZE) {
      this.ctx.deleteObject(previewId);
    } else {
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
      return { handled: true };
    }

    return { handled: false };
  }

  onKeyUp(e: ToolKeyboardEvent): ToolEventResult {
    // Update preview when shift key is released during drawing
    if (e.key === 'Shift' && this.state.isDrawing) {
      this.state.shiftKey = false;
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

    // Calculate bounding box
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.max(Math.abs(end.x - start.x), 1);
    const height = Math.max(Math.abs(end.y - start.y), 1);

    // Calculate relative positions
    const x1 = start.x - x;
    const y1 = start.y - y;
    const x2 = end.x - x;
    const y2 = end.y - y;

    this.ctx.updateObject(this.state.previewId, {
      x,
      y,
      width,
      height,
      x1,
      y1,
      x2,
      y2,
    });
  }
}
