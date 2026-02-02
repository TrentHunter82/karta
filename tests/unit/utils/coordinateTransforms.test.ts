/**
 * Tests for coordinate transform functions.
 * These functions convert between screen coordinates (pixels on screen)
 * and canvas coordinates (position in the infinite canvas space).
 *
 * Formulas from Canvas.tsx:
 * - canvasToScreen(x, y) = { x: (x + viewport.x) * viewport.zoom, y: (y + viewport.y) * viewport.zoom }
 * - screenToCanvas(x, y) = { x: x / viewport.zoom - viewport.x, y: y / viewport.zoom - viewport.y }
 */

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// Pure function implementations matching Canvas.tsx
const canvasToScreen = (x: number, y: number, viewport: Viewport) => ({
  x: (x + viewport.x) * viewport.zoom,
  y: (y + viewport.y) * viewport.zoom,
});

const screenToCanvas = (x: number, y: number, viewport: Viewport) => ({
  x: x / viewport.zoom - viewport.x,
  y: y / viewport.zoom - viewport.y,
});

describe('screenToCanvas', () => {
  describe('with various zoom levels', () => {
    it('converts correctly at zoom 0.1 (zoomed out)', () => {
      const viewport = { x: 0, y: 0, zoom: 0.1 };
      // Screen point 100,100 at 0.1 zoom should be 1000,1000 in canvas space
      const result = screenToCanvas(100, 100, viewport);
      expect(result.x).toBeCloseTo(1000, 5);
      expect(result.y).toBeCloseTo(1000, 5);
    });

    it('converts correctly at zoom 1.0 (no zoom)', () => {
      const viewport = { x: 0, y: 0, zoom: 1.0 };
      const result = screenToCanvas(100, 100, viewport);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('converts correctly at zoom 5.0 (zoomed in)', () => {
      const viewport = { x: 0, y: 0, zoom: 5.0 };
      // Screen point 100,100 at 5.0 zoom should be 20,20 in canvas space
      const result = screenToCanvas(100, 100, viewport);
      expect(result.x).toBeCloseTo(20, 5);
      expect(result.y).toBeCloseTo(20, 5);
    });

    it('handles very small zoom (0.01)', () => {
      const viewport = { x: 0, y: 0, zoom: 0.01 };
      const result = screenToCanvas(100, 100, viewport);
      expect(result.x).toBeCloseTo(10000, 5);
      expect(result.y).toBeCloseTo(10000, 5);
    });

    it('handles very large zoom (10.0)', () => {
      const viewport = { x: 0, y: 0, zoom: 10.0 };
      const result = screenToCanvas(100, 100, viewport);
      expect(result.x).toBeCloseTo(10, 5);
      expect(result.y).toBeCloseTo(10, 5);
    });
  });

  describe('with pan offsets', () => {
    it('accounts for positive pan offset', () => {
      const viewport = { x: 100, y: 200, zoom: 1.0 };
      const result = screenToCanvas(100, 100, viewport);
      // x / 1.0 - 100 = 0, y / 1.0 - 200 = -100
      expect(result.x).toBe(0);
      expect(result.y).toBe(-100);
    });

    it('accounts for negative pan offset', () => {
      const viewport = { x: -100, y: -200, zoom: 1.0 };
      const result = screenToCanvas(100, 100, viewport);
      // x / 1.0 - (-100) = 200, y / 1.0 - (-200) = 300
      expect(result.x).toBe(200);
      expect(result.y).toBe(300);
    });

    it('combines pan and zoom correctly', () => {
      const viewport = { x: 50, y: 50, zoom: 2.0 };
      // Screen 100,100 → 100/2 - 50 = 0, 100/2 - 50 = 0
      const result = screenToCanvas(100, 100, viewport);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles negative screen coordinates', () => {
      const viewport = { x: 0, y: 0, zoom: 1.0 };
      const result = screenToCanvas(-100, -200, viewport);
      expect(result.x).toBe(-100);
      expect(result.y).toBe(-200);
    });

    it('handles very large screen coordinates', () => {
      const viewport = { x: 0, y: 0, zoom: 1.0 };
      const result = screenToCanvas(1000000, 1000000, viewport);
      expect(result.x).toBe(1000000);
      expect(result.y).toBe(1000000);
    });

    it('handles origin (0,0)', () => {
      const viewport = { x: 0, y: 0, zoom: 1.0 };
      const result = screenToCanvas(0, 0, viewport);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('handles origin with pan offset', () => {
      const viewport = { x: 100, y: 100, zoom: 1.0 };
      const result = screenToCanvas(0, 0, viewport);
      expect(result.x).toBe(-100);
      expect(result.y).toBe(-100);
    });

    it('returns Infinity for zero zoom', () => {
      const viewport = { x: 0, y: 0, zoom: 0 };
      const result = screenToCanvas(100, 100, viewport);
      // Division by zero gives Infinity
      expect(result.x).toBe(Infinity);
      expect(result.y).toBe(Infinity);
    });

    it('handles fractional coordinates', () => {
      const viewport = { x: 0, y: 0, zoom: 1.0 };
      const result = screenToCanvas(100.5, 200.75, viewport);
      expect(result.x).toBeCloseTo(100.5, 5);
      expect(result.y).toBeCloseTo(200.75, 5);
    });
  });
});

describe('canvasToScreen', () => {
  describe('with various zoom levels', () => {
    it('converts correctly at zoom 0.1 (zoomed out)', () => {
      const viewport = { x: 0, y: 0, zoom: 0.1 };
      // Canvas point 1000,1000 at 0.1 zoom should be 100,100 on screen
      const result = canvasToScreen(1000, 1000, viewport);
      expect(result.x).toBeCloseTo(100, 5);
      expect(result.y).toBeCloseTo(100, 5);
    });

    it('converts correctly at zoom 1.0 (no zoom)', () => {
      const viewport = { x: 0, y: 0, zoom: 1.0 };
      const result = canvasToScreen(100, 100, viewport);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('converts correctly at zoom 5.0 (zoomed in)', () => {
      const viewport = { x: 0, y: 0, zoom: 5.0 };
      // Canvas point 20,20 at 5.0 zoom should be 100,100 on screen
      const result = canvasToScreen(20, 20, viewport);
      expect(result.x).toBeCloseTo(100, 5);
      expect(result.y).toBeCloseTo(100, 5);
    });
  });

  describe('with pan offsets', () => {
    it('accounts for positive pan offset', () => {
      const viewport = { x: 100, y: 200, zoom: 1.0 };
      const result = canvasToScreen(0, 0, viewport);
      // (0 + 100) * 1.0 = 100, (0 + 200) * 1.0 = 200
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it('accounts for negative pan offset', () => {
      const viewport = { x: -100, y: -200, zoom: 1.0 };
      const result = canvasToScreen(200, 300, viewport);
      // (200 - 100) * 1.0 = 100, (300 - 200) * 1.0 = 100
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('combines pan and zoom correctly', () => {
      const viewport = { x: 50, y: 50, zoom: 2.0 };
      // (0 + 50) * 2.0 = 100, (0 + 50) * 2.0 = 100
      const result = canvasToScreen(0, 0, viewport);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('handles negative canvas coordinates', () => {
      const viewport = { x: 0, y: 0, zoom: 1.0 };
      const result = canvasToScreen(-100, -200, viewport);
      expect(result.x).toBe(-100);
      expect(result.y).toBe(-200);
    });

    it('handles very large canvas coordinates', () => {
      const viewport = { x: 0, y: 0, zoom: 1.0 };
      const result = canvasToScreen(1000000, 1000000, viewport);
      expect(result.x).toBe(1000000);
      expect(result.y).toBe(1000000);
    });

    it('handles origin (0,0)', () => {
      const viewport = { x: 0, y: 0, zoom: 1.0 };
      const result = canvasToScreen(0, 0, viewport);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('handles zero zoom', () => {
      const viewport = { x: 0, y: 0, zoom: 0 };
      const result = canvasToScreen(100, 100, viewport);
      // (100 + 0) * 0 = 0
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('handles fractional coordinates', () => {
      const viewport = { x: 0, y: 0, zoom: 1.0 };
      const result = canvasToScreen(100.5, 200.75, viewport);
      expect(result.x).toBeCloseTo(100.5, 5);
      expect(result.y).toBeCloseTo(200.75, 5);
    });
  });
});

describe('coordinate transform round-trip', () => {
  it('screenToCanvas and canvasToScreen are inverses at zoom 1.0', () => {
    const viewport = { x: 0, y: 0, zoom: 1.0 };
    const original = { x: 150, y: 250 };
    const canvas = screenToCanvas(original.x, original.y, viewport);
    const screen = canvasToScreen(canvas.x, canvas.y, viewport);
    expect(screen.x).toBeCloseTo(original.x, 5);
    expect(screen.y).toBeCloseTo(original.y, 5);
  });

  it('screenToCanvas and canvasToScreen are inverses at zoom 2.0', () => {
    const viewport = { x: 0, y: 0, zoom: 2.0 };
    const original = { x: 150, y: 250 };
    const canvas = screenToCanvas(original.x, original.y, viewport);
    const screen = canvasToScreen(canvas.x, canvas.y, viewport);
    expect(screen.x).toBeCloseTo(original.x, 5);
    expect(screen.y).toBeCloseTo(original.y, 5);
  });

  it('screenToCanvas and canvasToScreen are inverses with pan offset', () => {
    const viewport = { x: 100, y: -50, zoom: 1.5 };
    const original = { x: 300, y: 400 };
    const canvas = screenToCanvas(original.x, original.y, viewport);
    const screen = canvasToScreen(canvas.x, canvas.y, viewport);
    expect(screen.x).toBeCloseTo(original.x, 5);
    expect(screen.y).toBeCloseTo(original.y, 5);
  });

  it('canvasToScreen and screenToCanvas are inverses', () => {
    const viewport = { x: 50, y: 75, zoom: 0.5 };
    const original = { x: 200, y: 300 };
    const screen = canvasToScreen(original.x, original.y, viewport);
    const canvas = screenToCanvas(screen.x, screen.y, viewport);
    expect(canvas.x).toBeCloseTo(original.x, 5);
    expect(canvas.y).toBeCloseTo(original.y, 5);
  });
});
