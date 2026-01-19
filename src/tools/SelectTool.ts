// SelectTool - handles selection, moving, resizing, rotating, and marquee selection
import { BaseTool } from './BaseTool';
import type {
  ToolMouseEvent,
  ToolKeyboardEvent,
  ToolEventResult,
  SelectToolState,
  HandleType,
  Position,
} from './types';
import type { TextObject, CanvasObject } from '../types/canvas';

// Constants
const MIN_OBJECT_SIZE = 10;
const DOUBLE_CLICK_THRESHOLD = 300; // ms

// Cursor styles for each handle type
const HANDLE_CURSORS: Record<NonNullable<HandleType>, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

/**
 * SelectTool handles all selection-related interactions:
 * - Click to select single object
 * - Shift+click to add/remove from selection
 * - Drag to move selected objects
 * - Drag handles to resize
 * - Drag rotation handle to rotate
 * - Drag on empty space for marquee selection
 * - Double-click to enter edit modes
 */
export class SelectTool extends BaseTool {
  // Type-safe state accessor
  protected declare state: SelectToolState;

  get name(): string {
    return 'select';
  }

  getInitialState(): SelectToolState {
    return {
      cursor: 'default',
      isActive: false,
      mode: 'idle',
      startPos: null,
      lastPos: null,
      dragStartCanvasPos: null,

      // Resize state
      activeHandle: null,
      resizeStartState: null,

      // Rotation state
      rotationStartAngle: 0,
      rotationObjStartRotation: 0,

      // Marquee state
      marqueeStart: null,
      marqueeEnd: null,
      marqueeShiftKey: false,

      // Double-click tracking
      lastClickTime: 0,
      lastClickObjectId: null,
    };
  }

  onActivate(): void {
    super.onActivate();
    this.setCursor('default');
  }

  onMouseDown(e: ToolMouseEvent): ToolEventResult {
    const { screenX, screenY, canvasX, canvasY, shiftKey } = e;

    // Only handle left mouse button
    if (e.button !== 0) {
      return { handled: false };
    }

    const selectedIds = this.ctx.getSelectedIds();
    const objects = this.ctx.getObjects();

    // Check for resize/rotation handles on selected object (single selection only)
    if (selectedIds.size === 1) {
      const selectedId = Array.from(selectedIds)[0];
      const selectedObj = objects.get(selectedId);

      if (selectedObj && !selectedObj.locked) {
        // Check rotation handle first
        const rotationHandle = this.ctx.hitTestRotationHandle(screenX, screenY, selectedObj);
        if (rotationHandle) {
          this.startRotation(selectedObj, screenX, screenY);
          return { handled: true, cursor: 'grab' };
        }

        // Check resize handles
        const handle = this.ctx.hitTestHandle(screenX, screenY, selectedObj);
        if (handle) {
          this.startResize(selectedObj, handle, canvasX, canvasY);
          return { handled: true, cursor: HANDLE_CURSORS[handle] };
        }
      }
    }

    // Hit test for objects
    const hitObject = this.ctx.hitTest(screenX, screenY);

    if (hitObject) {
      // Check for double-click
      const now = Date.now();
      const isDoubleClick =
        this.state.lastClickObjectId === hitObject.id &&
        now - this.state.lastClickTime < DOUBLE_CLICK_THRESHOLD;

      // Update click tracking
      this.state.lastClickTime = now;
      this.state.lastClickObjectId = hitObject.id;

      if (isDoubleClick) {
        return this.handleDoubleClick(hitObject);
      }

      // Check if object is locked
      if (hitObject.locked) {
        // Allow selection but not dragging
        this.handleLockedObjectClick(hitObject, shiftKey, selectedIds);
        return { handled: true };
      }

      // Normal click handling
      return this.handleObjectClick(hitObject, shiftKey, selectedIds, canvasX, canvasY, e);
    }

    // Click on empty space - exit group edit mode if active
    const editingGroupId = this.ctx.getEditingGroupId();
    if (editingGroupId) {
      this.ctx.exitGroupEditMode();
    }

    // Start marquee selection
    this.startMarquee(canvasX, canvasY, shiftKey, selectedIds);
    return { handled: true, cursor: 'crosshair' };
  }

  onMouseMove(e: ToolMouseEvent): ToolEventResult {
    const { screenX, screenY, canvasX, canvasY, shiftKey } = e;
    const objects = this.ctx.getObjects();
    const selectedIds = this.ctx.getSelectedIds();
    const viewport = this.ctx.getViewport();

    switch (this.state.mode) {
      case 'dragging':
        return this.handleDragMove(canvasX, canvasY, objects, selectedIds, viewport);

      case 'resizing':
        return this.handleResizeMove(canvasX, canvasY, shiftKey, objects, selectedIds);

      case 'rotating':
        return this.handleRotateMove(screenX, screenY, shiftKey, objects, selectedIds);

      case 'marquee':
        return this.handleMarqueeMove(canvasX, canvasY);

      case 'idle':
        return this.handleIdleHover(screenX, screenY, objects, selectedIds);
    }
  }

  onMouseUp(_e: ToolMouseEvent): ToolEventResult {
    const prevMode = this.state.mode;

    switch (prevMode) {
      case 'marquee':
        this.finalizeMarquee();
        break;

      case 'dragging':
      case 'resizing':
      case 'rotating':
        // These operations complete naturally on mouse up
        break;
    }

    // Reset state
    this.state.mode = 'idle';
    this.state.startPos = null;
    this.state.lastPos = null;
    this.state.dragStartCanvasPos = null;
    this.state.activeHandle = null;
    this.state.resizeStartState = null;
    this.state.marqueeStart = null;
    this.state.marqueeEnd = null;

    this.setCursor('default');
    return { handled: true };
  }

  onKeyDown(e: ToolKeyboardEvent): ToolEventResult {
    // Escape cancels current operation
    if (e.code === 'Escape' && this.state.mode !== 'idle') {
      // TODO: Could restore original positions on escape
      this.state.mode = 'idle';
      this.setCursor('default');
      return { handled: true };
    }

    return { handled: false };
  }

  // ============ Private helper methods ============

  private startRotation(obj: CanvasObject, screenX: number, screenY: number): void {
    this.ctx.pushHistory();
    this.state.mode = 'rotating';

    // Calculate center of object in screen coordinates
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    const screenCenter = this.ctx.canvasToScreen(centerX, centerY);

    // Calculate initial angle from center to mouse position
    const angleRad = Math.atan2(screenY - screenCenter.y, screenX - screenCenter.x);
    this.state.rotationStartAngle = (angleRad * 180) / Math.PI + 90;
    this.state.rotationObjStartRotation = obj.rotation;

    this.setCursor('grab');
  }

  private startResize(obj: CanvasObject, handle: HandleType, canvasX: number, canvasY: number): void {
    this.ctx.pushHistory();
    this.state.mode = 'resizing';
    this.state.activeHandle = handle;
    this.state.dragStartCanvasPos = { x: canvasX, y: canvasY };
    this.state.resizeStartState = {
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      fontSize: obj.type === 'text' ? (obj as TextObject).fontSize : undefined,
    };

    if (handle) {
      this.setCursor(HANDLE_CURSORS[handle]);
    }
  }

  private handleDoubleClick(obj: CanvasObject): ToolEventResult {
    // Handle double-click based on object type
    switch (obj.type) {
      case 'text':
        // Text editing is handled by Canvas component (needs DOM input)
        // Return event indicating text edit mode should be entered
        this.ctx.setSelection([obj.id]);
        return {
          handled: true,
          requestRedraw: true,
        };

      case 'frame':
        // Frame name editing is handled by Canvas component
        this.ctx.setSelection([obj.id]);
        return {
          handled: true,
          requestRedraw: true,
        };

      case 'group':
        // Enter group edit mode
        this.ctx.setSelection([obj.id]);
        this.ctx.enterGroupEditMode(obj.id);
        return { handled: true };

      case 'video':
        // Video playback toggle is handled by Canvas component
        this.ctx.setSelection([obj.id]);
        return { handled: true };

      default:
        return { handled: false };
    }
  }

  private handleLockedObjectClick(
    obj: CanvasObject,
    shiftKey: boolean,
    selectedIds: Set<string>
  ): void {
    if (!shiftKey) {
      this.ctx.setSelection([obj.id]);
    } else {
      // Toggle selection
      if (selectedIds.has(obj.id)) {
        const newSelection = Array.from(selectedIds).filter((id) => id !== obj.id);
        this.ctx.setSelection(newSelection);
      } else {
        this.ctx.setSelection([...Array.from(selectedIds), obj.id]);
      }
    }
  }

  private handleObjectClick(
    obj: CanvasObject,
    shiftKey: boolean,
    selectedIds: Set<string>,
    canvasX: number,
    canvasY: number,
    e: ToolMouseEvent
  ): ToolEventResult {
    if (shiftKey) {
      // Shift+click - toggle selection
      if (selectedIds.has(obj.id)) {
        const newSelection = Array.from(selectedIds).filter((id) => id !== obj.id);
        this.ctx.setSelection(newSelection);
      } else {
        this.ctx.setSelection([...Array.from(selectedIds), obj.id]);
      }
      return { handled: true };
    }

    // Push history before starting drag
    this.ctx.pushHistory();

    // Check if clicking on already selected object
    if (selectedIds.has(obj.id)) {
      // Check if all selected objects are unlocked
      const objects = this.ctx.getObjects();
      const allUnlocked = Array.from(selectedIds).every((id) => {
        const o = objects.get(id);
        return o && !o.locked;
      });

      if (allUnlocked) {
        this.startDragging(canvasX, canvasY, e);
      }
    } else {
      // Select only this object and start dragging
      this.ctx.setSelection([obj.id]);
      this.startDragging(canvasX, canvasY, e);
    }

    return { handled: true, cursor: 'move' };
  }

  private startDragging(canvasX: number, canvasY: number, e: ToolMouseEvent): void {
    this.state.mode = 'dragging';
    this.state.dragStartCanvasPos = { x: canvasX, y: canvasY };
    this.state.lastPos = { x: e.screenX, y: e.screenY };
    this.setCursor('move');
  }

  private startMarquee(
    canvasX: number,
    canvasY: number,
    shiftKey: boolean,
    _selectedIds: Set<string>
  ): void {
    this.state.mode = 'marquee';
    this.state.marqueeStart = { x: canvasX, y: canvasY };
    this.state.marqueeEnd = { x: canvasX, y: canvasY };
    this.state.marqueeShiftKey = shiftKey;

    // Clear selection unless shift is held
    if (!shiftKey) {
      this.ctx.setSelection([]);
    }

    this.setCursor('crosshair');
  }

  private handleDragMove(
    canvasX: number,
    canvasY: number,
    objects: Map<string, CanvasObject>,
    selectedIds: Set<string>,
    viewport: { zoom: number }
  ): ToolEventResult {
    if (!this.state.lastPos) {
      return { handled: false };
    }

    // Calculate canvas coordinate delta
    const screenPos = this.ctx.canvasToScreen(canvasX, canvasY);
    const dx = (screenPos.x - this.state.lastPos.x) / viewport.zoom;
    const dy = (screenPos.y - this.state.lastPos.y) / viewport.zoom;

    if (dx === 0 && dy === 0) {
      return { handled: true };
    }

    // Update all selected objects
    const updates = Array.from(selectedIds)
      .map((id) => {
        const obj = objects.get(id);
        if (!obj) return null;
        return {
          id,
          changes: {
            x: obj.x + dx,
            y: obj.y + dy,
          },
        };
      })
      .filter((u): u is { id: string; changes: { x: number; y: number } } => u !== null);

    if (updates.length > 0) {
      this.ctx.updateObjects(updates);
    }

    this.state.lastPos = { x: screenPos.x, y: screenPos.y };
    return { handled: true, cursor: 'move' };
  }

  private handleResizeMove(
    canvasX: number,
    canvasY: number,
    shiftKey: boolean,
    objects: Map<string, CanvasObject>,
    selectedIds: Set<string>
  ): ToolEventResult {
    if (selectedIds.size !== 1 || !this.state.activeHandle || !this.state.resizeStartState || !this.state.dragStartCanvasPos) {
      return { handled: false };
    }

    const selectedId = Array.from(selectedIds)[0];
    const startState = this.state.resizeStartState;
    const handle = this.state.activeHandle;

    // Calculate delta in canvas coordinates
    const deltaX = canvasX - this.state.dragStartCanvasPos.x;
    const deltaY = canvasY - this.state.dragStartCanvasPos.y;

    let newX = startState.x;
    let newY = startState.y;
    let newWidth = startState.width;
    let newHeight = startState.height;

    // Calculate aspect ratio for proportional resize
    const aspectRatio = startState.width / startState.height;
    const isCornerHandle = handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se';
    // Corner handles: proportional by default, Shift for free resize
    // Edge handles: always single dimension
    const useProportional = isCornerHandle && !shiftKey;

    // Apply resize based on handle type
    switch (handle) {
      case 'nw':
        newWidth = startState.width - deltaX;
        newHeight = startState.height - deltaY;
        if (useProportional) {
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            newHeight = newWidth / aspectRatio;
          } else {
            newWidth = newHeight * aspectRatio;
          }
        }
        newX = startState.x + startState.width - newWidth;
        newY = startState.y + startState.height - newHeight;
        break;
      case 'n':
        newHeight = startState.height - deltaY;
        newY = startState.y + startState.height - newHeight;
        break;
      case 'ne':
        newWidth = startState.width + deltaX;
        newHeight = startState.height - deltaY;
        if (useProportional) {
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            newHeight = newWidth / aspectRatio;
          } else {
            newWidth = newHeight * aspectRatio;
          }
        }
        newY = startState.y + startState.height - newHeight;
        break;
      case 'e':
        newWidth = startState.width + deltaX;
        break;
      case 'se':
        newWidth = startState.width + deltaX;
        newHeight = startState.height + deltaY;
        if (useProportional) {
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            newHeight = newWidth / aspectRatio;
          } else {
            newWidth = newHeight * aspectRatio;
          }
        }
        break;
      case 's':
        newHeight = startState.height + deltaY;
        break;
      case 'sw':
        newWidth = startState.width - deltaX;
        newHeight = startState.height + deltaY;
        if (useProportional) {
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            newHeight = newWidth / aspectRatio;
          } else {
            newWidth = newHeight * aspectRatio;
          }
        }
        newX = startState.x + startState.width - newWidth;
        break;
      case 'w':
        newWidth = startState.width - deltaX;
        newX = startState.x + startState.width - newWidth;
        break;
    }

    // Enforce minimum size
    if (newWidth < MIN_OBJECT_SIZE) {
      newWidth = MIN_OBJECT_SIZE;
      if (handle === 'nw' || handle === 'w' || handle === 'sw') {
        newX = startState.x + startState.width - MIN_OBJECT_SIZE;
      }
    }
    if (newHeight < MIN_OBJECT_SIZE) {
      newHeight = MIN_OBJECT_SIZE;
      if (handle === 'nw' || handle === 'n' || handle === 'ne') {
        newY = startState.y + startState.height - MIN_OBJECT_SIZE;
      }
    }

    // For text objects, scale fontSize proportionally
    const selectedObj = objects.get(selectedId);
    if (selectedObj && selectedObj.type === 'text' && startState.fontSize) {
      const scaleRatio = newWidth / startState.width;
      const newFontSize = Math.max(1, Math.round(startState.fontSize * scaleRatio));

      this.ctx.updateObjects([{
        id: selectedId,
        changes: {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          fontSize: newFontSize,
        } as Partial<CanvasObject>,
      }]);
    } else {
      this.ctx.updateObjects([{
        id: selectedId,
        changes: { x: newX, y: newY, width: newWidth, height: newHeight },
      }]);
    }

    return { handled: true, cursor: handle ? HANDLE_CURSORS[handle] : 'default' };
  }

  private handleRotateMove(
    screenX: number,
    screenY: number,
    shiftKey: boolean,
    objects: Map<string, CanvasObject>,
    selectedIds: Set<string>
  ): ToolEventResult {
    if (selectedIds.size !== 1) {
      return { handled: false };
    }

    const selectedId = Array.from(selectedIds)[0];
    const selectedObj = objects.get(selectedId);
    if (!selectedObj) {
      return { handled: false };
    }

    // Calculate center of object in screen coordinates
    const centerX = selectedObj.x + selectedObj.width / 2;
    const centerY = selectedObj.y + selectedObj.height / 2;
    const screenCenter = this.ctx.canvasToScreen(centerX, centerY);

    // Calculate current angle from center to mouse position
    const currentAngleRad = Math.atan2(screenY - screenCenter.y, screenX - screenCenter.x);
    const currentAngle = (currentAngleRad * 180) / Math.PI + 90;

    // Calculate rotation delta
    const rotationDelta = currentAngle - this.state.rotationStartAngle;

    // Calculate new rotation
    let newRotation = this.state.rotationObjStartRotation + rotationDelta;

    // Normalize to 0-360 range
    newRotation = ((newRotation % 360) + 360) % 360;

    // Shift+drag snaps to 15 degree increments
    if (shiftKey) {
      newRotation = Math.round(newRotation / 15) * 15;
    }

    this.ctx.updateObjects([{
      id: selectedId,
      changes: { rotation: newRotation },
    }]);

    return { handled: true, cursor: 'grab' };
  }

  private handleMarqueeMove(canvasX: number, canvasY: number): ToolEventResult {
    this.state.marqueeEnd = { x: canvasX, y: canvasY };
    return { handled: true, cursor: 'crosshair', requestRedraw: true };
  }

  private finalizeMarquee(): void {
    if (!this.state.marqueeStart || !this.state.marqueeEnd) {
      return;
    }

    const intersectingIds = this.ctx.getObjectsInRect(
      this.state.marqueeStart.x,
      this.state.marqueeStart.y,
      this.state.marqueeEnd.x,
      this.state.marqueeEnd.y
    );

    const selectedIds = this.ctx.getSelectedIds();

    if (this.state.marqueeShiftKey) {
      // Shift held: add to existing selection
      const newSelection = new Set(selectedIds);
      intersectingIds.forEach((id) => newSelection.add(id));
      this.ctx.setSelection(Array.from(newSelection));
    } else {
      // Normal marquee: select only intersecting objects
      this.ctx.setSelection(intersectingIds);
    }
  }

  private handleIdleHover(
    screenX: number,
    screenY: number,
    objects: Map<string, CanvasObject>,
    selectedIds: Set<string>
  ): ToolEventResult {
    // Check for handle hover on selected objects (single selection only)
    if (selectedIds.size === 1) {
      const selectedId = Array.from(selectedIds)[0];
      const selectedObj = objects.get(selectedId);

      if (selectedObj) {
        // Check rotation handle first
        const rotHandle = this.ctx.hitTestRotationHandle(screenX, screenY, selectedObj);
        if (rotHandle) {
          this.setCursor('grab');
          return { handled: true, cursor: 'grab' };
        }

        // Check resize handles
        const handle = this.ctx.hitTestHandle(screenX, screenY, selectedObj);
        if (handle) {
          this.setCursor(HANDLE_CURSORS[handle]);
          return { handled: true, cursor: HANDLE_CURSORS[handle] };
        }
      }
    }

    // Check for object hover (for move cursor)
    const hitObject = this.ctx.hitTest(screenX, screenY);
    if (hitObject && selectedIds.has(hitObject.id)) {
      this.setCursor('move');
      return { handled: true, cursor: 'move' };
    }

    // Default cursor
    this.setCursor('default');
    return { handled: true, cursor: 'default' };
  }

  // ============ Overlay rendering ============

  renderOverlay(ctx: CanvasRenderingContext2D): void {
    // Render marquee selection rectangle
    if (this.state.mode === 'marquee' && this.state.marqueeStart && this.state.marqueeEnd) {
      this.renderMarqueeRect(ctx);
    }
  }

  private renderMarqueeRect(ctx: CanvasRenderingContext2D): void {
    if (!this.state.marqueeStart || !this.state.marqueeEnd) return;

    const startScreen = this.ctx.canvasToScreen(this.state.marqueeStart.x, this.state.marqueeStart.y);
    const endScreen = this.ctx.canvasToScreen(this.state.marqueeEnd.x, this.state.marqueeEnd.y);

    const x = Math.min(startScreen.x, endScreen.x);
    const y = Math.min(startScreen.y, endScreen.y);
    const width = Math.abs(endScreen.x - startScreen.x);
    const height = Math.abs(endScreen.y - startScreen.y);

    ctx.save();

    // Fill with semi-transparent blue
    ctx.fillStyle = 'rgba(0, 102, 255, 0.1)';
    ctx.fillRect(x, y, width, height);

    // Dashed blue border
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, width, height);

    ctx.restore();
  }

  // ============ State queries ============

  /**
   * Get current selection mode
   */
  getMode(): string {
    return this.state.mode;
  }

  /**
   * Get marquee bounds (if in marquee mode)
   */
  getMarqueeBounds(): { start: Position; end: Position } | null {
    if (this.state.mode !== 'marquee' || !this.state.marqueeStart || !this.state.marqueeEnd) {
      return null;
    }
    return {
      start: { ...this.state.marqueeStart },
      end: { ...this.state.marqueeEnd },
    };
  }
}
