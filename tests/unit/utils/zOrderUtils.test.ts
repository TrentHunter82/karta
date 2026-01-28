import type { CanvasObject, RectangleObject } from '../../../src/types/canvas';
import {
  calculateBringToFront,
  calculateBringForward,
  calculateSendBackward,
  calculateSendToBack,
} from '../../../src/utils/zOrderUtils';

const createRect = (id: string, zIndex: number): CanvasObject => ({
  id, type: 'rectangle', x: 0, y: 0, width: 100, height: 100,
  rotation: 0, opacity: 1, zIndex, fill: '#000',
} as RectangleObject);

const makeObjects = (...items: [string, number][]): Map<string, CanvasObject> => {
  const map = new Map<string, CanvasObject>();
  for (const [id, z] of items) map.set(id, createRect(id, z));
  return map;
};

describe('calculateBringToFront', () => {
  it('assigns z-indexes above the max', () => {
    const objects = makeObjects(['a', 1], ['b', 2], ['c', 3]);
    const updates = calculateBringToFront(objects, new Set(['a']));
    expect(updates).toHaveLength(1);
    expect(updates[0].changes.zIndex).toBe(4);
  });

  it('orders multiple selected sequentially', () => {
    const objects = makeObjects(['a', 1], ['b', 2], ['c', 3]);
    const updates = calculateBringToFront(objects, new Set(['a', 'b']));
    expect(updates).toHaveLength(2);
    expect(updates[0].changes.zIndex).toBe(4);
    expect(updates[1].changes.zIndex).toBe(5);
  });
});

describe('calculateBringForward', () => {
  it('swaps with the object directly above', () => {
    const objects = makeObjects(['a', 1], ['b', 2], ['c', 3]);
    const updates = calculateBringForward(objects, new Set(['a']));
    expect(updates).toHaveLength(2);
    // 'a' moves up by 1, 'b' moves down by 1
    const aUpdate = updates.find(u => u.id === 'a');
    const bUpdate = updates.find(u => u.id === 'b');
    expect(aUpdate?.changes.zIndex).toBe(2);
    expect(bUpdate?.changes.zIndex).toBe(1);
  });

  it('returns empty when already at top', () => {
    const objects = makeObjects(['a', 3], ['b', 1], ['c', 2]);
    const updates = calculateBringForward(objects, new Set(['a']));
    expect(updates).toHaveLength(0);
  });
});

describe('calculateSendBackward', () => {
  it('swaps with the object directly below', () => {
    const objects = makeObjects(['a', 1], ['b', 2], ['c', 3]);
    const updates = calculateSendBackward(objects, new Set(['c']));
    expect(updates).toHaveLength(2);
    const cUpdate = updates.find(u => u.id === 'c');
    const bUpdate = updates.find(u => u.id === 'b');
    expect(cUpdate?.changes.zIndex).toBe(2);
    expect(bUpdate?.changes.zIndex).toBe(3);
  });

  it('returns empty when already at bottom', () => {
    const objects = makeObjects(['a', 1], ['b', 2]);
    const updates = calculateSendBackward(objects, new Set(['a']));
    expect(updates).toHaveLength(0);
  });
});

describe('calculateSendToBack', () => {
  it('assigns z-indexes below the min', () => {
    const objects = makeObjects(['a', 1], ['b', 2], ['c', 3]);
    const updates = calculateSendToBack(objects, new Set(['c']));
    expect(updates).toHaveLength(1);
    expect(updates[0].changes.zIndex).toBe(0);
  });

  it('orders multiple selected sequentially below min', () => {
    const objects = makeObjects(['a', 1], ['b', 2], ['c', 3]);
    const updates = calculateSendToBack(objects, new Set(['b', 'c']));
    expect(updates).toHaveLength(2);
    expect(updates[0].changes.zIndex).toBe(-1);
    expect(updates[1].changes.zIndex).toBe(0);
  });
});
