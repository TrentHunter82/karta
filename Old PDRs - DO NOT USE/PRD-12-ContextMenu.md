# PRD-12: Context Menu

## Overview
Add right-click context menu for quick access to common actions on the canvas.

**Priority:** MEDIUM
**Estimated Complexity:** Medium
**Files Affected:** New `ContextMenu.tsx`, `ContextMenu.css`, `Canvas.tsx`

---

## Background
Currently all actions require toolbar buttons, keyboard shortcuts, or properties panel controls. A context menu provides discoverable, context-sensitive access to common operations.

---

## User Stories

### US-100: Right-Click Context Menu on Canvas
**Goal:** Show a context menu when right-clicking on the canvas.

**Component (new file: src/components/ContextMenu.tsx):**
```typescript
import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import './ContextMenu.css';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  targetObjectId: string | null;
}

interface MenuItem {
  label: string;
  action: () => void;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
}

export const ContextMenu = ({ x, y, onClose, targetObjectId }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const store = useCanvasStore();

  const hasSelection = store.selectedIds.size > 0;
  const hasClipboard = store.clipboard.length > 0;
  const selectedCount = store.selectedIds.size;

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    const padding = 10;

    let adjustedX = x;
    let adjustedY = y;

    if (x + rect.width + padding > window.innerWidth) {
      adjustedX = x - rect.width;
    }

    if (y + rect.height + padding > window.innerHeight) {
      adjustedY = y - rect.height;
    }

    menuRef.current.style.left = `${Math.max(padding, adjustedX)}px`;
    menuRef.current.style.top = `${Math.max(padding, adjustedY)}px`;
  }, [x, y]);

  const executeAndClose = (action: () => void) => {
    action();
    onClose();
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Cut',
      action: () => { store.copySelection(); store.deleteSelectedObjects(); },
      shortcut: 'Ctrl+X',
      disabled: !hasSelection
    },
    {
      label: 'Copy',
      action: () => store.copySelection(),
      shortcut: 'Ctrl+C',
      disabled: !hasSelection
    },
    {
      label: 'Paste',
      action: () => store.paste(),
      shortcut: 'Ctrl+V',
      disabled: !hasClipboard
    },
    {
      label: 'Duplicate',
      action: () => store.duplicate(),
      shortcut: 'Ctrl+D',
      disabled: !hasSelection
    },
    { divider: true },
    {
      label: 'Delete',
      action: () => store.deleteSelectedObjects(),
      shortcut: 'Delete',
      disabled: !hasSelection
    },
    { divider: true },
    {
      label: 'Bring to Front',
      action: () => store.bringToFront(),
      shortcut: 'Ctrl+]',
      disabled: !hasSelection
    },
    {
      label: 'Bring Forward',
      action: () => store.bringForward(),
      shortcut: ']',
      disabled: !hasSelection
    },
    {
      label: 'Send Backward',
      action: () => store.sendBackward(),
      shortcut: '[',
      disabled: !hasSelection
    },
    {
      label: 'Send to Back',
      action: () => store.sendToBack(),
      shortcut: 'Ctrl+[',
      disabled: !hasSelection
    },
    { divider: true },
    {
      label: 'Select All',
      action: () => store.selectAll(),
      shortcut: 'Ctrl+A'
    }
  ];

  return (
    <div className="context-menu" ref={menuRef} style={{ left: x, top: y }}>
      {menuItems.map((item, index) =>
        item.divider ? (
          <div key={index} className="context-menu-divider" />
        ) : (
          <button
            key={item.label}
            className={`context-menu-item ${item.disabled ? 'disabled' : ''}`}
            onClick={() => !item.disabled && executeAndClose(item.action)}
            disabled={item.disabled}
          >
            <span className="menu-item-label">{item.label}</span>
            {item.shortcut && (
              <span className="menu-item-shortcut">{item.shortcut}</span>
            )}
          </button>
        )
      )}
    </div>
  );
};
```

**Canvas Integration:**
```typescript
// In Canvas.tsx
const [contextMenu, setContextMenu] = useState<{
  x: number;
  y: number;
  targetId: string | null;
} | null>(null);

const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();

  const canvasPos = screenToCanvas(e.clientX, e.clientY);
  const hitObject = hitTest(canvasPos);

  // Select object if right-clicking on unselected object
  if (hitObject && !selectedIds.has(hitObject.id)) {
    setSelection(new Set([hitObject.id]));
  }

  setContextMenu({
    x: e.clientX,
    y: e.clientY,
    targetId: hitObject?.id || null
  });
};

// In render
<canvas onContextMenu={handleContextMenu} ... />

{contextMenu && (
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    targetObjectId={contextMenu.targetId}
    onClose={() => setContextMenu(null)}
  />
)}
```

**Acceptance Criteria:**
- [ ] Right-click opens context menu
- [ ] Menu appears at cursor position
- [ ] Menu adjusts to stay within viewport
- [ ] Click outside closes menu
- [ ] Escape closes menu
- [ ] Right-click on object selects it if not already selected

---

### US-101: Object-Specific Menu Items
**Goal:** Show different menu items based on what was right-clicked.

**Dynamic Menu Based on Context:**
```typescript
const buildMenuItems = (): MenuItem[] => {
  const items: MenuItem[] = [];

  // Always show clipboard operations
  items.push(
    { label: 'Cut', action: cut, shortcut: 'Ctrl+X', disabled: !hasSelection },
    { label: 'Copy', action: copy, shortcut: 'Ctrl+C', disabled: !hasSelection },
    { label: 'Paste', action: paste, shortcut: 'Ctrl+V', disabled: !hasClipboard },
    { label: 'Duplicate', action: duplicate, shortcut: 'Ctrl+D', disabled: !hasSelection },
    { divider: true }
  );

  if (hasSelection) {
    items.push(
      { label: 'Delete', action: deleteSelected, shortcut: 'Delete' },
      { divider: true }
    );
  }

  // Object-specific items
  if (targetObjectId) {
    const obj = objects.get(targetObjectId);

    if (obj?.type === 'text') {
      items.push(
        { label: 'Edit Text', action: () => editText(obj.id) },
        { divider: true }
      );
    }

    if (obj?.type === 'frame') {
      items.push(
        { label: 'Rename Frame', action: () => editFrameName(obj.id) },
        { divider: true }
      );
    }

    if (obj?.type === 'image' || obj?.type === 'video') {
      items.push(
        { label: 'Replace Media...', action: () => replaceMedia(obj.id) },
        { divider: true }
      );
    }
  }

  // Z-order items when selection exists
  if (hasSelection) {
    items.push(
      { label: 'Bring to Front', action: bringToFront, shortcut: 'Ctrl+]' },
      { label: 'Bring Forward', action: bringForward, shortcut: ']' },
      { label: 'Send Backward', action: sendBackward, shortcut: '[' },
      { label: 'Send to Back', action: sendToBack, shortcut: 'Ctrl+[' },
      { divider: true }
    );
  }

  // Always show select all
  items.push({ label: 'Select All', action: selectAll, shortcut: 'Ctrl+A' });

  return items;
};
```

**Acceptance Criteria:**
- [ ] Text objects show "Edit Text" option
- [ ] Frame objects show "Rename Frame" option
- [ ] Image/video show "Replace Media..." option
- [ ] Menu adapts based on selection state

---

### US-102: Alignment Options in Context Menu
**Goal:** Add alignment submenu when multiple objects selected.

**Submenu Implementation:**
```typescript
interface MenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
  submenu?: MenuItem[];
}

// In buildMenuItems, add when 2+ objects selected
if (selectedCount >= 2) {
  items.push({
    label: 'Align',
    submenu: [
      { label: 'Align Left', action: () => alignObjects('left'), shortcut: 'Ctrl+Shift+L' },
      { label: 'Align Center', action: () => alignObjects('centerH'), shortcut: 'Ctrl+Shift+H' },
      { label: 'Align Right', action: () => alignObjects('right'), shortcut: 'Ctrl+Shift+R' },
      { divider: true },
      { label: 'Align Top', action: () => alignObjects('top'), shortcut: 'Ctrl+Shift+T' },
      { label: 'Align Middle', action: () => alignObjects('centerV'), shortcut: 'Ctrl+Shift+E' },
      { label: 'Align Bottom', action: () => alignObjects('bottom'), shortcut: 'Ctrl+Shift+B' },
    ]
  });
}

if (selectedCount >= 3) {
  items.push({
    label: 'Distribute',
    submenu: [
      { label: 'Distribute Horizontally', action: () => distributeObjects('horizontal') },
      { label: 'Distribute Vertically', action: () => distributeObjects('vertical') },
    ]
  });
}
```

**Submenu Rendering:**
```typescript
const MenuItem = ({ item }: { item: MenuItem }) => {
  const [showSubmenu, setShowSubmenu] = useState(false);

  if (item.submenu) {
    return (
      <div
        className="context-menu-item has-submenu"
        onMouseEnter={() => setShowSubmenu(true)}
        onMouseLeave={() => setShowSubmenu(false)}
      >
        <span className="menu-item-label">{item.label}</span>
        <span className="submenu-arrow">▶</span>

        {showSubmenu && (
          <div className="context-submenu">
            {item.submenu.map((subItem, i) => (
              <MenuItem key={i} item={subItem} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular item rendering...
};
```

**Acceptance Criteria:**
- [ ] "Align" submenu appears with 2+ objects selected
- [ ] "Distribute" submenu appears with 3+ objects selected
- [ ] Submenus show on hover
- [ ] Alignment/distribution actions work from menu

---

### US-103: Grouping Options in Context Menu
**Goal:** Add group/ungroup options when applicable.

**Menu Items:**
```typescript
// Add when 2+ objects selected (for grouping)
if (selectedCount >= 2) {
  items.push({
    label: 'Group',
    action: () => store.groupSelection(),
    shortcut: 'Ctrl+G'
  });
}

// Add when selection contains groups (for ungrouping)
const hasGroups = Array.from(selectedIds).some(id => {
  const obj = objects.get(id);
  return obj?.type === 'group';
});

if (hasGroups) {
  items.push({
    label: 'Ungroup',
    action: () => store.ungroupSelection(),
    shortcut: 'Ctrl+Shift+G'
  });
}
```

**Acceptance Criteria:**
- [ ] "Group" option appears with 2+ objects selected
- [ ] "Ungroup" option appears when groups are selected
- [ ] Group/ungroup actions work from menu

---

### US-104: Bring to Front / Send to Back Options
**Goal:** Z-order controls in context menu. (Already covered in US-100)

**Verification:**
- Ensure z-order options are always present when objects selected
- Options should be disabled if object is already at top/bottom

**Enhanced Disable Logic:**
```typescript
const objects = Array.from(store.objects.values())
  .sort((a, b) => a.zIndex - b.zIndex);

const selectedObjects = objects.filter(obj => selectedIds.has(obj.id));
const maxSelectedZ = Math.max(...selectedObjects.map(obj => obj.zIndex));
const minSelectedZ = Math.min(...selectedObjects.map(obj => obj.zIndex));
const maxZ = objects[objects.length - 1]?.zIndex || 0;
const minZ = objects[0]?.zIndex || 0;

const isAtTop = maxSelectedZ === maxZ;
const isAtBottom = minSelectedZ === minZ;

// In menu items
{
  label: 'Bring to Front',
  action: bringToFront,
  disabled: isAtTop
},
{
  label: 'Send to Back',
  action: sendToBack,
  disabled: isAtBottom
}
```

**Acceptance Criteria:**
- [ ] Z-order options present when objects selected
- [ ] "Bring to Front" disabled when already at top
- [ ] "Send to Back" disabled when already at bottom

---

## UI Specifications

### Context Menu Styling
```css
.context-menu {
  position: fixed;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 4px;
  min-width: 180px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

.context-menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 13px;
  text-align: left;
  border-radius: 4px;
  cursor: pointer;
}

.context-menu-item:hover:not(.disabled) {
  background: var(--color-bg-tertiary);
}

.context-menu-item.disabled {
  color: var(--color-text-quaternary);
  cursor: not-allowed;
}

.menu-item-shortcut {
  color: var(--color-text-tertiary);
  font-size: 11px;
  margin-left: 24px;
}

.context-menu-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

/* Submenu styles */
.context-menu-item.has-submenu {
  position: relative;
}

.submenu-arrow {
  font-size: 8px;
  color: var(--color-text-tertiary);
}

.context-submenu {
  position: absolute;
  left: 100%;
  top: -4px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 4px;
  min-width: 180px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}
```

---

## Testing Checklist
- [ ] Right-click opens context menu
- [ ] Menu appears at cursor position
- [ ] Menu stays within viewport bounds
- [ ] Click outside closes menu
- [ ] Escape closes menu
- [ ] Cut/Copy/Paste/Duplicate work
- [ ] Delete works
- [ ] Z-order options work
- [ ] Select All works
- [ ] Text-specific options appear for text objects
- [ ] Alignment submenu appears with 2+ selection
- [ ] Distribution submenu appears with 3+ selection
- [ ] Group/Ungroup options work
- [ ] Disabled states are correct
- [ ] Shortcuts display correctly

## Dependencies
- PRD-03 (Alignment Tools) - for alignment submenu
- PRD-06 (Grouping) - for group/ungroup options
- PRD-11 (Keyboard Shortcuts) - for z-order actions

## Notes
- Context menu is a common feature that improves discoverability
- Can be extended with more options as features are added
- Consider adding icons to menu items in future
