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
 * Hook that sets up global keyboard shortcuts for tool switching.
 * Shortcuts are disabled when typing in input fields.
 */
export function useKeyboardShortcuts() {
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if modifier keys are pressed (for other shortcuts like Ctrl+Z)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      // Ignore if focus is on an input field, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
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
  }, [setActiveTool]);
}
