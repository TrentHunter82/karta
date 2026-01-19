# PRD-05: Snap & Grid System

## Overview
Add a configurable grid system with snap-to-grid and snap-to-objects functionality for precise object placement.

**Priority:** HIGH
**Estimated Complexity:** Medium
**Files Affected:** `canvasStore.ts`, `Canvas.tsx`, `StatusBar.tsx`, `Canvas.css`

---

## Background
Currently, users must manually position objects using X/Y coordinates or freehand dragging. A grid and snap system will enable precise, aligned layouts without tedious coordinate entry.

---

## User Stories

### US-063: Configurable Grid Display
**Goal:** Allow users to show/hide a grid and configure its size.

**State Addition (canvasStore.ts):**
```typescript
interface GridSettings {
  visible: boolean;
  size: number; // pixels
  snapEnabled: boolean;
  snapToObjects: boolean;
}

// Add to CanvasState
gridSettings: GridSettings;

// Default values
gridSettings: {
  visible: true,
  size: 20,
  snapEnabled: true,
  snapToObjects: true
}
```

**Actions:**
```typescript
setGridVisible: (visible: boolean) => void;
setGridSize: (size: number) => void;
setSnapEnabled: (enabled: boolean) => void;
setSnapToObjects: (enabled: boolean) => void;
```

**Grid Rendering (Canvas.tsx):**
```typescript
const drawGrid = () => {
  if (!gridSettings.visible) return;

  const gridSize = gridSettings.size * viewport.zoom;
  const offsetX = (viewport.x * viewport.zoom) % gridSize;
  const offsetY = (viewport.y * viewport.zoom) % gridSize;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = offsetX; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = offsetY; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
};
```

**Acceptance Criteria:**
- [ ] Grid displays with configurable spacing
- [ ] Grid scales correctly with zoom
- [ ] Grid pans correctly with viewport
- [ ] Grid can be toggled on/off
- [ ] Grid size can be changed (10px, 20px, 50px, 100px presets)

---

### US-064: Snap to Grid When Moving/Resizing
**Goal:** Objects snap to grid lines when being moved or resized.

**Snap Helper Function:**
```typescript
const snapToGrid = (value: number, gridSize: number): number => {
  return Math.round(value / gridSize) * gridSize;
};

const snapPosition = (x: number, y: number): { x: number; y: number } => {
  const { gridSettings } = useCanvasStore.getState();
  if (!gridSettings.snapEnabled) return { x, y };

  return {
    x: snapToGrid(x, gridSettings.size),
    y: snapToGrid(y, gridSettings.size)
  };
};
```

**Integration Points:**
1. **Moving objects:** In `handleMouseMove` when `isDragging`, snap the final position
2. **Resizing objects:** In resize handler, snap width/height and positions
3. **Drawing new objects:** Snap start and end points when creating rectangles/frames

**Visual Feedback:**
- Show snapped position preview while dragging
- Optional: highlight grid lines being snapped to

**Acceptance Criteria:**
- [ ] Objects snap to grid when moved (with snap enabled)
- [ ] Object edges snap during resize
- [ ] New shapes snap when being drawn
- [ ] Holding Alt/Option temporarily disables snap
- [ ] Snap works correctly at all zoom levels

---

### US-065: Snap to Other Objects
**Goal:** Objects snap to edges and centers of other objects.

**Snap Points to Consider:**
- Left edge, right edge, horizontal center
- Top edge, bottom edge, vertical center

**Implementation:**
```typescript
interface SnapGuide {
  type: 'horizontal' | 'vertical';
  position: number; // canvas coordinate
  sourceId: string;
}

const findSnapGuides = (
  movingIds: Set<string>,
  movingBounds: { x: number; y: number; width: number; height: number }
): SnapGuide[] => {
  const guides: SnapGuide[] = [];
  const threshold = 5 / viewport.zoom; // 5 screen pixels

  const movingLeft = movingBounds.x;
  const movingRight = movingBounds.x + movingBounds.width;
  const movingCenterX = movingBounds.x + movingBounds.width / 2;
  const movingTop = movingBounds.y;
  const movingBottom = movingBounds.y + movingBounds.height;
  const movingCenterY = movingBounds.y + movingBounds.height / 2;

  objects.forEach((obj, id) => {
    if (movingIds.has(id)) return;

    const objRight = obj.x + obj.width;
    const objCenterX = obj.x + obj.width / 2;
    const objBottom = obj.y + obj.height;
    const objCenterY = obj.y + obj.height / 2;

    // Check vertical guides (for horizontal alignment)
    const verticalChecks = [
      { moving: movingLeft, target: obj.x },
      { moving: movingLeft, target: objRight },
      { moving: movingRight, target: obj.x },
      { moving: movingRight, target: objRight },
      { moving: movingCenterX, target: objCenterX }
    ];

    verticalChecks.forEach(({ moving, target }) => {
      if (Math.abs(moving - target) < threshold) {
        guides.push({ type: 'vertical', position: target, sourceId: id });
      }
    });

    // Similar for horizontal guides...
  });

  return guides;
};
```

**Acceptance Criteria:**
- [ ] Objects snap to edges of other objects
- [ ] Objects snap to centers of other objects
- [ ] Snap threshold is zoom-independent (always ~5 screen pixels)
- [ ] Can be toggled independently of grid snap

---

### US-066: Smart Guides Display
**Goal:** Show visual guides when snapping to objects.

**Guide Rendering:**
```typescript
const drawSnapGuides = (guides: SnapGuide[]) => {
  ctx.save();
  ctx.strokeStyle = '#ff00ff'; // Magenta for visibility
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  guides.forEach(guide => {
    ctx.beginPath();
    if (guide.type === 'vertical') {
      const screenX = (guide.position + viewport.x) * viewport.zoom;
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, canvas.height);
    } else {
      const screenY = (guide.position + viewport.y) * viewport.zoom;
      ctx.moveTo(0, screenY);
      ctx.lineTo(canvas.width, screenY);
    }
    ctx.stroke();
  });

  ctx.restore();
};
```

**Guide Behavior:**
- Guides appear when within snap threshold
- Guides disappear immediately when moving away
- Multiple guides can show simultaneously (horizontal + vertical)

**Acceptance Criteria:**
- [ ] Magenta/pink dashed lines show snap alignment
- [ ] Guides span full canvas width/height
- [ ] Guides update in real-time during drag
- [ ] Guides disappear when not snapping

---

### US-067: Grid Settings UI
**Goal:** Add grid controls to the status bar.

**UI Location:** Status bar, between selection info and zoom controls

**UI Design:**
```
[Position: X, Y] | [Selection: 2 objects] | [Grid: On ▾] [Snap: On ▾] | [Zoom: 100%]
```

**Grid Dropdown Options:**
- Grid: On / Off
- Grid Size: 10px / 20px / 50px / 100px / Custom...

**Snap Dropdown Options:**
- Snap to Grid: On / Off
- Snap to Objects: On / Off

**Implementation (StatusBar.tsx):**
```typescript
const GridControls = () => {
  const { gridSettings, setGridVisible, setGridSize, setSnapEnabled, setSnapToObjects } = useCanvasStore();
  const [showGridMenu, setShowGridMenu] = useState(false);

  return (
    <div className="grid-controls">
      <button
        className={`grid-toggle ${gridSettings.visible ? 'active' : ''}`}
        onClick={() => setGridVisible(!gridSettings.visible)}
        title="Toggle Grid (G)"
      >
        <GridIcon />
      </button>
      <button
        className={`snap-toggle ${gridSettings.snapEnabled ? 'active' : ''}`}
        onClick={() => setSnapEnabled(!gridSettings.snapEnabled)}
        title="Toggle Snap (S)"
      >
        <SnapIcon />
      </button>
    </div>
  );
};
```

**Keyboard Shortcuts:**
- `G` - Toggle grid visibility
- `Shift+G` - Open grid size menu
- `S` - Toggle snap to grid
- `Shift+S` - Toggle snap to objects

**Acceptance Criteria:**
- [ ] Grid toggle button in status bar
- [ ] Snap toggle button in status bar
- [ ] Grid size can be changed
- [ ] Keyboard shortcuts work
- [ ] Settings persist in session

---

## UI Specifications

### Grid Appearance
```css
/* Grid lines */
.grid-line {
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 1;
}

/* Major grid lines (every 5 units) */
.grid-line-major {
  stroke: rgba(255, 255, 255, 0.15);
}
```

### Snap Guide Appearance
```css
/* Snap guides */
.snap-guide {
  stroke: #ff00ff;
  stroke-width: 1;
  stroke-dasharray: 4 4;
}
```

### Status Bar Controls
```css
.grid-controls {
  display: flex;
  gap: 4px;
  padding: 0 8px;
  border-left: 1px solid var(--color-border);
}

.grid-toggle, .snap-toggle {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--color-text-tertiary);
  cursor: pointer;
}

.grid-toggle.active, .snap-toggle.active {
  color: var(--color-accent);
  background: rgba(0, 102, 255, 0.1);
}
```

---

## Testing Checklist
- [ ] Grid displays correctly at all zoom levels
- [ ] Grid pans correctly with viewport
- [ ] Snap to grid works for move, resize, and draw operations
- [ ] Snap to objects works with multiple objects
- [ ] Smart guides appear and disappear correctly
- [ ] Alt key temporarily disables snap
- [ ] Grid size changes take effect immediately
- [ ] Keyboard shortcuts work
- [ ] No performance issues with grid rendering
- [ ] Yjs sync not affected by snap operations

## Dependencies
- None (independent feature)

## Notes
- This PRD is independent and can be worked on in parallel with others
- Consider adding "snap to canvas center" in future iteration
- Grid settings could be saved to localStorage for persistence across sessions
