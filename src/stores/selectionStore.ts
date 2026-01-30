/**
 * Selection Store
 *
 * Manages object selection state and provides alignment/distribution
 * operations for multi-object layouts.
 *
 * Key responsibilities:
 * - Track currently selected object IDs
 * - Calculate alignment positions (left, right, top, bottom, centerH, centerV)
 * - Calculate distribution spacing (horizontal, vertical)
 * - Handle rotated object bounding boxes for accurate alignment
 *
 * This store is intentionally separate from canvasStore to keep selection
 * logic isolated and testable.
 */
import { create } from 'zustand';
import type { CanvasObject } from '../types/canvas';

/**
 * Alignment types for object positioning
 */
export type AlignmentType = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV';

/**
 * Distribution direction
 */
export type DistributionDirection = 'horizontal' | 'vertical';

/**
 * Helper to get rotated bounding box of an object
 */
const getRotatedBounds = (obj: CanvasObject): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } => {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const angle = (obj.rotation || 0) * Math.PI / 180;

  if (angle === 0) {
    return {
      minX: obj.x,
      maxX: obj.x + obj.width,
      minY: obj.y,
      maxY: obj.y + obj.height,
      width: obj.width,
      height: obj.height
    };
  }

  const corners = [
    { x: obj.x, y: obj.y },
    { x: obj.x + obj.width, y: obj.y },
    { x: obj.x + obj.width, y: obj.y + obj.height },
    { x: obj.x, y: obj.y + obj.height }
  ].map(corner => {
    const dx = corner.x - cx;
    const dy = corner.y - cy;
    return {
      x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: cy + dx * Math.sin(angle) + dy * Math.cos(angle)
    };
  });

  const minX = Math.min(...corners.map(c => c.x));
  const maxX = Math.max(...corners.map(c => c.x));
  const minY = Math.min(...corners.map(c => c.y));
  const maxY = Math.max(...corners.map(c => c.y));

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
};

/**
 * Calculate alignment updates for selected objects
 */
export const calculateAlignmentUpdates = (
  selectedObjects: CanvasObject[],
  alignment: AlignmentType
): Array<{ id: string; changes: Partial<CanvasObject> }> => {
  if (selectedObjects.length < 2) return [];

  let updates: Array<{ id: string; changes: Partial<CanvasObject> }> = [];

  switch (alignment) {
    case 'left': {
      const minX = Math.min(...selectedObjects.map(obj => getRotatedBounds(obj).minX));
      updates = selectedObjects.map(obj => {
        const bounds = getRotatedBounds(obj);
        const offset = bounds.minX - obj.x;
        return {
          id: obj.id,
          changes: { x: minX - offset }
        };
      });
      break;
    }
    case 'right': {
      const maxX = Math.max(...selectedObjects.map(obj => getRotatedBounds(obj).maxX));
      updates = selectedObjects.map(obj => {
        const bounds = getRotatedBounds(obj);
        const offset = bounds.maxX - obj.x;
        return {
          id: obj.id,
          changes: { x: maxX - offset }
        };
      });
      break;
    }
    case 'top': {
      const minY = Math.min(...selectedObjects.map(obj => getRotatedBounds(obj).minY));
      updates = selectedObjects.map(obj => {
        const bounds = getRotatedBounds(obj);
        const offset = bounds.minY - obj.y;
        return {
          id: obj.id,
          changes: { y: minY - offset }
        };
      });
      break;
    }
    case 'bottom': {
      const maxY = Math.max(...selectedObjects.map(obj => getRotatedBounds(obj).maxY));
      updates = selectedObjects.map(obj => {
        const bounds = getRotatedBounds(obj);
        const offset = bounds.maxY - obj.y;
        return {
          id: obj.id,
          changes: { y: maxY - offset }
        };
      });
      break;
    }
    case 'centerH': {
      const centers = selectedObjects.map(obj => {
        const bounds = getRotatedBounds(obj);
        return (bounds.minX + bounds.maxX) / 2;
      });
      const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
      updates = selectedObjects.map(obj => {
        const bounds = getRotatedBounds(obj);
        const currentCenter = (bounds.minX + bounds.maxX) / 2;
        const offset = currentCenter - obj.x;
        return {
          id: obj.id,
          changes: { x: avgCenter - offset }
        };
      });
      break;
    }
    case 'centerV': {
      const centers = selectedObjects.map(obj => {
        const bounds = getRotatedBounds(obj);
        return (bounds.minY + bounds.maxY) / 2;
      });
      const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
      updates = selectedObjects.map(obj => {
        const bounds = getRotatedBounds(obj);
        const currentCenter = (bounds.minY + bounds.maxY) / 2;
        const offset = currentCenter - obj.y;
        return {
          id: obj.id,
          changes: { y: avgCenter - offset }
        };
      });
      break;
    }
  }

  return updates;
};

/**
 * Calculate distribution updates for selected objects
 */
export const calculateDistributionUpdates = (
  selectedObjects: CanvasObject[],
  direction: DistributionDirection
): Array<{ id: string; changes: Partial<CanvasObject> }> => {
  if (selectedObjects.length < 3) return [];

  let updates: Array<{ id: string; changes: Partial<CanvasObject> }> = [];

  if (direction === 'horizontal') {
    // Sort by X position (using bounding box)
    const sortedObjects = [...selectedObjects].sort((a, b) => {
      return getRotatedBounds(a).minX - getRotatedBounds(b).minX;
    });

    const first = sortedObjects[0];
    const last = sortedObjects[sortedObjects.length - 1];
    const firstBounds = getRotatedBounds(first);
    const lastBounds = getRotatedBounds(last);

    // Calculate total width of all objects (using bounding boxes)
    const totalObjectWidth = sortedObjects.reduce((sum, obj) => sum + getRotatedBounds(obj).width, 0);

    // Calculate available space for gaps
    const totalSpace = lastBounds.maxX - firstBounds.minX;
    const gapSpace = totalSpace - totalObjectWidth;
    const gap = gapSpace / (sortedObjects.length - 1);

    // Position each object
    let currentX = firstBounds.minX;
    updates = sortedObjects.map(obj => {
      const bounds = getRotatedBounds(obj);
      const offset = bounds.minX - obj.x;
      const update = { id: obj.id, changes: { x: currentX - offset } };
      currentX += bounds.width + gap;
      return update;
    });
  } else {
    // Sort by Y position (using bounding box)
    const sortedObjects = [...selectedObjects].sort((a, b) => {
      return getRotatedBounds(a).minY - getRotatedBounds(b).minY;
    });

    const first = sortedObjects[0];
    const last = sortedObjects[sortedObjects.length - 1];
    const firstBounds = getRotatedBounds(first);
    const lastBounds = getRotatedBounds(last);

    // Calculate total height of all objects (using bounding boxes)
    const totalObjectHeight = sortedObjects.reduce((sum, obj) => sum + getRotatedBounds(obj).height, 0);

    // Calculate available space for gaps
    const totalSpace = lastBounds.maxY - firstBounds.minY;
    const gapSpace = totalSpace - totalObjectHeight;
    const gap = gapSpace / (sortedObjects.length - 1);

    // Position each object
    let currentY = firstBounds.minY;
    updates = sortedObjects.map(obj => {
      const bounds = getRotatedBounds(obj);
      const offset = bounds.minY - obj.y;
      const update = { id: obj.id, changes: { y: currentY - offset } };
      currentY += bounds.height + gap;
      return update;
    });
  }

  return updates;
};

interface SelectionState {
  // State
  selectedIds: Set<string>;

  // Actions
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  addToSelection: (ids: string[]) => void;
  removeFromSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  // Initial state
  selectedIds: new Set(),

  setSelection: (ids) =>
    set({ selectedIds: new Set(ids) }),

  clearSelection: () =>
    set({ selectedIds: new Set() }),

  addToSelection: (ids) =>
    set((state) => {
      const newSelectedIds = new Set(state.selectedIds);
      ids.forEach(id => newSelectedIds.add(id));
      return { selectedIds: newSelectedIds };
    }),

  removeFromSelection: (ids) =>
    set((state) => {
      const newSelectedIds = new Set(state.selectedIds);
      ids.forEach(id => newSelectedIds.delete(id));
      return { selectedIds: newSelectedIds };
    }),

  toggleSelection: (id) =>
    set((state) => {
      const newSelectedIds = new Set(state.selectedIds);
      if (newSelectedIds.has(id)) {
        newSelectedIds.delete(id);
      } else {
        newSelectedIds.add(id);
      }
      return { selectedIds: newSelectedIds };
    }),
}));
