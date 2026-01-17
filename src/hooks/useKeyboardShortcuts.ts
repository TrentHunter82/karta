import { useEffect } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import type { ToolType } from '../types/canvas';

const TOOL_SHORTCUTS: Record<string, ToolType> = {
  v: 'select',
  h: 'hand',
  r: 'rectangle',
  t: 'text',
  f: 'frame',
  p: 'pen',
};

/**
 * Hook that sets up global keyboard shortcuts for tool switching, zoom control, and undo/redo.
 * Shortcuts are disabled when typing in input fields.
 */
export function useKeyboardShortcuts() {
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);

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

        // Ctrl+= or Ctrl++ (zoom in)
        if (event.key === '=' || event.key === '+') {
          event.preventDefault();
          const newZoom = Math.min(5, viewport.zoom * 1.25);
          setViewport({ zoom: newZoom });
          return;
        }

        // Ctrl+- (zoom out)
        if (event.key === '-') {
          event.preventDefault();
          const newZoom = Math.max(0.1, viewport.zoom / 1.25);
          setViewport({ zoom: newZoom });
          return;
        }

        // Ctrl+0 (reset to 100%)
        if (event.key === '0') {
          event.preventDefault();
          setViewport({ zoom: 1 });
          return;
        }

        // Other Ctrl/Cmd shortcuts - let them pass through
        return;
      }

      // Ignore Alt key for tool shortcuts
      if (event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
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
  }, [setActiveTool, setViewport, undo, redo]);
}
