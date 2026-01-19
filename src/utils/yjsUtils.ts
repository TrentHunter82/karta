/**
 * Yjs serialization and validation utilities for canvas objects.
 *
 * These functions handle conversion between CanvasObject instances and Yjs Y.Map structures,
 * including validation of object properties during deserialization.
 */

import * as Y from 'yjs';
import type { CanvasObject } from '../types/canvas';
import { sanitizeCoordinates } from './geometryUtils';

/**
 * Converts a CanvasObject to a plain object suitable for Yjs storage.
 *
 * Handles special cases like path points which need to be explicitly mapped
 * to ensure proper serialization in Yjs.
 *
 * @param obj - The canvas object to convert
 * @returns A plain object with all properties serialized for Yjs
 */
export const objectToYjs = (obj: CanvasObject): Record<string, unknown> => {
  const plainObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'points' && Array.isArray(value)) {
      // Explicitly map point objects to ensure clean serialization
      plainObj[key] = value.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
    } else {
      plainObj[key] = value;
    }
  }
  return plainObj;
};

/**
 * Validates that an object has all required base properties for a CanvasObject.
 *
 * @param obj - The object to validate
 * @returns True if the object has valid base properties
 */
export const isValidBaseObject = (obj: Record<string, unknown>): boolean => {
  return (
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number' &&
    typeof obj.rotation === 'number' &&
    typeof obj.opacity === 'number' &&
    typeof obj.zIndex === 'number'
  );
};

/**
 * Validates type-specific properties based on the object's type.
 *
 * Each object type (rectangle, text, path, etc.) has different required properties.
 * This function ensures those properties exist and have correct types.
 *
 * @param obj - The object to validate
 * @returns True if the object has valid type-specific properties
 */
export const isValidTypeSpecificProps = (obj: Record<string, unknown>): boolean => {
  switch (obj.type) {
    case 'rectangle':
    case 'ellipse':
      return true;
    case 'text':
      return (
        typeof obj.text === 'string' &&
        typeof obj.fontSize === 'number' &&
        typeof obj.fontFamily === 'string' &&
        (obj.textAlign === 'left' || obj.textAlign === 'center' || obj.textAlign === 'right')
      );
    case 'frame':
      return typeof obj.name === 'string';
    case 'path':
      return (
        Array.isArray(obj.points) &&
        obj.points.every((p: unknown) => {
          const point = p as Record<string, unknown>;
          return typeof point?.x === 'number' && typeof point?.y === 'number';
        })
      );
    case 'image':
    case 'video':
      return typeof obj.src === 'string';
    case 'group':
      return Array.isArray(obj.children);
    case 'line':
    case 'arrow':
      return (
        typeof obj.x1 === 'number' &&
        typeof obj.y1 === 'number' &&
        typeof obj.x2 === 'number' &&
        typeof obj.y2 === 'number'
      );
    case 'polygon':
      return typeof obj.sides === 'number';
    case 'star':
      return typeof obj.points === 'number' && typeof obj.innerRadius === 'number';
    default:
      return false;
  }
};

/**
 * Converts a Yjs Y.Map back to a CanvasObject.
 *
 * Performs validation on both base properties and type-specific properties.
 * Returns null if the object is invalid, logging a warning for debugging.
 *
 * @param yMap - The Yjs map to convert
 * @returns The reconstructed CanvasObject, or null if invalid
 */
export const yjsToObject = (yMap: Y.Map<unknown>): CanvasObject | null => {
  const obj: Record<string, unknown> = {};
  yMap.forEach((value, key) => {
    if (key === 'points' && Array.isArray(value)) {
      obj[key] = value.map((p: unknown) => {
        const point = p as { x: number; y: number };
        return { x: point.x, y: point.y };
      });
    } else {
      obj[key] = value;
    }
  });

  if (!isValidBaseObject(obj)) {
    console.warn('[yjsUtils] Invalid object from Yjs: missing or invalid base properties', obj.id);
    return null;
  }

  if (!isValidTypeSpecificProps(obj)) {
    console.warn('[yjsUtils] Invalid object from Yjs: missing or invalid type-specific properties', obj.id, obj.type);
    return null;
  }

  // Sanitize coordinates to prevent extreme position issues
  const sanitizedObj = sanitizeCoordinates(obj as CanvasObject);
  return sanitizedObj;
};

/**
 * Debounce interval for batching Yjs updates (in milliseconds).
 * Updates are batched within this window for better performance.
 */
export const SYNC_DEBOUNCE_MS = 50;

/**
 * Creates a debounced Yjs update queue.
 *
 * This batches multiple property updates into single Yjs transactions,
 * reducing network traffic and improving collaborative editing performance.
 *
 * @param getYdoc - Function to get the Yjs document
 * @param getYObjects - Function to get the objects Y.Map
 * @returns Object with queue and flush functions
 */
export const createYjsUpdateQueue = (
  getYdoc: () => Y.Doc,
  getYObjects: () => Y.Map<Y.Map<unknown>>
) => {
  let syncTimeout: ReturnType<typeof setTimeout> | null = null;
  const pendingUpdates: Map<string, Record<string, unknown>> = new Map();

  /**
   * Queues a property update for an object.
   * Updates are automatically flushed after SYNC_DEBOUNCE_MS.
   */
  const queueUpdate = (id: string, changes: Record<string, unknown>) => {
    const existing = pendingUpdates.get(id) || {};
    pendingUpdates.set(id, { ...existing, ...changes });

    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }

    syncTimeout = setTimeout(() => {
      flushUpdates();
    }, SYNC_DEBOUNCE_MS);
  };

  /**
   * Immediately flushes all pending updates to Yjs.
   */
  const flushUpdates = () => {
    if (pendingUpdates.size === 0) return;

    const updates = new Map(pendingUpdates);
    pendingUpdates.clear();
    syncTimeout = null;

    getYdoc().transact(() => {
      updates.forEach((changes, id) => {
        const yMap = getYObjects().get(id);
        if (yMap) {
          Object.entries(changes).forEach(([key, value]) => {
            yMap.set(key, value);
          });
        }
      });
    });

    console.log(`[yjsUtils] Flushed ${updates.size} debounced Yjs updates`);
  };

  return { queueUpdate, flushUpdates };
};
