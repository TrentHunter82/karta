/**
 * Frame Tool
 *
 * Creates frame container objects via click-and-drag.
 * Frames are containers that can hold other objects (like Figma frames).
 *
 * Behavior:
 * - Click and drag to define frame bounds
 * - Created with default name "Frame"
 * - Escape cancels drawing
 * - Switches to select tool after creation
 * - Minimum size enforced to prevent tiny frames
 * - Supports auto-resize to content via resizeToContent()
 *
 * @see FrameObject in types/canvas.ts
 */
import { BaseTool } from './BaseTool';
import type {
  ToolState,
  ToolMouseEvent,
  ToolKeyboardEvent,
  ToolEventResult,
  Position,
} from './types';
import type { FrameObject } from '../types/canvas';
import {
  DEFAULT_FRAME_FILL,
  DEFAULT_FRAME_STROKE,
  DEFAULT_FRAME_STROKE_WIDTH,
} from '../constants/colors';

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
    const snapped = this.ctx.snapPosition(e.canvasX, e.canvasY);
    this.state.startPos = { x: snapped.x, y: snapped.y };
    this.state.endPos = { x: snapped.x, y: snapped.y };

    // Create preview frame
    const id = crypto.randomUUID();
    this.state.previewId = id;

    const frame: FrameObject = {
      id,
      type: 'frame',
      x: snapped.x,
      y: snapped.y,
      width: 0,
      height: 0,
      rotation: 0,
      opacity: 1,
      zIndex: -1000, // Frames always render behind other objects
      fill: DEFAULT_FRAME_FILL,
      stroke: DEFAULT_FRAME_STROKE,
      strokeWidth: DEFAULT_FRAME_STROKE_WIDTH,
      name: 'Frame',
    };

    this.ctx.addObject(frame);

    return { handled: true };
  }

  onMouseMove(e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isDrawing || !this.state.startPos || !this.state.previewId) {
      return { handled: false };
    }

    const snapped = this.ctx.snapPosition(e.canvasX, e.canvasY);
    this.state.endPos = { x: snapped.x, y: snapped.y };
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

    // Check if frame is too small (accidental click)
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

  /**
   * Resize a frame to fit its contents with optional padding.
   * Can be called externally to auto-resize a frame.
   * @param frameId - The ID of the frame to resize
   * @param padding - Padding around content (default: 20)
   * @returns true if frame was resized, false if no contents or frame not found
   */
  resizeToContent(frameId: string, padding: number = 20): boolean {
    const objects = this.ctx.getObjects();
    const frame = objects.get(frameId);

    if (!frame || frame.type !== 'frame') {
      return false;
    }

    // Get objects inside the frame
    const contentIds = this.ctx.getObjectsInsideFrame(frameId);
    if (contentIds.length === 0) {
      return false;
    }

    // Calculate bounding box of all content
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const id of contentIds) {
      const obj = objects.get(id);
      if (!obj) continue;

      const objMinX = obj.x;
      const objMinY = obj.y;
      const objMaxX = obj.x + obj.width;
      const objMaxY = obj.y + obj.height;

      minX = Math.min(minX, objMinX);
      minY = Math.min(minY, objMinY);
      maxX = Math.max(maxX, objMaxX);
      maxY = Math.max(maxY, objMaxY);
    }

    if (minX === Infinity) {
      return false;
    }

    // Calculate new frame bounds with padding
    const newX = minX - padding;
    const newY = minY - padding;
    const newWidth = (maxX - minX) + (padding * 2);
    const newHeight = (maxY - minY) + (padding * 2);

    // Only update if dimensions changed significantly
    const EPSILON = 0.5;
    if (
      Math.abs(frame.x - newX) > EPSILON ||
      Math.abs(frame.y - newY) > EPSILON ||
      Math.abs(frame.width - newWidth) > EPSILON ||
      Math.abs(frame.height - newHeight) > EPSILON
    ) {
      this.ctx.pushHistory();
      this.ctx.updateObject(frameId, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
      return true;
    }

    return false;
  }
}
