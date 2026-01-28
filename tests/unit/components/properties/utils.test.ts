import { getSharedValue, getSharedNumber, applyToAll } from '../../../../src/components/properties/utils';
import type { CanvasObject, RectangleObject } from '../../../../src/types/canvas';

describe('getSharedValue', () => {
  const createRect = (overrides: Partial<RectangleObject> = {}): RectangleObject => ({
    id: 'rect-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    fill: '#ff0000',
    ...overrides,
  });

  it('returns mixed for empty array', () => {
    const result = getSharedValue([], (obj) => obj.x);
    expect(result).toBe('mixed');
  });

  it('returns value when all objects have same value', () => {
    const objects = [
      createRect({ x: 100 }),
      createRect({ id: 'rect-2', x: 100 }),
    ];
    const result = getSharedValue(objects, (obj) => obj.x);
    expect(result).toBe(100);
  });

  it('returns mixed when objects have different values', () => {
    const objects = [
      createRect({ x: 100 }),
      createRect({ id: 'rect-2', x: 200 }),
    ];
    const result = getSharedValue(objects, (obj) => obj.x);
    expect(result).toBe('mixed');
  });

  it('works with string values', () => {
    const objects = [
      createRect({ fill: '#ff0000' }),
      createRect({ id: 'rect-2', fill: '#ff0000' }),
    ];
    const result = getSharedValue(objects, (obj) => obj.fill);
    expect(result).toBe('#ff0000');
  });
});

describe('getSharedNumber', () => {
  const createRect = (overrides: Partial<RectangleObject> = {}): RectangleObject => ({
    id: 'rect-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    fill: '#ff0000',
    ...overrides,
  });

  it('returns rounded value', () => {
    const objects = [createRect({ x: 100.4 })];
    const result = getSharedNumber(objects, (obj) => obj.x);
    expect(result).toBe(100);
  });

  it('returns mixed when rounded values differ', () => {
    const objects = [
      createRect({ x: 100.1 }),
      createRect({ id: 'rect-2', x: 200.9 }),
    ];
    const result = getSharedNumber(objects, (obj) => obj.x);
    expect(result).toBe('mixed');
  });

  it('returns value when rounded values are same', () => {
    const objects = [
      createRect({ x: 100.1 }),
      createRect({ id: 'rect-2', x: 100.4 }),
    ];
    const result = getSharedNumber(objects, (obj) => obj.x);
    expect(result).toBe(100);
  });
});

describe('applyToAll', () => {
  const createRect = (id: string): RectangleObject => ({
    id,
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    fill: '#ff0000',
  });

  it('calls updateObject for each object', () => {
    const objects = [createRect('rect-1'), createRect('rect-2')];
    const updateObject = vi.fn();
    const pushHistory = vi.fn();

    applyToAll(objects, { x: 50 }, updateObject, pushHistory);

    expect(updateObject).toHaveBeenCalledTimes(2);
    expect(updateObject).toHaveBeenCalledWith('rect-1', { x: 50 });
    expect(updateObject).toHaveBeenCalledWith('rect-2', { x: 50 });
  });

  it('calls pushHistory before updates', () => {
    const objects = [createRect('rect-1')];
    const updateObject = vi.fn();
    const pushHistory = vi.fn();

    applyToAll(objects, { x: 50 }, updateObject, pushHistory);

    expect(pushHistory).toHaveBeenCalled();
    expect(pushHistory.mock.invocationCallOrder[0]).toBeLessThan(
      updateObject.mock.invocationCallOrder[0]
    );
  });

  it('works without pushHistory', () => {
    const objects = [createRect('rect-1')];
    const updateObject = vi.fn();

    applyToAll(objects, { x: 50 }, updateObject);

    expect(updateObject).toHaveBeenCalledWith('rect-1', { x: 50 });
  });
});
