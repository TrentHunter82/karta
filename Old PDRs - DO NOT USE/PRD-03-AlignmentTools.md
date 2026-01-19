# PRD-03: Alignment & Distribution Tools

## Overview
Add alignment and distribution tools to help users precisely arrange multiple objects on the canvas.

**Priority:** MEDIUM
**Estimated Complexity:** Medium
**Files Affected:** `Toolbar.tsx`, `Toolbar.css`, `canvasStore.ts` (new actions), `useKeyboardShortcuts.ts`

---

## Background
Currently there's no way to align objects relative to each other or distribute them evenly. Users must manually position objects using X/Y coordinates.

---

## User Stories

### US-050: Add Alignment Toolbar Section
**Goal:** Add alignment buttons to the toolbar when multiple objects are selected.

**UI Design:**
```
[Toolbar]
  [Select tool]
  [Hand tool]
  [Rectangle tool]
  [Text tool]
  [Frame tool]
  [Pen tool]
  ─────────────
  [Import Image]
  ─────────────
  [Align section] ← NEW (only visible when 2+ objects selected)
    [Align Left]
    [Align H Center]
    [Align Right]
    [Align Top]
    [Align V Center]
    [Align Bottom]
  ─────────────
  [Distribute section] ← NEW (only visible when 3+ objects selected)
    [Distribute H]
    [Distribute V]
```

**Implementation:**
```typescript
// Toolbar.tsx
const selectedCount = useCanvasStore(state => state.selectedIds.size);

{selectedCount >= 2 && (
  <div className="toolbar-section">
    <div className="toolbar-divider" />
    <button onClick={() => alignObjects('left')} title="Align Left">
      <AlignLeftIcon />
    </button>
    {/* ... other alignment buttons */}
  </div>
)}
```

**Acceptance Criteria:**
- [ ] Alignment buttons appear when 2+ objects selected
- [ ] Alignment buttons disappear when <2 objects selected
- [ ] Distribution buttons appear when 3+ objects selected
- [ ] All buttons have tooltips with keyboard shortcuts

---

### US-051: Implement Align Left/Right/Top/Bottom
**Goal:** Align selected objects to the leftmost/rightmost/topmost/bottommost edge.

**Behavior:**
- **Align Left:** All objects' X = minimum X of selection
- **Align Right:** All objects' right edge = maximum right edge of selection
- **Align Top:** All objects' Y = minimum Y of selection
- **Align Bottom:** All objects' bottom edge = maximum bottom edge of selection

**Implementation (canvasStore.ts):**
```typescript
alignObjects: (alignment: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => {
  const state = get();
  const selectedObjects = Array.from(state.selectedIds)
    .map(id => state.objects.get(id))
    .filter((obj): obj is CanvasObject => obj !== undefined);

  if (selectedObjects.length < 2) return;

  state.pushHistory();

  let updates: { id: string; changes: Partial<CanvasObject> }[] = [];

  switch (alignment) {
    case 'left': {
      const minX = Math.min(...selectedObjects.map(obj => obj.x));
      updates = selectedObjects.map(obj => ({
        id: obj.id,
        changes: { x: minX }
      }));
      break;
    }
    case 'right': {
      const maxRight = Math.max(...selectedObjects.map(obj => obj.x + obj.width));
      updates = selectedObjects.map(obj => ({
        id: obj.id,
        changes: { x: maxRight - obj.width }
      }));
      break;
    }
    // ... similar for top, bottom, centerH, centerV
  }

  state.updateObjects(updates);
}
```

**Acceptance Criteria:**
- [ ] Align Left: All objects' left edges align to leftmost
- [ ] Align Right: All objects' right edges align to rightmost
- [ ] Align Top: All objects' top edges align to topmost
- [ ] Align Bottom: All objects' bottom edges align to bottommost
- [ ] Undo reverses alignment in one step

---

### US-052: Implement Align Center (Horizontal & Vertical)
**Goal:** Center objects along horizontal or vertical axis.

**Behavior:**
- **Center Horizontal:** All objects' horizontal centers = average center X
- **Center Vertical:** All objects' vertical centers = average center Y

**Implementation:**
```typescript
case 'centerH': {
  const centers = selectedObjects.map(obj => obj.x + obj.width / 2);
  const avgCenter = centers.reduce((a, b) => a + b) / centers.length;
  updates = selectedObjects.map(obj => ({
    id: obj.id,
    changes: { x: avgCenter - obj.width / 2 }
  }));
  break;
}
case 'centerV': {
  const centers = selectedObjects.map(obj => obj.y + obj.height / 2);
  const avgCenter = centers.reduce((a, b) => a + b) / centers.length;
  updates = selectedObjects.map(obj => ({
    id: obj.id,
    changes: { y: avgCenter - obj.height / 2 }
  }));
  break;
}
```

**Acceptance Criteria:**
- [ ] Center H: Objects centered horizontally along average center
- [ ] Center V: Objects centered vertically along average center

---

### US-053: Implement Distribute Horizontally/Vertically
**Goal:** Evenly space 3+ objects along horizontal or vertical axis.

**Behavior:**
- **Distribute Horizontal:** Equal spacing between objects (left to right by position)
- **Distribute Vertical:** Equal spacing between objects (top to bottom by position)

**Implementation:**
```typescript
distributeObjects: (direction: 'horizontal' | 'vertical') => {
  const state = get();
  const selectedObjects = Array.from(state.selectedIds)
    .map(id => state.objects.get(id))
    .filter((obj): obj is CanvasObject => obj !== undefined);

  if (selectedObjects.length < 3) return;

  state.pushHistory();

  if (direction === 'horizontal') {
    // Sort by X position
    const sorted = [...selectedObjects].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Calculate total width of all objects
    const totalObjectWidth = sorted.reduce((sum, obj) => sum + obj.width, 0);

    // Calculate available space for gaps
    const totalSpace = (last.x + last.width) - first.x;
    const gapSpace = totalSpace - totalObjectWidth;
    const gap = gapSpace / (sorted.length - 1);

    // Position each object
    let currentX = first.x;
    const updates = sorted.map(obj => {
      const update = { id: obj.id, changes: { x: currentX } };
      currentX += obj.width + gap;
      return update;
    });

    state.updateObjects(updates);
  }
  // Similar for vertical
}
```

**Acceptance Criteria:**
- [ ] Distribute H: Equal gaps between objects horizontally
- [ ] Distribute V: Equal gaps between objects vertically
- [ ] Works with objects of different sizes
- [ ] Maintains first and last object positions (distributes middle objects)

---

### US-054: Add Keyboard Shortcuts for Alignment
**Goal:** Quick keyboard access to alignment functions.

**Shortcuts:**
| Action | Shortcut |
|--------|----------|
| Align Left | `Ctrl+Shift+L` |
| Align Right | `Ctrl+Shift+R` |
| Align Top | `Ctrl+Shift+T` |
| Align Bottom | `Ctrl+Shift+B` |
| Align Center H | `Ctrl+Shift+H` |
| Align Center V | `Ctrl+Shift+V` |
| Distribute H | `Ctrl+Alt+H` |
| Distribute V | `Ctrl+Alt+V` |

**Implementation (useKeyboardShortcuts.ts):**
```typescript
if (event.ctrlKey && event.shiftKey) {
  switch (event.key.toLowerCase()) {
    case 'l':
      event.preventDefault();
      alignObjects('left');
      break;
    // ... etc
  }
}
```

**Acceptance Criteria:**
- [ ] All shortcuts work when 2+ objects selected
- [ ] Shortcuts disabled when <2 objects selected (no error)
- [ ] Shortcuts don't conflict with existing shortcuts

---

### US-055: Handle Rotated Objects in Alignment
**Goal:** Alignment should use bounding box of rotated objects.

**Problem:** Rotated objects have axis-aligned bounding boxes larger than their visual representation.

**Behavior:**
- Use the rotated bounding box for alignment calculations
- Calculate corners of rotated rectangle, find min/max X/Y

**Implementation:**
```typescript
function getRotatedBounds(obj: CanvasObject): { minX: number; maxX: number; minY: number; maxY: number } {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const angle = (obj.rotation || 0) * Math.PI / 180;

  const corners = [
    { x: obj.x, y: obj.y },
    { x: obj.x + obj.width, y: obj.y },
    { x: obj.x + obj.width, y: obj.y + obj.height },
    { x: obj.x, y: obj.y + obj.height }
  ].map(corner => {
    const dx = corner.x - cx;
    const dy = corner.y - cy;
    return {
      x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: cy + dx * Math.sin(angle) + dy * Math.cos(angle)
    };
  });

  return {
    minX: Math.min(...corners.map(c => c.x)),
    maxX: Math.max(...corners.map(c => c.x)),
    minY: Math.min(...corners.map(c => c.y)),
    maxY: Math.max(...corners.map(c => c.y))
  };
}
```

**Acceptance Criteria:**
- [ ] Align rotated objects correctly using visual bounds
- [ ] Distribution respects rotated object sizes

---

## UI Specifications

### Alignment Button Icons (SVG)
```
Align Left:    |▢ ▢ ▢
Align Right:   ▢ ▢ ▢|
Align Top:     ▢▢▢
               ───
Align Bottom:  ───
               ▢▢▢
Center H:      ▢|▢|▢
Center V:      ▢─▢─▢
Distribute H:  |▢ · ▢ · ▢|
Distribute V:  ▢···▢···▢
```

### Button Styling
```css
.alignment-button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.alignment-button:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.alignment-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
```

---

## Testing Checklist
- [ ] All 6 alignment functions work correctly
- [ ] Both distribution functions work correctly
- [ ] Keyboard shortcuts work
- [ ] Rotated objects align/distribute correctly
- [ ] Undo/redo works for all operations
- [ ] Yjs sync works for all operations
- [ ] UI buttons appear/disappear based on selection count

## Notes
- This PRD modifies Toolbar.tsx (new section) and adds new store actions
- Does not conflict with PRD-01 (bug fixes) or PRD-02 (properties panel)
- Consider adding "Align to Canvas" option in future (align to canvas center/edges)
