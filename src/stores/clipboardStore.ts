/**
 * Clipboard store for copy/paste/duplicate operations.
 *
 * Stores deep-cloned copies of objects and handles validation
 * to ensure clipboard contents are always valid.
 */
import { create } from 'zustand';
import type { CanvasObject, ObjectType } from '../types/canvas';

interface ClipboardState {
  /** Objects currently in clipboard */
  items: CanvasObject[];
  /** Number of times pasted (for cascading offset) */
  pasteCount: number;

  /** Copy objects to clipboard */
  copy: (objects: CanvasObject[]) => void;
  /** Paste clipboard contents with offset */
  paste: (
    getNextZIndex: () => number,
    addObjects: (objects: CanvasObject[]) => void,
    setSelection: (ids: string[]) => void
  ) => void;
  /** Duplicate objects in place (no offset) */
  duplicate: (
    objects: CanvasObject[],
    getNextZIndex: () => number,
    addObjects: (objects: CanvasObject[]) => void,
    setSelection: (ids: string[]) => void
  ) => void;
  /** Clear clipboard contents */
  clear: () => void;
  /** Check if clipboard has items */
  hasItems: () => boolean;
  /** Get clipboard items */
  getItems: () => CanvasObject[];
}

/** Pixel offset applied between successive pastes */
const PASTE_OFFSET = 10;

// Valid object types for validation
const VALID_OBJECT_TYPES: ObjectType[] = [
  'rectangle', 'ellipse', 'text', 'frame', 'path',
  'image', 'video', 'group', 'line', 'arrow', 'polygon', 'star'
];

/**
 * Validates that a value is a finite number, returns default if not
 */
function sanitizeNumber(value: unknown, defaultValue: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultValue;
  }
  return value;
}

/**
 * Validates that an object has all required BaseObject properties
 */
function isValidCanvasObject(obj: unknown): obj is CanvasObject {
  if (!obj || typeof obj !== 'object') return false;

  const o = obj as Record<string, unknown>;

  // Check required BaseObject properties exist and are correct types
  if (typeof o.id !== 'string' || o.id.length === 0) return false;
  if (typeof o.type !== 'string' || !VALID_OBJECT_TYPES.includes(o.type as ObjectType)) return false;
  if (typeof o.x !== 'number') return false;
  if (typeof o.y !== 'number') return false;
  if (typeof o.width !== 'number') return false;
  if (typeof o.height !== 'number') return false;
  if (typeof o.rotation !== 'number') return false;
  if (typeof o.opacity !== 'number') return false;
  if (typeof o.zIndex !== 'number') return false;

  return true;
}

/**
 * Sanitizes numeric properties of an object to ensure they are finite numbers
 */
function sanitizeObjectNumbers<T extends CanvasObject>(obj: T): T {
  return {
    ...obj,
    x: sanitizeNumber(obj.x, 0),
    y: sanitizeNumber(obj.y, 0),
    width: sanitizeNumber(obj.width, 100),
    height: sanitizeNumber(obj.height, 100),
    rotation: sanitizeNumber(obj.rotation, 0),
    opacity: Math.max(0, Math.min(1, sanitizeNumber(obj.opacity, 1))),
    zIndex: sanitizeNumber(obj.zIndex, 0),
  };
}

/**
 * Safely deep clones an object using JSON, returns null if it fails
 */
function safeDeepClone<T>(obj: T): T | null {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    // Silently fail - caller handles null return
    return null;
  }
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  items: [],
  pasteCount: 0,

  copy: (objects) => {
    if (objects.length === 0) return;

    // Deep clone and validate objects
    const clonedItems: CanvasObject[] = [];
    for (const obj of objects) {
      const cloned = safeDeepClone(obj);
      if (cloned && isValidCanvasObject(cloned)) {
        clonedItems.push(sanitizeObjectNumbers(cloned));
      } else {
        console.warn('[Clipboard] Skipping invalid object during copy:', obj);
      }
    }

    if (clonedItems.length === 0) {
      console.warn('[Clipboard] No valid objects to copy');
      return;
    }

    set({
      items: clonedItems,
      pasteCount: 0,
    });

  },

  paste: (getNextZIndex, addObjects, setSelection) => {
    const state = get();
    if (state.items.length === 0) return;

    // Create new objects with new IDs and offset positions
    const newObjects: CanvasObject[] = [];
    for (const item of state.items) {
      const cloned = safeDeepClone(item);
      if (!cloned || !isValidCanvasObject(cloned)) {
        console.warn('[Clipboard] Skipping invalid object during paste:', item);
        continue;
      }

      const sanitized = sanitizeObjectNumbers(cloned);
      newObjects.push({
        ...sanitized,
        id: crypto.randomUUID(),
        x: sanitized.x + PASTE_OFFSET,
        y: sanitized.y + PASTE_OFFSET,
        zIndex: getNextZIndex(),
      });
    }

    if (newObjects.length === 0) {
      console.warn('[Clipboard] No valid objects to paste');
      return;
    }

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

  },

  duplicate: (objects, getNextZIndex, addObjects, setSelection) => {
    if (objects.length === 0) return;

    // Create new objects with new IDs (no offset for duplicate - matches original behavior)
    const newObjects: CanvasObject[] = [];
    for (const obj of objects) {
      const cloned = safeDeepClone(obj);
      if (!cloned || !isValidCanvasObject(cloned)) {
        console.warn('[Clipboard] Skipping invalid object during duplicate:', obj);
        continue;
      }

      const sanitized = sanitizeObjectNumbers(cloned);
      newObjects.push({
        ...sanitized,
        id: crypto.randomUUID(),
        zIndex: getNextZIndex(),
      });
    }

    if (newObjects.length === 0) {
      console.warn('[Clipboard] No valid objects to duplicate');
      return;
    }

    addObjects(newObjects);
    setSelection(newObjects.map((obj) => obj.id));

  },

  clear: () => set({ items: [], pasteCount: 0 }),

  hasItems: () => get().items.length > 0,

  getItems: () => get().items,
}));
