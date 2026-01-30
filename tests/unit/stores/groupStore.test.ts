import {
  useGroupStore,
  getAbsolutePosition,
  calculateGroupData,
  calculateUngroupData,
} from '../../../src/stores/groupStore';
import type { CanvasObject, RectangleObject, GroupObject } from '../../../src/types/canvas';

const resetStore = () => {
  useGroupStore.setState({
    editingGroupId: null,
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
  visible: true,
  locked: false,
  ...overrides,
});

const createGroup = (id: string, children: string[], overrides?: Partial<GroupObject>): GroupObject => ({
  id,
  type: 'group',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  zIndex: 1,
  children,
  visible: true,
  locked: false,
  ...overrides,
});

describe('groupStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('Initial State', () => {
    it('has no group being edited', () => {
      const { editingGroupId } = useGroupStore.getState();
      expect(editingGroupId).toBeNull();
    });
  });

  describe('enterGroupEditMode', () => {
    it('sets the editing group ID', () => {
      const store = useGroupStore.getState();

      store.enterGroupEditMode('group-1');

      expect(useGroupStore.getState().editingGroupId).toBe('group-1');
    });

    it('can switch to a different group', () => {
      const store = useGroupStore.getState();
      store.enterGroupEditMode('group-1');

      store.enterGroupEditMode('group-2');

      expect(useGroupStore.getState().editingGroupId).toBe('group-2');
    });
  });

  describe('exitGroupEditMode', () => {
    it('clears the editing group ID', () => {
      const store = useGroupStore.getState();
      store.enterGroupEditMode('group-1');

      store.exitGroupEditMode();

      expect(useGroupStore.getState().editingGroupId).toBeNull();
    });

    it('does nothing when not in edit mode', () => {
      const store = useGroupStore.getState();

      store.exitGroupEditMode();

      expect(useGroupStore.getState().editingGroupId).toBeNull();
    });
  });
});

describe('getAbsolutePosition', () => {
  it('returns object position when no parent', () => {
    const obj = createRectangle('rect-1', { x: 100, y: 200 });
    const objects = new Map<string, CanvasObject>([['rect-1', obj]]);

    const pos = getAbsolutePosition(obj, objects);

    expect(pos).toEqual({ x: 100, y: 200 });
  });

  it('adds parent position to child position', () => {
    const parent = createGroup('group-1', ['rect-1'], { x: 50, y: 75 });
    const child = createRectangle('rect-1', { x: 10, y: 20, parentId: 'group-1' });
    const objects = new Map<string, CanvasObject>([
      ['group-1', parent],
      ['rect-1', child],
    ]);

    const pos = getAbsolutePosition(child, objects);

    expect(pos).toEqual({ x: 60, y: 95 }); // 50+10, 75+20
  });

  it('handles nested groups', () => {
    const grandparent = createGroup('group-1', ['group-2'], { x: 100, y: 100 });
    const parent = createGroup('group-2', ['rect-1'], { x: 50, y: 50, parentId: 'group-1' });
    const child = createRectangle('rect-1', { x: 10, y: 10, parentId: 'group-2' });
    const objects = new Map<string, CanvasObject>([
      ['group-1', grandparent],
      ['group-2', parent],
      ['rect-1', child],
    ]);

    const pos = getAbsolutePosition(child, objects);

    expect(pos).toEqual({ x: 160, y: 160 }); // 100+50+10, 100+50+10
  });

  it('returns object position when parent not found', () => {
    const obj = createRectangle('rect-1', { x: 100, y: 200, parentId: 'missing-group' });
    const objects = new Map<string, CanvasObject>([['rect-1', obj]]);

    const pos = getAbsolutePosition(obj, objects);

    expect(pos).toEqual({ x: 100, y: 200 });
  });

  it('handles cyclic parent chain without infinite recursion', () => {
    // Create a cyclic parent chain: A → B → A
    const groupA = createGroup('group-a', ['group-b'], { x: 100, y: 100, parentId: 'group-b' });
    const groupB = createGroup('group-b', ['group-a'], { x: 50, y: 50, parentId: 'group-a' });
    const objects = new Map<string, CanvasObject>([
      ['group-a', groupA],
      ['group-b', groupB],
    ]);

    // Should not throw or cause stack overflow - returns a position without infinite loop
    expect(() => {
      const pos = getAbsolutePosition(groupA, objects);
      // With cycle detection, should return some valid position
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }).not.toThrow();
  });

  it('handles self-referencing parent without infinite recursion', () => {
    // Create self-referencing parent: A → A
    const group = createGroup('group-self', ['rect-1'], { x: 100, y: 100, parentId: 'group-self' });
    const objects = new Map<string, CanvasObject>([
      ['group-self', group],
    ]);

    // Should not throw or cause stack overflow
    expect(() => {
      const pos = getAbsolutePosition(group, objects);
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
    }).not.toThrow();
  });
});

describe('calculateGroupData', () => {
  it('returns null when less than 2 objects selected', () => {
    const objects = new Map<string, CanvasObject>([
      ['rect-1', createRectangle('rect-1')],
    ]);

    const result = calculateGroupData(['rect-1'], objects, 10);

    expect(result).toBeNull();
  });

  it('returns null when selected objects not found', () => {
    const objects = new Map<string, CanvasObject>();

    const result = calculateGroupData(['rect-1', 'rect-2'], objects, 10);

    expect(result).toBeNull();
  });

  it('creates group with correct bounding box', () => {
    const objects = new Map<string, CanvasObject>([
      ['rect-1', createRectangle('rect-1', { x: 0, y: 0, width: 50, height: 50 })],
      ['rect-2', createRectangle('rect-2', { x: 100, y: 100, width: 50, height: 50 })],
    ]);

    const result = calculateGroupData(['rect-1', 'rect-2'], objects, 10);

    expect(result).not.toBeNull();
    expect(result!.group.x).toBe(0);
    expect(result!.group.y).toBe(0);
    expect(result!.group.width).toBe(150); // 0 to 150
    expect(result!.group.height).toBe(150); // 0 to 150
    expect(result!.group.zIndex).toBe(10);
    expect(result!.group.type).toBe('group');
    expect(result!.group.children).toContain('rect-1');
    expect(result!.group.children).toContain('rect-2');
  });

  it('calculates relative positions for children', () => {
    const objects = new Map<string, CanvasObject>([
      ['rect-1', createRectangle('rect-1', { x: 50, y: 50, width: 50, height: 50 })],
      ['rect-2', createRectangle('rect-2', { x: 100, y: 100, width: 50, height: 50 })],
    ]);

    const result = calculateGroupData(['rect-1', 'rect-2'], objects, 10);

    expect(result).not.toBeNull();

    // Group starts at (50, 50)
    const rect1Update = result!.childUpdates.find(u => u.id === 'rect-1');
    const rect2Update = result!.childUpdates.find(u => u.id === 'rect-2');

    // rect-1 was at (50, 50), group at (50, 50), so relative is (0, 0)
    expect(rect1Update?.changes.x).toBe(0);
    expect(rect1Update?.changes.y).toBe(0);
    expect(rect1Update?.changes.parentId).toBe(result!.group.id);

    // rect-2 was at (100, 100), group at (50, 50), so relative is (50, 50)
    expect(rect2Update?.changes.x).toBe(50);
    expect(rect2Update?.changes.y).toBe(50);
    expect(rect2Update?.changes.parentId).toBe(result!.group.id);
  });

  it('handles already-nested objects correctly', () => {
    const existingGroup = createGroup('existing-group', ['rect-1'], { x: 100, y: 100 });
    const nestedRect = createRectangle('rect-1', { x: 10, y: 10, parentId: 'existing-group' });
    const standaloneRect = createRectangle('rect-2', { x: 200, y: 200, width: 50, height: 50 });

    const objects = new Map<string, CanvasObject>([
      ['existing-group', existingGroup],
      ['rect-1', nestedRect],
      ['rect-2', standaloneRect],
    ]);

    // Group the nested rect (absolute pos 110, 110) with standalone rect (200, 200)
    const result = calculateGroupData(['rect-1', 'rect-2'], objects, 10);

    expect(result).not.toBeNull();
    // Bounding box should use absolute positions
    expect(result!.group.x).toBe(110); // min of 110 and 200
    expect(result!.group.y).toBe(110);
  });
});

describe('calculateUngroupData', () => {
  it('returns empty data when no group IDs provided', () => {
    const objects = new Map<string, CanvasObject>();

    const result = calculateUngroupData([], objects);

    expect(result.groupsToDelete).toEqual([]);
    expect(result.childUpdates).toEqual([]);
    expect(result.newSelectedIds).toEqual([]);
  });

  it('ignores non-group objects', () => {
    const objects = new Map<string, CanvasObject>([
      ['rect-1', createRectangle('rect-1')],
    ]);

    const result = calculateUngroupData(['rect-1'], objects);

    expect(result.groupsToDelete).toEqual([]);
    expect(result.childUpdates).toEqual([]);
  });

  it('ungroups and restores absolute positions', () => {
    const group = createGroup('group-1', ['rect-1', 'rect-2'], { x: 100, y: 100 });
    const rect1 = createRectangle('rect-1', { x: 10, y: 10, parentId: 'group-1' });
    const rect2 = createRectangle('rect-2', { x: 50, y: 50, parentId: 'group-1' });

    const objects = new Map<string, CanvasObject>([
      ['group-1', group],
      ['rect-1', rect1],
      ['rect-2', rect2],
    ]);

    const result = calculateUngroupData(['group-1'], objects);

    expect(result.groupsToDelete).toContain('group-1');

    const rect1Update = result.childUpdates.find(u => u.id === 'rect-1');
    const rect2Update = result.childUpdates.find(u => u.id === 'rect-2');

    // Absolute positions: group (100, 100) + child relative
    expect(rect1Update?.changes.x).toBe(110); // 100 + 10
    expect(rect1Update?.changes.y).toBe(110);
    expect(rect1Update?.changes.parentId).toBeUndefined();

    expect(rect2Update?.changes.x).toBe(150); // 100 + 50
    expect(rect2Update?.changes.y).toBe(150);
    expect(rect2Update?.changes.parentId).toBeUndefined();

    expect(result.newSelectedIds).toContain('rect-1');
    expect(result.newSelectedIds).toContain('rect-2');
  });

  it('handles multiple groups', () => {
    const group1 = createGroup('group-1', ['rect-1'], { x: 100, y: 100 });
    const group2 = createGroup('group-2', ['rect-2'], { x: 200, y: 200 });
    const rect1 = createRectangle('rect-1', { x: 10, y: 10, parentId: 'group-1' });
    const rect2 = createRectangle('rect-2', { x: 20, y: 20, parentId: 'group-2' });

    const objects = new Map<string, CanvasObject>([
      ['group-1', group1],
      ['group-2', group2],
      ['rect-1', rect1],
      ['rect-2', rect2],
    ]);

    const result = calculateUngroupData(['group-1', 'group-2'], objects);

    expect(result.groupsToDelete).toContain('group-1');
    expect(result.groupsToDelete).toContain('group-2');
    expect(result.childUpdates).toHaveLength(2);
    expect(result.newSelectedIds).toContain('rect-1');
    expect(result.newSelectedIds).toContain('rect-2');
  });

  it('handles nested groups', () => {
    const outerGroup = createGroup('outer-group', ['inner-group'], { x: 100, y: 100 });
    const innerGroup = createGroup('inner-group', ['rect-1'], { x: 50, y: 50, parentId: 'outer-group' });
    const rect = createRectangle('rect-1', { x: 10, y: 10, parentId: 'inner-group' });

    const objects = new Map<string, CanvasObject>([
      ['outer-group', outerGroup],
      ['inner-group', innerGroup],
      ['rect-1', rect],
    ]);

    // Ungroup only the outer group
    const result = calculateUngroupData(['outer-group'], objects);

    expect(result.groupsToDelete).toContain('outer-group');
    expect(result.groupsToDelete).not.toContain('inner-group');

    const innerGroupUpdate = result.childUpdates.find(u => u.id === 'inner-group');
    expect(innerGroupUpdate?.changes.x).toBe(150); // 100 + 50
    expect(innerGroupUpdate?.changes.y).toBe(150);
  });

  it('handles missing children gracefully', () => {
    const group = createGroup('group-1', ['rect-1', 'missing-rect'], { x: 100, y: 100 });
    const rect1 = createRectangle('rect-1', { x: 10, y: 10, parentId: 'group-1' });

    const objects = new Map<string, CanvasObject>([
      ['group-1', group],
      ['rect-1', rect1],
    ]);

    const result = calculateUngroupData(['group-1'], objects);

    expect(result.groupsToDelete).toContain('group-1');
    // Only the existing child should be updated
    expect(result.childUpdates).toHaveLength(1);
    expect(result.childUpdates[0].id).toBe('rect-1');
    expect(result.newSelectedIds).toContain('rect-1');
    expect(result.newSelectedIds).not.toContain('missing-rect');
  });
});
