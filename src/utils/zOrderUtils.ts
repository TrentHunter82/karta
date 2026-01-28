/**
 * Z-order calculation utilities for canvas object layering.
 *
 * Pure functions that compute z-index updates for bring/send operations.
 * Used by canvasStore to separate z-order logic from state management.
 */

import type { CanvasObject } from '../types/canvas';

interface ZOrderUpdate {
  id: string;
  changes: { zIndex: number };
}

/**
 * Computes z-index updates to bring selected objects to the front.
 */
export function calculateBringToFront(
  objects: Map<string, CanvasObject>,
  selectedIds: Set<string>
): ZOrderUpdate[] {
  let maxZ = -1;
  for (const obj of objects.values()) {
    if (obj.zIndex > maxZ) maxZ = obj.zIndex;
  }

  const updates: ZOrderUpdate[] = [];
  selectedIds.forEach(id => {
    maxZ++;
    updates.push({ id, changes: { zIndex: maxZ } });
  });

  return updates;
}

/**
 * Computes z-index updates to bring selected objects one layer forward.
 */
export function calculateBringForward(
  objects: Map<string, CanvasObject>,
  selectedIds: Set<string>
): ZOrderUpdate[] {
  const sortedObjects = Array.from(objects.values()).sort((a, b) => a.zIndex - b.zIndex);

  let maxSelectedZ = -1;
  selectedIds.forEach(id => {
    const obj = objects.get(id);
    if (obj && obj.zIndex > maxSelectedZ) maxSelectedZ = obj.zIndex;
  });

  const objAbove = sortedObjects.find(obj => obj.zIndex > maxSelectedZ && !selectedIds.has(obj.id));
  if (!objAbove) return [];

  const updates: ZOrderUpdate[] = [];
  selectedIds.forEach(id => {
    const obj = objects.get(id);
    if (obj) {
      updates.push({ id, changes: { zIndex: obj.zIndex + 1 } });
    }
  });
  updates.push({ id: objAbove.id, changes: { zIndex: objAbove.zIndex - selectedIds.size } });

  return updates;
}

/**
 * Computes z-index updates to send selected objects one layer backward.
 */
export function calculateSendBackward(
  objects: Map<string, CanvasObject>,
  selectedIds: Set<string>
): ZOrderUpdate[] {
  const sortedObjects = Array.from(objects.values()).sort((a, b) => a.zIndex - b.zIndex);

  let minSelectedZ = Infinity;
  selectedIds.forEach(id => {
    const obj = objects.get(id);
    if (obj && obj.zIndex < minSelectedZ) minSelectedZ = obj.zIndex;
  });

  const objBelow = sortedObjects.reverse().find(obj => obj.zIndex < minSelectedZ && !selectedIds.has(obj.id));
  if (!objBelow) return [];

  const updates: ZOrderUpdate[] = [];
  selectedIds.forEach(id => {
    const obj = objects.get(id);
    if (obj) {
      updates.push({ id, changes: { zIndex: obj.zIndex - 1 } });
    }
  });
  updates.push({ id: objBelow.id, changes: { zIndex: objBelow.zIndex + selectedIds.size } });

  return updates;
}

/**
 * Computes z-index updates to send selected objects to the back.
 */
export function calculateSendToBack(
  objects: Map<string, CanvasObject>,
  selectedIds: Set<string>
): ZOrderUpdate[] {
  let minZ = Infinity;
  for (const obj of objects.values()) {
    if (obj.zIndex < minZ) minZ = obj.zIndex;
  }

  const updates: ZOrderUpdate[] = [];
  let newZ = minZ - selectedIds.size;
  selectedIds.forEach(id => {
    updates.push({ id, changes: { zIndex: newZ } });
    newZ++;
  });

  return updates;
}
