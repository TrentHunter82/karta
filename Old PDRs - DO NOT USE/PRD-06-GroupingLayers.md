# PRD-06: Grouping & Layers

## Overview
Add ability to group objects together and manage object visibility/locking through a layers system.

**Priority:** HIGH
**Estimated Complexity:** High
**Files Affected:** `types/canvas.ts`, `canvasStore.ts`, `Canvas.tsx`, `PropertiesPanel.tsx`, `useKeyboardShortcuts.ts`

---

## Background
Currently, all objects exist at the same level. Users cannot group related objects to move/transform them together, hide objects temporarily, or lock objects to prevent accidental edits.

---

## Prerequisites
- PRD-02 (Multi-Selection Property Editing) should be completed first
- Multi-selection editing provides the foundation for group manipulation

---

## User Stories

### US-068: Group Selected Objects (Ctrl+G)
**Goal:** Combine multiple selected objects into a single group.

**Type Definition (types/canvas.ts):**
```typescript
interface GroupObject extends BaseObject {
  type: 'group';
  children: string[]; // IDs of child objects
  // Groups inherit x, y, width, height from bounding box of children
}

// Update CanvasObject union
type CanvasObject = RectangleObject | EllipseObject | TextObject |
                    FrameObject | PathObject | ImageObject | VideoObject | GroupObject;
```

**Store Action (canvasStore.ts):**
```typescript
groupSelection: () => {
  const state = get();
  const selectedIds = Array.from(state.selectedIds);

  if (selectedIds.length < 2) return;

  state.pushHistory();

  // Calculate bounding box of all selected objects
  const selectedObjects = selectedIds
    .map(id => state.objects.get(id))
    .filter((obj): obj is CanvasObject => obj !== undefined);

  const bounds = calculateBoundingBox(selectedObjects);

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
    zIndex: state.getNextZIndex(),
    children: selectedIds
  };

  // Add group, update child positions to be relative to group
  const newObjects = new Map(state.objects);
  newObjects.set(groupId, group);

  // Update children to store relative positions
  selectedIds.forEach(id => {
    const obj = newObjects.get(id);
    if (obj) {
      newObjects.set(id, {
        ...obj,
        parentId: groupId,
        // Convert to relative position within group
        x: obj.x - bounds.x,
        y: obj.y - bounds.y
      });
    }
  });

  set({
    objects: newObjects,
    selectedIds: new Set([groupId])
  });

  // Sync to Yjs...
}
```

**Acceptance Criteria:**
- [ ] Ctrl+G groups 2+ selected objects
- [ ] Group appears as single selectable unit
- [ ] Group has bounding box of all children
- [ ] Children maintain relative positions
- [ ] Undo restores original ungrouped state

---

### US-069: Ungroup Objects (Ctrl+Shift+G)
**Goal:** Break a group back into individual objects.

**Store Action:**
```typescript
ungroupSelection: () => {
  const state = get();
  const selectedIds = Array.from(state.selectedIds);

  state.pushHistory();

  const newObjects = new Map(state.objects);
  const newSelectedIds = new Set<string>();

  selectedIds.forEach(id => {
    const obj = state.objects.get(id);
    if (obj?.type === 'group') {
      const group = obj as GroupObject;

      // Convert children back to absolute positions
      group.children.forEach(childId => {
        const child = newObjects.get(childId);
        if (child) {
          newObjects.set(childId, {
            ...child,
            x: child.x + group.x,
            y: child.y + group.y,
            parentId: undefined
          });
          newSelectedIds.add(childId);
        }
      });

      // Remove the group object
      newObjects.delete(id);
    } else {
      newSelectedIds.add(id);
    }
  });

  set({
    objects: newObjects,
    selectedIds: newSelectedIds
  });
}
```

**Acceptance Criteria:**
- [ ] Ctrl+Shift+G ungroups selected groups
- [ ] Children become individually selectable
- [ ] Children return to absolute coordinates
- [ ] Non-group objects in selection are unaffected
- [ ] Undo restores the group

---

### US-070: Nested Group Support
**Goal:** Groups can contain other groups for hierarchical organization.

**Behavior:**
- Grouping objects that include groups creates nested groups
- Ungrouping only removes the top-level group
- Deep ungroup requires multiple ungroup operations

**Considerations:**
```typescript
// When calculating group bounds, recursively process nested groups
const getAbsolutePosition = (obj: CanvasObject, objects: Map<string, CanvasObject>): { x: number; y: number } => {
  if (!obj.parentId) {
    return { x: obj.x, y: obj.y };
  }

  const parent = objects.get(obj.parentId);
  if (!parent) {
    return { x: obj.x, y: obj.y };
  }

  const parentPos = getAbsolutePosition(parent, objects);
  return {
    x: parentPos.x + obj.x,
    y: parentPos.y + obj.y
  };
};
```

**Acceptance Criteria:**
- [ ] Can group objects that include existing groups
- [ ] Nested groups display correctly
- [ ] Selecting parent group moves all nested children
- [ ] Ungroup only removes one level at a time

---

### US-071: Group Selection and Manipulation
**Goal:** Groups behave like single objects for selection, move, resize, rotate.

**Selection Behavior:**
- Click on any child object selects the entire group
- Double-click enters "edit group" mode (select children individually)
- Click outside exits edit mode

**Edit Mode State:**
```typescript
interface CanvasState {
  // ... existing state
  editingGroupId: string | null; // Currently editing group
}

enterGroupEditMode: (groupId: string) => void;
exitGroupEditMode: () => void;
```

**Transform Behavior:**
- Moving group moves all children (their relative positions unchanged)
- Resizing group scales all children proportionally
- Rotating group rotates children around group center

**Acceptance Criteria:**
- [ ] Clicking child selects parent group
- [ ] Double-click enters group edit mode
- [ ] In edit mode, can select individual children
- [ ] Click outside exits edit mode
- [ ] Moving group moves all children
- [ ] Resizing group scales children
- [ ] Rotating group rotates children

---

### US-072: Layer Panel with Visibility Toggles
**Goal:** Add visibility (eye icon) toggle to hierarchy panel items.

**State Addition:**
```typescript
interface BaseObject {
  // ... existing properties
  visible: boolean; // default: true
}
```

**UI Enhancement (PropertiesPanel.tsx HierarchySection):**
```typescript
const HierarchyItem = ({ obj }: { obj: CanvasObject }) => {
  const updateObject = useCanvasStore(state => state.updateObject);

  return (
    <div className="hierarchy-item">
      <button
        className={`visibility-toggle ${obj.visible ? '' : 'hidden'}`}
        onClick={(e) => {
          e.stopPropagation();
          updateObject(obj.id, { visible: !obj.visible });
        }}
      >
        {obj.visible ? <EyeIcon /> : <EyeOffIcon />}
      </button>
      <span className="item-icon">{getTypeIcon(obj.type)}</span>
      <span className="item-name">{getObjectName(obj)}</span>
    </div>
  );
};
```

**Rendering (Canvas.tsx):**
```typescript
// Skip hidden objects in draw loop
const drawObjects = () => {
  sortedObjects.forEach(obj => {
    if (!obj.visible) return;
    drawObject(obj);
  });
};
```

**Acceptance Criteria:**
- [ ] Eye icon toggles object visibility
- [ ] Hidden objects don't render on canvas
- [ ] Hidden objects can't be selected on canvas
- [ ] Hidden objects show dimmed in hierarchy
- [ ] Visibility state syncs via Yjs

---

### US-073: Lock/Unlock Objects
**Goal:** Prevent accidental edits to locked objects.

**State Addition:**
```typescript
interface BaseObject {
  // ... existing properties
  locked: boolean; // default: false
}
```

**UI Enhancement:**
```typescript
const HierarchyItem = ({ obj }: { obj: CanvasObject }) => {
  return (
    <div className="hierarchy-item">
      <button className="visibility-toggle">...</button>
      <button
        className={`lock-toggle ${obj.locked ? 'locked' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          updateObject(obj.id, { locked: !obj.locked });
        }}
      >
        {obj.locked ? <LockIcon /> : <UnlockIcon />}
      </button>
      {/* ... rest of item */}
    </div>
  );
};
```

**Behavior:**
- Locked objects can be selected but not moved, resized, or rotated
- Locked objects show lock cursor on hover
- Locked objects show lock icon overlay when selected
- Properties panel shows "Locked" indicator

**Acceptance Criteria:**
- [ ] Lock icon toggles lock state
- [ ] Locked objects can be selected
- [ ] Locked objects cannot be moved/resized/rotated
- [ ] Locked objects show lock cursor
- [ ] Locked state syncs via Yjs
- [ ] Can unlock from hierarchy or properties panel

---

## UI Specifications

### Group Visual Indicator
```css
/* When group is selected, show light bounding box */
.group-selection-box {
  stroke: var(--color-accent);
  stroke-width: 1;
  stroke-dasharray: 4 4;
  fill: transparent;
}

/* Edit mode indicator */
.group-edit-mode {
  background: rgba(0, 102, 255, 0.05);
  border: 1px dashed var(--color-accent);
}
```

### Hierarchy Item Enhancements
```css
.hierarchy-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
}

.visibility-toggle, .lock-toggle {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  border-radius: 2px;
}

.visibility-toggle:hover, .lock-toggle:hover {
  background: var(--color-bg-tertiary);
}

.visibility-toggle.hidden {
  color: var(--color-text-quaternary);
}

.lock-toggle.locked {
  color: var(--color-accent);
}

/* Indentation for group children */
.hierarchy-item[data-depth="1"] { padding-left: 24px; }
.hierarchy-item[data-depth="2"] { padding-left: 40px; }
.hierarchy-item[data-depth="3"] { padding-left: 56px; }

/* Group row styling */
.hierarchy-item.group {
  font-weight: 500;
}

.hierarchy-item.group::before {
  content: '▶';
  margin-right: 4px;
  font-size: 8px;
  transition: transform 0.1s;
}

.hierarchy-item.group.expanded::before {
  transform: rotate(90deg);
}
```

---

## Testing Checklist
- [ ] Group creation works with 2+ objects
- [ ] Ungroup restores individual objects
- [ ] Nested groups work correctly
- [ ] Group transforms (move, resize, rotate) work
- [ ] Double-click enters group edit mode
- [ ] Visibility toggle hides/shows objects
- [ ] Lock toggle prevents edits
- [ ] Hierarchy shows correct nesting/indentation
- [ ] Yjs sync works for all group operations
- [ ] Undo/redo works for group/ungroup
- [ ] Copy/paste works with groups

## Dependencies
- PRD-02 (Multi-Selection Property Editing) - provides foundation for batch operations

## Notes
- Groups add complexity to selection, transforms, and rendering
- Consider performance impact of deep group nesting
- Frame objects could be enhanced to act like groups (auto-group children)
