/**
 * Geometry utilities for canvas operations.
 *
 * Contains functions for calculating bounding boxes, positions,
 * and other geometric operations on canvas objects.
 */

import type { CanvasObject } from '../types/canvas';

/**
 * Represents an axis-aligned bounding box.
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates the axis-aligned bounding box for a rotated rectangle.
 * Takes an object's position, dimensions, and rotation, then returns
 * the smallest AABB that fully contains the rotated shape.
 *
 * @param x - Object's x position
 * @param y - Object's y position
 * @param width - Object's width
 * @param height - Object's height
 * @param rotation - Rotation in degrees
 * @returns The axis-aligned bounding box containing the rotated rectangle
 */
export const getRotatedBoundingBox = (
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number
): BoundingBox => {
  // If no rotation, return original bounds
  if (!rotation || rotation === 0) {
    return { x, y, width, height };
  }

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const cos = Math.cos((rotation * Math.PI) / 180);
  const sin = Math.sin((rotation * Math.PI) / 180);

  // Half dimensions
  const hw = width / 2;
  const hh = height / 2;

  // Calculate all four corners after rotation
  const corners = [
    { x: centerX + (-hw * cos - -hh * sin), y: centerY + (-hw * sin + -hh * cos) }, // top-left
    { x: centerX + (hw * cos - -hh * sin), y: centerY + (hw * sin + -hh * cos) },   // top-right
    { x: centerX + (hw * cos - hh * sin), y: centerY + (hw * sin + hh * cos) },     // bottom-right
    { x: centerX + (-hw * cos - hh * sin), y: centerY + (-hw * sin + hh * cos) },   // bottom-left
  ];

  // Find min/max to get AABB
  const minX = Math.min(...corners.map(c => c.x));
  const maxX = Math.max(...corners.map(c => c.x));
  const minY = Math.min(...corners.map(c => c.y));
  const maxY = Math.max(...corners.map(c => c.y));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

/**
 * Calculates the axis-aligned bounding box that contains all given objects.
 * Accounts for object rotation to ensure the bounding box fully contains
 * rotated objects.
 *
 * @param objects - Array of canvas objects to calculate bounds for
 * @returns The bounding box containing all objects, or zero-size box if empty
 */
export const calculateBoundingBox = (objects: CanvasObject[]): BoundingBox => {
  if (objects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  objects.forEach(obj => {
    // Get rotation-aware bounding box for each object
    const bounds = getRotatedBoundingBox(obj.x, obj.y, obj.width, obj.height, obj.rotation);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

/**
 * Calculates the center point of a bounding box.
 *
 * @param bounds - The bounding box
 * @returns The center point {x, y}
 */
export const getBoundingBoxCenter = (bounds: BoundingBox): { x: number; y: number } => {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
};

/**
 * Checks if two bounding boxes intersect (AABB collision detection).
 *
 * @param a - First bounding box
 * @param b - Second bounding box
 * @returns True if the boxes intersect
 */
export const boundingBoxesIntersect = (a: BoundingBox, b: BoundingBox): boolean => {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
};

/**
 * Checks if point is inside a bounding box.
 *
 * @param point - The point to check
 * @param bounds - The bounding box
 * @returns True if point is inside bounds
 */
export const isPointInBounds = (
  point: { x: number; y: number },
  bounds: BoundingBox
): boolean => {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
};

/**
 * Expands a bounding box by a given amount on all sides.
 *
 * @param bounds - The original bounding box
 * @param padding - Amount to expand on each side
 * @returns The expanded bounding box
 */
export const expandBounds = (bounds: BoundingBox, padding: number): BoundingBox => {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
};

/**
 * Normalizes a rectangle so width/height are positive.
 * Useful when drawing rectangles from drag operations where
 * end point may be before start point.
 *
 * @param x - Start x coordinate
 * @param y - Start y coordinate
 * @param width - Width (may be negative)
 * @param height - Height (may be negative)
 * @returns Normalized bounding box with positive dimensions
 */
export const normalizeRect = (
  x: number,
  y: number,
  width: number,
  height: number
): BoundingBox => {
  return {
    x: width >= 0 ? x : x + width,
    y: height >= 0 ? y : y + height,
    width: Math.abs(width),
    height: Math.abs(height),
  };
};

// Coordinate bounds constants
// These limits ensure good Canvas 2D performance and avoid floating-point precision issues
export const MAX_COORDINATE = 1_000_000; // 1 million pixels
export const MIN_COORDINATE = -1_000_000;
export const MIN_DIMENSION = 0.01; // Minimum width/height to prevent zero-area objects
export const MAX_DIMENSION = 100_000; // Maximum width/height

/**
 * Checks if a number is a valid finite value.
 *
 * @param value - The value to check
 * @returns True if value is a finite number
 */
export const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

/**
 * Clamps a coordinate value to safe bounds.
 * Returns 0 if value is not a finite number.
 *
 * @param value - The coordinate value
 * @returns Clamped value within safe bounds
 */
export const clampCoordinate = (value: number): number => {
  if (!isFiniteNumber(value)) return 0;
  return Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, value));
};

/**
 * Clamps a dimension (width/height) to safe bounds.
 * Returns MIN_DIMENSION if value is not valid.
 *
 * @param value - The dimension value
 * @returns Clamped value within safe bounds
 */
export const clampDimension = (value: number): number => {
  if (!isFiniteNumber(value) || value < MIN_DIMENSION) return MIN_DIMENSION;
  return Math.min(MAX_DIMENSION, value);
};

/**
 * Validates that all geometric properties of an object are within safe bounds.
 *
 * @param obj - Object with x, y, width, height properties
 * @returns True if all values are within safe bounds
 */
export const hasValidCoordinates = (obj: {
  x: number;
  y: number;
  width: number;
  height: number;
}): boolean => {
  return (
    isFiniteNumber(obj.x) &&
    isFiniteNumber(obj.y) &&
    isFiniteNumber(obj.width) &&
    isFiniteNumber(obj.height) &&
    obj.x >= MIN_COORDINATE &&
    obj.x <= MAX_COORDINATE &&
    obj.y >= MIN_COORDINATE &&
    obj.y <= MAX_COORDINATE &&
    obj.width >= MIN_DIMENSION &&
    obj.width <= MAX_DIMENSION &&
    obj.height >= MIN_DIMENSION &&
    obj.height <= MAX_DIMENSION
  );
};

/**
 * Sanitizes an object's geometric properties to ensure they are within safe bounds.
 * This is useful when receiving data from external sources (clipboard, Yjs, etc).
 *
 * @param obj - Object with geometric properties
 * @returns Object with sanitized x, y, width, height values
 */
export const sanitizeCoordinates = <
  T extends { x: number; y: number; width: number; height: number }
>(
  obj: T
): T => {
  return {
    ...obj,
    x: clampCoordinate(obj.x),
    y: clampCoordinate(obj.y),
    width: clampDimension(obj.width),
    height: clampDimension(obj.height),
  };
};
