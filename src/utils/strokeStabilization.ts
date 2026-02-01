/**
 * Stroke stabilization utilities for pen tool.
 *
 * Contains implementations for various line stabilization techniques
 * that reduce hand tremor and create smoother drawing input.
 *
 * All functions are pure (no side effects) and handle edge cases gracefully.
 */

import type { PathPoint } from '../types/canvas';

/**
 * Point with associated timestamp for velocity calculations.
 */
export interface TimedPoint extends PathPoint {
  timestamp: number;
}

/**
 * State for spring-based stabilizer.
 */
export interface SpringStabilizerState {
  position: PathPoint;
  velocity: PathPoint;
}

/**
 * Applies spring-based smoothing to cursor position.
 * Creates a smooth, lagging cursor that follows the target with physics-based motion.
 *
 * Algorithm: Uses spring physics (Hooke's law) with damping to create
 * smooth interpolation. The current position is "pulled" toward the target
 * with force proportional to distance.
 *
 * Latency: Typically 8-16ms depending on spring constant
 *
 * @param targetPoint - The actual cursor position to follow
 * @param currentState - Current stabilizer state (position and velocity)
 * @param springConstant - Spring stiffness (0.1 = loose, 0.9 = tight). Default 0.3
 * @param damping - Velocity damping (0.1 = bouncy, 0.9 = stiff). Default 0.8
 * @param deltaTime - Time since last update in ms. Default 16 (60fps)
 * @returns Updated stabilizer state
 */
export function springStabilizer(
  targetPoint: PathPoint,
  currentState: SpringStabilizerState,
  springConstant: number = 0.3,
  damping: number = 0.8,
  deltaTime: number = 16
): SpringStabilizerState {
  // Normalize delta time (assuming 60fps baseline)
  const dt = deltaTime / 16;

  // Clamp parameters
  const k = Math.max(0.01, Math.min(1, springConstant));
  const d = Math.max(0.01, Math.min(1, damping));

  // Calculate spring force (F = -k * displacement)
  const dx = targetPoint.x - currentState.position.x;
  const dy = targetPoint.y - currentState.position.y;

  // Apply spring force to velocity
  const newVelX = (currentState.velocity.x + dx * k * dt) * d;
  const newVelY = (currentState.velocity.y + dy * k * dt) * d;

  // Update position
  const newPosX = currentState.position.x + newVelX * dt;
  const newPosY = currentState.position.y + newVelY * dt;

  return {
    position: { x: newPosX, y: newPosY },
    velocity: { x: newVelX, y: newVelY },
  };
}

/**
 * Creates initial state for spring stabilizer.
 *
 * @param initialPoint - Starting position
 * @returns Initial stabilizer state
 */
export function createSpringStabilizerState(
  initialPoint: PathPoint
): SpringStabilizerState {
  return {
    position: { ...initialPoint },
    velocity: { x: 0, y: 0 },
  };
}

/**
 * State for lazy/pull-string stabilizer.
 */
export interface LazyStabilizerState {
  position: PathPoint;
  anchor: PathPoint;
}

/**
 * Applies "lazy" or pull-string stabilization.
 * The brush position only moves when the cursor exceeds a certain distance from it.
 * Similar to Lazy Nezumi's "Pulled String" mode.
 *
 * Algorithm: Maintains an anchor point that moves only when the target
 * exceeds the string length. The brush follows the string at a fixed distance.
 *
 * Latency: String length dependent (higher = more lag but smoother)
 *
 * @param points - Array of input points to stabilize
 * @param stringLength - Maximum distance between brush and cursor. Default 10
 * @returns Stabilized array of points
 */
export function lazyStabilizer(
  points: PathPoint[],
  stringLength: number = 10
): PathPoint[] {
  // Edge cases
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];
  if (stringLength <= 0) return points.map(p => ({ ...p }));

  const result: PathPoint[] = [{ ...points[0] }];
  let anchor = { ...points[0] };

  for (let i = 1; i < points.length; i++) {
    const target = points[i];

    // Calculate distance from anchor to target
    const dx = target.x - anchor.x;
    const dy = target.y - anchor.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > stringLength) {
      // Move anchor toward target, maintaining string length
      const ratio = (distance - stringLength) / distance;
      anchor = {
        x: anchor.x + dx * ratio,
        y: anchor.y + dy * ratio,
      };
      result.push({ ...anchor });
    }
    // If distance <= stringLength, don't add a point (brush stays put)
  }

  // Always include final position
  if (result.length > 0) {
    const last = result[result.length - 1];
    const final = points[points.length - 1];
    if (last.x !== final.x || last.y !== final.y) {
      result.push({ ...final });
    }
  }

  return result;
}

/**
 * Single-point lazy stabilizer update for real-time use.
 *
 * @param targetPoint - Current cursor position
 * @param currentState - Current stabilizer state
 * @param stringLength - String length threshold
 * @returns Updated state and whether brush moved
 */
export function lazyStabilizerStep(
  targetPoint: PathPoint,
  currentState: LazyStabilizerState,
  stringLength: number = 10
): { state: LazyStabilizerState; moved: boolean } {
  const dx = targetPoint.x - currentState.anchor.x;
  const dy = targetPoint.y - currentState.anchor.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > stringLength) {
    const ratio = (distance - stringLength) / distance;
    const newAnchor = {
      x: currentState.anchor.x + dx * ratio,
      y: currentState.anchor.y + dy * ratio,
    };
    return {
      state: {
        position: { ...newAnchor },
        anchor: newAnchor,
      },
      moved: true,
    };
  }

  return {
    state: currentState,
    moved: false,
  };
}

/**
 * Creates initial state for lazy stabilizer.
 *
 * @param initialPoint - Starting position
 * @returns Initial stabilizer state
 */
export function createLazyStabilizerState(
  initialPoint: PathPoint
): LazyStabilizerState {
  return {
    position: { ...initialPoint },
    anchor: { ...initialPoint },
  };
}

/**
 * Applies predictive smoothing to reduce jitter while maintaining responsiveness.
 * Uses a weighted moving average with lookahead to predict stroke direction.
 *
 * Algorithm: Combines current point with weighted average of previous points
 * and extrapolated future direction.
 *
 * Latency: Minimal (<8ms) due to prediction
 *
 * @param points - Array of input points
 * @param lookahead - Number of points to use for prediction. Default 3
 * @param smoothness - Blend factor between raw and smoothed (0-1). Default 0.5
 * @returns Smoothed array of points
 */
export function predictiveSmooth(
  points: PathPoint[],
  lookahead: number = 3,
  smoothness: number = 0.5
): PathPoint[] {
  // Edge cases
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];
  if (points.length === 2) return points.map(p => ({ ...p }));

  // Clamp parameters
  const look = Math.max(1, Math.min(10, lookahead));
  const smooth = Math.max(0, Math.min(1, smoothness));

  const result: PathPoint[] = [{ ...points[0] }];

  for (let i = 1; i < points.length; i++) {
    // Calculate weighted average of previous points
    let weightSum = 0;
    let avgX = 0;
    let avgY = 0;

    const startIdx = Math.max(0, i - look);
    for (let j = startIdx; j <= i; j++) {
      // More recent points have higher weight
      const weight = (j - startIdx + 1) / (i - startIdx + 1);
      weightSum += weight;
      avgX += points[j].x * weight;
      avgY += points[j].y * weight;
    }

    avgX /= weightSum;
    avgY /= weightSum;

    // Calculate direction from recent trend
    if (i >= 2) {
      const dirX = points[i].x - points[i - 1].x;
      const dirY = points[i].y - points[i - 1].y;

      // Predict next position
      const predictedX = points[i].x + dirX * 0.3;
      const predictedY = points[i].y + dirY * 0.3;

      // Blend predicted with smoothed
      avgX = avgX * smooth + predictedX * (1 - smooth);
      avgY = avgY * smooth + predictedY * (1 - smooth);
    }

    // Blend raw point with smoothed point
    result.push({
      x: points[i].x * (1 - smooth) + avgX * smooth,
      y: points[i].y * (1 - smooth) + avgY * smooth,
    });
  }

  return result;
}

/**
 * Applies velocity-weighted stabilization.
 * Slower movements are smoothed more heavily, faster movements pass through.
 *
 * Algorithm: Calculates local velocity and applies smoothing inversely
 * proportional to speed.
 *
 * @param points - Array of timed points
 * @param maxSmoothing - Maximum smoothing factor at low velocity. Default 0.8
 * @returns Smoothed array of points
 */
export function velocityWeightedSmooth(
  points: TimedPoint[],
  maxSmoothing: number = 0.8
): PathPoint[] {
  // Edge cases
  if (points.length === 0) return [];
  if (points.length === 1) return [{ x: points[0].x, y: points[0].y }];

  const smooth = Math.max(0, Math.min(1, maxSmoothing));
  const result: PathPoint[] = [{ x: points[0].x, y: points[0].y }];

  // Velocity thresholds
  const minVelocity = 0.1;  // px/ms - below this, apply max smoothing
  const maxVelocity = 1.5;  // px/ms - above this, minimal smoothing

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Calculate velocity
    const dt = Math.max(1, curr.timestamp - prev.timestamp);
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const velocity = distance / dt;

    // Map velocity to smoothing factor (inverse relationship)
    const normalizedVelocity = Math.max(0, Math.min(1,
      (velocity - minVelocity) / (maxVelocity - minVelocity)
    ));
    const smoothingFactor = smooth * (1 - normalizedVelocity);

    // Blend with previous smoothed point
    const lastSmoothed = result[result.length - 1];
    result.push({
      x: curr.x * (1 - smoothingFactor) + lastSmoothed.x * smoothingFactor,
      y: curr.y * (1 - smoothingFactor) + lastSmoothed.y * smoothingFactor,
    });
  }

  return result;
}

/**
 * Combines multiple stabilization techniques for optimal results.
 * Uses spring physics for smoothing and lazy stabilizer for jitter reduction.
 *
 * @param points - Input points
 * @param springConstant - Spring stiffness. Default 0.4
 * @param stringLength - Lazy stabilizer threshold. Default 3
 * @returns Stabilized points
 */
export function combinedStabilizer(
  points: PathPoint[],
  springConstant: number = 0.4,
  stringLength: number = 3
): PathPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];

  // First pass: spring smoothing
  const springSmoothed: PathPoint[] = [{ ...points[0] }];
  let springState = createSpringStabilizerState(points[0]);

  for (let i = 1; i < points.length; i++) {
    springState = springStabilizer(points[i], springState, springConstant);
    springSmoothed.push({ ...springState.position });
  }

  // Second pass: lazy stabilizer for jitter reduction
  if (stringLength > 0) {
    return lazyStabilizer(springSmoothed, stringLength);
  }

  return springSmoothed;
}

/**
 * Detects and removes accidental pen lifts (very short gaps).
 * Useful for connecting strokes that were unintentionally split.
 *
 * @param strokes - Array of stroke arrays
 * @param maxGap - Maximum gap to bridge in pixels. Default 20
 * @param maxTime - Maximum time gap to bridge in ms. Default 100
 * @returns Connected strokes
 */
export function bridgeStrokeGaps(
  strokes: TimedPoint[][],
  maxGap: number = 20,
  maxTime: number = 100
): PathPoint[][] {
  if (strokes.length === 0) return [];
  if (strokes.length === 1) return [strokes[0].map(p => ({ x: p.x, y: p.y }))];

  const result: PathPoint[][] = [];
  let currentStroke: PathPoint[] = strokes[0].map(p => ({ x: p.x, y: p.y }));

  for (let i = 1; i < strokes.length; i++) {
    const lastPoint = strokes[i - 1][strokes[i - 1].length - 1];
    const firstPoint = strokes[i][0];

    // Calculate gap
    const dx = firstPoint.x - lastPoint.x;
    const dy = firstPoint.y - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const timeDiff = firstPoint.timestamp - lastPoint.timestamp;

    if (distance <= maxGap && timeDiff <= maxTime) {
      // Bridge the gap - add points from next stroke to current
      currentStroke.push(...strokes[i].map(p => ({ x: p.x, y: p.y })));
    } else {
      // Gap too large - start new stroke
      result.push(currentStroke);
      currentStroke = strokes[i].map(p => ({ x: p.x, y: p.y }));
    }
  }

  result.push(currentStroke);
  return result;
}
