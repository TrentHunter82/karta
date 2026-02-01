/**
 * Snap calculation utilities for grid and object alignment.
 *
 * Pure functions that compute snapped positions and alignment guides.
 * Used by canvasStore to separate snap logic from state management.
 */

import type { CanvasObject } from '../types/canvas';
import type { GridSettings, SnapGuide } from '../stores/canvasStore';
import { SNAP_THRESHOLD_PX } from '../constants/interaction';

/** Pixel distance within which an object edge triggers a snap */
const SNAP_THRESHOLD = SNAP_THRESHOLD_PX;

/** Arrow endpoint snap threshold - slightly larger for easier targeting */
const ARROW_SNAP_THRESHOLD = SNAP_THRESHOLD_PX * 1.5;

/** Types of snap points for arrow endpoints */
export type ArrowSnapType = 'center' | 'left' | 'right' | 'top' | 'bottom';

/** Result of arrow endpoint snap calculation */
export interface ArrowSnapResult {
  x: number;
  y: number;
  snapped: boolean;
  snapType?: ArrowSnapType;
  targetObjectId?: string;
}

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

/**
 * Computes arrow endpoint snapping to object edges and centers.
 *
 * Figma-style snap points:
 * - Edge midpoints: left, right, top, bottom
 * - Center point
 *
 * @param x - The x coordinate to snap
 * @param y - The y coordinate to snap
 * @param objects - All canvas objects (for object snapping)
 * @param excludeIds - Object IDs to exclude from snap targets
 * @param threshold - Custom threshold (defaults to ARROW_SNAP_THRESHOLD)
 */
export function computeArrowEndpointSnap(
  x: number,
  y: number,
  objects: Map<string, CanvasObject>,
  excludeIds: Set<string> = new Set(),
  threshold: number = ARROW_SNAP_THRESHOLD
): ArrowSnapResult {
  let closestSnap: ArrowSnapResult = { x, y, snapped: false };
  let closestDistance = threshold;

  const targetObjects = Array.from(objects.values())
    .filter(obj =>
      !excludeIds.has(obj.id) &&
      obj.visible !== false &&
      !obj.parentId &&
      obj.type !== 'line' &&
      obj.type !== 'arrow' // Don't snap to other lines/arrows
    );

  for (const obj of targetObjects) {
    // Skip objects with invalid dimensions
    if (!Number.isFinite(obj.width) || !Number.isFinite(obj.height) ||
        obj.width <= 0 || obj.height <= 0) {
      continue;
    }

    // Calculate the 5 snap points for this object
    const snapPoints: Array<{ x: number; y: number; type: ArrowSnapType }> = [
      // Center
      { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2, type: 'center' },
      // Edge midpoints
      { x: obj.x, y: obj.y + obj.height / 2, type: 'left' },
      { x: obj.x + obj.width, y: obj.y + obj.height / 2, type: 'right' },
      { x: obj.x + obj.width / 2, y: obj.y, type: 'top' },
      { x: obj.x + obj.width / 2, y: obj.y + obj.height, type: 'bottom' },
    ];

    for (const point of snapPoints) {
      const dx = x - point.x;
      const dy = y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestSnap = {
          x: point.x,
          y: point.y,
          snapped: true,
          snapType: point.type,
          targetObjectId: obj.id,
        };
      }
    }
  }

  return closestSnap;
}

/**
 * Finds all potential snap points on objects for arrow endpoints.
 * Used for rendering snap point indicators.
 *
 * @param objects - All canvas objects
 * @param excludeIds - Object IDs to exclude
 * @param nearPoint - Only return points near this coordinate (optional optimization)
 * @param nearThreshold - Distance threshold for nearPoint filter
 */
export function getArrowSnapPoints(
  objects: Map<string, CanvasObject>,
  excludeIds: Set<string> = new Set(),
  nearPoint?: { x: number; y: number },
  nearThreshold: number = ARROW_SNAP_THRESHOLD * 3
): Array<{ x: number; y: number; type: ArrowSnapType; objectId: string }> {
  const snapPoints: Array<{ x: number; y: number; type: ArrowSnapType; objectId: string }> = [];

  const targetObjects = Array.from(objects.values())
    .filter(obj =>
      !excludeIds.has(obj.id) &&
      obj.visible !== false &&
      !obj.parentId &&
      obj.type !== 'line' &&
      obj.type !== 'arrow'
    );

  for (const obj of targetObjects) {
    if (!Number.isFinite(obj.width) || !Number.isFinite(obj.height) ||
        obj.width <= 0 || obj.height <= 0) {
      continue;
    }

    const points: Array<{ x: number; y: number; type: ArrowSnapType }> = [
      { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2, type: 'center' },
      { x: obj.x, y: obj.y + obj.height / 2, type: 'left' },
      { x: obj.x + obj.width, y: obj.y + obj.height / 2, type: 'right' },
      { x: obj.x + obj.width / 2, y: obj.y, type: 'top' },
      { x: obj.x + obj.width / 2, y: obj.y + obj.height, type: 'bottom' },
    ];

    for (const point of points) {
      // If nearPoint provided, filter by distance
      if (nearPoint) {
        const dx = nearPoint.x - point.x;
        const dy = nearPoint.y - point.y;
        if (Math.sqrt(dx * dx + dy * dy) > nearThreshold) {
          continue;
        }
      }
      snapPoints.push({ ...point, objectId: obj.id });
    }
  }

  return snapPoints;
}
