import type { CanvasObject, RectangleObject } from '../../../src/types/canvas';
import type { GridSettings } from '../../../src/stores/canvasStore';
import { snapValueToGrid, computeSnappedPosition } from '../../../src/utils/snapUtils';

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
