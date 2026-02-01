/**
 * Stroke pressure and velocity simulation utilities.
 *
 * Contains functions for simulating pen pressure based on drawing velocity,
 * creating natural-looking variable-width strokes.
 *
 * All functions are pure (no side effects) and handle edge cases gracefully.
 */

import type { PathPoint } from '../types/canvas';

/**
 * Point with associated stroke width.
 */
export interface StrokePoint extends PathPoint {
  width: number;
}

/**
 * Calculates stroke width based on velocity using an inverse relationship.
 * Fast movement = thin stroke, slow movement = thick stroke (like real pens).
 *
 * Algorithm: Uses exponential decay mapping velocity to width range.
 * Includes easing for more natural feel.
 *
 * @param velocity - Movement velocity in pixels per millisecond
 * @param minWidth - Minimum stroke width. Default 1
 * @param maxWidth - Maximum stroke width. Default 8
 * @param sensitivity - Velocity sensitivity (0-1). Default 0.5
 * @returns Calculated stroke width between minWidth and maxWidth
 */
export function getStrokeWidthFromVelocity(
  velocity: number,
  minWidth: number = 1,
  maxWidth: number = 8,
  sensitivity: number = 0.5
): number {
  // Handle invalid inputs
  if (!Number.isFinite(velocity) || velocity < 0) {
    return (minWidth + maxWidth) / 2;
  }

  // Clamp sensitivity
  const sens = Math.max(0, Math.min(1, sensitivity));

  // Velocity thresholds (px/ms)
  const minVelocity = 0.1;  // Slow drawing threshold
  const maxVelocity = 2.0;  // Fast drawing threshold

  // Normalize velocity to 0-1 range
  const normalizedVelocity = Math.max(0, Math.min(1,
    (velocity - minVelocity) / (maxVelocity - minVelocity)
  ));

  // Apply easing curve (cubic ease-out for smoother transitions)
  const eased = 1 - Math.pow(1 - normalizedVelocity, 3);

  // Mix between sensitivity and constant width
  const velocityInfluence = eased * sens;

  // Inverse relationship: faster = thinner
  const width = maxWidth - velocityInfluence * (maxWidth - minWidth);

  return Math.max(minWidth, Math.min(maxWidth, width));
}

/**
 * Calculates velocity between two points given time delta.
 *
 * @param currentPoint - Current position
 * @param lastPoint - Previous position
 * @param deltaTime - Time elapsed in milliseconds
 * @returns Velocity in pixels per millisecond
 */
export function calculateVelocity(
  currentPoint: PathPoint,
  lastPoint: PathPoint,
  deltaTime: number
): number {
  // Handle edge cases
  if (deltaTime <= 0) return 0;

  const dx = currentPoint.x - lastPoint.x;
  const dy = currentPoint.y - lastPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance / deltaTime;
}

/**
 * Applies taper to stroke ends for natural start/stop appearance.
 * Creates smooth width transitions at the beginning and end of the stroke.
 *
 * Algorithm: Linear interpolation from 0 to full width at start,
 * and from full width to 0 at end.
 *
 * Time complexity: O(n)
 *
 * @param points - Array of stroke points with widths
 * @param taperStart - Length of start taper in points. Default 5
 * @param taperEnd - Length of end taper in points. Default 5
 * @returns Array with tapered widths
 */
export function taperStrokeEnds(
  points: StrokePoint[],
  taperStart: number = 5,
  taperEnd: number = 5
): StrokePoint[] {
  // Edge cases
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{ ...points[0], width: points[0].width * 0.5 }];
  }

  const result: StrokePoint[] = points.map(p => ({ ...p }));
  const len = result.length;

  // Clamp taper lengths to available points
  const startLen = Math.min(Math.max(0, taperStart), Math.floor(len / 2));
  const endLen = Math.min(Math.max(0, taperEnd), Math.floor(len / 2));

  // Apply start taper with ease-in curve
  for (let i = 0; i < startLen; i++) {
    const t = (i + 1) / (startLen + 1);
    // Ease-in (quadratic)
    const eased = t * t;
    result[i].width *= eased;
  }

  // Apply end taper with ease-out curve
  for (let i = 0; i < endLen; i++) {
    const idx = len - 1 - i;
    const t = (i + 1) / (endLen + 1);
    // Ease-out (quadratic)
    const eased = t * (2 - t);
    result[idx].width *= (1 - eased);
  }

  return result;
}

/**
 * Generates outline points for a variable-width stroke.
 * Creates a closed polygon representing the stroke shape.
 *
 * Algorithm: For each point, calculates perpendicular offset based on width.
 * Returns left side points followed by reversed right side points to form
 * a closed polygon.
 *
 * Time complexity: O(n)
 *
 * @param points - Array of center points
 * @param widths - Array of widths corresponding to each point
 * @returns Array of points forming a closed polygon outline
 */
export function variableWidthStroke(
  points: PathPoint[],
  widths: number[]
): PathPoint[] {
  // Edge cases
  if (points.length === 0) return [];
  if (points.length === 1) {
    // Return a circle approximation for single point
    const p = points[0];
    const w = (widths[0] ?? 1) / 2;
    const segments = 8;
    const outline: PathPoint[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      outline.push({
        x: p.x + Math.cos(angle) * w,
        y: p.y + Math.sin(angle) * w,
      });
    }
    return outline;
  }

  const leftSide: PathPoint[] = [];
  const rightSide: PathPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const width = (widths[i] ?? widths[widths.length - 1] ?? 1) / 2;

    // Calculate direction vector
    let dx: number;
    let dy: number;

    if (i === 0) {
      // First point: use direction to next point
      dx = points[1].x - points[0].x;
      dy = points[1].y - points[0].y;
    } else if (i === points.length - 1) {
      // Last point: use direction from previous point
      dx = points[i].x - points[i - 1].x;
      dy = points[i].y - points[i - 1].y;
    } else {
      // Middle points: average of adjacent directions
      const dx1 = points[i].x - points[i - 1].x;
      const dy1 = points[i].y - points[i - 1].y;
      const dx2 = points[i + 1].x - points[i].x;
      const dy2 = points[i + 1].y - points[i].y;
      dx = (dx1 + dx2) / 2;
      dy = (dy1 + dy2) / 2;
    }

    // Normalize and get perpendicular
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) {
      // Duplicate point, use previous perpendicular or default
      if (leftSide.length > 0) {
        leftSide.push({ ...leftSide[leftSide.length - 1] });
        rightSide.push({ ...rightSide[rightSide.length - 1] });
      } else {
        leftSide.push({ x: points[i].x, y: points[i].y - width });
        rightSide.push({ x: points[i].x, y: points[i].y + width });
      }
      continue;
    }

    // Perpendicular vector (rotated 90 degrees)
    const perpX = -dy / len;
    const perpY = dx / len;

    // Add points on both sides
    leftSide.push({
      x: points[i].x + perpX * width,
      y: points[i].y + perpY * width,
    });
    rightSide.push({
      x: points[i].x - perpX * width,
      y: points[i].y - perpY * width,
    });
  }

  // Combine into closed polygon: left side forward, right side backward
  // Add rounded end caps
  const startCap = generateEndCap(
    points[0],
    leftSide[0],
    rightSide[0],
    true
  );
  const endCap = generateEndCap(
    points[points.length - 1],
    leftSide[leftSide.length - 1],
    rightSide[rightSide.length - 1],
    false
  );

  return [
    ...leftSide,
    ...endCap,
    ...rightSide.reverse(),
    ...startCap,
  ];
}

/**
 * Generates a semicircular end cap for stroke.
 */
function generateEndCap(
  center: PathPoint,
  leftPoint: PathPoint,
  rightPoint: PathPoint,
  isStart: boolean
): PathPoint[] {
  const segments = 4;
  const cap: PathPoint[] = [];

  // Calculate angle from center to left and right points
  const leftAngle = Math.atan2(leftPoint.y - center.y, leftPoint.x - center.x);
  const rightAngle = Math.atan2(rightPoint.y - center.y, rightPoint.x - center.x);

  // Calculate radius
  const radius = Math.sqrt(
    Math.pow(leftPoint.x - center.x, 2) + Math.pow(leftPoint.y - center.y, 2)
  );

  // Generate arc points
  let startAngle: number;
  let endAngle: number;

  if (isStart) {
    // Start cap: arc from right to left (counterclockwise)
    startAngle = rightAngle;
    endAngle = leftAngle;
    // Ensure we go the short way
    if (endAngle < startAngle) endAngle += Math.PI * 2;
    if (endAngle - startAngle > Math.PI) {
      startAngle += Math.PI * 2;
    }
  } else {
    // End cap: arc from left to right (counterclockwise)
    startAngle = leftAngle;
    endAngle = rightAngle;
    if (endAngle < startAngle) endAngle += Math.PI * 2;
    if (endAngle - startAngle > Math.PI) {
      startAngle += Math.PI * 2;
    }
  }

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const angle = startAngle + (endAngle - startAngle) * t;
    cap.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }

  return cap;
}

/**
 * Converts an array of points and velocities to stroke points with calculated widths.
 * Convenience function that combines velocity calculation and width mapping.
 *
 * @param points - Array of points with timestamps
 * @param minWidth - Minimum stroke width
 * @param maxWidth - Maximum stroke width
 * @param sensitivity - Velocity sensitivity
 * @returns Array of StrokePoints with calculated widths
 */
export function pointsToStrokePoints(
  points: Array<PathPoint & { timestamp?: number }>,
  minWidth: number = 1,
  maxWidth: number = 8,
  sensitivity: number = 0.5
): StrokePoint[] {
  if (points.length === 0) return [];

  const result: StrokePoint[] = [];

  for (let i = 0; i < points.length; i++) {
    let velocity = 0;

    if (i > 0 && points[i].timestamp !== undefined && points[i - 1].timestamp !== undefined) {
      const deltaTime = (points[i].timestamp as number) - (points[i - 1].timestamp as number);
      velocity = calculateVelocity(points[i], points[i - 1], deltaTime);
    }

    const width = getStrokeWidthFromVelocity(velocity, minWidth, maxWidth, sensitivity);

    result.push({
      x: points[i].x,
      y: points[i].y,
      width,
    });
  }

  return result;
}

/**
 * Smooths width values to prevent abrupt changes.
 * Applies a simple moving average to width values.
 *
 * @param points - Array of stroke points
 * @param windowSize - Smoothing window size. Default 3
 * @returns Array with smoothed width values
 */
export function smoothWidths(
  points: StrokePoint[],
  windowSize: number = 3
): StrokePoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];

  const result: StrokePoint[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(points.length - 1, i + halfWindow);
    let sum = 0;
    let count = 0;

    for (let j = start; j <= end; j++) {
      sum += points[j].width;
      count++;
    }

    result.push({
      x: points[i].x,
      y: points[i].y,
      width: sum / count,
    });
  }

  return result;
}
