import type { CanvasObject, RectangleObject, LineObject, ArrowObject } from '../../../src/types/canvas';
import type { GridSettings } from '../../../src/stores/canvasStore';
import {
  snapValueToGrid,
  computeSnappedPosition,
  computeArrowEndpointSnap,
  getArrowSnapPoints,
} from '../../../src/utils/snapUtils';

const createRect = (id: string, x: number, y: number, w = 100, h = 100): CanvasObject => ({
  id, type: 'rectangle', x, y, width: w, height: h,
  rotation: 0, opacity: 1, zIndex: 1, fill: '#000',
} as RectangleObject);

const defaultGrid: GridSettings = { visible: false, size: 20, snapEnabled: false, snapToObjects: false };
const gridSnap: GridSettings = { ...defaultGrid, snapEnabled: true };
const objSnap: GridSettings = { ...defaultGrid, snapToObjects: true };
const bothSnap: GridSettings = { ...defaultGrid, snapEnabled: true, snapToObjects: true };

describe('snapValueToGrid', () => {
  it('snaps to nearest grid line', () => {
    expect(snapValueToGrid(23, 20)).toBe(20);
    expect(snapValueToGrid(30, 20)).toBe(40);
    expect(snapValueToGrid(10, 20)).toBe(20);
  });

  it('snaps exact values unchanged', () => {
    expect(snapValueToGrid(40, 20)).toBe(40);
    expect(snapValueToGrid(0, 20)).toBe(0);
  });
});

describe('computeSnappedPosition', () => {
  const empty = new Map<string, CanvasObject>();
  const noSelection = new Set<string>();

  it('returns original position when snap disabled', () => {
    const result = computeSnappedPosition(33, 47, defaultGrid, empty, noSelection);
    expect(result).toEqual({ x: 33, y: 47, guides: [] });
  });

  it('returns original position when skipSnap is true', () => {
    const result = computeSnappedPosition(33, 47, bothSnap, empty, noSelection, true);
    expect(result).toEqual({ x: 33, y: 47, guides: [] });
  });

  it('snaps to grid when grid snap enabled', () => {
    const result = computeSnappedPosition(33, 47, gridSnap, empty, noSelection);
    expect(result.x).toBe(40);
    expect(result.y).toBe(40);
    expect(result.guides).toHaveLength(0);
  });

  it('snaps to object left edge', () => {
    const objects = new Map([['r1', createRect('r1', 100, 200)]]);
    // x=103 is within 8px of objLeft=100
    const result = computeSnappedPosition(103, 50, objSnap, objects, noSelection);
    expect(result.x).toBe(100);
    expect(result.guides).toHaveLength(1);
    expect(result.guides[0].type).toBe('vertical');
    expect(result.guides[0].position).toBe(100);
  });

  it('snaps to object center', () => {
    const objects = new Map([['r1', createRect('r1', 100, 200)]]);
    // center = 100 + 50 = 150; x=147 is within 8px
    const result = computeSnappedPosition(147, 50, objSnap, objects, noSelection);
    expect(result.x).toBe(150);
  });

  it('snaps to object right edge', () => {
    const objects = new Map([['r1', createRect('r1', 100, 200)]]);
    // right = 100 + 100 = 200; x=197 is within 8px
    const result = computeSnappedPosition(197, 50, objSnap, objects, noSelection);
    expect(result.x).toBe(200);
  });

  it('snaps to object top edge', () => {
    const objects = new Map([['r1', createRect('r1', 100, 200)]]);
    // y=203 is within 8px of objTop=200
    const result = computeSnappedPosition(50, 203, objSnap, objects, noSelection);
    expect(result.y).toBe(200);
  });

  it('excludes selected objects from snap targets', () => {
    const objects = new Map([['r1', createRect('r1', 100, 200)]]);
    const selected = new Set(['r1']);
    const result = computeSnappedPosition(103, 50, objSnap, objects, selected);
    // Should NOT snap because r1 is selected
    expect(result.x).toBe(103);
  });

  it('excludes hidden objects from snap targets', () => {
    const hidden = { ...createRect('r1', 100, 200), visible: false } as CanvasObject;
    const objects = new Map([['r1', hidden]]);
    const result = computeSnappedPosition(103, 50, objSnap, objects, noSelection);
    expect(result.x).toBe(103);
  });

  it('excludes child objects from snap targets', () => {
    const child = { ...createRect('r1', 100, 200), parentId: 'group-1' } as CanvasObject;
    const objects = new Map([['r1', child]]);
    const result = computeSnappedPosition(103, 50, objSnap, objects, noSelection);
    expect(result.x).toBe(103);
  });
});

describe('computeArrowEndpointSnap', () => {
  const noExclude = new Set<string>();

  const createLine = (id: string, x: number, y: number): CanvasObject => ({
    id, type: 'line', x, y, width: 100, height: 100,
    rotation: 0, opacity: 1, zIndex: 1, stroke: '#fff', strokeWidth: 2,
    x1: 0, y1: 0, x2: 100, y2: 100,
  } as LineObject);

  const createArrow = (id: string, x: number, y: number): CanvasObject => ({
    id, type: 'arrow', x, y, width: 100, height: 100,
    rotation: 0, opacity: 1, zIndex: 1, stroke: '#fff', strokeWidth: 2,
    x1: 0, y1: 0, x2: 100, y2: 100,
    arrowStart: false, arrowEnd: true, arrowSize: 1,
  } as ArrowObject);

  it('returns original position when no objects nearby', () => {
    const objects = new Map([['r1', createRect('r1', 500, 500)]]);
    const result = computeArrowEndpointSnap(50, 50, objects, noExclude);
    expect(result.snapped).toBe(false);
    expect(result.x).toBe(50);
    expect(result.y).toBe(50);
  });

  it('snaps to object center', () => {
    const objects = new Map([['r1', createRect('r1', 100, 100)]]);
    // Center of rect is at (150, 150)
    const result = computeArrowEndpointSnap(148, 152, objects, noExclude);
    expect(result.snapped).toBe(true);
    expect(result.x).toBe(150);
    expect(result.y).toBe(150);
    expect(result.snapType).toBe('center');
    expect(result.targetObjectId).toBe('r1');
  });

  it('snaps to object left edge midpoint', () => {
    const objects = new Map([['r1', createRect('r1', 100, 100)]]);
    // Left edge midpoint is at (100, 150)
    const result = computeArrowEndpointSnap(102, 148, objects, noExclude);
    expect(result.snapped).toBe(true);
    expect(result.x).toBe(100);
    expect(result.y).toBe(150);
    expect(result.snapType).toBe('left');
  });

  it('snaps to object right edge midpoint', () => {
    const objects = new Map([['r1', createRect('r1', 100, 100)]]);
    // Right edge midpoint is at (200, 150)
    const result = computeArrowEndpointSnap(198, 152, objects, noExclude);
    expect(result.snapped).toBe(true);
    expect(result.x).toBe(200);
    expect(result.y).toBe(150);
    expect(result.snapType).toBe('right');
  });

  it('snaps to object top edge midpoint', () => {
    const objects = new Map([['r1', createRect('r1', 100, 100)]]);
    // Top edge midpoint is at (150, 100)
    const result = computeArrowEndpointSnap(148, 102, objects, noExclude);
    expect(result.snapped).toBe(true);
    expect(result.x).toBe(150);
    expect(result.y).toBe(100);
    expect(result.snapType).toBe('top');
  });

  it('snaps to object bottom edge midpoint', () => {
    const objects = new Map([['r1', createRect('r1', 100, 100)]]);
    // Bottom edge midpoint is at (150, 200)
    const result = computeArrowEndpointSnap(152, 198, objects, noExclude);
    expect(result.snapped).toBe(true);
    expect(result.x).toBe(150);
    expect(result.y).toBe(200);
    expect(result.snapType).toBe('bottom');
  });

  it('chooses closest snap point', () => {
    const objects = new Map([['r1', createRect('r1', 100, 100)]]);
    // Point at (102, 152) - closer to left edge (100, 150) than center (150, 150)
    const result = computeArrowEndpointSnap(102, 152, objects, noExclude);
    expect(result.snapType).toBe('left');
  });

  it('excludes specified object IDs', () => {
    const objects = new Map([['r1', createRect('r1', 100, 100)]]);
    const exclude = new Set(['r1']);
    const result = computeArrowEndpointSnap(150, 150, objects, exclude);
    expect(result.snapped).toBe(false);
  });

  it('excludes hidden objects', () => {
    const hidden = { ...createRect('r1', 100, 100), visible: false } as CanvasObject;
    const objects = new Map([['r1', hidden]]);
    const result = computeArrowEndpointSnap(150, 150, objects, noExclude);
    expect(result.snapped).toBe(false);
  });

  it('excludes child objects (in groups)', () => {
    const child = { ...createRect('r1', 100, 100), parentId: 'group-1' } as CanvasObject;
    const objects = new Map([['r1', child]]);
    const result = computeArrowEndpointSnap(150, 150, objects, noExclude);
    expect(result.snapped).toBe(false);
  });

  it('does NOT snap to line objects', () => {
    const objects = new Map([['l1', createLine('l1', 100, 100)]]);
    const result = computeArrowEndpointSnap(150, 150, objects, noExclude);
    expect(result.snapped).toBe(false);
  });

  it('does NOT snap to arrow objects', () => {
    const objects = new Map([['a1', createArrow('a1', 100, 100)]]);
    const result = computeArrowEndpointSnap(150, 150, objects, noExclude);
    expect(result.snapped).toBe(false);
  });

  it('snaps to closest object when multiple are near', () => {
    const objects = new Map([
      ['r1', createRect('r1', 100, 100)],
      ['r2', createRect('r2', 250, 100)],
    ]);
    // Point at (160, 150) - closer to r1 center (150, 150) than r2 left edge (250, 150)
    const result = computeArrowEndpointSnap(160, 150, objects, noExclude);
    expect(result.targetObjectId).toBe('r1');
  });
});

describe('getArrowSnapPoints', () => {
  const noExclude = new Set<string>();

  it('returns 5 snap points per rectangle (center + 4 edges)', () => {
    const objects = new Map([['r1', createRect('r1', 100, 100)]]);
    const points = getArrowSnapPoints(objects, noExclude);
    expect(points).toHaveLength(5);
  });

  it('returns snap points with correct types', () => {
    const objects = new Map([['r1', createRect('r1', 100, 100)]]);
    const points = getArrowSnapPoints(objects, noExclude);
    const types = points.map(p => p.type);
    expect(types).toContain('center');
    expect(types).toContain('left');
    expect(types).toContain('right');
    expect(types).toContain('top');
    expect(types).toContain('bottom');
  });

  it('returns correct coordinates for snap points', () => {
    const objects = new Map([['r1', createRect('r1', 100, 100, 100, 100)]]);
    const points = getArrowSnapPoints(objects, noExclude);

    const center = points.find(p => p.type === 'center');
    expect(center).toEqual({ x: 150, y: 150, type: 'center', objectId: 'r1' });

    const left = points.find(p => p.type === 'left');
    expect(left).toEqual({ x: 100, y: 150, type: 'left', objectId: 'r1' });

    const right = points.find(p => p.type === 'right');
    expect(right).toEqual({ x: 200, y: 150, type: 'right', objectId: 'r1' });

    const top = points.find(p => p.type === 'top');
    expect(top).toEqual({ x: 150, y: 100, type: 'top', objectId: 'r1' });

    const bottom = points.find(p => p.type === 'bottom');
    expect(bottom).toEqual({ x: 150, y: 200, type: 'bottom', objectId: 'r1' });
  });

  it('returns points from multiple objects', () => {
    const objects = new Map([
      ['r1', createRect('r1', 100, 100)],
      ['r2', createRect('r2', 300, 100)],
    ]);
    const points = getArrowSnapPoints(objects, noExclude);
    expect(points).toHaveLength(10); // 5 per object
  });

  it('filters points by nearPoint when provided', () => {
    const objects = new Map([
      ['r1', createRect('r1', 100, 100)],
      ['r2', createRect('r2', 500, 500)], // Far away
    ]);
    // Only get points near r1's center
    const points = getArrowSnapPoints(objects, noExclude, { x: 150, y: 150 }, 100);
    // Should only include r1's points
    expect(points.every(p => p.objectId === 'r1')).toBe(true);
  });

  it('excludes specified object IDs', () => {
    const objects = new Map([
      ['r1', createRect('r1', 100, 100)],
      ['r2', createRect('r2', 300, 100)],
    ]);
    const exclude = new Set(['r1']);
    const points = getArrowSnapPoints(objects, exclude);
    expect(points).toHaveLength(5); // Only r2's points
    expect(points.every(p => p.objectId === 'r2')).toBe(true);
  });

  it('excludes hidden objects', () => {
    const hidden = { ...createRect('r1', 100, 100), visible: false } as CanvasObject;
    const objects = new Map([['r1', hidden]]);
    const points = getArrowSnapPoints(objects, noExclude);
    expect(points).toHaveLength(0);
  });

  it('excludes objects with invalid dimensions', () => {
    const invalid = { ...createRect('r1', 100, 100), width: 0, height: 0 } as CanvasObject;
    const objects = new Map([['r1', invalid]]);
    const points = getArrowSnapPoints(objects, noExclude);
    expect(points).toHaveLength(0);
  });
});
