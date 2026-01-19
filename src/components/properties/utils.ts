import type { CanvasObject } from '../../types/canvas';

/**
 * Get value from multiple objects - returns value if all same, or 'mixed'
 */
export function getSharedValue<T extends CanvasObject, V>(
  objects: T[],
  getter: (obj: T) => V
): V | 'mixed' {
  if (objects.length === 0) return 'mixed';

  const firstValue = getter(objects[0]);
  const allSame = objects.every((obj) => getter(obj) === firstValue);

  return allSame ? firstValue : 'mixed';
}

/**
 * Get shared numeric value with rounding
 */
export function getSharedNumber<T extends CanvasObject>(
  objects: T[],
  getter: (obj: T) => number
): number | 'mixed' {
  if (objects.length === 0) return 'mixed';

  const firstValue = Math.round(getter(objects[0]));
  const allSame = objects.every((obj) => Math.round(getter(obj)) === firstValue);

  return allSame ? firstValue : 'mixed';
}

/**
 * Apply value to all selected objects
 */
export function applyToAll<T extends CanvasObject>(
  objects: T[],
  changes: Partial<CanvasObject>,
  updateObject: (id: string, changes: Partial<CanvasObject>) => void,
  pushHistory?: () => void
): void {
  pushHistory?.();
  objects.forEach((obj) => {
    updateObject(obj.id, changes);
  });
}
