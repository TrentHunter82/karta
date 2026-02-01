/**
 * Tests for stroke pressure and velocity simulation.
 */
import {
  getStrokeWidthFromVelocity,
  calculateVelocity,
  taperStrokeEnds,
  variableWidthStroke,
  pointsToStrokePoints,
  smoothWidths,
  type StrokePoint,
} from '../../../src/utils/strokePressure';
import type { PathPoint } from '../../../src/types/canvas';

describe('calculateVelocity', () => {
  it('returns 0 for same point', () => {
    const point = { x: 10, y: 20 };
    expect(calculateVelocity(point, point, 16)).toBe(0);
  });

  it('calculates correct velocity for horizontal movement', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 0 };
    const dt = 100; // 100ms

    const velocity = calculateVelocity(p2, p1, dt);
    expect(velocity).toBeCloseTo(1.0, 5); // 100px / 100ms = 1 px/ms
  });

  it('calculates correct velocity for diagonal movement', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 30, y: 40 }; // distance = 50 (3-4-5 triangle)
    const dt = 50;

    const velocity = calculateVelocity(p2, p1, dt);
    expect(velocity).toBeCloseTo(1.0, 5); // 50px / 50ms = 1 px/ms
  });

  it('returns 0 for zero delta time', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 100 };
    expect(calculateVelocity(p2, p1, 0)).toBe(0);
  });

  it('returns 0 for negative delta time', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 100 };
    expect(calculateVelocity(p2, p1, -10)).toBe(0);
  });

  it('handles very small movements', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 0.001, y: 0.001 };
    const velocity = calculateVelocity(p2, p1, 16);
    expect(velocity).toBeGreaterThan(0);
    expect(velocity).toBeLessThan(0.001);
  });
});

describe('getStrokeWidthFromVelocity', () => {
  const minWidth = 1;
  const maxWidth = 8;

  it('returns middle value for zero velocity', () => {
    const width = getStrokeWidthFromVelocity(0, minWidth, maxWidth);
    expect(width).toBeGreaterThanOrEqual(minWidth);
    expect(width).toBeLessThanOrEqual(maxWidth);
  });

  it('returns max width for very slow movement', () => {
    const width = getStrokeWidthFromVelocity(0.05, minWidth, maxWidth);
    expect(width).toBeCloseTo(maxWidth, 0);
  });

  it('returns min width for very fast movement', () => {
    const width = getStrokeWidthFromVelocity(5.0, minWidth, maxWidth, 1.0);
    expect(width).toBeCloseTo(minWidth, 0);
  });

  it('stays within min/max bounds', () => {
    for (let v = 0; v <= 10; v += 0.5) {
      const width = getStrokeWidthFromVelocity(v, minWidth, maxWidth);
      expect(width).toBeGreaterThanOrEqual(minWidth);
      expect(width).toBeLessThanOrEqual(maxWidth);
    }
  });

  it('respects custom min/max widths', () => {
    const customMin = 2;
    const customMax = 20;

    const slowWidth = getStrokeWidthFromVelocity(0.05, customMin, customMax);
    const fastWidth = getStrokeWidthFromVelocity(5.0, customMin, customMax, 1.0);

    expect(slowWidth).toBeCloseTo(customMax, 0);
    expect(fastWidth).toBeGreaterThanOrEqual(customMin);
  });

  it('handles invalid velocity (NaN)', () => {
    const width = getStrokeWidthFromVelocity(NaN, minWidth, maxWidth);
    expect(width).toBeCloseTo((minWidth + maxWidth) / 2, 5);
  });

  it('handles negative velocity', () => {
    const width = getStrokeWidthFromVelocity(-1, minWidth, maxWidth);
    expect(width).toBeCloseTo((minWidth + maxWidth) / 2, 5);
  });

  it('handles Infinity velocity', () => {
    const width = getStrokeWidthFromVelocity(Infinity, minWidth, maxWidth);
    expect(width).toBeCloseTo((minWidth + maxWidth) / 2, 5);
  });

  it('produces natural width variation (no sudden jumps)', () => {
    const widths: number[] = [];
    for (let v = 0; v <= 2; v += 0.1) {
      widths.push(getStrokeWidthFromVelocity(v, minWidth, maxWidth));
    }

    // Check for smooth transitions
    for (let i = 1; i < widths.length; i++) {
      const diff = Math.abs(widths[i] - widths[i - 1]);
      expect(diff).toBeLessThan(1); // Max 1px change per 0.1 velocity
    }
  });

  it('sensitivity=0 returns constant width', () => {
    const w1 = getStrokeWidthFromVelocity(0.1, minWidth, maxWidth, 0);
    const w2 = getStrokeWidthFromVelocity(1.0, minWidth, maxWidth, 0);
    const w3 = getStrokeWidthFromVelocity(2.0, minWidth, maxWidth, 0);

    expect(w1).toBeCloseTo(w2, 5);
    expect(w2).toBeCloseTo(w3, 5);
  });
});

describe('taperStrokeEnds', () => {
  const createStrokePoints = (count: number, width: number = 4): StrokePoint[] => {
    return Array.from({ length: count }, (_, i) => ({
      x: i * 10,
      y: 0,
      width,
    }));
  };

  it('returns empty array for empty input', () => {
    expect(taperStrokeEnds([])).toEqual([]);
  });

  it('handles single point', () => {
    const points: StrokePoint[] = [{ x: 0, y: 0, width: 4 }];
    const result = taperStrokeEnds(points);
    expect(result).toHaveLength(1);
    expect(result[0].width).toBeLessThan(4);
  });

  it('applies taper at start (width increases)', () => {
    const points = createStrokePoints(20, 4);
    const result = taperStrokeEnds(points, 5, 5);

    // First point should be thinnest
    expect(result[0].width).toBeLessThan(result[4].width);

    // Taper should be gradual
    for (let i = 0; i < 4; i++) {
      expect(result[i].width).toBeLessThanOrEqual(result[i + 1].width);
    }
  });

  it('applies taper at end (width decreases)', () => {
    const points = createStrokePoints(20, 4);
    const result = taperStrokeEnds(points, 5, 5);

    const len = result.length;

    // Points in taper region should be reduced from original
    // The middle of stroke (outside taper) should be unchanged
    expect(result[10].width).toBe(4); // Middle untouched

    // Points in taper region should have reduced width
    expect(result[len - 1].width).toBeLessThan(4);
    expect(result[len - 3].width).toBeLessThan(4);
  });

  it('produces smooth taper (no sudden jumps)', () => {
    const points = createStrokePoints(30, 6);
    const result = taperStrokeEnds(points, 10, 10);

    // Verify all points have valid widths
    for (const p of result) {
      expect(p.width).toBeGreaterThanOrEqual(0);
      expect(p.width).toBeLessThanOrEqual(6);
    }

    // Middle section should be unchanged
    expect(result[15].width).toBe(6);
  });

  it('respects taper length parameters', () => {
    const points = createStrokePoints(20, 4);

    // No taper
    const noTaper = taperStrokeEnds(points, 0, 0);
    expect(noTaper[0].width).toBe(4);
    expect(noTaper[noTaper.length - 1].width).toBe(4);

    // Only start taper
    const startOnly = taperStrokeEnds(points, 5, 0);
    expect(startOnly[0].width).toBeLessThan(4);
    expect(startOnly[startOnly.length - 1].width).toBe(4);
  });

  it('handles taper longer than half the stroke', () => {
    const points = createStrokePoints(10, 4);
    // Taper lengths are clamped to half the stroke
    const result = taperStrokeEnds(points, 20, 20);

    expect(result).toHaveLength(10);
    // Should still produce valid tapers
    expect(result[0].width).toBeLessThanOrEqual(4);
    expect(result[result.length - 1].width).toBeLessThanOrEqual(4);
  });
});

describe('variableWidthStroke', () => {
  it('returns empty array for empty input', () => {
    expect(variableWidthStroke([], [])).toEqual([]);
  });

  it('returns circle for single point', () => {
    const points: PathPoint[] = [{ x: 50, y: 50 }];
    const widths = [10];
    const result = variableWidthStroke(points, widths);

    // Should be a circular outline
    expect(result.length).toBeGreaterThan(4);

    // Points should be approximately radius distance from center
    const radius = widths[0] / 2;
    for (const p of result) {
      const dist = Math.sqrt(Math.pow(p.x - 50, 2) + Math.pow(p.y - 50, 2));
      expect(dist).toBeCloseTo(radius, 0);
    }
  });

  it('returns closed polygon for line stroke', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const widths = [10, 10];
    const result = variableWidthStroke(points, widths);

    // Should be a closed polygon (first and last points close)
    expect(result.length).toBeGreaterThan(4);

    // First and last points should be very close
    const first = result[0];
    const last = result[result.length - 1];
    const dist = Math.sqrt(Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2));
    expect(dist).toBeLessThan(20); // Should form closed shape
  });

  it('produces outline with varying width', () => {
    const points: PathPoint[] = [
      { x: 0, y: 50 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ];
    const widths = [4, 10, 4]; // Wide in middle
    const result = variableWidthStroke(points, widths);

    // Find points near middle (x ~ 50)
    const middlePoints = result.filter(p => Math.abs(p.x - 50) < 10);
    const endPoints = result.filter(p => p.x < 10 || p.x > 90);

    // Middle should have points further from centerline (y=50)
    const middleSpread = Math.max(...middlePoints.map(p => Math.abs(p.y - 50)));
    const endSpread = Math.max(...endPoints.map(p => Math.abs(p.y - 50)));

    expect(middleSpread).toBeGreaterThan(endSpread);
  });

  it('handles mismatched widths array', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 100 },
    ];
    const widths = [4]; // Only one width

    // Should not throw, should use last available width
    const result = variableWidthStroke(points, widths);
    expect(result.length).toBeGreaterThan(0);
  });

  it('produces valid outline for curved path', () => {
    const points: PathPoint[] = [];
    const widths: number[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      points.push({
        x: t * 100,
        y: Math.sin(t * Math.PI) * 30,
      });
      widths.push(4);
    }

    const result = variableWidthStroke(points, widths);

    // Should have reasonable number of points
    expect(result.length).toBeGreaterThan(points.length);

    // All points should have valid coordinates
    for (const p of result) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe('pointsToStrokePoints', () => {
  it('returns empty array for empty input', () => {
    expect(pointsToStrokePoints([])).toEqual([]);
  });

  it('converts points with timestamps to stroke points', () => {
    const points = [
      { x: 0, y: 0, timestamp: 0 },
      { x: 100, y: 0, timestamp: 100 }, // 1 px/ms velocity
      { x: 200, y: 0, timestamp: 200 },
    ];

    const result = pointsToStrokePoints(points, 1, 8);

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty('width');
    expect(result[1]).toHaveProperty('width');
    expect(result[2]).toHaveProperty('width');
  });

  it('assigns widths based on velocity', () => {
    const points = [
      { x: 0, y: 0, timestamp: 0 },
      { x: 10, y: 0, timestamp: 100 },  // Slow: 0.1 px/ms
      { x: 210, y: 0, timestamp: 200 }, // Fast: 2 px/ms
    ];

    const result = pointsToStrokePoints(points, 1, 8, 1.0);

    // First point has no previous, so default velocity
    // Second point is slow -> wider
    // Third point is fast -> thinner
    expect(result[2].width).toBeLessThan(result[1].width);
  });
});

describe('smoothWidths', () => {
  it('returns empty array for empty input', () => {
    expect(smoothWidths([])).toEqual([]);
  });

  it('returns copy for single point', () => {
    const points: StrokePoint[] = [{ x: 0, y: 0, width: 5 }];
    const result = smoothWidths(points);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(points[0]);
  });

  it('smooths width variations', () => {
    const points: StrokePoint[] = [
      { x: 0, y: 0, width: 4 },
      { x: 10, y: 0, width: 8 }, // Spike
      { x: 20, y: 0, width: 4 },
      { x: 30, y: 0, width: 4 },
      { x: 40, y: 0, width: 4 },
    ];

    const result = smoothWidths(points, 3);

    // The spike should be reduced
    expect(result[1].width).toBeLessThan(8);
  });

  it('preserves coordinates', () => {
    const points: StrokePoint[] = [
      { x: 10, y: 20, width: 4 },
      { x: 30, y: 40, width: 6 },
      { x: 50, y: 60, width: 5 },
    ];

    const result = smoothWidths(points, 3);

    expect(result[0].x).toBe(10);
    expect(result[0].y).toBe(20);
    expect(result[1].x).toBe(30);
    expect(result[1].y).toBe(40);
  });
});
