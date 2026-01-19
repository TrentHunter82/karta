import { describe, it, expect, beforeEach } from 'vitest';
import { QuadTree, calculateBoundingBox, type Bounds } from '../../../src/utils/quadtree';

interface TestItem extends Bounds {
  id: string;
}

const createItem = (id: string, x: number, y: number, width = 10, height = 10): TestItem => ({
  id,
  x,
  y,
  width,
  height,
});

describe('QuadTree', () => {
  let tree: QuadTree<TestItem>;

  beforeEach(() => {
    // Create a tree covering a 1000x1000 area
    tree = new QuadTree<TestItem>({ x: 0, y: 0, width: 1000, height: 1000 });
  });

  describe('insert', () => {
    it('inserts a single item', () => {
      const item = createItem('item-1', 100, 100);
      tree.insert(item);

      const results = tree.getAll();
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('item-1');
    });

    it('inserts multiple items', () => {
      tree.insert(createItem('item-1', 100, 100));
      tree.insert(createItem('item-2', 200, 200));
      tree.insert(createItem('item-3', 300, 300));

      const results = tree.getAll();
      expect(results).toHaveLength(3);
    });

    it('handles items at the edge of bounds', () => {
      tree.insert(createItem('corner-tl', 0, 0));
      tree.insert(createItem('corner-br', 990, 990));

      const results = tree.getAll();
      expect(results).toHaveLength(2);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // Insert items in different quadrants
      tree.insert(createItem('top-left', 100, 100, 50, 50));
      tree.insert(createItem('top-right', 700, 100, 50, 50));
      tree.insert(createItem('bottom-left', 100, 700, 50, 50));
      tree.insert(createItem('bottom-right', 700, 700, 50, 50));
      tree.insert(createItem('center', 475, 475, 50, 50));
    });

    it('finds items that intersect the query bounds', () => {
      // Query the top-left area
      const results = tree.query({ x: 0, y: 0, width: 200, height: 200 });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('top-left');
    });

    it('finds multiple items in query bounds', () => {
      // Query that covers top-left and center
      const results = tree.query({ x: 50, y: 50, width: 500, height: 500 });

      expect(results.length).toBeGreaterThanOrEqual(2);
      const ids = results.map(r => r.id);
      expect(ids).toContain('top-left');
      expect(ids).toContain('center');
    });

    it('returns empty array when no items intersect', () => {
      // Query an empty area
      const results = tree.query({ x: 400, y: 200, width: 50, height: 50 });

      expect(results).toHaveLength(0);
    });

    it('finds all items with full-bounds query', () => {
      const results = tree.query({ x: 0, y: 0, width: 1000, height: 1000 });

      expect(results).toHaveLength(5);
    });
  });

  describe('queryPoint', () => {
    beforeEach(() => {
      tree.insert(createItem('rect-1', 100, 100, 50, 50));
    });

    it('finds item at point inside', () => {
      const results = tree.queryPoint(125, 125);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('rect-1');
    });

    it('returns empty for point outside all items', () => {
      const results = tree.queryPoint(500, 500);

      expect(results).toHaveLength(0);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      tree.insert(createItem('item-1', 100, 100));
      tree.insert(createItem('item-2', 200, 200));
      tree.insert(createItem('item-3', 300, 300));
    });

    it('removes item by id', () => {
      const removed = tree.remove('item-2');

      expect(removed).toBe(true);
      expect(tree.getAll()).toHaveLength(2);
      expect(tree.getAll().map(i => i.id)).not.toContain('item-2');
    });

    it('returns false for non-existent id', () => {
      const removed = tree.remove('non-existent');

      expect(removed).toBe(false);
      expect(tree.getAll()).toHaveLength(3);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      tree.insert(createItem('item-1', 100, 100, 50, 50));
    });

    it('updates item position', () => {
      const updatedItem = createItem('item-1', 500, 500, 50, 50);
      tree.update(updatedItem);

      // Should not find at old position
      const oldResults = tree.query({ x: 50, y: 50, width: 100, height: 100 });
      expect(oldResults.find(i => i.id === 'item-1')).toBeUndefined();

      // Should find at new position
      const newResults = tree.query({ x: 450, y: 450, width: 100, height: 100 });
      expect(newResults.find(i => i.id === 'item-1')).toBeDefined();
    });
  });

  describe('clear', () => {
    it('removes all items', () => {
      tree.insert(createItem('item-1', 100, 100));
      tree.insert(createItem('item-2', 200, 200));

      tree.clear();

      expect(tree.getAll()).toHaveLength(0);
    });
  });

  describe('subdivision', () => {
    it('subdivides when maxItems exceeded', () => {
      // Default maxItems is 10, insert 15 items
      for (let i = 0; i < 15; i++) {
        tree.insert(createItem(`item-${i}`, (i % 5) * 50, Math.floor(i / 5) * 50, 10, 10));
      }

      const all = tree.getAll();
      expect(all).toHaveLength(15);
    });

    it('handles items spanning multiple quadrants', () => {
      // Large item in the center that spans all quadrants
      tree.insert(createItem('spanning', 400, 400, 200, 200));

      const results = tree.query({ x: 450, y: 450, width: 100, height: 100 });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('spanning');
    });
  });

  describe('performance with many items', () => {
    it('handles 1000 items', () => {
      // Insert 1000 items in a grid
      for (let i = 0; i < 1000; i++) {
        const x = (i % 32) * 30;
        const y = Math.floor(i / 32) * 30;
        tree.insert(createItem(`item-${i}`, x, y, 20, 20));
      }

      // Query a small area
      const startTime = performance.now();
      const results = tree.query({ x: 0, y: 0, width: 100, height: 100 });
      const endTime = performance.now();

      // Should find items quickly (spatial indexing benefit)
      expect(endTime - startTime).toBeLessThan(50); // Should be fast
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThan(1000); // Should not return all
    });
  });
});

describe('calculateBoundingBox', () => {
  it('returns zero bounds for empty array', () => {
    const result = calculateBoundingBox([]);

    expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('returns object bounds for single item', () => {
    const items = [{ x: 100, y: 200, width: 50, height: 75 }];

    const result = calculateBoundingBox(items);

    expect(result).toEqual({ x: 100, y: 200, width: 50, height: 75 });
  });

  it('calculates bounds containing all items', () => {
    const items = [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 100, y: 100, width: 50, height: 50 },
      { x: 50, y: 50, width: 50, height: 50 },
    ];

    const result = calculateBoundingBox(items);

    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.width).toBe(150); // 0 to 150
    expect(result.height).toBe(150); // 0 to 150
  });

  it('handles negative positions', () => {
    const items = [
      { x: -100, y: -100, width: 50, height: 50 },
      { x: 100, y: 100, width: 50, height: 50 },
    ];

    const result = calculateBoundingBox(items);

    expect(result.x).toBe(-100);
    expect(result.y).toBe(-100);
    expect(result.width).toBe(250); // -100 to 150
    expect(result.height).toBe(250);
  });
});
