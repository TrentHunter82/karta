# PRD-11: Keyboard Shortcuts Enhancement

## Overview
Enhance keyboard shortcuts with help modal, nudge controls, object cycling, and z-index manipulation.

**Priority:** LOW
**Estimated Complexity:** Low
**Files Affected:** `useKeyboardShortcuts.ts`, new `ShortcutsModal.tsx`, `ShortcutsModal.css`, `canvasStore.ts`

---

## Background
Current keyboard shortcuts cover basic operations but lack discoverability and some common actions like nudging objects or changing z-order.

---

## User Stories

### US-095: Shortcuts Help Modal
**Goal:** Show all available keyboard shortcuts in a modal dialog.

**Implementation (new file: src/components/ShortcutsModal.tsx):**
```typescript
import { useState, useEffect } from 'react';
import './ShortcutsModal.css';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  {
    category: 'Tools',
    items: [
      { keys: 'V', action: 'Select tool' },
      { keys: 'H', action: 'Hand tool (pan)' },
      { keys: 'R', action: 'Rectangle tool' },
      { keys: 'O', action: 'Ellipse tool' },
      { keys: 'T', action: 'Text tool' },
      { keys: 'F', action: 'Frame tool' },
      { keys: 'P', action: 'Pen tool' },
      { keys: 'L', action: 'Line tool' },
    ]
  },
  {
    category: 'Selection',
    items: [
      { keys: 'Ctrl+A', action: 'Select all' },
      { keys: 'Escape', action: 'Deselect all' },
      { keys: 'Tab', action: 'Select next object' },
      { keys: 'Shift+Tab', action: 'Select previous object' },
    ]
  },
  {
    category: 'Edit',
    items: [
      { keys: 'Ctrl+C', action: 'Copy' },
      { keys: 'Ctrl+V', action: 'Paste' },
      { keys: 'Ctrl+D', action: 'Duplicate' },
      { keys: 'Delete', action: 'Delete selected' },
      { keys: 'Ctrl+Z', action: 'Undo' },
      { keys: 'Ctrl+Shift+Z', action: 'Redo' },
    ]
  },
  {
    category: 'Transform',
    items: [
      { keys: '↑↓←→', action: 'Nudge 1px' },
      { keys: 'Shift+↑↓←→', action: 'Nudge 10px' },
      { keys: ']', action: 'Bring forward' },
      { keys: '[', action: 'Send backward' },
      { keys: 'Ctrl+]', action: 'Bring to front' },
      { keys: 'Ctrl+[', action: 'Send to back' },
    ]
  },
  {
    category: 'View',
    items: [
      { keys: 'Ctrl+=', action: 'Zoom in' },
      { keys: 'Ctrl+-', action: 'Zoom out' },
      { keys: 'Ctrl+0', action: 'Fit all' },
      { keys: 'Ctrl+1', action: 'Zoom to 100%' },
      { keys: 'Ctrl+2', action: 'Fit selection' },
      { keys: 'Space+drag', action: 'Pan canvas' },
      { keys: 'G', action: 'Toggle grid' },
    ]
  },
  {
    category: 'Alignment',
    items: [
      { keys: 'Ctrl+Shift+L', action: 'Align left' },
      { keys: 'Ctrl+Shift+R', action: 'Align right' },
      { keys: 'Ctrl+Shift+T', action: 'Align top' },
      { keys: 'Ctrl+Shift+B', action: 'Align bottom' },
      { keys: 'Ctrl+Shift+H', action: 'Align center horizontal' },
      { keys: 'Ctrl+Shift+E', action: 'Align center vertical' },
    ]
  }
];

export const ShortcutsModal = ({ isOpen, onClose }: ShortcutsModalProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="shortcuts-modal-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="shortcuts-modal-content">
          {shortcuts.map(section => (
            <div key={section.category} className="shortcuts-section">
              <h3>{section.category}</h3>
              <div className="shortcuts-list">
                {section.items.map(item => (
                  <div key={item.keys} className="shortcut-item">
                    <kbd>{item.keys}</kbd>
                    <span>{item.action}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcuts-modal-footer">
          Press <kbd>?</kbd> to open this dialog
        </div>
      </div>
    </div>
  );
};
```

**Trigger (useKeyboardShortcuts.ts):**
```typescript
// Add to existing shortcut handler
if (event.key === '?' || (event.shiftKey && event.key === '/')) {
  event.preventDefault();
  useCanvasStore.getState().setShowShortcutsModal(true);
}
```

**Acceptance Criteria:**
- [ ] `?` key opens shortcuts modal
- [ ] Modal shows all shortcuts organized by category
- [ ] Escape or click outside closes modal
- [ ] Modal is scrollable if needed

---

### US-096: Arrow Keys Nudge Selected Objects
**Goal:** Move selected objects with arrow keys.

**Implementation (useKeyboardShortcuts.ts):**
```typescript
const handleArrowNudge = (event: KeyboardEvent) => {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    return false;
  }

  const state = useCanvasStore.getState();
  if (state.selectedIds.size === 0) return false;

  event.preventDefault();

  const distance = event.shiftKey ? 10 : 1;
  let dx = 0, dy = 0;

  switch (event.key) {
    case 'ArrowUp':    dy = -distance; break;
    case 'ArrowDown':  dy = distance; break;
    case 'ArrowLeft':  dx = -distance; break;
    case 'ArrowRight': dx = distance; break;
  }

  // Push history before first nudge in sequence
  if (!isNudging) {
    state.pushHistory();
    isNudging = true;

    // Reset after delay
    clearTimeout(nudgeTimeout);
    nudgeTimeout = setTimeout(() => {
      isNudging = false;
    }, 500);
  }

  // Update all selected objects
  const updates = Array.from(state.selectedIds).map(id => {
    const obj = state.objects.get(id);
    if (!obj) return null;
    return {
      id,
      changes: { x: obj.x + dx, y: obj.y + dy }
    };
  }).filter(Boolean);

  state.updateObjects(updates);
  return true;
};

// Track nudge state to batch undo
let isNudging = false;
let nudgeTimeout: NodeJS.Timeout;
```

**Acceptance Criteria:**
- [ ] Arrow keys move selected objects 1px
- [ ] Shift+Arrow moves 10px
- [ ] Works with multiple selected objects
- [ ] Nudge sequence batched for undo (one undo = all nudges in sequence)
- [ ] Doesn't interfere with text editing

---

### US-097: Tab Key Cycles Through Objects
**Goal:** Tab to select next object, Shift+Tab for previous.

**Implementation:**
```typescript
const handleTabCycle = (event: KeyboardEvent) => {
  if (event.key !== 'Tab') return false;

  const state = useCanvasStore.getState();
  const objects = Array.from(state.objects.values())
    .sort((a, b) => a.zIndex - b.zIndex);

  if (objects.length === 0) return false;

  event.preventDefault();

  const currentId = state.selectedIds.size === 1
    ? Array.from(state.selectedIds)[0]
    : null;

  const currentIndex = currentId
    ? objects.findIndex(obj => obj.id === currentId)
    : -1;

  let nextIndex: number;
  if (event.shiftKey) {
    // Previous object
    nextIndex = currentIndex <= 0 ? objects.length - 1 : currentIndex - 1;
  } else {
    // Next object
    nextIndex = currentIndex >= objects.length - 1 ? 0 : currentIndex + 1;
  }

  state.setSelection(new Set([objects[nextIndex].id]));
  return true;
};
```

**Acceptance Criteria:**
- [ ] Tab selects next object (by z-index)
- [ ] Shift+Tab selects previous object
- [ ] Wraps around at ends
- [ ] Works when nothing selected (starts at first/last)

---

### US-098: Escape Key Deselects All
**Goal:** Quick way to clear selection.

**Implementation:**
```typescript
const handleEscape = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return false;

  const state = useCanvasStore.getState();

  // If editing text, stop editing first
  if (state.editingTextId) {
    // Text editing handles its own Escape
    return false;
  }

  // If in group edit mode, exit that first
  if (state.editingGroupId) {
    state.exitGroupEditMode();
    return true;
  }

  // Deselect all
  if (state.selectedIds.size > 0) {
    state.setSelection(new Set());
    return true;
  }

  // If active tool, switch to select
  if (state.activeTool !== 'select') {
    state.setActiveTool('select');
    return true;
  }

  return false;
};
```

**Acceptance Criteria:**
- [ ] Escape clears selection
- [ ] Escape exits group edit mode first if active
- [ ] Escape switches tool to select if non-select tool active
- [ ] Doesn't interfere with text editing Escape

---

### US-099: Bracket Keys for Z-Index
**Goal:** Change object stacking order with keyboard.

**Store Actions (canvasStore.ts):**
```typescript
bringForward: () => {
  const state = get();
  if (state.selectedIds.size === 0) return;

  state.pushHistory();

  const objects = Array.from(state.objects.values())
    .sort((a, b) => a.zIndex - b.zIndex);

  const selectedObjects = objects.filter(obj => state.selectedIds.has(obj.id));
  const maxSelectedZ = Math.max(...selectedObjects.map(obj => obj.zIndex));

  // Find next object above selection
  const nextAbove = objects.find(obj =>
    !state.selectedIds.has(obj.id) && obj.zIndex > maxSelectedZ
  );

  if (!nextAbove) return; // Already at top

  // Swap z-indices
  const newObjects = new Map(state.objects);
  selectedObjects.forEach(obj => {
    newObjects.set(obj.id, { ...obj, zIndex: obj.zIndex + 1 });
  });
  newObjects.set(nextAbove.id, { ...nextAbove, zIndex: maxSelectedZ });

  set({ objects: newObjects });
  // Sync to Yjs...
},

sendBackward: () => {
  // Similar logic but going down
},

bringToFront: () => {
  const state = get();
  if (state.selectedIds.size === 0) return;

  state.pushHistory();

  const maxZ = Math.max(...Array.from(state.objects.values()).map(obj => obj.zIndex));

  const newObjects = new Map(state.objects);
  let nextZ = maxZ + 1;

  state.selectedIds.forEach(id => {
    const obj = newObjects.get(id);
    if (obj) {
      newObjects.set(id, { ...obj, zIndex: nextZ++ });
    }
  });

  set({ objects: newObjects });
},

sendToBack: () => {
  const state = get();
  if (state.selectedIds.size === 0) return;

  state.pushHistory();

  const minZ = Math.min(...Array.from(state.objects.values()).map(obj => obj.zIndex));

  const newObjects = new Map(state.objects);
  let nextZ = minZ - state.selectedIds.size;

  state.selectedIds.forEach(id => {
    const obj = newObjects.get(id);
    if (obj) {
      newObjects.set(id, { ...obj, zIndex: nextZ++ });
    }
  });

  set({ objects: newObjects });
}
```

**Keyboard Shortcuts:**
- `]` - Bring forward one step
- `[` - Send backward one step
- `Ctrl+]` - Bring to front
- `Ctrl+[` - Send to back

**Acceptance Criteria:**
- [ ] `]` moves selected objects up one z-level
- [ ] `[` moves selected objects down one z-level
- [ ] `Ctrl+]` moves to top
- [ ] `Ctrl+[` moves to bottom
- [ ] Works with multiple selections
- [ ] Hierarchy panel updates to reflect changes

---

## UI Specifications

### Shortcuts Modal Styling
```css
.shortcuts-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.shortcuts-modal {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.shortcuts-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.shortcuts-modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--color-text-primary);
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 20px;
  cursor: pointer;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--color-bg-tertiary);
}

.shortcuts-modal-content {
  padding: 20px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.shortcuts-section h3 {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  margin: 0 0 12px 0;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.shortcut-item kbd {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.shortcut-item span {
  color: var(--color-text-primary);
}

.shortcuts-modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-tertiary);
  text-align: center;
}

.shortcuts-modal-footer kbd {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 1px 4px;
  font-family: monospace;
  font-size: 11px;
}
```

---

## Testing Checklist
- [ ] `?` opens shortcuts modal
- [ ] Modal displays all shortcuts correctly
- [ ] Escape closes modal
- [ ] Arrow keys nudge objects 1px
- [ ] Shift+Arrow nudges 10px
- [ ] Nudge batched for undo
- [ ] Tab cycles through objects
- [ ] Shift+Tab cycles backwards
- [ ] Escape deselects all
- [ ] Bracket keys change z-order
- [ ] Ctrl+brackets bring to front/back
- [ ] No conflicts with existing shortcuts

## Dependencies
- None (isolated to keyboard handling)

## Notes
- Consider adding shortcut customization in future
- Could add cheat sheet that stays visible (not modal)
- Nudge could optionally snap to grid when snap is enabled
