import { useEffect } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import type { ToolType, TextObject } from '../types/canvas';
import { CANVAS_WIDTH_OFFSET, CANVAS_HEIGHT_OFFSET } from '../constants/layout';

interface KeyboardShortcutsOptions {
  onOpenShortcuts?: () => void;
}

const TOOL_SHORTCUTS: Record<string, ToolType> = {
  v: 'select',
  h: 'hand',
  r: 'rectangle',
  o: 'ellipse',
  l: 'line',
  t: 'text',
  f: 'frame',
  p: 'pen',
};

// Shift key tool shortcuts
const SHIFT_TOOL_SHORTCUTS: Record<string, ToolType> = {
  l: 'arrow',
};

/**
 * Hook that sets up global keyboard shortcuts for tool switching, zoom control, and undo/redo.
 * Shortcuts are disabled when typing in input fields.
 *
 * Uses getState() inside the handler to avoid a large dependency array
 * that would cause frequent event listener re-registration.
 */
export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const { onOpenShortcuts } = options;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if focus is on an input field, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Pull all actions from store at call time — avoids stale closures
      const store = useCanvasStore.getState();

      // Handle Ctrl/Cmd shortcuts
      if (event.ctrlKey || event.metaKey) {
        const viewport = store.viewport;
        const cursorPosition = store.cursorPosition;

        // Ctrl+Z (undo) or Ctrl+Shift+Z (redo)
        if (event.key === 'z' || event.key === 'Z') {
          event.preventDefault();
          if (event.shiftKey) {
            store.redo();
          } else {
            store.undo();
          }
          return;
        }

        // Ctrl+Y (redo)
        if (event.key === 'y' || event.key === 'Y') {
          event.preventDefault();
          store.redo();
          return;
        }

        // Ctrl+C (copy)
        if (event.key === 'c' || event.key === 'C') {
          event.preventDefault();
          store.copySelection();
          return;
        }

        // Ctrl+V (paste)
        if (event.key === 'v' || event.key === 'V') {
          event.preventDefault();
          store.paste();
          return;
        }

        // Ctrl+D (duplicate)
        if (event.key === 'd' || event.key === 'D') {
          event.preventDefault();
          store.duplicate();
          return;
        }

        // Ctrl+A (select all)
        if (event.key === 'a' || event.key === 'A') {
          event.preventDefault();
          const allIds = Array.from(store.objects.keys());
          store.setSelection(allIds);
          return;
        }

        // Ctrl+B (toggle bold for selected text objects)
        if (event.key === 'b' || event.key === 'B') {
          const textObjs = Array.from(store.selectedIds)
            .map(id => store.objects.get(id))
            .filter((obj): obj is TextObject => obj?.type === 'text');

          if (textObjs.length > 0) {
            event.preventDefault();
            store.pushHistory();
            const allBold = textObjs.every(obj => (obj.fontWeight || 400) >= 700);
            store.updateObjects(textObjs.map(obj => ({
              id: obj.id,
              changes: { fontWeight: allBold ? 400 : 700 }
            })));
            return;
          }
        }

        // Ctrl+I (toggle italic for selected text objects)
        if (event.key === 'i' || event.key === 'I') {
          const textObjs = Array.from(store.selectedIds)
            .map(id => store.objects.get(id))
            .filter((obj): obj is TextObject => obj?.type === 'text');

          if (textObjs.length > 0) {
            event.preventDefault();
            store.pushHistory();
            const allItalic = textObjs.every(obj => obj.fontStyle === 'italic');
            store.updateObjects(textObjs.map(obj => ({
              id: obj.id,
              changes: { fontStyle: allItalic ? 'normal' : 'italic' }
            })));
            return;
          }
        }

        // Ctrl+U (toggle underline for selected text objects)
        if (event.key === 'u' || event.key === 'U') {
          const textObjs = Array.from(store.selectedIds)
            .map(id => store.objects.get(id))
            .filter((obj): obj is TextObject => obj?.type === 'text');

          if (textObjs.length > 0) {
            event.preventDefault();
            store.pushHistory();
            const allUnderline = textObjs.every(obj => obj.textDecoration === 'underline');
            store.updateObjects(textObjs.map(obj => ({
              id: obj.id,
              changes: { textDecoration: allUnderline ? 'none' : 'underline' }
            })));
            return;
          }
        }

        // Ctrl+G (group selection)
        if ((event.key === 'g' || event.key === 'G') && !event.shiftKey) {
          event.preventDefault();
          store.groupSelection();
          return;
        }

        // Alignment shortcuts (Ctrl+Shift+...)
        if (event.shiftKey) {
          switch (event.key.toLowerCase()) {
            case 'g': // Ctrl+Shift+G (ungroup selection)
              event.preventDefault();
              store.ungroupSelection();
              return;
            case 'l':
              event.preventDefault();
              store.alignObjects('left');
              return;
            case 'r':
              event.preventDefault();
              store.alignObjects('right');
              return;
            case 't':
              event.preventDefault();
              store.alignObjects('top');
              return;
            case 'b':
              event.preventDefault();
              store.alignObjects('bottom');
              return;
            case 'h':
              event.preventDefault();
              store.alignObjects('centerH');
              return;
            case 'e': // Using E instead of V to avoid conflict with paste
              event.preventDefault();
              store.alignObjects('centerV');
              return;
            case '2': // Ctrl+Shift+2 for zoom to selection
              event.preventDefault();
              store.zoomToSelection();
              return;
          }
        }

        // Distribution shortcuts (Ctrl+Alt+...)
        if (event.altKey) {
          switch (event.key.toLowerCase()) {
            case 'h':
              event.preventDefault();
              store.distributeObjects('horizontal');
              return;
            case 'v':
              event.preventDefault();
              store.distributeObjects('vertical');
              return;
          }
        }

        // Helper function for zoom toward cursor
        const zoomTowardCursor = (zoomIn: boolean) => {
          // Get canvas dimensions
          const canvasWidth = window.innerWidth - CANVAS_WIDTH_OFFSET;
          const canvasHeight = window.innerHeight - CANVAS_HEIGHT_OFFSET;

          // Calculate zoom center (cursor position if on canvas, otherwise center)
          const zoomCenter = cursorPosition || {
            x: -viewport.x + canvasWidth / 2 / viewport.zoom,
            y: -viewport.y + canvasHeight / 2 / viewport.zoom
          };

          const zoomFactor = zoomIn ? 1.25 : 0.8;
          const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * zoomFactor));

          // Calculate new viewport position to keep zoomCenter fixed
          const newX = viewport.x - zoomCenter.x * (1 / viewport.zoom - 1 / newZoom);
          const newY = viewport.y - zoomCenter.y * (1 / viewport.zoom - 1 / newZoom);

          store.setViewport({
            x: newX,
            y: newY,
            zoom: newZoom
          });
        };

        // Ctrl+= or Ctrl++ (zoom in toward cursor)
        if (event.key === '=' || event.key === '+') {
          event.preventDefault();
          zoomTowardCursor(true);
          return;
        }

        // Ctrl+- (zoom out toward cursor)
        if (event.key === '-') {
          event.preventDefault();
          zoomTowardCursor(false);
          return;
        }

        // Ctrl+0 (fit all objects)
        if (event.key === '0') {
          event.preventDefault();
          store.zoomToFit();
          return;
        }

        // Ctrl+1 (zoom to 100%)
        if (event.key === '1') {
          event.preventDefault();
          store.setZoomPreset(1);
          return;
        }

        // Ctrl+2 (zoom to 200%) - Note: Ctrl+Shift+2 is zoom to selection
        if (event.key === '2' && !event.shiftKey) {
          event.preventDefault();
          store.setZoomPreset(2);
          return;
        }

        // Ctrl+3 (zoom to 50%)
        if (event.key === '3') {
          event.preventDefault();
          store.setZoomPreset(0.5);
          return;
        }

        // Ctrl+] (bring to front)
        if (event.key === ']') {
          event.preventDefault();
          store.bringToFront();
          return;
        }

        // Ctrl+[ (send to back)
        if (event.key === '[') {
          event.preventDefault();
          store.sendToBack();
          return;
        }

        // Other Ctrl/Cmd shortcuts - let them pass through
        return;
      }

      // Ignore Alt key for tool shortcuts
      if (event.altKey) {
        return;
      }

      // Delete or Backspace deletes selected objects
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        store.deleteSelectedObjects();
        return;
      }

      // Escape deselects all objects and switches to select tool
      if (event.key === 'Escape') {
        event.preventDefault();
        store.setSelection([]);
        store.setActiveTool('select');
        return;
      }

      // ? key opens keyboard shortcuts modal
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        onOpenShortcuts?.();
        return;
      }

      // M key toggles minimap
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        store.toggleMinimap();
        return;
      }

      // ] key (bring forward / bring to front with Ctrl)
      if (event.key === ']') {
        event.preventDefault();
        store.bringForward();
        return;
      }

      // [ key (send backward / send to back with Ctrl)
      if (event.key === '[') {
        event.preventDefault();
        store.sendBackward();
        return;
      }

      // Arrow key nudging
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        if (store.selectedIds.size === 0) return;

        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;

        let dx = 0, dy = 0;
        if (event.key === 'ArrowUp') dy = -amount;
        if (event.key === 'ArrowDown') dy = amount;
        if (event.key === 'ArrowLeft') dx = -amount;
        if (event.key === 'ArrowRight') dx = amount;

        store.pushHistory();
        const updates = Array.from(store.selectedIds)
          .map(id => store.objects.get(id))
          .filter((obj): obj is NonNullable<typeof obj> => obj != null && !obj.locked)
          .map(obj => ({ id: obj.id, changes: { x: obj.x + dx, y: obj.y + dy } }));

        if (updates.length > 0) {
          store.updateObjects(updates);
        }
        return;
      }

      // Tab navigation between objects
      if (event.key === 'Tab') {
        event.preventDefault();

        const objects = Array.from(store.objects.values())
          .filter(obj => !obj.parentId && obj.visible !== false)
          .sort((a, b) => a.zIndex - b.zIndex);

        if (objects.length === 0) return;

        const currentId = store.selectedIds.size === 1 ? Array.from(store.selectedIds)[0] : null;
        const currentIndex = currentId ? objects.findIndex(o => o.id === currentId) : -1;

        let nextIndex: number;
        if (event.shiftKey) {
          // Shift+Tab: previous object
          nextIndex = currentIndex <= 0 ? objects.length - 1 : currentIndex - 1;
        } else {
          // Tab: next object
          nextIndex = currentIndex >= objects.length - 1 ? 0 : currentIndex + 1;
        }

        store.setSelection([objects[nextIndex].id]);
        return;
      }

      const key = event.key.toLowerCase();

      // Check for Shift+key tool shortcuts first
      if (event.shiftKey) {
        const shiftTool = SHIFT_TOOL_SHORTCUTS[key];
        if (shiftTool) {
          event.preventDefault();
          store.setActiveTool(shiftTool);
          return;
        }
      }

      // Check for regular tool shortcuts
      const tool = TOOL_SHORTCUTS[key];
      if (tool) {
        event.preventDefault();
        store.setActiveTool(tool);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onOpenShortcuts]);
}
