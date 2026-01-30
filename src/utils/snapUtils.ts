/**
 * Snap calculation utilities for grid and object alignment.
 *
 * Pure functions that compute snapped positions and alignment guides.
 * Used by canvasStore to separate snap logic from state management.
 */

import type { CanvasObject } from '../types/canvas';
import type { GridSettings, SnapGuide } from '../stores/canvasStore';

/** Pixel distance within which an object edge triggers a snap */
const SNAP_THRESHOLD = 8;

/**
 * Snaps a single value to the nearest grid line.
 */
export function snapValueToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Computes a snapped position and any alignment guides for the given point.
 *
 * @param x - The x coordinate to snap
 * @param y - The y coordinate to snap
 * @param gridSettings - Current grid configuration
 * @param objects - All canvas objects (for object snapping)
 * @param selectedIds - Currently selected object IDs (excluded from snap targets)
 * @param skipSnap - If true, returns the position unchanged
 */
export function computeSnappedPosition(
  x: number,
  y: number,
  gridSettings: GridSettings,
  objects: Map<string, CanvasObject>,
  selectedIds: Set<string>,
  skipSnap = false
): { x: number; y: number; guides: SnapGuide[] } {
  const guides: SnapGuide[] = [];

  if (skipSnap || (!gridSettings.snapEnabled && !gridSettings.snapToObjects)) {
    return { x, y, guides };
  }

  let snappedX = x;
  let snappedY = y;

  if (gridSettings.snapEnabled) {
    snappedX = snapValueToGrid(x, gridSettings.size);
    snappedY = snapValueToGrid(y, gridSettings.size);
  }

  if (gridSettings.snapToObjects) {
    const otherObjects = Array.from(objects.values())
      .filter(obj => !selectedIds.has(obj.id) && obj.visible !== false && !obj.parentId);

    for (const obj of otherObjects) {
      // Skip objects with invalid dimensions that could produce Infinity/NaN
      if (!Number.isFinite(obj.width) || !Number.isFinite(obj.height) ||
          obj.width <= 0 || obj.height <= 0) {
        continue;
      }

      const objLeft = obj.x;
      const objCenter = obj.x + obj.width / 2;
      const objRight = obj.x + obj.width;

      if (Math.abs(x - objLeft) < SNAP_THRESHOLD) {
        snappedX = objLeft;
        guides.push({ type: 'vertical', position: objLeft, sourceId: obj.id });
      } else if (Math.abs(x - objCenter) < SNAP_THRESHOLD) {
        snappedX = objCenter;
        guides.push({ type: 'vertical', position: objCenter, sourceId: obj.id });
      } else if (Math.abs(x - objRight) < SNAP_THRESHOLD) {
        snappedX = objRight;
        guides.push({ type: 'vertical', position: objRight, sourceId: obj.id });
      }

      const objTop = obj.y;
      const objMiddle = obj.y + obj.height / 2;
      const objBottom = obj.y + obj.height;

      if (Math.abs(y - objTop) < SNAP_THRESHOLD) {
        snappedY = objTop;
        guides.push({ type: 'horizontal', position: objTop, sourceId: obj.id });
      } else if (Math.abs(y - objMiddle) < SNAP_THRESHOLD) {
        snappedY = objMiddle;
        guides.push({ type: 'horizontal', position: objMiddle, sourceId: obj.id });
      } else if (Math.abs(y - objBottom) < SNAP_THRESHOLD) {
        snappedY = objBottom;
        guides.push({ type: 'horizontal', position: objBottom, sourceId: obj.id });
      }
    }
  }

  return { x: snappedX, y: snappedY, guides };
}
