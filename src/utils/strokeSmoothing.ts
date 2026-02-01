/**
 * Stroke smoothing algorithms for pen tool.
 *
 * Contains implementations for various curve smoothing and simplification
 * algorithms used to create smooth, natural-looking strokes from raw input points.
 *
 * All functions are pure (no side effects) and handle edge cases gracefully.
 */

import type { PathPoint } from '../types/canvas';

/**
 * Interpolates points using Catmull-Rom spline.
 * Creates smooth curves that pass through all control points.
 *
 * Algorithm: Uses cubic Hermite interpolation where tangent at each point
 * is determined by the positions of neighboring points.
 *
 * Time complexity: O(n * segments) where n is number of points
 *
 * @param points - Array of control points to interpolate through
 * @param tension - Tension parameter (0 = sharp corners, 1 = smooth). Default 0.5
 * @param segments - Number of interpolated points between each pair. Default 10
 * @returns Array of interpolated points forming a smooth curve
 */
export function catmullRomSpline(
  points: PathPoint[],
  tension: number = 0.5,
  segments: number = 10
): PathPoint[] {
  // Edge cases: not enough points for spline
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];
  if (points.length === 2) {
    // Linear interpolation for 2 points
    const result: PathPoint[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      result.push({
        x: points[0].x + (points[1].x - points[0].x) * t,
        y: points[0].y + (points[1].y - points[0].y) * t,
      });
    }
    return result;
  }

  const result: PathPoint[] = [];

  // Catmull-Rom requires 4 points: p0, p1, p2, p3
  // We interpolate between p1 and p2, using p0 and p3 for tangent calculation
  for (let i = 0; i < points.length - 1; i++) {
    // Get 4 control points, clamping to array bounds
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Interpolate between p1 and p2
    for (let j = 0; j < segments; j++) {
      const t = j / segments;
      const t2 = t * t;
      const t3 = t2 * t;

      // Catmull-Rom basis functions with tension
      const s = (1 - tension) / 2;

      const h1 = -s * t3 + 2 * s * t2 - s * t;
      const h2 = (2 - s) * t3 + (s - 3) * t2 + 1;
      const h3 = (s - 2) * t3 + (3 - 2 * s) * t2 + s * t;
      const h4 = s * t3 - s * t2;

      result.push({
        x: h1 * p0.x + h2 * p1.x + h3 * p2.x + h4 * p3.x,
        y: h1 * p0.y + h2 * p1.y + h3 * p2.y + h4 * p3.y,
      });
    }
  }

  // Add the final point
  result.push({ ...points[points.length - 1] });

  return result;
}

/**
 * Represents a cubic Bezier curve segment.
 */
export interface CubicBezier {
  p0: PathPoint;  // Start point
  p1: PathPoint;  // First control point
  p2: PathPoint;  // Second control point
  p3: PathPoint;  // End point
}

/**
 * Fits cubic Bezier curves to a series of points using Schneider's algorithm.
 * Attempts to find the best-fitting Bezier curve within an error threshold.
 *
 * Algorithm: Iteratively fits curves and splits when error exceeds threshold.
 * Uses least-squares fitting with chord-length parameterization.
 *
 * Time complexity: O(n * iterations) for fitting, O(n log n) worst case with splits
 *
 * @param points - Array of points to fit curves to
 * @param errorThreshold - Maximum allowed error from original points. Default 4.0
 * @returns Array of cubic Bezier curves that approximate the input
 */
export function fitCubicBezier(
  points: PathPoint[],
  errorThreshold: number = 4.0
): CubicBezier[] {
  // Edge cases
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{
      p0: { ...points[0] },
      p1: { ...points[0] },
      p2: { ...points[0] },
      p3: { ...points[0] },
    }];
  }
  if (points.length === 2) {
    // Simple line segment as degenerate Bezier
    const third = {
      x: (points[1].x - points[0].x) / 3,
      y: (points[1].y - points[0].y) / 3,
    };
    return [{
      p0: { ...points[0] },
      p1: { x: points[0].x + third.x, y: points[0].y + third.y },
      p2: { x: points[1].x - third.x, y: points[1].y - third.y },
      p3: { ...points[1] },
    }];
  }

  // Calculate tangent vectors at endpoints
  const leftTangent = normalize(subtract(points[1], points[0]));
  const rightTangent = normalize(subtract(points[points.length - 2], points[points.length - 1]));

  return fitCubicBezierRecursive(points, leftTangent, rightTangent, errorThreshold);
}

/**
 * Recursive helper for Bezier curve fitting (Schneider's algorithm).
 */
function fitCubicBezierRecursive(
  points: PathPoint[],
  leftTangent: PathPoint,
  rightTangent: PathPoint,
  errorThreshold: number
): CubicBezier[] {
  const maxIterations = 4;

  if (points.length === 2) {
    const dist = distance(points[0], points[1]) / 3;
    return [{
      p0: { ...points[0] },
      p1: { x: points[0].x + leftTangent.x * dist, y: points[0].y + leftTangent.y * dist },
      p2: { x: points[1].x + rightTangent.x * dist, y: points[1].y + rightTangent.y * dist },
      p3: { ...points[1] },
    }];
  }

  // Chord-length parameterization
  let u = chordLengthParameterize(points);
  let bezier = generateBezier(points, u, leftTangent, rightTangent);
  let { maxError, splitPoint } = computeMaxError(points, bezier, u);

  if (maxError < errorThreshold) {
    return [bezier];
  }

  // Try to improve the fit with Newton-Raphson refinement
  if (maxError < errorThreshold * errorThreshold) {
    for (let i = 0; i < maxIterations; i++) {
      u = reparameterize(points, u, bezier);
      bezier = generateBezier(points, u, leftTangent, rightTangent);
      const result = computeMaxError(points, bezier, u);
      maxError = result.maxError;
      splitPoint = result.splitPoint;

      if (maxError < errorThreshold) {
        return [bezier];
      }
    }
  }

  // Split at point of maximum error and fit recursively
  const centerTangent = computeCenterTangent(points, splitPoint);
  const leftCurves = fitCubicBezierRecursive(
    points.slice(0, splitPoint + 1),
    leftTangent,
    negate(centerTangent),
    errorThreshold
  );
  const rightCurves = fitCubicBezierRecursive(
    points.slice(splitPoint),
    centerTangent,
    rightTangent,
    errorThreshold
  );

  return [...leftCurves, ...rightCurves];
}

// Vector math helpers
function subtract(a: PathPoint, b: PathPoint): PathPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: PathPoint, b: PathPoint): PathPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(p: PathPoint, s: number): PathPoint {
  return { x: p.x * s, y: p.y * s };
}

function normalize(p: PathPoint): PathPoint {
  const len = Math.sqrt(p.x * p.x + p.y * p.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: p.x / len, y: p.y / len };
}

function negate(p: PathPoint): PathPoint {
  return { x: -p.x, y: -p.y };
}

function distance(a: PathPoint, b: PathPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function dot(a: PathPoint, b: PathPoint): number {
  return a.x * b.x + a.y * b.y;
}

function chordLengthParameterize(points: PathPoint[]): number[] {
  const u: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    u.push(u[i - 1] + distance(points[i], points[i - 1]));
  }
  const totalLength = u[u.length - 1];
  if (totalLength > 0) {
    for (let i = 1; i < u.length; i++) {
      u[i] /= totalLength;
    }
  }
  return u;
}

function generateBezier(
  points: PathPoint[],
  u: number[],
  leftTangent: PathPoint,
  rightTangent: PathPoint
): CubicBezier {
  const first = points[0];
  const last = points[points.length - 1];

  // Compute A matrix
  const A: [PathPoint, PathPoint][] = [];
  for (let i = 0; i < points.length; i++) {
    const t = u[i];
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    A.push([
      scale(leftTangent, 3 * mt2 * t),
      scale(rightTangent, 3 * mt * t2),
    ]);
  }

  // Compute C and X matrices
  const C = [[0, 0], [0, 0]];
  const X = [0, 0];

  for (let i = 0; i < points.length; i++) {
    C[0][0] += dot(A[i][0], A[i][0]);
    C[0][1] += dot(A[i][0], A[i][1]);
    C[1][0] = C[0][1];
    C[1][1] += dot(A[i][1], A[i][1]);

    const t = u[i];
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const tmp = subtract(
      points[i],
      add(
        add(scale(first, mt3), scale(first, 3 * mt2 * t)),
        add(scale(last, 3 * mt * t2), scale(last, t3))
      )
    );

    X[0] += dot(A[i][0], tmp);
    X[1] += dot(A[i][1], tmp);
  }

  // Solve for alpha values
  const det = C[0][0] * C[1][1] - C[1][0] * C[0][1];
  let alpha1: number;
  let alpha2: number;

  if (Math.abs(det) < 1e-6) {
    const segLength = distance(first, last) / 3;
    alpha1 = segLength;
    alpha2 = segLength;
  } else {
    alpha1 = (C[1][1] * X[0] - C[0][1] * X[1]) / det;
    alpha2 = (C[0][0] * X[1] - C[1][0] * X[0]) / det;
  }

  // Ensure positive alpha values
  const segLength = distance(first, last);
  const epsilon = 1e-6 * segLength;

  if (alpha1 < epsilon || alpha2 < epsilon) {
    alpha1 = segLength / 3;
    alpha2 = segLength / 3;
  }

  return {
    p0: { ...first },
    p1: add(first, scale(leftTangent, alpha1)),
    p2: add(last, scale(rightTangent, alpha2)),
    p3: { ...last },
  };
}

function computeMaxError(
  points: PathPoint[],
  bezier: CubicBezier,
  u: number[]
): { maxError: number; splitPoint: number } {
  let maxError = 0;
  let splitPoint = Math.floor(points.length / 2);

  for (let i = 1; i < points.length - 1; i++) {
    const p = evaluateBezier(bezier, u[i]);
    const dist = distance(points[i], p);
    if (dist > maxError) {
      maxError = dist;
      splitPoint = i;
    }
  }

  return { maxError, splitPoint };
}

function evaluateBezier(bezier: CubicBezier, t: number): PathPoint {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * bezier.p0.x + 3 * mt2 * t * bezier.p1.x + 3 * mt * t2 * bezier.p2.x + t3 * bezier.p3.x,
    y: mt3 * bezier.p0.y + 3 * mt2 * t * bezier.p1.y + 3 * mt * t2 * bezier.p2.y + t3 * bezier.p3.y,
  };
}

function reparameterize(
  points: PathPoint[],
  u: number[],
  bezier: CubicBezier
): number[] {
  return u.map((param, i) => newtonRaphsonRootFind(bezier, points[i], param));
}

function newtonRaphsonRootFind(
  bezier: CubicBezier,
  point: PathPoint,
  u: number
): number {
  const d = subtract(evaluateBezier(bezier, u), point);
  const qPrime = evaluateBezierDerivative(bezier, u);
  const qPrimePrime = evaluateBezierSecondDerivative(bezier, u);

  const numerator = dot(d, qPrime);
  const denominator = dot(qPrime, qPrime) + dot(d, qPrimePrime);

  if (Math.abs(denominator) < 1e-6) {
    return u;
  }

  return u - numerator / denominator;
}

function evaluateBezierDerivative(bezier: CubicBezier, t: number): PathPoint {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x: 3 * mt2 * (bezier.p1.x - bezier.p0.x) +
       6 * mt * t * (bezier.p2.x - bezier.p1.x) +
       3 * t2 * (bezier.p3.x - bezier.p2.x),
    y: 3 * mt2 * (bezier.p1.y - bezier.p0.y) +
       6 * mt * t * (bezier.p2.y - bezier.p1.y) +
       3 * t2 * (bezier.p3.y - bezier.p2.y),
  };
}

function evaluateBezierSecondDerivative(bezier: CubicBezier, t: number): PathPoint {
  const mt = 1 - t;
  return {
    x: 6 * mt * (bezier.p2.x - 2 * bezier.p1.x + bezier.p0.x) +
       6 * t * (bezier.p3.x - 2 * bezier.p2.x + bezier.p1.x),
    y: 6 * mt * (bezier.p2.y - 2 * bezier.p1.y + bezier.p0.y) +
       6 * t * (bezier.p3.y - 2 * bezier.p2.y + bezier.p1.y),
  };
}

function computeCenterTangent(points: PathPoint[], center: number): PathPoint {
  const v1 = subtract(points[center - 1], points[center]);
  const v2 = subtract(points[center], points[center + 1]);
  return normalize({
    x: (v1.x + v2.x) / 2,
    y: (v1.y + v2.y) / 2,
  });
}

/**
 * Smooths points using Chaikin's corner cutting algorithm.
 * Creates smooth curves by iteratively cutting corners.
 *
 * Algorithm: For each iteration, replaces each edge with two points at
 * 1/4 and 3/4 positions along the edge, creating a smoother curve.
 *
 * Time complexity: O(n * 2^iterations) as points double each iteration
 *
 * @param points - Array of points to smooth
 * @param iterations - Number of corner cutting iterations. Default 2
 * @returns Smoothed array of points (approximately 2^iterations times more points)
 */
export function chaikinSmooth(
  points: PathPoint[],
  iterations: number = 2
): PathPoint[] {
  // Edge cases
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];
  if (points.length === 2 || iterations <= 0) {
    return points.map(p => ({ ...p }));
  }

  let current = [...points];

  for (let iter = 0; iter < iterations; iter++) {
    const next: PathPoint[] = [];

    // Preserve first point (open curve)
    next.push({ ...current[0] });

    // Cut corners for each segment
    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];

      // Q = 3/4 * P0 + 1/4 * P1
      next.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      });

      // R = 1/4 * P0 + 3/4 * P1
      next.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      });
    }

    // Preserve last point (open curve)
    next.push({ ...current[current.length - 1] });

    current = next;
  }

  return current;
}

/**
 * Smooths points using a moving average filter.
 * Simple low-pass filter that reduces noise while maintaining overall shape.
 *
 * Algorithm: Replaces each point with the average of its neighboring points
 * within a window.
 *
 * Time complexity: O(n * windowSize)
 *
 * @param points - Array of points to smooth
 * @param windowSize - Number of points to average. Must be odd. Default 5
 * @returns Smoothed array of points (same length as input)
 */
export function movingAverageSmooth(
  points: PathPoint[],
  windowSize: number = 5
): PathPoint[] {
  // Edge cases
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];

  // Ensure window size is odd and at least 1
  const size = Math.max(1, windowSize % 2 === 0 ? windowSize + 1 : windowSize);
  const halfWindow = Math.floor(size / 2);

  // If window is larger than points, use all points
  if (size >= points.length) {
    const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return points.map((p, i) => {
      // Preserve endpoints
      if (i === 0 || i === points.length - 1) return { ...p };
      return { x: avgX, y: avgY };
    });
  }

  const result: PathPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    // Preserve endpoints
    if (i === 0 || i === points.length - 1) {
      result.push({ ...points[i] });
      continue;
    }

    // Calculate window bounds
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(points.length - 1, i + halfWindow);
    const count = end - start + 1;

    // Calculate average
    let sumX = 0;
    let sumY = 0;
    for (let j = start; j <= end; j++) {
      sumX += points[j].x;
      sumY += points[j].y;
    }

    result.push({
      x: sumX / count,
      y: sumY / count,
    });
  }

  return result;
}

/**
 * Simplifies a path using the Ramer-Douglas-Peucker algorithm.
 * Reduces number of points while preserving the overall shape.
 *
 * Algorithm: Recursively removes points that are within epsilon distance
 * of the line between endpoints.
 *
 * Time complexity: O(n^2) worst case, O(n log n) average
 *
 * @param points - Array of points to simplify
 * @param epsilon - Maximum distance threshold for point removal. Default 1.0
 * @returns Simplified array of points (fewer points, same shape)
 */
export function rdpSimplify(
  points: PathPoint[],
  epsilon: number = 1.0
): PathPoint[] {
  // Edge cases
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];
  if (points.length === 2) return [{ ...points[0] }, { ...points[1] }];

  // No simplification if epsilon is 0 or negative
  if (epsilon <= 0) {
    return points.map(p => ({ ...p }));
  }

  // Find point with maximum distance from line
  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIndex + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIndex), epsilon);

    // Combine results, removing duplicate point at junction
    return [...left.slice(0, -1), ...right];
  }

  // Otherwise, keep only endpoints
  return [{ ...first }, { ...last }];
}

/**
 * Calculates perpendicular distance from a point to a line segment.
 */
function perpendicularDistance(
  point: PathPoint,
  lineStart: PathPoint,
  lineEnd: PathPoint
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Line is a point
  if (dx === 0 && dy === 0) {
    return distance(point, lineStart);
  }

  // Calculate perpendicular distance using cross product formula
  const num = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  );
  const den = Math.sqrt(dx * dx + dy * dy);

  return num / den;
}
