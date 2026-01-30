/**
 * Hand Tool
 *
 * Panning tool that allows users to drag the canvas viewport.
 * Activated via keyboard shortcut (H) or when spacebar is held.
 *
 * Behavior:
 * - Click and drag to pan the viewport
 * - Cursor shows grab (idle) / grabbing (active)
 * - Does not interact with objects
 *
 * @see SelectTool.ts - Has temporary hand mode via spacebar
 */
import { BaseTool } from './BaseTool';
import type {
  ToolState,
  ToolMouseEvent,
  ToolEventResult,
  Position,
} from './types';

/**
 * HandTool state
 */
interface HandToolState extends ToolState {
  isPanning: boolean;
  lastScreenPos: Position | null;
}

/**
 * HandTool handles canvas panning via click and drag.
 * - Click and drag to pan the canvas
 * - Cursor shows grab/grabbing state
 */
export class HandTool extends BaseTool {
  protected declare state: HandToolState;

  get name(): string {
    return 'hand';
  }

  getInitialState(): HandToolState {
    return {
      cursor: 'grab',
      isActive: false,
      isPanning: false,
      lastScreenPos: null,
    };
  }

  onActivate(): void {
    super.onActivate();
    this.setCursor('grab');
  }

  onMouseDown(e: ToolMouseEvent): ToolEventResult {
    // Only handle left mouse button
    if (e.button !== 0) {
      return { handled: false };
    }

    this.state.isPanning = true;
    this.state.lastScreenPos = { x: e.screenX, y: e.screenY };
    this.setCursor('grabbing');

    return { handled: true, cursor: 'grabbing' };
  }

  onMouseMove(e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isPanning || !this.state.lastScreenPos) {
      return { handled: false };
    }

    const dx = e.screenX - this.state.lastScreenPos.x;
    const dy = e.screenY - this.state.lastScreenPos.y;

    if (dx !== 0 || dy !== 0) {
      const viewport = this.ctx.getViewport();
      this.ctx.setViewport({
        x: viewport.x + dx / viewport.zoom,
        y: viewport.y + dy / viewport.zoom,
      });
    }

    this.state.lastScreenPos = { x: e.screenX, y: e.screenY };
    return { handled: true, cursor: 'grabbing' };
  }

  onMouseUp(_e: ToolMouseEvent): ToolEventResult {
    if (!this.state.isPanning) {
      return { handled: false };
    }

    this.state.isPanning = false;
    this.state.lastScreenPos = null;
    this.setCursor('grab');

    return { handled: true, cursor: 'grab' };
  }
}
