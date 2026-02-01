/**
 * Arrow Tool
 *
 * Creates arrow (line with arrowhead) objects via click-and-drag.
 *
 * Behavior:
 * - Click to set start point, drag to set end point
 * - Hold Shift to snap to 15-degree angles (more precision)
 * - Escape cancels drawing
 * - Switches to select tool after creation
 * - Arrowhead drawn at end point by default
 * - Supports multiple arrowhead styles (triangle, open, diamond, circle)
 * - Figma-style snapping to object edges and centers
 *
 * @see LineTool.ts - Similar but without arrowhead
 */
import { BaseTool } from './BaseTool';
import { ANGLE_SNAP_15_RAD } from '../constants/layout';
import {
  DEFAULT_LINE_STROKE,
  DEFAULT_LINE_STROKE_WIDTH,
} from '../constants/colors';
import { computeArrowEndpointSnap } from '../utils/snapUtils';
import type {
  ToolState,
  ToolMouseEvent,
  ToolKeyboardEvent,
  ToolEventResult,
  Position,
} from './types';
import type { ArrowObject } from '../types/canvas';
import type { SnapGuide } from '../stores/canvasStore';

const MIN_OBJECT_SIZE = 10;

/**
 * ArrowTool state
 */
interface ArrowToolState extends ToolState {
  isDrawing: boolean;
  startPos: Position | null;
  endPos: Position | null;
  shiftKey: boolean;
  previewId: string | null;
}

/**
 * ArrowTool handles arrow drawing via click and drag.
 * - Click and drag to draw an arrow
 * - Shift key constrains to 15° angles
 * - Escape cancels the current drawing
 * - Switches to select tool after creation
 */
export class ArrowTool extends BaseTool {
  protected declare state: ArrowToolState;

  get name(): string {
    return 'arrow';
  }

  getInitialState(): ArrowToolState {
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
    // Clear selection when switching to arrow tool
    this.ctx.setSelection([]);
  }

  onMouseDown(e: ToolMouseEvent): ToolEventResult {
    // Only handle left mouse button
    if (e.button !== 0) {
      return { handled: false };
    }

    this.state.isDrawing = true;

    // Try arrow endpoint snapping first (Figma-style snap to object edges/centers)
    const objects = this.ctx.getObjects();
    const arrowSnap = computeArrowEndpointSnap(
      e.canvasX,
      e.canvasY,
      objects,
      new Set() // No objects to exclude for start point
    );

    let startX: number, startY: number;
    const guides: SnapGuide[] = [];

    if (arrowSnap.snapped) {
      startX = arrowSnap.x;
      startY = arrowSnap.y;
      // Add visual snap indicator
      guides.push({
        type: 'point',
        position: 0,
        pointX: arrowSnap.x,
        pointY: arrowSnap.y,
        sourceId: arrowSnap.targetObjectId,
      });
    } else {
      // Fall back to grid snapping
      const snapped = this.ctx.snapPosition(e.canvasX, e.canvasY);
      startX = snapped.x;
      startY = snapped.y;
      guides.push(...snapped.guides);
    }

    this.state.startPos = { x: startX, y: startY };
    this.state.endPos = { x: startX, y: startY };
    this.state.shiftKey = e.shiftKey;
    this.ctx.setActiveSnapGuides(guides);

    // Create preview arrow
    const id = crypto.randomUUID();
    this.state.previewId = id;

    const arrow: ArrowObject = {
      id,
      type: 'arrow',
      x: startX,
      y: startY,
      width: 1,
      height: 1,
      rotation: 0,
      opacity: 1,
      zIndex: this.ctx.getNextZIndex(),
      stroke: DEFAULT_LINE_STROKE,
      strokeWidth: DEFAULT_LINE_STROKE_WIDTH,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      arrowStart: false,
      arrowEnd: true,
      arrowSize: 1,
      arrowStartStyle: 'none',
      arrowEndStyle: 'triangle',
    };

    this.ctx.addObject(arrow);

    return { handled: true };
  }

  onMouseMove(e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.startPos || !this.state.previewId) {
      return { handled: false };
    }

    let endX = e.canvasX;
    let endY = e.canvasY;

    // Shift key constrains to 15° angles for more precise control
    if (e.shiftKey) {
      const dx = endX - this.state.startPos.x;
      const dy = endY - this.state.startPos.y;
      const angle = Math.atan2(dy, dx);
      const length = Math.sqrt(dx * dx + dy * dy);
      // Snap to 15° increments (0°, 15°, 30°, 45°, 60°, 75°, 90°, etc.)
      const snappedAngle = Math.round(angle / ANGLE_SNAP_15_RAD) * ANGLE_SNAP_15_RAD;
      endX = this.state.startPos.x + length * Math.cos(snappedAngle);
      endY = this.state.startPos.y + length * Math.sin(snappedAngle);
    }

    // Try arrow endpoint snapping first (Figma-style snap to object edges/centers)
    const objects = this.ctx.getObjects();
    const arrowSnap = computeArrowEndpointSnap(
      endX,
      endY,
      objects,
      new Set([this.state.previewId]) // Exclude the arrow being drawn
    );

    const guides: SnapGuide[] = [];

    if (arrowSnap.snapped && !e.shiftKey) {
      // Use arrow snap (but not when Shift is held for angle snapping)
      this.state.endPos = { x: arrowSnap.x, y: arrowSnap.y };
      // Add visual snap indicator
      guides.push({
        type: 'point',
        position: 0,
        pointX: arrowSnap.x,
        pointY: arrowSnap.y,
        sourceId: arrowSnap.targetObjectId,
      });
    } else {
      // Fall back to grid snapping
      const snapped = this.ctx.snapPosition(endX, endY);
      this.state.endPos = { x: snapped.x, y: snapped.y };
      guides.push(...snapped.guides);
    }

    this.state.shiftKey = e.shiftKey;
    this.ctx.setActiveSnapGuides(guides);

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

    // Check if arrow is too short (accidental click)
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
