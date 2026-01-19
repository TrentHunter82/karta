// src/stores/clipboardStore.ts
import { create } from 'zustand';
import type { CanvasObject } from '../types/canvas';

interface ClipboardState {
  // State
  items: CanvasObject[];
  pasteCount: number; // For offset on multiple pastes

  // Actions
  copy: (objects: CanvasObject[]) => void;
  paste: (
    getNextZIndex: () => number,
    addObjects: (objects: CanvasObject[]) => void,
    setSelection: (ids: string[]) => void
  ) => void;
  duplicate: (
    objects: CanvasObject[],
    getNextZIndex: () => number,
    addObjects: (objects: CanvasObject[]) => void,
    setSelection: (ids: string[]) => void
  ) => void;
  clear: () => void;
  hasItems: () => boolean;
  getItems: () => CanvasObject[];
}

const PASTE_OFFSET = 10;

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  items: [],
  pasteCount: 0,

  copy: (objects) => {
    if (objects.length === 0) return;

    // Deep clone objects
    const clonedItems = objects.map((obj) => JSON.parse(JSON.stringify(obj)));

    set({
      items: clonedItems,
      pasteCount: 0,
    });

    console.log(`[Clipboard] Copied ${objects.length} objects`);
  },

  paste: (getNextZIndex, addObjects, setSelection) => {
    const state = get();
    if (state.items.length === 0) return;

    // Create new objects with new IDs and offset positions
    const newObjects: CanvasObject[] = state.items.map((item) => ({
      ...JSON.parse(JSON.stringify(item)),
      id: crypto.randomUUID(),
      x: item.x + PASTE_OFFSET,
      y: item.y + PASTE_OFFSET,
      zIndex: getNextZIndex(),
    }));

    addObjects(newObjects);
    setSelection(newObjects.map((obj) => obj.id));

    // Update stored items with new positions for successive pastes
    const updatedItems = state.items.map((item) => ({
      ...item,
      x: item.x + PASTE_OFFSET,
      y: item.y + PASTE_OFFSET,
    }));

    set({
      pasteCount: state.pasteCount + 1,
      items: updatedItems,
    });

    console.log(`[Clipboard] Pasted ${newObjects.length} objects`);
  },

  duplicate: (objects, getNextZIndex, addObjects, setSelection) => {
    if (objects.length === 0) return;

    // Create new objects with new IDs (no offset for duplicate - matches original behavior)
    const newObjects: CanvasObject[] = objects.map((obj) => ({
      ...JSON.parse(JSON.stringify(obj)),
      id: crypto.randomUUID(),
      zIndex: getNextZIndex(),
    }));

    addObjects(newObjects);
    setSelection(newObjects.map((obj) => obj.id));

    console.log(`[Clipboard] Duplicated ${newObjects.length} objects`);
  },

  clear: () => set({ items: [], pasteCount: 0 }),

  hasItems: () => get().items.length > 0,

  getItems: () => get().items,
}));
