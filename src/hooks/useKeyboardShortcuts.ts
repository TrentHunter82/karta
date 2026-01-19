import { useEffect } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import type { ToolType, TextObject } from '../types/canvas';

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
 */
export function useKeyboardShortcuts() {
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const setSelection = useCanvasStore((state) => state.setSelection);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const deleteSelectedObjects = useCanvasStore((state) => state.deleteSelectedObjects);
  const copySelection = useCanvasStore((state) => state.copySelection);
  const paste = useCanvasStore((state) => state.paste);
  const duplicate = useCanvasStore((state) => state.duplicate);
  const alignObjects = useCanvasStore((state) => state.alignObjects);
  const distributeObjects = useCanvasStore((state) => state.distributeObjects);
  const zoomToFit = useCanvasStore((state) => state.zoomToFit);
  const zoomToSelection = useCanvasStore((state) => state.zoomToSelection);
  const setZoomPreset = useCanvasStore((state) => state.setZoomPreset);
  const toggleMinimap = useCanvasStore((state) => state.toggleMinimap);
  const groupSelection = useCanvasStore((state) => state.groupSelection);
  const ungroupSelection = useCanvasStore((state) => state.ungroupSelection);
  const updateObjects = useCanvasStore((state) => state.updateObjects);
  const pushHistory = useCanvasStore((state) => state.pushHistory);

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

      // Handle Ctrl/Cmd shortcuts
      if (event.ctrlKey || event.metaKey) {
        const viewport = useCanvasStore.getState().viewport;
        const cursorPosition = useCanvasStore.getState().cursorPosition;

        // Ctrl+Z (undo) or Ctrl+Shift+Z (redo)
        if (event.key === 'z' || event.key === 'Z') {
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }

        // Ctrl+Y (redo)
        if (event.key === 'y' || event.key === 'Y') {
          event.preventDefault();
          redo();
          return;
        }

        // Ctrl+C (copy)
        if (event.key === 'c' || event.key === 'C') {
          event.preventDefault();
          copySelection();
          return;
        }

        // Ctrl+V (paste)
        if (event.key === 'v' || event.key === 'V') {
          event.preventDefault();
          paste();
          return;
        }

        // Ctrl+D (duplicate)
        if (event.key === 'd' || event.key === 'D') {
          event.preventDefault();
          duplicate();
          return;
        }

        // Ctrl+A (select all)
        if (event.key === 'a' || event.key === 'A') {
          event.preventDefault();
          const objects = useCanvasStore.getState().objects;
          const allIds = Array.from(objects.keys());
          setSelection(allIds);
          return;
        }

        // Ctrl+B (toggle bold for selected text objects)
        if (event.key === 'b' || event.key === 'B') {
          const { objects, selectedIds } = useCanvasStore.getState();
          const textObjs = Array.from(selectedIds)
            .map(id => objects.get(id))
            .filter((obj): obj is TextObject => obj?.type === 'text');

          if (textObjs.length > 0) {
            event.preventDefault();
            pushHistory();
            const allBold = textObjs.every(obj => (obj.fontWeight || 400) >= 700);
            updateObjects(textObjs.map(obj => ({
              id: obj.id,
              changes: { fontWeight: allBold ? 400 : 700 }
            })));
            return;
          }
        }

        // Ctrl+I (toggle italic for selected text objects)
        if (event.key === 'i' || event.key === 'I') {
          const { objects, selectedIds } = useCanvasStore.getState();
          const textObjs = Array.from(selectedIds)
            .map(id => objects.get(id))
            .filter((obj): obj is TextObject => obj?.type === 'text');

          if (textObjs.length > 0) {
            event.preventDefault();
            pushHistory();
            const allItalic = textObjs.every(obj => obj.fontStyle === 'italic');
            updateObjects(textObjs.map(obj => ({
              id: obj.id,
              changes: { fontStyle: allItalic ? 'normal' : 'italic' }
            })));
            return;
          }
        }

        // Ctrl+U (toggle underline for selected text objects)
        if (event.key === 'u' || event.key === 'U') {
          const { objects, selectedIds } = useCanvasStore.getState();
          const textObjs = Array.from(selectedIds)
            .map(id => objects.get(id))
            .filter((obj): obj is TextObject => obj?.type === 'text');

          if (textObjs.length > 0) {
            event.preventDefault();
            pushHistory();
            const allUnderline = textObjs.every(obj => obj.textDecoration === 'underline');
            updateObjects(textObjs.map(obj => ({
              id: obj.id,
              changes: { textDecoration: allUnderline ? 'none' : 'underline' }
            })));
            return;
          }
        }

        // Ctrl+G (group selection)
        if ((event.key === 'g' || event.key === 'G') && !event.shiftKey) {
          event.preventDefault();
          groupSelection();
          return;
        }

        // Alignment shortcuts (Ctrl+Shift+...)
        if (event.shiftKey) {
          switch (event.key.toLowerCase()) {
            case 'g': // Ctrl+Shift+G (ungroup selection)
              event.preventDefault();
              ungroupSelection();
              return;
            case 'l':
              event.preventDefault();
              alignObjects('left');
              return;
            case 'r':
              event.preventDefault();
              alignObjects('right');
              return;
            case 't':
              event.preventDefault();
              alignObjects('top');
              return;
            case 'b':
              event.preventDefault();
              alignObjects('bottom');
              return;
            case 'h':
              event.preventDefault();
              alignObjects('centerH');
              return;
            case 'e': // Using E instead of V to avoid conflict with paste
              event.preventDefault();
              alignObjects('centerV');
              return;
            case '2': // Ctrl+Shift+2 for zoom to selection
              event.preventDefault();
              zoomToSelection();
              return;
          }
        }

        // Distribution shortcuts (Ctrl+Alt+...)
        if (event.altKey) {
          switch (event.key.toLowerCase()) {
            case 'h':
              event.preventDefault();
              distributeObjects('horizontal');
              return;
            case 'v':
              event.preventDefault();
              distributeObjects('vertical');
              return;
          }
        }

        // Helper function for zoom toward cursor
        const zoomTowardCursor = (zoomIn: boolean) => {
          // Get canvas dimensions
          const canvasWidth = window.innerWidth - 260;
          const canvasHeight = window.innerHeight - 80;

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

          setViewport({
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
          zoomToFit();
          return;
        }

        // Ctrl+1 (zoom to 100%)
        if (event.key === '1') {
          event.preventDefault();
          setZoomPreset(1);
          return;
        }

        // Ctrl+2 (zoom to 200%) - Note: Ctrl+Shift+2 is zoom to selection
        if (event.key === '2' && !event.shiftKey) {
          event.preventDefault();
          setZoomPreset(2);
          return;
        }

        // Ctrl+3 (zoom to 50%)
        if (event.key === '3') {
          event.preventDefault();
          setZoomPreset(0.5);
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
        deleteSelectedObjects();
        return;
      }

      // Escape deselects all objects and switches to select tool
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelection([]);
        setActiveTool('select');
        return;
      }

      // M key toggles minimap
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        toggleMinimap();
        return;
      }

      const key = event.key.toLowerCase();

      // Check for Shift+key tool shortcuts first
      if (event.shiftKey) {
        const shiftTool = SHIFT_TOOL_SHORTCUTS[key];
        if (shiftTool) {
          event.preventDefault();
          setActiveTool(shiftTool);
          return;
        }
      }

      // Check for regular tool shortcuts
      const tool = TOOL_SHORTCUTS[key];
      if (tool) {
        event.preventDefault();
        setActiveTool(tool);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setActiveTool, setViewport, setSelection, undo, redo, deleteSelectedObjects, copySelection, paste, duplicate, alignObjects, distributeObjects, zoomToFit, zoomToSelection, setZoomPreset, toggleMinimap, groupSelection, ungroupSelection, updateObjects, pushHistory]);
}
