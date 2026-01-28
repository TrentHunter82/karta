import {
  useSelectionStore,
  calculateAlignmentUpdates,
  calculateDistributionUpdates,
  type AlignmentType,
  type DistributionDirection
} from '../../../src/stores/selectionStore';
import type { CanvasObject, RectangleObject } from '../../../src/types/canvas';

const resetStore = () => {
  useSelectionStore.setState({
    selectedIds: new Set(),
  });
};

// Factory for creating test objects
const createRectangle = (id: string, overrides?: Partial<RectangleObject>): RectangleObject => ({
  id,
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  zIndex: 1,
  fill: '#4a4a4a',
  ...overrides,
});

describe('selectionStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('Initial State', () => {
    it('has empty selection', () => {
      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(0);
    });
  });

  describe('setSelection', () => {
    it('sets selected IDs', () => {
      const store = useSelectionStore.getState();

      store.setSelection(['rect-1', 'rect-2']);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(2);
      expect(selectedIds.has('rect-1')).toBe(true);
      expect(selectedIds.has('rect-2')).toBe(true);
    });

    it('clears previous selection', () => {
      const store = useSelectionStore.getState();
      store.setSelection(['rect-1']);

      store.setSelection(['rect-2']);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.has('rect-1')).toBe(false);
      expect(selectedIds.has('rect-2')).toBe(true);
    });

    it('allows empty selection', () => {
      const store = useSelectionStore.getState();
      store.setSelection(['rect-1', 'rect-2']);

      store.setSelection([]);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(0);
    });
  });

  describe('clearSelection', () => {
    it('clears all selected IDs', () => {
      const store = useSelectionStore.getState();
      store.setSelection(['rect-1', 'rect-2', 'rect-3']);

      store.clearSelection();

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(0);
    });

    it('does nothing when already empty', () => {
      const store = useSelectionStore.getState();

      store.clearSelection();

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(0);
    });
  });

  describe('addToSelection', () => {
    it('adds IDs to existing selection', () => {
      const store = useSelectionStore.getState();
      store.setSelection(['rect-1']);

      store.addToSelection(['rect-2', 'rect-3']);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(3);
      expect(selectedIds.has('rect-1')).toBe(true);
      expect(selectedIds.has('rect-2')).toBe(true);
      expect(selectedIds.has('rect-3')).toBe(true);
    });

    it('does not duplicate existing IDs', () => {
      const store = useSelectionStore.getState();
      store.setSelection(['rect-1', 'rect-2']);

      store.addToSelection(['rect-2', 'rect-3']);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(3);
    });

    it('adds to empty selection', () => {
      const store = useSelectionStore.getState();

      store.addToSelection(['rect-1']);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(1);
      expect(selectedIds.has('rect-1')).toBe(true);
    });
  });

  describe('removeFromSelection', () => {
    it('removes IDs from selection', () => {
      const store = useSelectionStore.getState();
      store.setSelection(['rect-1', 'rect-2', 'rect-3']);

      store.removeFromSelection(['rect-1', 'rect-2']);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(1);
      expect(selectedIds.has('rect-3')).toBe(true);
    });

    it('ignores IDs not in selection', () => {
      const store = useSelectionStore.getState();
      store.setSelection(['rect-1']);

      store.removeFromSelection(['rect-2', 'rect-3']);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(1);
      expect(selectedIds.has('rect-1')).toBe(true);
    });

    it('can remove all items', () => {
      const store = useSelectionStore.getState();
      store.setSelection(['rect-1', 'rect-2']);

      store.removeFromSelection(['rect-1', 'rect-2']);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(0);
    });
  });

  describe('toggleSelection', () => {
    it('adds ID if not selected', () => {
      const store = useSelectionStore.getState();

      store.toggleSelection('rect-1');

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.has('rect-1')).toBe(true);
    });

    it('removes ID if already selected', () => {
      const store = useSelectionStore.getState();
      store.setSelection(['rect-1']);

      store.toggleSelection('rect-1');

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.has('rect-1')).toBe(false);
    });

    it('toggles individual ID without affecting others', () => {
      const store = useSelectionStore.getState();
      store.setSelection(['rect-1', 'rect-2']);

      store.toggleSelection('rect-1');

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.has('rect-1')).toBe(false);
      expect(selectedIds.has('rect-2')).toBe(true);
    });
  });
});

describe('calculateAlignmentUpdates', () => {
  const createObjects = (): CanvasObject[] => [
    createRectangle('rect-1', { x: 0, y: 0, width: 50, height: 50 }),
    createRectangle('rect-2', { x: 100, y: 100, width: 50, height: 50 }),
    createRectangle('rect-3', { x: 200, y: 200, width: 50, height: 50 }),
  ];

  it('returns empty array when less than 2 objects', () => {
    const singleObject = [createRectangle('rect-1')];

    const updates = calculateAlignmentUpdates(singleObject, 'left');

    expect(updates).toEqual([]);
  });

  it('aligns objects to left', () => {
    const objects = createObjects();

    const updates = calculateAlignmentUpdates(objects, 'left');

    expect(updates).toHaveLength(3);
    expect(updates.find(u => u.id === 'rect-1')?.changes.x).toBe(0);
    expect(updates.find(u => u.id === 'rect-2')?.changes.x).toBe(0);
    expect(updates.find(u => u.id === 'rect-3')?.changes.x).toBe(0);
  });

  it('aligns objects to right', () => {
    const objects = createObjects();

    const updates = calculateAlignmentUpdates(objects, 'right');

    expect(updates).toHaveLength(3);
    // All should align to rightmost edge (200 + 50 = 250)
    expect(updates.find(u => u.id === 'rect-1')?.changes.x).toBe(200);
    expect(updates.find(u => u.id === 'rect-2')?.changes.x).toBe(200);
    expect(updates.find(u => u.id === 'rect-3')?.changes.x).toBe(200);
  });

  it('aligns objects to top', () => {
    const objects = createObjects();

    const updates = calculateAlignmentUpdates(objects, 'top');

    expect(updates).toHaveLength(3);
    expect(updates.find(u => u.id === 'rect-1')?.changes.y).toBe(0);
    expect(updates.find(u => u.id === 'rect-2')?.changes.y).toBe(0);
    expect(updates.find(u => u.id === 'rect-3')?.changes.y).toBe(0);
  });

  it('aligns objects to bottom', () => {
    const objects = createObjects();

    const updates = calculateAlignmentUpdates(objects, 'bottom');

    expect(updates).toHaveLength(3);
    // All should align to bottommost edge (200 + 50 = 250)
    expect(updates.find(u => u.id === 'rect-1')?.changes.y).toBe(200);
    expect(updates.find(u => u.id === 'rect-2')?.changes.y).toBe(200);
    expect(updates.find(u => u.id === 'rect-3')?.changes.y).toBe(200);
  });

  it('aligns objects to horizontal center', () => {
    const objects = createObjects();

    const updates = calculateAlignmentUpdates(objects, 'centerH');

    expect(updates).toHaveLength(3);
    // All should move to the average horizontal center
    const avgCenter = (25 + 125 + 225) / 3; // 125
    expect(updates.find(u => u.id === 'rect-1')?.changes.x).toBeCloseTo(avgCenter - 25, 1);
    expect(updates.find(u => u.id === 'rect-2')?.changes.x).toBeCloseTo(avgCenter - 25, 1);
    expect(updates.find(u => u.id === 'rect-3')?.changes.x).toBeCloseTo(avgCenter - 25, 1);
  });

  it('aligns objects to vertical center', () => {
    const objects = createObjects();

    const updates = calculateAlignmentUpdates(objects, 'centerV');

    expect(updates).toHaveLength(3);
    // All should move to the average vertical center
    const avgCenter = (25 + 125 + 225) / 3; // 125
    expect(updates.find(u => u.id === 'rect-1')?.changes.y).toBeCloseTo(avgCenter - 25, 1);
    expect(updates.find(u => u.id === 'rect-2')?.changes.y).toBeCloseTo(avgCenter - 25, 1);
    expect(updates.find(u => u.id === 'rect-3')?.changes.y).toBeCloseTo(avgCenter - 25, 1);
  });

  it('handles rotated objects correctly', () => {
    const objects = [
      createRectangle('rect-1', { x: 0, y: 0, width: 100, height: 50, rotation: 45 }),
      createRectangle('rect-2', { x: 200, y: 200, width: 100, height: 50, rotation: 0 }),
    ];

    const updates = calculateAlignmentUpdates(objects, 'left');

    expect(updates).toHaveLength(2);
    // Should align based on rotated bounding boxes
  });
});

describe('calculateDistributionUpdates', () => {
  const createObjects = (): CanvasObject[] => [
    createRectangle('rect-1', { x: 0, y: 0, width: 50, height: 50 }),
    createRectangle('rect-2', { x: 50, y: 50, width: 50, height: 50 }),
    createRectangle('rect-3', { x: 200, y: 200, width: 50, height: 50 }),
  ];

  it('returns empty array when less than 3 objects', () => {
    const twoObjects = [
      createRectangle('rect-1'),
      createRectangle('rect-2'),
    ];

    const updates = calculateDistributionUpdates(twoObjects, 'horizontal');

    expect(updates).toEqual([]);
  });

  it('distributes objects horizontally with even spacing', () => {
    const objects = createObjects();

    const updates = calculateDistributionUpdates(objects, 'horizontal');

    expect(updates).toHaveLength(3);

    // Get the x positions from updates
    const positions = updates.map(u => u.changes.x as number).sort((a, b) => a - b);

    // Gaps between objects should be equal
    const gap1 = positions[1] - positions[0];
    const gap2 = positions[2] - positions[1];
    expect(gap1).toBeCloseTo(gap2, 1);
  });

  it('distributes objects vertically with even spacing', () => {
    const objects = createObjects();

    const updates = calculateDistributionUpdates(objects, 'vertical');

    expect(updates).toHaveLength(3);

    // Get the y positions from updates
    const positions = updates.map(u => u.changes.y as number).sort((a, b) => a - b);

    // Gaps between objects should be equal
    const gap1 = positions[1] - positions[0];
    const gap2 = positions[2] - positions[1];
    expect(gap1).toBeCloseTo(gap2, 1);
  });

  it('maintains first and last object positions when distributing horizontally', () => {
    const objects = [
      createRectangle('rect-1', { x: 0, y: 0, width: 50, height: 50 }),
      createRectangle('rect-2', { x: 100, y: 0, width: 50, height: 50 }),
      createRectangle('rect-3', { x: 300, y: 0, width: 50, height: 50 }),
    ];

    const updates = calculateDistributionUpdates(objects, 'horizontal');

    // First object (x=0) should stay at x=0
    const firstUpdate = updates.find(u => u.id === 'rect-1');
    expect(firstUpdate?.changes.x).toBe(0);

    // Last object (x=300) should stay at x=300
    const lastUpdate = updates.find(u => u.id === 'rect-3');
    expect(lastUpdate?.changes.x).toBe(300);
  });

  it('handles objects of different sizes', () => {
    const objects = [
      createRectangle('rect-1', { x: 0, y: 0, width: 50, height: 50 }),
      createRectangle('rect-2', { x: 100, y: 0, width: 100, height: 100 }),
      createRectangle('rect-3', { x: 300, y: 0, width: 30, height: 30 }),
    ];

    const updates = calculateDistributionUpdates(objects, 'horizontal');

    expect(updates).toHaveLength(3);
    // Should still produce valid distribution
  });
});
