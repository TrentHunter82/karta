// TextTool - handles text creation
import { BaseTool } from './BaseTool';
import type {
  ToolState,
  ToolMouseEvent,
  ToolEventResult,
} from './types';
import type { TextObject } from '../types/canvas';

// Default text dimensions for empty text
const DEFAULT_TEXT_WIDTH = 100;
const DEFAULT_TEXT_HEIGHT = 24;

/**
 * TextTool handles text creation via click.
 * - Click to create a text object at that position
 * - Immediately switches to select tool for editing
 * - Returns requestRedraw to signal Canvas to enter text editing mode
 */
export class TextTool extends BaseTool {
  get name(): string {
    return 'text';
  }

  getInitialState(): ToolState {
    return {
      cursor: 'text',
      isActive: false,
    };
  }

  onActivate(): void {
    super.onActivate();
    this.setCursor('text');
  }

  onMouseDown(e: ToolMouseEvent): ToolEventResult {
    // Only handle left mouse button
    if (e.button !== 0) {
      return { handled: false };
    }

    // Create a new text object at the click position
    const id = crypto.randomUUID();

    const text: TextObject = {
      id,
      type: 'text',
      x: e.canvasX,
      y: e.canvasY,
      width: DEFAULT_TEXT_WIDTH,
      height: DEFAULT_TEXT_HEIGHT,
      rotation: 0,
      opacity: 1,
      zIndex: this.ctx.getNextZIndex(),
      fill: '#ffffff',
      text: '',
      fontSize: 16,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 400,
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      lineHeight: 1.2,
    };

    this.ctx.addObject(text);
    this.ctx.setSelection([id]);
    this.ctx.setActiveTool('select');

    // Request redraw to signal that text editing should be started
    // The Canvas component will check for the newly created text object
    // and enter edit mode
    return { handled: true, requestRedraw: true };
  }

  onMouseMove(_e: ToolMouseEvent): ToolEventResult {
    return { handled: false };
  }

  onMouseUp(_e: ToolMouseEvent): ToolEventResult {
    return { handled: false };
  }
}
