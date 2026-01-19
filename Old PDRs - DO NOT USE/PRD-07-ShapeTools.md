# PRD-07: Additional Shape Tools

## Overview
Add new shape drawing tools: Line, Arrow, Polygon, Star, and Rounded Rectangle.

**Priority:** MEDIUM
**Estimated Complexity:** Medium
**Files Affected:** `types/canvas.ts`, `Toolbar.tsx`, `Toolbar.css`, `Canvas.tsx`, `PropertiesPanel.tsx`, `canvasStore.ts`

---

## Background
Currently only Rectangle, Ellipse, Text, Frame, and Pen tools are available. Additional shape tools will expand creative possibilities and match standard design tool capabilities.

---

## User Stories

### US-074: Line Tool with Shift-Constraint
**Goal:** Draw straight lines between two points.

**Type Definition (types/canvas.ts):**
```typescript
interface LineObject extends BaseObject {
  type: 'line';
  x1: number; // Start point relative to object origin
  y1: number;
  x2: number; // End point relative to object origin
  y2: number;
  stroke: string;
  strokeWidth: number;
  // x, y, width, height calculated from points for bounding box
}
```

**Tool Implementation:**
- Click and drag to draw line from start to end point
- Shift constrains to 45° angle increments (0°, 45°, 90°, 135°, 180°, etc.)
- Line endpoints can be moved independently when selected

**Drawing Logic:**
```typescript
const handleLineDrawing = () => {
  const start = lineDrawStart.current;
  const end = lineDrawEnd.current;

  if (lineDrawShiftKey.current) {
    // Snap to 45° increments
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const length = Math.sqrt(dx * dx + dy * dy);

    end.x = start.x + Math.cos(snappedAngle) * length;
    end.y = start.y + Math.sin(snappedAngle) * length;
  }

  // Calculate bounding box
  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);

  const line: LineObject = {
    id: crypto.randomUUID(),
    type: 'line',
    x: minX,
    y: minY,
    width: maxX - minX || 1,
    height: maxY - minY || 1,
    x1: start.x - minX,
    y1: start.y - minY,
    x2: end.x - minX,
    y2: end.y - minY,
    rotation: 0,
    opacity: 1,
    stroke: '#ffffff',
    strokeWidth: 2,
    zIndex: getNextZIndex()
  };
};
```

**Keyboard Shortcut:** `L`

**Acceptance Criteria:**
- [ ] L key activates line tool
- [ ] Click-drag draws line
- [ ] Shift constrains to 45° angles
- [ ] Line renders correctly
- [ ] Line can be selected, moved, rotated
- [ ] Stroke color/width editable in properties

---

### US-075: Arrow Tool
**Goal:** Draw lines with arrowheads.

**Type Definition:**
```typescript
interface ArrowObject extends LineObject {
  type: 'arrow';
  arrowStart: boolean; // Arrowhead at start
  arrowEnd: boolean;   // Arrowhead at end (default: true)
  arrowSize: number;   // Size multiplier (default: 1)
}
```

**Arrowhead Rendering:**
```typescript
const drawArrowhead = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  strokeWidth: number
) => {
  const arrowLength = size * 12 * (strokeWidth / 2);
  const arrowWidth = size * 8 * (strokeWidth / 2);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-arrowLength, -arrowWidth / 2);
  ctx.lineTo(-arrowLength, arrowWidth / 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};
```

**Keyboard Shortcut:** `Shift+L`

**Acceptance Criteria:**
- [ ] Shift+L activates arrow tool
- [ ] Arrow draws with arrowhead at end by default
- [ ] Properties panel allows adding/removing arrowheads at start/end
- [ ] Arrow size adjustable
- [ ] Shift constrains angle like line tool

---

### US-076: Polygon Tool
**Goal:** Draw regular polygons with configurable number of sides.

**Type Definition:**
```typescript
interface PolygonObject extends BaseObject {
  type: 'polygon';
  sides: number; // 3-12, default: 6 (hexagon)
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}
```

**Drawing Logic:**
```typescript
const drawPolygon = (obj: PolygonObject) => {
  const cx = obj.width / 2;
  const cy = obj.height / 2;
  const radius = Math.min(obj.width, obj.height) / 2;
  const angleStep = (2 * Math.PI) / obj.sides;
  const startAngle = -Math.PI / 2; // Start at top

  ctx.beginPath();
  for (let i = 0; i < obj.sides; i++) {
    const angle = startAngle + i * angleStep;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
};
```

**Properties Panel Addition:**
- Sides slider/input (3-12)
- Number presets: Triangle (3), Square (4), Pentagon (5), Hexagon (6)

**Keyboard Shortcut:** `Y` (polygon)

**Acceptance Criteria:**
- [ ] Y key activates polygon tool
- [ ] Default is hexagon (6 sides)
- [ ] Can change sides in properties panel
- [ ] Shift constrains to equal width/height
- [ ] Polygon renders correctly at all rotations

---

### US-077: Star Tool
**Goal:** Draw star shapes with configurable points and inner radius.

**Type Definition:**
```typescript
interface StarObject extends BaseObject {
  type: 'star';
  points: number;      // 3-12, default: 5
  innerRadius: number; // 0-1 ratio of outer radius, default: 0.5
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}
```

**Drawing Logic:**
```typescript
const drawStar = (obj: StarObject) => {
  const cx = obj.width / 2;
  const cy = obj.height / 2;
  const outerRadius = Math.min(obj.width, obj.height) / 2;
  const innerRadius = outerRadius * obj.innerRadius;
  const angleStep = Math.PI / obj.points;
  const startAngle = -Math.PI / 2;

  ctx.beginPath();
  for (let i = 0; i < obj.points * 2; i++) {
    const angle = startAngle + i * angleStep;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
};
```

**Properties Panel Addition:**
- Points slider (3-12)
- Inner radius slider (10%-90%)

**Keyboard Shortcut:** `Shift+Y`

**Acceptance Criteria:**
- [ ] Shift+Y activates star tool
- [ ] Default is 5-point star
- [ ] Can adjust points and inner radius
- [ ] Star renders correctly at all sizes/rotations

---

### US-078: Rounded Rectangle
**Goal:** Add corner radius property to rectangles.

**Type Update:**
```typescript
interface RectangleObject extends BaseObject {
  type: 'rectangle';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number; // NEW: default 0
}
```

**Drawing Update:**
```typescript
const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};
```

**Properties Panel Addition:**
```typescript
// In Transform or Appearance section
{obj.type === 'rectangle' && (
  <EditablePropertyRow
    label="RADIUS"
    value={obj.cornerRadius || 0}
    onChange={(value) => updateObject(obj.id, { cornerRadius: value })}
    min={0}
    max={Math.min(obj.width, obj.height) / 2}
  />
)}
```

**Acceptance Criteria:**
- [ ] Corner radius property appears for rectangles
- [ ] Radius slider/input in properties panel
- [ ] Radius clamped to half of smallest dimension
- [ ] Rounded corners render correctly
- [ ] Works with fill and stroke

---

## Toolbar Updates

### New Tool Buttons
```typescript
// Toolbar.tsx - Add to tool buttons array
const tools = [
  { id: 'select', icon: <SelectIcon />, shortcut: 'V', tooltip: 'Select (V)' },
  { id: 'hand', icon: <HandIcon />, shortcut: 'H', tooltip: 'Hand (H)' },
  { id: 'rectangle', icon: <RectIcon />, shortcut: 'R', tooltip: 'Rectangle (R)' },
  { id: 'ellipse', icon: <EllipseIcon />, shortcut: 'O', tooltip: 'Ellipse (O)' },
  { id: 'line', icon: <LineIcon />, shortcut: 'L', tooltip: 'Line (L)' },
  { id: 'arrow', icon: <ArrowIcon />, shortcut: 'Shift+L', tooltip: 'Arrow (Shift+L)' },
  { id: 'polygon', icon: <PolygonIcon />, shortcut: 'Y', tooltip: 'Polygon (Y)' },
  { id: 'star', icon: <StarIcon />, shortcut: 'Shift+Y', tooltip: 'Star (Shift+Y)' },
  { id: 'text', icon: <TextIcon />, shortcut: 'T', tooltip: 'Text (T)' },
  { id: 'frame', icon: <FrameIcon />, shortcut: 'F', tooltip: 'Frame (F)' },
  { id: 'pen', icon: <PenIcon />, shortcut: 'P', tooltip: 'Pen (P)' },
];
```

### Tool Type Updates (types/canvas.ts)
```typescript
type ToolType = 'select' | 'hand' | 'rectangle' | 'ellipse' | 'line' | 'arrow' |
                'polygon' | 'star' | 'text' | 'frame' | 'pen';
```

---

## UI Specifications

### Tool Icons (SVG)
```
Line:     /
Arrow:    →
Polygon:  ⬡
Star:     ☆
```

### Properties Panel Sections
For polygon/star objects, add "Shape" section:
```css
.shape-section {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
}

.shape-section .property-row {
  margin-bottom: 8px;
}

.sides-presets {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.sides-preset-btn {
  flex: 1;
  padding: 4px;
  font-size: 11px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 4px;
  cursor: pointer;
}

.sides-preset-btn:hover {
  background: var(--color-bg-tertiary);
}
```

---

## Testing Checklist
- [ ] Line tool draws correctly with shift constraint
- [ ] Arrow tool renders arrowheads correctly
- [ ] Polygon tool works with 3-12 sides
- [ ] Star tool works with variable points and inner radius
- [ ] Rounded rectangle corners render correctly
- [ ] All new shapes can be selected, moved, resized, rotated
- [ ] All new shapes support fill and stroke
- [ ] Properties panel shows appropriate controls for each shape
- [ ] Keyboard shortcuts work for all new tools
- [ ] New shapes sync via Yjs
- [ ] Undo/redo works for new shape creation
- [ ] Copy/paste works for new shapes
- [ ] Export works for new shapes

## Dependencies
- None (additive feature, no prerequisites)

## Notes
- This PRD adds new functionality without modifying existing shapes
- Can be worked on in parallel with most other PRDs
- Consider adding more shapes in future (rounded polygon, donut, etc.)
- Line and arrow could share base implementation
