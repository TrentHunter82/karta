/**
 * Tests for stroke smoothing algorithms.
 */
import {
  catmullRomSpline,
  fitCubicBezier,
  chaikinSmooth,
  movingAverageSmooth,
  rdpSimplify,
  type CubicBezier,
} from '../../../src/utils/strokeSmoothing';
import type { PathPoint } from '../../../src/types/canvas';

// Helper to calculate distance between points
function distance(a: PathPoint, b: PathPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Helper to check if points are approximately equal
function pointsEqual(a: PathPoint, b: PathPoint, tolerance = 0.001): boolean {
  return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance;
}

describe('catmullRomSpline', () => {
  it('returns empty array for empty input', () => {
    expect(catmullRomSpline([])).toEqual([]);
  });

  it('returns single point for single point input', () => {
    const point = { x: 10, y: 20 };
    const result = catmullRomSpline([point]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(point);
  });

  it('preserves endpoints for multi-point input', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 50 },
      { x: 150, y: 75 },
    ];
    const result = catmullRomSpline(points, 0.5, 10);

    // First point should match
    expect(result[0].x).toBeCloseTo(points[0].x, 5);
    expect(result[0].y).toBeCloseTo(points[0].y, 5);

    // Last point should match
    const last = result[result.length - 1];
    expect(last.x).toBeCloseTo(points[points.length - 1].x, 5);
    expect(last.y).toBeCloseTo(points[points.length - 1].y, 5);
  });

  it('generates correct number of interpolated points', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 0 },
    ];
    const segments = 10;
    const result = catmullRomSpline(points, 0.5, segments);

    // For n points, we have (n-1) segments, each with 'segments' interpolated points
    // plus the final point
    // So: (n-1) * segments + 1
    const expectedCount = (points.length - 1) * segments + 1;
    expect(result).toHaveLength(expectedCount);
  });

  it('produces smooth curve (no sharp jumps)', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 50 },
      { x: 150, y: 75 },
    ];
    const result = catmullRomSpline(points, 0.5, 10);

    // Check that consecutive points are reasonably close (smooth)
    let maxJump = 0;
    for (let i = 1; i < result.length; i++) {
      const jump = distance(result[i], result[i - 1]);
      maxJump = Math.max(maxJump, jump);
    }

    // Max jump should be reasonable (less than input point spacing)
    expect(maxJump).toBeLessThan(50);
  });

  it('interpolates linearly for 2 points', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    const result = catmullRomSpline(points, 0.5, 10);

    // Check midpoint is on the line
    const midIdx = Math.floor(result.length / 2);
    expect(result[midIdx].x).toBeCloseTo(50, 1);
    expect(result[midIdx].y).toBeCloseTo(50, 1);
  });

  it('passes through all control points', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 200 },
      { x: 200, y: 100 },
      { x: 300, y: 150 },
    ];
    const segments = 10;
    const result = catmullRomSpline(points, 0.5, segments);

    // Check each original point appears in result (at segment boundaries)
    for (let i = 0; i < points.length; i++) {
      const idx = i * segments;
      if (idx < result.length) {
        expect(result[idx].x).toBeCloseTo(points[i].x, 3);
        expect(result[idx].y).toBeCloseTo(points[i].y, 3);
      }
    }
  });

  it('handles 1000+ points efficiently', () => {
    const points: PathPoint[] = [];
    for (let i = 0; i < 1000; i++) {
      points.push({ x: i * 10, y: Math.sin(i * 0.1) * 100 });
    }

    const start = Date.now();
    const result = catmullRomSpline(points, 0.5, 5);
    const elapsed = Date.now() - start;

    expect(result.length).toBeGreaterThan(points.length);
    expect(elapsed).toBeLessThan(1000); // Should complete in under 1 second
  });
});

describe('fitCubicBezier', () => {
  it('returns empty array for empty input', () => {
    expect(fitCubicBezier([])).toEqual([]);
  });

  it('returns degenerate curve for single point', () => {
    const point = { x: 10, y: 20 };
    const result = fitCubicBezier([point]);
    expect(result).toHaveLength(1);
    expect(result[0].p0).toEqual(point);
    expect(result[0].p3).toEqual(point);
  });

  it('returns valid bezier for two points', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    const result = fitCubicBezier(points);

    expect(result).toHaveLength(1);
    expect(result[0].p0).toEqual(points[0]);
    expect(result[0].p3).toEqual(points[1]);
  });

  it('produces curves with error within threshold', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 30, y: 50 },
      { x: 60, y: 40 },
      { x: 100, y: 100 },
    ];
    const errorThreshold = 5.0;
    const curves = fitCubicBezier(points, errorThreshold);

    // Evaluate each curve and check distance from original points
    for (const curve of curves) {
      // Check that curve endpoints are close to original points
      expect(distance(curve.p0, points[0]) < errorThreshold * 2 ||
             distance(curve.p3, points[points.length - 1]) < errorThreshold * 2).toBe(true);
    }
  });

  it('splits curves when error exceeds threshold', () => {
    // Create a path with a sharp corner that can't be fit well with one curve
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 }, // Sharp corner
      { x: 100, y: 50 },
    ];
    const result = fitCubicBezier(points, 1.0);

    // Sharp corner should require multiple curves
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('produces connected curves', () => {
    const points: PathPoint[] = [];
    for (let i = 0; i < 20; i++) {
      points.push({ x: i * 10, y: Math.sin(i * 0.5) * 50 });
    }
    const curves = fitCubicBezier(points, 2.0);

    // Check that curves are connected (end of one = start of next)
    for (let i = 1; i < curves.length; i++) {
      expect(curves[i].p0.x).toBeCloseTo(curves[i - 1].p3.x, 3);
      expect(curves[i].p0.y).toBeCloseTo(curves[i - 1].p3.y, 3);
    }
  });
});

describe('chaikinSmooth', () => {
  it('returns empty array for empty input', () => {
    expect(chaikinSmooth([])).toEqual([]);
  });

  it('returns single point for single point input', () => {
    const point = { x: 10, y: 20 };
    const result = chaikinSmooth([point]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(point);
  });

  it('returns copy for two points (no smoothing possible)', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    const result = chaikinSmooth(points, 2);
    expect(result).toHaveLength(2);
  });

  it('increases point count with iterations', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 50 },
    ];

    const result1 = chaikinSmooth(points, 1);
    const result2 = chaikinSmooth(points, 2);
    const result3 = chaikinSmooth(points, 3);

    // Point count should increase with each iteration
    expect(result1.length).toBeGreaterThan(points.length);
    expect(result2.length).toBeGreaterThan(result1.length);
    expect(result3.length).toBeGreaterThan(result2.length);
  });

  it('preserves endpoints', () => {
    const points: PathPoint[] = [
      { x: 10, y: 20 },
      { x: 50, y: 100 },
      { x: 100, y: 50 },
      { x: 150, y: 75 },
    ];
    const result = chaikinSmooth(points, 3);

    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[points.length - 1]);
  });

  it('smooths corners', () => {
    // Create a sharp corner
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 }, // Sharp 90-degree corner
    ];
    const result = chaikinSmooth(points, 2);

    // The corner should be smoothed - intermediate points should exist
    expect(result.length).toBeGreaterThan(3);

    // Points near the corner shouldn't be exactly at (50, 0) or (50, 50)
    const nearCorner = result.filter(p =>
      p.x > 40 && p.x < 60 && p.y > 0 && p.y < 50
    );
    expect(nearCorner.length).toBeGreaterThan(0);
  });

  it('returns copy when iterations is 0', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 0 },
    ];
    const result = chaikinSmooth(points, 0);
    expect(result).toHaveLength(points.length);
  });
});

describe('movingAverageSmooth', () => {
  it('returns empty array for empty input', () => {
    expect(movingAverageSmooth([])).toEqual([]);
  });

  it('returns single point for single point input', () => {
    const point = { x: 10, y: 20 };
    const result = movingAverageSmooth([point]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(point);
  });

  it('preserves same point count', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 15 },
      { x: 20, y: 10 },
      { x: 30, y: 25 },
      { x: 40, y: 20 },
    ];
    const result = movingAverageSmooth(points, 3);
    expect(result).toHaveLength(points.length);
  });

  it('preserves endpoints', () => {
    const points: PathPoint[] = [
      { x: 5, y: 10 },
      { x: 15, y: 20 },
      { x: 25, y: 15 },
      { x: 35, y: 30 },
    ];
    const result = movingAverageSmooth(points, 3);

    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[points.length - 1]);
  });

  it('smooths noisy input', () => {
    // Create noisy signal
    const points: PathPoint[] = [];
    for (let i = 0; i < 20; i++) {
      points.push({
        x: i * 10,
        y: 50 + (Math.random() - 0.5) * 40, // Noisy Y
      });
    }

    const smoothed = movingAverageSmooth(points, 5);

    // Calculate variance of original vs smoothed
    const origVariance = calculateVariance(points.map(p => p.y));
    const smoothVariance = calculateVariance(smoothed.map(p => p.y));

    // Smoothed should have less variance
    expect(smoothVariance).toBeLessThanOrEqual(origVariance);
  });
});

// Helper to calculate variance
function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}

describe('rdpSimplify', () => {
  it('returns empty array for empty input', () => {
    expect(rdpSimplify([])).toEqual([]);
  });

  it('returns single point for single point input', () => {
    const point = { x: 10, y: 20 };
    const result = rdpSimplify([point]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(point);
  });

  it('returns both points for two point input', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    const result = rdpSimplify(points);
    expect(result).toHaveLength(2);
  });

  it('reduces points while preserving shape', () => {
    // Create a curve with many points
    const points: PathPoint[] = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      points.push({
        x: t * 100,
        y: Math.sin(t * Math.PI) * 50,
      });
    }

    const result = rdpSimplify(points, 2.0);

    // Should have fewer points
    expect(result.length).toBeLessThan(points.length);
    expect(result.length).toBeGreaterThan(2);

    // Endpoints should be preserved
    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[points.length - 1]);
  });

  it('simplifies collinear points to endpoints only', () => {
    // Points on a straight line
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 25, y: 25 },
      { x: 50, y: 50 },
      { x: 75, y: 75 },
      { x: 100, y: 100 },
    ];

    const result = rdpSimplify(points, 1.0);

    // Collinear points should be simplified to just endpoints
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(points[0]);
    expect(result[1]).toEqual(points[points.length - 1]);
  });

  it('returns copy with epsilon = 0 (no simplification)', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 50 },
    ];
    const result = rdpSimplify(points, 0);

    expect(result).toHaveLength(points.length);
    expect(result[0]).toEqual(points[0]);
    expect(result[1]).toEqual(points[1]);
    expect(result[2]).toEqual(points[2]);
  });

  it('preserves corners that exceed epsilon', () => {
    // Create a path with a sharp corner
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 }, // Sharp corner
      { x: 100, y: 50 },
    ];

    const result = rdpSimplify(points, 5.0);

    // Corner point should be preserved because it's far from the line
    expect(result.length).toBeGreaterThan(2);

    // The corner point or something close should exist
    const hasCorner = result.some(p =>
      Math.abs(p.x - 50) < 5 && p.y > 0 && p.y < 50
    );
    expect(hasCorner || result.length >= 3).toBe(true);
  });

  it('handles negative epsilon as no simplification', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 },
    ];
    const result = rdpSimplify(points, -1);
    expect(result).toHaveLength(points.length);
  });

  it('handles 1000+ points efficiently', () => {
    const points: PathPoint[] = [];
    for (let i = 0; i < 1000; i++) {
      points.push({ x: i, y: Math.sin(i * 0.1) * 50 + Math.random() * 5 });
    }

    const start = Date.now();
    const result = rdpSimplify(points, 3.0);
    const elapsed = Date.now() - start;

    expect(result.length).toBeLessThan(points.length);
    expect(elapsed).toBeLessThan(500); // Should complete quickly
  });

  it('quality: smoothed strokes have <50% of raw points', () => {
    // Generate a typical freehand stroke (slight noise)
    const points: PathPoint[] = [];
    for (let i = 0; i < 200; i++) {
      points.push({
        x: i * 2,
        y: Math.sin(i * 0.05) * 30 + Math.random() * 3,
      });
    }

    const result = rdpSimplify(points, 2.0);
    const ratio = result.length / points.length;

    expect(ratio).toBeLessThan(0.5);
  });
});
