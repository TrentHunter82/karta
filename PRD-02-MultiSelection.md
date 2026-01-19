# PRD-02: Multi-Selection Property Editing

## Overview
Enable editing properties when multiple objects are selected, showing shared values and applying changes to all selected objects.

**Priority:** MEDIUM
**Estimated Complexity:** Medium
**Files Affected:** `PropertiesPanel.tsx`, `PropertiesPanel.css` only

---

## Background
Currently, the Properties Panel shows "---" for all values when multiple objects are selected, with all controls disabled. Users must select objects one at a time to edit properties, which is tedious.

**Current behavior (PropertiesPanel.tsx:1414-1419):**
```typescript
const singleSelection = selectedObjects.length === 1 ? selectedObjects[0] : null;
// All controls check singleSelection and show "---" if null
```

---

## User Stories

### US-045: Show Mixed Values for Multi-Selection
**Goal:** When multiple objects are selected, show their shared values or indicate "mixed".

**Behavior:**
- If all selected objects have the same value → show that value
- If values differ → show "Mixed" or "---"
- Example: 3 rectangles with same fill color → show that color
- Example: 3 objects with different X positions → show "Mixed"

**Implementation:**
```typescript
function getSharedValue<T>(
  objects: CanvasObject[],
  getter: (obj: CanvasObject) => T
): T | 'mixed' | undefined {
  if (objects.length === 0) return undefined;
  const firstValue = getter(objects[0]);
  const allSame = objects.every(obj => getter(obj) === firstValue);
  return allSame ? firstValue : 'mixed';
}
```

**UI Changes:**
- "Mixed" displayed in italic gray text
- Input fields show placeholder "Mixed" instead of value
- Color swatches show gradient/striped pattern for mixed colors

**Acceptance Criteria:**
- [ ] Select 2 rectangles with same fill → fill color shown
- [ ] Select 2 rectangles with different fills → "Mixed" shown
- [ ] Select 3 objects with same X → X value shown
- [ ] Select 3 objects with different X → "Mixed" shown

---

### US-046: Batch Edit Transform Properties
**Goal:** Editing X, Y, Width, Height, or Rotation applies to all selected objects.

**Behavior - Absolute vs Relative:**
- **X/Y Position:** Set all to same value OR apply delta to all
  - Option A: All objects move to exact X=100 (absolute)
  - Option B: All objects shift by +10 (relative) - better UX
- **Width/Height:** Set all to same size (absolute)
- **Rotation:** Set all to same angle (absolute)

**Recommended:** Use relative positioning (delta) for X/Y, absolute for size/rotation.

**Implementation:**
```typescript
const handleXChange = (newValue: number) => {
  if (selectedObjects.length === 1) {
    updateObject(selectedObjects[0].id, { x: newValue });
  } else {
    // Calculate delta from first object's current position
    const delta = newValue - selectedObjects[0].x;
    const updates = selectedObjects.map(obj => ({
      id: obj.id,
      changes: { x: obj.x + delta }
    }));
    updateObjects(updates);
  }
};
```

**Acceptance Criteria:**
- [ ] Select 2 objects, change X → both move (relative)
- [ ] Select 2 objects, change Width → both resize to same width
- [ ] Select 2 objects, change Rotation → both rotate to same angle
- [ ] Undo reverses all changes in one step

---

### US-047: Batch Edit Appearance Properties
**Goal:** Editing Opacity, Fill, and Stroke applies to all selected objects.

**Behavior:**
- **Opacity:** All objects set to same opacity (absolute)
- **Fill Color:** All objects set to same fill color
- **Fill Enable/Disable:** Toggle fill for all objects
- **Stroke Color:** All objects set to same stroke color
- **Stroke Width:** All objects set to same stroke width
- **Stroke Enable/Disable:** Toggle stroke for all objects

**Mixed State Toggle Behavior:**
- If some objects have fill and some don't → checkbox shows indeterminate state
- Clicking indeterminate checkbox enables fill for all
- Clicking again disables fill for all

**Implementation:**
```typescript
// Indeterminate checkbox state
const fillStates = selectedObjects.map(obj => obj.fill !== undefined);
const allHaveFill = fillStates.every(Boolean);
const noneHaveFill = fillStates.every(s => !s);
const isIndeterminate = !allHaveFill && !noneHaveFill;

// Checkbox rendering
<input
  type="checkbox"
  checked={allHaveFill}
  ref={el => el && (el.indeterminate = isIndeterminate)}
  onChange={() => {
    const newFill = allHaveFill ? undefined : '#ffffff';
    updateObjects(selectedObjects.map(obj => ({
      id: obj.id,
      changes: { fill: newFill }
    })));
  }}
/>
```

**Acceptance Criteria:**
- [ ] Select 2 objects, change opacity → both update
- [ ] Select 2 objects (1 with fill, 1 without) → indeterminate checkbox
- [ ] Click indeterminate checkbox → all get fill
- [ ] Select 2 objects, pick fill color → both update

---

### US-048: Update Constrain Proportions for Multi-Selection
**Goal:** Constrain proportions toggle works sensibly with multiple objects.

**Behavior:**
- When constrain is ON and width is changed:
  - Each object's height is scaled by its own aspect ratio
  - Objects maintain their individual proportions, not a shared ratio

**Implementation:**
```typescript
const handleWidthChange = (newWidth: number) => {
  pushHistory();
  if (constrainProportions) {
    updateObjects(selectedObjects.map(obj => {
      const aspectRatio = obj.height / obj.width;
      return {
        id: obj.id,
        changes: {
          width: newWidth,
          height: Math.round(newWidth * aspectRatio)
        }
      };
    }));
  } else {
    updateObjects(selectedObjects.map(obj => ({
      id: obj.id,
      changes: { width: newWidth }
    })));
  }
};
```

**Acceptance Criteria:**
- [ ] Select 2 objects (100x50 and 200x100), constrain ON, set width=150
- [ ] First becomes 150x75, second becomes 150x75 (each maintains own ratio)

---

### US-049: Hierarchy Selection Sync
**Goal:** Multi-selection in hierarchy panel reflects correctly.

**Current:** Shift+click and Ctrl+click work in hierarchy panel.

**Enhancement:** Show selection count in hierarchy header:
- "1 object" / "3 objects" / "All (5 objects)"

**Acceptance Criteria:**
- [ ] Hierarchy header shows accurate count
- [ ] Ctrl+click in hierarchy toggles selection correctly
- [ ] Shift+click in hierarchy extends selection correctly

---

## UI/UX Specifications

### Mixed Value Display
```css
.property-value.mixed {
  color: var(--color-text-tertiary);
  font-style: italic;
}
```

### Indeterminate Checkbox
```css
input[type="checkbox"]:indeterminate {
  opacity: 0.5;
}
```

### Multi-Selection Indicator
Add subtle badge or highlight to properties panel header when multiple objects selected.

---

## Testing Checklist
- [ ] All transform properties work with multi-selection
- [ ] All appearance properties work with multi-selection
- [ ] Mixed values display correctly
- [ ] Indeterminate checkboxes work correctly
- [ ] Undo/redo works correctly for batch edits
- [ ] Yjs sync works for batch updates
- [ ] No regressions with single selection editing

## Notes
- This PRD is isolated to PropertiesPanel - no conflicts with other PRDs
- Uses existing `updateObjects` batch action from canvasStore
- Consider caching aspect ratios for constrain proportions performance
