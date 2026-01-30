/**
 * Group Store
 *
 * Manages group editing mode and provides pure functions for grouping
 * and ungrouping operations.
 *
 * Key responsibilities:
 * - Track which group is currently being edited (editingGroupId)
 * - Calculate group creation data from selected objects
 * - Calculate ungroup data to restore children to canvas root
 * - Provide absolute position calculation for nested objects
 *
 * Architecture notes:
 * - Group editing mode allows selecting/moving children within a group
 * - Children have relative coordinates to their parent group
 * - getAbsolutePosition traverses parent chain for true canvas coords
 * - Pure calculation functions enable testing without store mocks
 *
 * @see canvasStore.ts - Calls calculateGroupData/calculateUngroupData
 */
import { create } from 'zustand';
import type { CanvasObject, GroupObject } from '../types/canvas';
import { isGroupObject } from '../types/canvas';

/**
 * Get absolute position of an object, traversing up the parent chain
 */
export const getAbsolutePosition = (
  obj: CanvasObject,
  objects: Map<string, CanvasObject>,
  visited: Set<string> = new Set()
): { x: number; y: number } => {
  if (!obj.parentId) {
    return { x: obj.x, y: obj.y };
  }

  // Cycle detection: if we've already visited this object, break the chain
  if (visited.has(obj.id)) {
    return { x: obj.x, y: obj.y };
  }
  visited.add(obj.id);

  const parent = objects.get(obj.parentId);
  if (!parent) {
    return { x: obj.x, y: obj.y };
  }

  const parentPos = getAbsolutePosition(parent, objects, visited);
  return {
    x: parentPos.x + obj.x,
    y: parentPos.y + obj.y
  };
};

/**
 * Calculate group creation data from selected objects
 */
export const calculateGroupData = (
  selectedIds: string[],
  objects: Map<string, CanvasObject>,
  nextZIndex: number
): {
  group: GroupObject;
  childUpdates: Array<{ id: string; changes: Partial<CanvasObject> }>;
} | null => {
  if (selectedIds.length < 2) {
    return null;
  }

  // Get selected objects
  const selectedObjects = selectedIds
    .map(id => objects.get(id))
    .filter((obj): obj is CanvasObject => obj !== undefined);

  if (selectedObjects.length < 2) {
    return null;
  }

  // Calculate bounding box of all selected objects (using absolute positions)
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  selectedObjects.forEach(obj => {
    const absPos = getAbsolutePosition(obj, objects);
    minX = Math.min(minX, absPos.x);
    minY = Math.min(minY, absPos.y);
    maxX = Math.max(maxX, absPos.x + obj.width);
    maxY = Math.max(maxY, absPos.y + obj.height);
  });

  const bounds = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };

  // Create group object
  const groupId = crypto.randomUUID();
  const group: GroupObject = {
    id: groupId,
    type: 'group',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    rotation: 0,
    opacity: 1,
    zIndex: nextZIndex,
    children: selectedIds,
    visible: true,
    locked: false
  };

  // Calculate child updates (convert to relative positions)
  const childUpdates = selectedObjects.map(obj => {
    const absPos = getAbsolutePosition(obj, objects);
    return {
      id: obj.id,
      changes: {
        parentId: groupId,
        x: absPos.x - bounds.x,
        y: absPos.y - bounds.y
      }
    };
  });

  return { group, childUpdates };
};

/**
 * Calculate ungroup data for groups
 */
export const calculateUngroupData = (
  groupIds: string[],
  objects: Map<string, CanvasObject>
): {
  groupsToDelete: string[];
  childUpdates: Array<{ id: string; changes: Partial<CanvasObject> }>;
  newSelectedIds: string[];
} => {
  const groupsToDelete: string[] = [];
  const childUpdates: Array<{ id: string; changes: Partial<CanvasObject> }> = [];
  const newSelectedIds: string[] = [];

  groupIds.forEach(groupId => {
    const obj = objects.get(groupId);
    if (obj && isGroupObject(obj)) {
      groupsToDelete.push(groupId);

      // Get group's absolute position
      const groupAbsPos = getAbsolutePosition(obj, objects);

      // Convert children back to absolute positions
      obj.children.forEach(childId => {
        const child = objects.get(childId);
        if (child) {
          childUpdates.push({
            id: childId,
            changes: {
              x: child.x + groupAbsPos.x,
              y: child.y + groupAbsPos.y,
              parentId: undefined
            }
          });
          newSelectedIds.push(childId);
        }
      });
    }
  });

  return { groupsToDelete, childUpdates, newSelectedIds };
};

interface GroupState {
  // State
  editingGroupId: string | null;

  // Actions
  enterGroupEditMode: (groupId: string) => void;
  exitGroupEditMode: () => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  // Initial state
  editingGroupId: null,

  enterGroupEditMode: (groupId) => {
    set({ editingGroupId: groupId });
  },

  exitGroupEditMode: () => {
    set({ editingGroupId: null });
  },
}));
