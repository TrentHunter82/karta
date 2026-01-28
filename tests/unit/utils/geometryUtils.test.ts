import type { CanvasObject, RectangleObject } from '../../../src/types/canvas';
import {
  getRotatedBoundingBox,
  calculateBoundingBox,
  getBoundingBoxCenter,
  boundingBoxesIntersect,
  isPointInBounds,
  expandBounds,
  normalizeRect,
  isFiniteNumber,
  clampCoordinate,
  clampDimension,
  hasValidCoordinates,
  sanitizeCoordinates,
  MAX_COORDINATE,
  MIN_COORDINATE,
  MIN_DIMENSION,
  MAX_DIMENSION,
} from '../../../src/utils/geometryUtils';

const createRect = (overrides: Partial<RectangleObject> = {}): RectangleObject => ({
  id: 'rect-1',
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  zIndex: 1,
  fill: '#000',
  ...overrides,
});

describe('getRotatedBoundingBox', () => {
  it('returns original bounds when rotation is 0', () => {
    const result = getRotatedBoundingBox(10, 20, 100, 50, 0);
    expect(result).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('returns original bounds when rotation is falsy', () => {
    const result = getRotatedBoundingBox(10, 20, 100, 50, 0);
    expect(result).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('expands bounds for 45-degree rotation', () => {
    const result = getRotatedBoundingBox(0, 0, 100, 100, 45);
    // A square rotated 45° has a larger AABB
    expect(result.width).toBeGreaterThan(100);
    expect(result.height).toBeGreaterThan(100);
  });

  it('returns same-size bounds for 90-degree rotation of a square', () => {
    const result = getRotatedBoundingBox(0, 0, 100, 100, 90);
    expect(result.width).toBeCloseTo(100, 5);
    expect(result.height).toBeCloseTo(100, 5);
  });

  it('swaps width/height for 90-degree rotation of a rectangle', () => {
    const result = getRotatedBoundingBox(0, 0, 200, 100, 90);
    expect(result.width).toBeCloseTo(100, 5);
    expect(result.height).toBeCloseTo(200, 5);
  });

  it('returns same dimensions for 180-degree rotation', () => {
    const result = getRotatedBoundingBox(0, 0, 200, 100, 180);
    expect(result.width).toBeCloseTo(200, 5);
    expect(result.height).toBeCloseTo(100, 5);
  });

  it('preserves center point after rotation', () => {
    const x = 50, y = 30, w = 100, h = 60;
    const original = { cx: x + w / 2, cy: y + h / 2 };
    const result = getRotatedBoundingBox(x, y, w, h, 45);
    const rotatedCenter = { cx: result.x + result.width / 2, cy: result.y + result.height / 2 };
    expect(rotatedCenter.cx).toBeCloseTo(original.cx, 5);
    expect(rotatedCenter.cy).toBeCloseTo(original.cy, 5);
  });
});

describe('calculateBoundingBox', () => {
  it('returns zero-size box for empty array', () => {
    expect(calculateBoundingBox([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('returns bounds of a single object', () => {
    const objects = [createRect({ x: 10, y: 20, width: 100, height: 50 })] as CanvasObject[];
    const result = calculateBoundingBox(objects);
    expect(result).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('computes union bounds of multiple objects', () => {
    const objects = [
      createRect({ id: 'a', x: 0, y: 0, width: 50, height: 50 }),
      createRect({ id: 'b', x: 100, y: 100, width: 50, height: 50 }),
    ] as CanvasObject[];
    const result = calculateBoundingBox(objects);
    expect(result).toEqual({ x: 0, y: 0, width: 150, height: 150 });
  });

  it('accounts for rotation in bounding box', () => {
    const objects = [createRect({ x: 0, y: 0, width: 200, height: 100, rotation: 90 })] as CanvasObject[];
    const result = calculateBoundingBox(objects);
    expect(result.width).toBeCloseTo(100, 5);
    expect(result.height).toBeCloseTo(200, 5);
  });
});

describe('getBoundingBoxCenter', () => {
  it('returns center of a bounding box', () => {
    expect(getBoundingBoxCenter({ x: 0, y: 0, width: 100, height: 100 })).toEqual({ x: 50, y: 50 });
  });

  it('handles offset position', () => {
    expect(getBoundingBoxCenter({ x: 50, y: 30, width: 100, height: 60 })).toEqual({ x: 100, y: 60 });
  });
});

describe('boundingBoxesIntersect', () => {
  it('returns true for overlapping boxes', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 50, y: 50, width: 100, height: 100 };
    expect(boundingBoxesIntersect(a, b)).toBe(true);
  });

  it('returns false for non-overlapping boxes', () => {
    const a = { x: 0, y: 0, width: 50, height: 50 };
    const b = { x: 100, y: 100, width: 50, height: 50 };
    expect(boundingBoxesIntersect(a, b)).toBe(false);
  });

  it('returns true for touching edges', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 100, y: 0, width: 100, height: 100 };
    expect(boundingBoxesIntersect(a, b)).toBe(true);
  });

  it('returns true when one box contains the other', () => {
    const a = { x: 0, y: 0, width: 200, height: 200 };
    const b = { x: 50, y: 50, width: 10, height: 10 };
    expect(boundingBoxesIntersect(a, b)).toBe(true);
  });
});

describe('isPointInBounds', () => {
  const bounds = { x: 10, y: 10, width: 100, height: 100 };

  it('returns true for point inside', () => {
    expect(isPointInBounds({ x: 50, y: 50 }, bounds)).toBe(true);
  });

  it('returns true for point on edge', () => {
    expect(isPointInBounds({ x: 10, y: 10 }, bounds)).toBe(true);
    expect(isPointInBounds({ x: 110, y: 110 }, bounds)).toBe(true);
  });

  it('returns false for point outside', () => {
    expect(isPointInBounds({ x: 0, y: 0 }, bounds)).toBe(false);
    expect(isPointInBounds({ x: 200, y: 200 }, bounds)).toBe(false);
  });
});

describe('expandBounds', () => {
  it('expands bounds by padding on all sides', () => {
    const result = expandBounds({ x: 10, y: 10, width: 100, height: 100 }, 5);
    expect(result).toEqual({ x: 5, y: 5, width: 110, height: 110 });
  });

  it('handles zero padding', () => {
    const bounds = { x: 10, y: 10, width: 100, height: 100 };
    expect(expandBounds(bounds, 0)).toEqual(bounds);
  });
});

describe('normalizeRect', () => {
  it('returns unchanged for positive dimensions', () => {
    expect(normalizeRect(10, 20, 100, 50)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('normalizes negative width', () => {
    expect(normalizeRect(110, 20, -100, 50)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('normalizes negative height', () => {
    expect(normalizeRect(10, 70, 100, -50)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('normalizes both negative', () => {
    expect(normalizeRect(110, 70, -100, -50)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });
});

describe('isFiniteNumber', () => {
  it('returns true for finite numbers', () => {
    expect(isFiniteNumber(42)).toBe(true);
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-3.14)).toBe(true);
  });

  it('returns false for non-finite values', () => {
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
    expect(isFiniteNumber(NaN)).toBe(false);
  });

  it('returns false for non-numbers', () => {
    expect(isFiniteNumber('42')).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
  });
});

describe('clampCoordinate', () => {
  it('returns value within bounds unchanged', () => {
    expect(clampCoordinate(500)).toBe(500);
    expect(clampCoordinate(-500)).toBe(-500);
  });

  it('clamps to MAX_COORDINATE', () => {
    expect(clampCoordinate(MAX_COORDINATE + 1)).toBe(MAX_COORDINATE);
  });

  it('clamps to MIN_COORDINATE', () => {
    expect(clampCoordinate(MIN_COORDINATE - 1)).toBe(MIN_COORDINATE);
  });

  it('returns 0 for NaN', () => {
    expect(clampCoordinate(NaN)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(clampCoordinate(Infinity)).toBe(0);
  });
});

describe('clampDimension', () => {
  it('returns value within bounds unchanged', () => {
    expect(clampDimension(100)).toBe(100);
  });

  it('clamps to MAX_DIMENSION', () => {
    expect(clampDimension(MAX_DIMENSION + 1)).toBe(MAX_DIMENSION);
  });

  it('returns MIN_DIMENSION for values too small', () => {
    expect(clampDimension(0)).toBe(MIN_DIMENSION);
    expect(clampDimension(-5)).toBe(MIN_DIMENSION);
  });

  it('returns MIN_DIMENSION for NaN', () => {
    expect(clampDimension(NaN)).toBe(MIN_DIMENSION);
  });
});

describe('hasValidCoordinates', () => {
  it('returns true for valid coordinates', () => {
    expect(hasValidCoordinates({ x: 0, y: 0, width: 100, height: 100 })).toBe(true);
  });

  it('returns false for NaN values', () => {
    expect(hasValidCoordinates({ x: NaN, y: 0, width: 100, height: 100 })).toBe(false);
  });

  it('returns false for out-of-range coordinates', () => {
    expect(hasValidCoordinates({ x: MAX_COORDINATE + 1, y: 0, width: 100, height: 100 })).toBe(false);
  });

  it('returns false for zero-area dimensions', () => {
    expect(hasValidCoordinates({ x: 0, y: 0, width: 0, height: 100 })).toBe(false);
  });
});

describe('sanitizeCoordinates', () => {
  it('passes through valid coordinates unchanged', () => {
    const obj = { x: 50, y: 50, width: 100, height: 100 };
    expect(sanitizeCoordinates(obj)).toEqual(obj);
  });

  it('clamps out-of-range coordinates', () => {
    const obj = { x: MAX_COORDINATE + 100, y: MIN_COORDINATE - 100, width: MAX_DIMENSION + 1, height: 0 };
    const result = sanitizeCoordinates(obj);
    expect(result.x).toBe(MAX_COORDINATE);
    expect(result.y).toBe(MIN_COORDINATE);
    expect(result.width).toBe(MAX_DIMENSION);
    expect(result.height).toBe(MIN_DIMENSION);
  });

  it('preserves extra properties', () => {
    const obj = { x: 0, y: 0, width: 100, height: 100, fill: '#ff0000' };
    const result = sanitizeCoordinates(obj);
    expect(result.fill).toBe('#ff0000');
  });
});
