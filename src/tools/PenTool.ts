// PenTool - handles freehand path drawing
import { BaseTool } from './BaseTool';
import type {
  ToolState,
  ToolMouseEvent,
  ToolKeyboardEvent,
  ToolEventResult,
} from './types';
import type { PathObject, PathPoint } from '../types/canvas';

const MIN_PATH_POINTS = 2;

/**
 * PenTool state
 */
interface PenToolState extends ToolState {
  isDrawing: boolean;
  points: PathPoint[];
  previewId: string | null;
}

/**
 * PenTool handles freehand path drawing.
 * - Click and drag to draw a path
 * - Points are added as you move
 * - Escape cancels the current drawing
 * - Stays in pen tool after each stroke for continuous drawing
 */
export class PenTool extends BaseTool {
  protected declare state: PenToolState;

  get name(): string {
    return 'pen';
  }

  getInitialState(): PenToolState {
    return {
      cursor: 'crosshair',
      isActive: false,
      isDrawing: false,
      points: [],
      previewId: null,
    };
  }

  onActivate(): void {
    super.onActivate();
    this.setCursor('crosshair');
    // Clear selection when switching to pen tool
    this.ctx.setSelection([]);
  }

  onMouseDown(e: ToolMouseEvent): ToolEventResult {
    // Only handle left mouse button
    if (e.button !== 0) {
      return { handled: false };
    }

    this.state.isDrawing = true;
    this.state.points = [{ x: e.canvasX, y: e.canvasY }];

    // Create preview path
    const id = crypto.randomUUID();
    this.state.previewId = id;

    const path: PathObject = {
      id,
      type: 'path',
      x: e.canvasX,
      y: e.canvasY,
      width: 1,
      height: 1,
      rotation: 0,
      opacity: 1,
      zIndex: this.ctx.getNextZIndex(),
      stroke: '#ffffff',
      strokeWidth: 2,
      points: [{ x: 0, y: 0 }],
    };

    this.ctx.addObject(path);

    return { handled: true };
  }

  onMouseMove(e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.previewId) {
      return { handled: false };
    }

    // Add new point
    this.state.points.push({ x: e.canvasX, y: e.canvasY });

    this.updatePreview();

    return { handled: true, requestRedraw: true };
  }

  onMouseUp(_e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.previewId) {
      return { handled: false };
    }

    const previewId = this.state.previewId;

    // Check if path has enough points
    if (this.state.points.length < MIN_PATH_POINTS) {
      this.ctx.deleteObject(previewId);
    } else {
      // Finalize the path and clear selection so drawing continues uninterrupted
      this.ctx.setSelection([]);
    }

    // Reset state
    this.state.isDrawing = false;
    this.state.points = [];
    this.state.previewId = null;

    return { handled: true };
  }

  onKeyDown(e: ToolKeyboardEvent): ToolEventResult {
    // Escape cancels drawing
    if (e.key === 'Escape' && this.state.isDrawing && this.state.previewId) {
      this.ctx.deleteObject(this.state.previewId);
      this.state.isDrawing = false;
      this.state.points = [];
      this.state.previewId = null;
      return { handled: true };
    }

    return { handled: false };
  }

  private updatePreview(): void {
    if (!this.state.previewId || this.state.points.length === 0) {
      return;
    }

    const points = this.state.points;

    // Calculate bounding box
    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    // Normalize points relative to the bounding box
    const normalizedPoints: PathPoint[] = points.map((p) => ({
      x: p.x - minX,
      y: p.y - minY,
    }));

    this.ctx.updateObject(this.state.previewId, {
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1),
      points: normalizedPoints,
    });
  }
}
