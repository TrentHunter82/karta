/**
 * Pen Tool
 *
 * Creates freehand path objects by recording mouse movement.
 *
 * Behavior:
 * - Click and drag to draw a continuous path
 * - Points are sampled as the mouse moves
 * - Release mouse to complete the stroke
 * - Escape cancels current drawing
 * - Stays in pen tool after each stroke (continuous drawing mode)
 * - Minimum 2 points required for valid path
 *
 * @see PathObject, PathPoint in types/canvas.ts
 */
import { BaseTool } from './BaseTool';
import type {
  ToolState,
  ToolMouseEvent,
  ToolKeyboardEvent,
  ToolEventResult,
} from './types';
import type { PathObject, PathPoint } from '../types/canvas';
import { rdpSimplify, chaikinSmooth } from '../utils/strokeSmoothing';
import { calculateVelocity, getStrokeWidthFromVelocity } from '../utils/strokePressure';
import {
  springStabilizer,
  createSpringStabilizerState,
  type SpringStabilizerState,
} from '../utils/strokeStabilization';
import { usePenToolStore, type PenToolSettings } from '../stores/penToolStore';

const MIN_PATH_POINTS = 2;

// Re-export types from store for external consumers
export type { SmoothingType, StabilizerMode, PenToolSettings } from '../stores/penToolStore';

/**
 * Point with timestamp for velocity tracking
 */
interface TimestampedPoint extends PathPoint {
  timestamp: number;
}

/**
 * PenTool state
 */
interface PenToolState extends ToolState {
  isDrawing: boolean;
  points: PathPoint[];
  previewId: string | null;
  /** Raw points with timestamps for velocity tracking */
  rawPoints: TimestampedPoint[];
  /** Calculated velocities for each point */
  velocities: number[];
  /** Spring stabilizer state */
  stabilizerState: SpringStabilizerState | null;
  /** Last point timestamp for velocity calculation */
  lastTimestamp: number;
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

  /**
   * Get current smoothing settings from the store.
   * Uses Zustand's getState() since we can't use hooks in a class.
   */
  private get smoothingSettings(): PenToolSettings {
    return usePenToolStore.getState().settings;
  }

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
      rawPoints: [],
      velocities: [],
      stabilizerState: null,
      lastTimestamp: 0,
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

    const now = performance.now();
    const initialPoint: TimestampedPoint = { x: e.canvasX, y: e.canvasY, timestamp: now };

    this.state.isDrawing = true;
    this.state.points = [{ x: e.canvasX, y: e.canvasY }];
    this.state.rawPoints = [initialPoint];
    this.state.velocities = [0];
    this.state.lastTimestamp = now;

    // Initialize stabilizer if enabled
    if (this.smoothingSettings.stabilizerMode === 'spring') {
      this.state.stabilizerState = createSpringStabilizerState({ x: e.canvasX, y: e.canvasY });
    } else {
      this.state.stabilizerState = null;
    }

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
      stroke: this.smoothingSettings.strokeColor,
      strokeWidth: this.smoothingSettings.pressureSimulation
        ? this.smoothingSettings.maxWidth
        : this.smoothingSettings.strokeWidth,
      points: [{ x: 0, y: 0 }],
    };

    this.ctx.addObject(path);

    return { handled: true };
  }

  onMouseMove(e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.previewId) {
      return { handled: false };
    }

    const now = performance.now();
    const deltaTime = now - this.state.lastTimestamp;
    let pointToAdd: PathPoint = { x: e.canvasX, y: e.canvasY };

    // Apply stabilizer if enabled
    if (this.smoothingSettings.stabilizerMode === 'spring' && this.state.stabilizerState) {
      this.state.stabilizerState = springStabilizer(
        { x: e.canvasX, y: e.canvasY },
        this.state.stabilizerState,
        this.smoothingSettings.stabilizerStrength,
        0.8,
        deltaTime
      );
      pointToAdd = { ...this.state.stabilizerState.position };
    }

    // Track raw point with timestamp for velocity
    const rawPoint: TimestampedPoint = { x: e.canvasX, y: e.canvasY, timestamp: now };
    this.state.rawPoints.push(rawPoint);

    // Calculate velocity
    const lastPoint = this.state.points[this.state.points.length - 1];
    const velocity = calculateVelocity(pointToAdd, lastPoint, Math.max(1, deltaTime));
    this.state.velocities.push(velocity);

    // Add the (potentially stabilized) point
    this.state.points.push(pointToAdd);
    this.state.lastTimestamp = now;

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
      // Apply final stroke optimization
      const optimizedPoints = this.optimizeStroke(this.state.points);

      // Calculate widths from velocities if pressure simulation is enabled
      let widths: number[] | undefined;
      if (this.smoothingSettings.pressureSimulation) {
        widths = this.calculateWidthsForOptimizedPoints(optimizedPoints);
      }

      this.updatePreviewWithPoints(optimizedPoints, widths);
      // Finalize the path and clear selection so drawing continues uninterrupted
      this.ctx.setSelection([]);
    }

    // Reset state
    this.state.isDrawing = false;
    this.state.points = [];
    this.state.previewId = null;
    this.state.rawPoints = [];
    this.state.velocities = [];
    this.state.stabilizerState = null;
    this.state.lastTimestamp = 0;

    return { handled: true };
  }

  /**
   * Calculates widths for optimized points by sampling from original velocities
   */
  private calculateWidthsForOptimizedPoints(optimizedPoints: PathPoint[]): number[] {
    const { minWidth, maxWidth } = this.smoothingSettings;
    const originalPoints = this.state.points;
    const velocities = this.state.velocities;

    if (velocities.length === 0 || optimizedPoints.length === 0) {
      return optimizedPoints.map(() => (minWidth + maxWidth) / 2);
    }

    // For each optimized point, find the closest original point and use its velocity
    return optimizedPoints.map((optPoint) => {
      let minDist = Infinity;
      let closestIdx = 0;

      for (let i = 0; i < originalPoints.length; i++) {
        const dx = optPoint.x - originalPoints[i].x;
        const dy = optPoint.y - originalPoints[i].y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }

      const velocity = velocities[closestIdx] ?? 0;
      return getStrokeWidthFromVelocity(velocity, minWidth, maxWidth);
    });
  }

  /**
   * Optimizes the stroke by applying smoothing and simplification
   */
  private optimizeStroke(points: PathPoint[]): PathPoint[] {
    if (points.length < 3) return points;

    let result = [...points];
    const { type, amount } = this.smoothingSettings;

    // First, simplify to reduce point count (RDP algorithm)
    // Epsilon based on amount: 0.5 at low amount, up to 4 at high amount
    const epsilon = 0.5 + amount * 3.5;
    result = rdpSimplify(result, epsilon);

    // Then apply smoothing based on type
    if (type === 'chaikin' && result.length >= 3) {
      // Iterations based on amount: 1-3 iterations
      const iterations = Math.ceil(amount * 2) + 1;
      result = chaikinSmooth(result, iterations);
    }
    // 'simplify' type only uses RDP (already done above)
    // 'none' type skips additional smoothing

    return result;
  }

  /**
   * Updates preview with specific points (used for final optimization)
   */
  private updatePreviewWithPoints(points: PathPoint[], widths?: number[]): void {
    if (!this.state.previewId || points.length === 0) {
      return;
    }

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

    // Build update object
    const update: Partial<import('../types/canvas').PathObject> = {
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1),
      points: normalizedPoints,
    };

    // Add variable-width data if available
    if (widths && widths.length === normalizedPoints.length) {
      update.widths = widths;
      update.variableWidth = true;
    }

    this.ctx.updateObject(this.state.previewId, update);
  }

  onKeyDown(e: ToolKeyboardEvent): ToolEventResult {
    // Escape cancels drawing
    if (e.key === 'Escape' && this.state.isDrawing && this.state.previewId) {
      this.ctx.deleteObject(this.state.previewId);
      this.state.isDrawing = false;
      this.state.points = [];
      this.state.previewId = null;
      this.state.rawPoints = [];
      this.state.velocities = [];
      this.state.stabilizerState = null;
      this.state.lastTimestamp = 0;
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
