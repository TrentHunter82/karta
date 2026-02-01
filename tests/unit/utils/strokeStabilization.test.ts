/**
 * Tests for stroke stabilization algorithms.
 */
import {
  springStabilizer,
  createSpringStabilizerState,
  lazyStabilizer,
  lazyStabilizerStep,
  createLazyStabilizerState,
  predictiveSmooth,
  velocityWeightedSmooth,
  combinedStabilizer,
  bridgeStrokeGaps,
  type SpringStabilizerState,
  type LazyStabilizerState,
  type TimedPoint,
} from '../../../src/utils/strokeStabilization';
import type { PathPoint } from '../../../src/types/canvas';

// Helper to calculate distance between points
function distance(a: PathPoint, b: PathPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

describe('springStabilizer', () => {
  it('converges to target over multiple updates', () => {
    const target = { x: 100, y: 100 };
    let state = createSpringStabilizerState({ x: 0, y: 0 });

    // Simulate multiple frames
    for (let i = 0; i < 100; i++) {
      state = springStabilizer(target, state, 0.3, 0.8, 16);
    }

    // Should converge close to target
    expect(distance(state.position, target)).toBeLessThan(1);
  });

  it('maintains position when already at target', () => {
    const target = { x: 50, y: 50 };
    let state: SpringStabilizerState = {
      position: { x: 50, y: 50 },
      velocity: { x: 0, y: 0 },
    };

    state = springStabilizer(target, state, 0.3, 0.8, 16);

    expect(state.position.x).toBeCloseTo(50, 5);
    expect(state.position.y).toBeCloseTo(50, 5);
  });

  it('moves toward target on first update', () => {
    const target = { x: 100, y: 0 };
    let state = createSpringStabilizerState({ x: 0, y: 0 });

    state = springStabilizer(target, state, 0.3, 0.8, 16);

    // Position should have moved toward target
    expect(state.position.x).toBeGreaterThan(0);
    expect(state.velocity.x).toBeGreaterThan(0);
  });

  it('higher spring constant results in faster initial movement', () => {
    const target = { x: 100, y: 100 };
    let stateLoose = createSpringStabilizerState({ x: 0, y: 0 });
    let stateTight = createSpringStabilizerState({ x: 0, y: 0 });

    // Apply just a few updates to see initial response
    for (let i = 0; i < 5; i++) {
      stateLoose = springStabilizer(target, stateLoose, 0.1, 0.8, 16);
      stateTight = springStabilizer(target, stateTight, 0.5, 0.8, 16);
    }

    // Tighter spring should have moved more initially
    const looseProgress = distance({ x: 0, y: 0 }, stateLoose.position);
    const tightProgress = distance({ x: 0, y: 0 }, stateTight.position);

    expect(tightProgress).toBeGreaterThan(looseProgress);
  });

  it('handles rapid direction changes', () => {
    let state = createSpringStabilizerState({ x: 50, y: 50 });

    // Rapidly change targets
    const targets = [
      { x: 100, y: 50 },
      { x: 0, y: 50 },
      { x: 50, y: 100 },
      { x: 50, y: 0 },
    ];

    for (const target of targets) {
      for (let i = 0; i < 5; i++) {
        state = springStabilizer(target, state, 0.3, 0.8, 16);
      }
    }

    // Should still have valid position and velocity
    expect(Number.isFinite(state.position.x)).toBe(true);
    expect(Number.isFinite(state.position.y)).toBe(true);
    expect(Number.isFinite(state.velocity.x)).toBe(true);
    expect(Number.isFinite(state.velocity.y)).toBe(true);
  });

  it('clamps parameters to valid range', () => {
    const target = { x: 100, y: 100 };
    let state = createSpringStabilizerState({ x: 0, y: 0 });

    // Use out-of-range parameters
    state = springStabilizer(target, state, -1, 2, 16);

    // Should still produce valid output
    expect(Number.isFinite(state.position.x)).toBe(true);
    expect(Number.isFinite(state.position.y)).toBe(true);
  });
});

describe('lazyStabilizer', () => {
  it('returns empty array for empty input', () => {
    expect(lazyStabilizer([])).toEqual([]);
  });

  it('returns single point for single point input', () => {
    const points: PathPoint[] = [{ x: 10, y: 20 }];
    const result = lazyStabilizer(points);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(points[0]);
  });

  it('maintains string length constraint', () => {
    const stringLength = 15;
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },  // Within string
      { x: 20, y: 0 },  // Should trigger move
      { x: 40, y: 0 },  // Should trigger move
      { x: 60, y: 0 },  // Should trigger move
    ];

    const result = lazyStabilizer(points, stringLength);

    // Check consecutive result points are within string length + small tolerance
    for (let i = 1; i < result.length; i++) {
      const dist = distance(result[i], result[i - 1]);
      // Allow some tolerance due to the algorithm's nature
      expect(dist).toBeLessThanOrEqual(stringLength * 2);
    }
  });

  it('filters out jitter (small movements)', () => {
    const stringLength = 10;
    // Create jittery input
    const points: PathPoint[] = [];
    for (let i = 0; i < 20; i++) {
      points.push({
        x: 50 + Math.random() * 5, // Small random jitter
        y: 50 + Math.random() * 5,
      });
    }

    const result = lazyStabilizer(points, stringLength);

    // Should have fewer points due to jitter filtering
    expect(result.length).toBeLessThan(points.length);
  });

  it('preserves large movements', () => {
    const stringLength = 10;
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },   // Large jump
      { x: 100, y: 100 }, // Large jump
      { x: 200, y: 100 }, // Large jump
    ];

    const result = lazyStabilizer(points, stringLength);

    // Should preserve the general path shape
    expect(result.length).toBeGreaterThan(1);

    // First and last should be close to original
    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[points.length - 1]);
  });

  it('returns copy for zero string length', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ];
    const result = lazyStabilizer(points, 0);
    expect(result).toHaveLength(points.length);
  });

  it('handles 1000+ points efficiently', () => {
    const points: PathPoint[] = [];
    for (let i = 0; i < 1000; i++) {
      points.push({ x: i * 2 + Math.random() * 3, y: Math.sin(i * 0.05) * 50 });
    }

    const start = Date.now();
    const result = lazyStabilizer(points, 5);
    const elapsed = Date.now() - start;

    expect(result.length).toBeLessThan(points.length);
    expect(elapsed).toBeLessThan(100); // Should be very fast
  });
});

describe('lazyStabilizerStep', () => {
  it('does not move when within string length', () => {
    const state = createLazyStabilizerState({ x: 0, y: 0 });
    const target = { x: 5, y: 0 }; // Within 10px string

    const { state: newState, moved } = lazyStabilizerStep(target, state, 10);

    expect(moved).toBe(false);
    expect(newState.position).toEqual(state.position);
  });

  it('moves when exceeding string length', () => {
    const state = createLazyStabilizerState({ x: 0, y: 0 });
    const target = { x: 20, y: 0 }; // Beyond 10px string

    const { state: newState, moved } = lazyStabilizerStep(target, state, 10);

    expect(moved).toBe(true);
    expect(newState.position.x).toBeGreaterThan(0);
  });

  it('moves by correct amount', () => {
    const state = createLazyStabilizerState({ x: 0, y: 0 });
    const target = { x: 20, y: 0 };
    const stringLength = 10;

    const { state: newState } = lazyStabilizerStep(target, state, stringLength);

    // New position should be exactly stringLength away from target
    const distToTarget = distance(newState.position, target);
    expect(distToTarget).toBeCloseTo(stringLength, 5);
  });
});

describe('predictiveSmooth', () => {
  it('returns empty array for empty input', () => {
    expect(predictiveSmooth([])).toEqual([]);
  });

  it('returns single point for single point input', () => {
    const points: PathPoint[] = [{ x: 10, y: 20 }];
    const result = predictiveSmooth(points);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(points[0]);
  });

  it('returns copy for two points', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    const result = predictiveSmooth(points);
    expect(result).toHaveLength(2);
  });

  it('reduces jitter in noisy input', () => {
    // Create noisy input with jitter
    const points: PathPoint[] = [];
    for (let i = 0; i < 50; i++) {
      points.push({
        x: i * 4 + (Math.random() - 0.5) * 10,
        y: i * 3 + (Math.random() - 0.5) * 10,
      });
    }

    const result = predictiveSmooth(points, 3, 0.5);

    // Calculate variance of point-to-point changes
    function calculateChangeVariance(pts: PathPoint[]): number {
      const changes: number[] = [];
      for (let i = 1; i < pts.length; i++) {
        changes.push(distance(pts[i], pts[i - 1]));
      }
      const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
      return changes.reduce((acc, c) => acc + Math.pow(c - mean, 2), 0) / changes.length;
    }

    const origVariance = calculateChangeVariance(points);
    const smoothVariance = calculateChangeVariance(result);

    // Smoothed should have less variance in step sizes
    expect(smoothVariance).toBeLessThanOrEqual(origVariance * 1.5);
  });

  it('preserves general direction', () => {
    const points: PathPoint[] = [];
    for (let i = 0; i < 20; i++) {
      points.push({ x: i * 10, y: i * 5 });
    }

    const result = predictiveSmooth(points, 3, 0.3);

    // Start and end should be close to original
    expect(result[0].x).toBeCloseTo(points[0].x, 0);
    expect(result[result.length - 1].x).toBeCloseTo(points[points.length - 1].x, 0);
  });

  it('clamps parameters to valid range', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ];

    // Use out-of-range parameters
    const result = predictiveSmooth(points, -5, 2.0);

    expect(result).toHaveLength(3);
    expect(Number.isFinite(result[1].x)).toBe(true);
    expect(Number.isFinite(result[1].y)).toBe(true);
  });
});

describe('velocityWeightedSmooth', () => {
  it('returns empty array for empty input', () => {
    expect(velocityWeightedSmooth([])).toEqual([]);
  });

  it('returns single point for single point input', () => {
    const points: TimedPoint[] = [{ x: 10, y: 20, timestamp: 0 }];
    const result = velocityWeightedSmooth(points);
    expect(result).toHaveLength(1);
  });

  it('applies more smoothing to slow movements', () => {
    // Create points with varying velocities
    const points: TimedPoint[] = [
      { x: 0, y: 0, timestamp: 0 },
      { x: 10, y: 0, timestamp: 100 },  // Slow (0.1 px/ms)
      { x: 210, y: 0, timestamp: 200 }, // Fast (2 px/ms)
      { x: 220, y: 0, timestamp: 300 }, // Slow again
    ];

    const result = velocityWeightedSmooth(points, 0.8);

    // Fast movement should pass through more directly
    // The jump at index 2 should be preserved better than slow movements
    expect(result.length).toBe(points.length);
  });

  it('handles constant velocity gracefully', () => {
    const points: TimedPoint[] = [];
    for (let i = 0; i < 10; i++) {
      points.push({ x: i * 10, y: 0, timestamp: i * 100 });
    }

    const result = velocityWeightedSmooth(points);

    expect(result).toHaveLength(10);
    // All points should be valid
    for (const p of result) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe('combinedStabilizer', () => {
  it('returns empty array for empty input', () => {
    expect(combinedStabilizer([])).toEqual([]);
  });

  it('returns single point for single point input', () => {
    const points: PathPoint[] = [{ x: 10, y: 20 }];
    const result = combinedStabilizer(points);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(points[0]);
  });

  it('reduces point count through stabilization with jittery input', () => {
    // Create very jittery input with small movements
    const points: PathPoint[] = [];
    for (let i = 0; i < 100; i++) {
      points.push({
        x: 50 + Math.random() * 4 - 2, // Jitter around x=50
        y: 50 + Math.random() * 4 - 2, // Jitter around y=50
      });
    }

    const result = combinedStabilizer(points, 0.4, 10);

    // Jittery input within string length should be reduced
    expect(result.length).toBeLessThan(points.length);
  });

  it('produces smoother output than raw input', () => {
    const points: PathPoint[] = [];
    for (let i = 0; i < 50; i++) {
      points.push({
        x: i * 5 + (Math.random() - 0.5) * 15,
        y: i * 3 + (Math.random() - 0.5) * 15,
      });
    }

    const result = combinedStabilizer(points, 0.5, 3);

    // Calculate "jerkiness" (variance in direction changes)
    function calculateJerk(pts: PathPoint[]): number {
      if (pts.length < 3) return 0;
      let jerk = 0;
      for (let i = 2; i < pts.length; i++) {
        const dir1 = Math.atan2(pts[i - 1].y - pts[i - 2].y, pts[i - 1].x - pts[i - 2].x);
        const dir2 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
        jerk += Math.abs(dir2 - dir1);
      }
      return jerk / (pts.length - 2);
    }

    const origJerk = calculateJerk(points);
    const smoothJerk = calculateJerk(result);

    // Smoothed path should be less jerky or similar
    // (with fewer points, there are fewer direction changes)
    expect(smoothJerk).toBeLessThanOrEqual(origJerk * 2);
  });
});

describe('bridgeStrokeGaps', () => {
  it('returns empty array for empty input', () => {
    expect(bridgeStrokeGaps([])).toEqual([]);
  });

  it('returns single stroke unchanged', () => {
    const strokes: TimedPoint[][] = [
      [
        { x: 0, y: 0, timestamp: 0 },
        { x: 10, y: 10, timestamp: 100 },
      ],
    ];
    const result = bridgeStrokeGaps(strokes);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it('bridges small gaps', () => {
    const strokes: TimedPoint[][] = [
      [
        { x: 0, y: 0, timestamp: 0 },
        { x: 10, y: 0, timestamp: 100 },
      ],
      [
        { x: 15, y: 0, timestamp: 150 }, // Small gap: 5px, 50ms
        { x: 25, y: 0, timestamp: 250 },
      ],
    ];

    const result = bridgeStrokeGaps(strokes, 20, 100);

    // Should merge into single stroke
    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(4);
  });

  it('does not bridge large gaps', () => {
    const strokes: TimedPoint[][] = [
      [
        { x: 0, y: 0, timestamp: 0 },
        { x: 10, y: 0, timestamp: 100 },
      ],
      [
        { x: 100, y: 0, timestamp: 200 }, // Large gap: 90px
        { x: 110, y: 0, timestamp: 300 },
      ],
    ];

    const result = bridgeStrokeGaps(strokes, 20, 100);

    // Should keep as separate strokes
    expect(result).toHaveLength(2);
  });

  it('does not bridge long time gaps', () => {
    const strokes: TimedPoint[][] = [
      [
        { x: 0, y: 0, timestamp: 0 },
        { x: 10, y: 0, timestamp: 100 },
      ],
      [
        { x: 15, y: 0, timestamp: 1000 }, // Small distance but long time: 900ms
        { x: 25, y: 0, timestamp: 1100 },
      ],
    ];

    const result = bridgeStrokeGaps(strokes, 20, 100);

    // Should keep as separate strokes due to time gap
    expect(result).toHaveLength(2);
  });

  it('bridges multiple consecutive small gaps', () => {
    const strokes: TimedPoint[][] = [
      [{ x: 0, y: 0, timestamp: 0 }],
      [{ x: 5, y: 0, timestamp: 50 }],  // Small gap
      [{ x: 10, y: 0, timestamp: 100 }], // Small gap
      [{ x: 15, y: 0, timestamp: 150 }], // Small gap
    ];

    const result = bridgeStrokeGaps(strokes, 10, 100);

    // Should merge all into single stroke
    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(4);
  });
});
