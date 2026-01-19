# PRD-09: Zoom & Navigation UX

## Overview
Enhance zoom and navigation controls with fit-to-content, zoom presets, and optional minimap.

**Priority:** MEDIUM
**Estimated Complexity:** Low
**Files Affected:** `canvasStore.ts`, `Canvas.tsx`, `StatusBar.tsx`, `StatusBar.css`

---

## Background
Current zoom controls are basic (buttons and mouse wheel). Design tools typically offer zoom-to-fit, zoom-to-selection, and minimap navigation for easier canvas navigation.

---

## User Stories

### US-085: Zoom to Fit All Objects
**Goal:** Center and zoom the viewport to show all objects.

**Store Action (canvasStore.ts):**
```typescript
zoomToFit: () => {
  const state = get();
  const objects = Array.from(state.objects.values());

  if (objects.length === 0) {
    // Reset to center with 100% zoom
    set({ viewport: { x: 0, y: 0, zoom: 1 } });
    return;
  }

  // Calculate bounding box of all objects
  const bounds = calculateBoundingBox(objects);

  // Get canvas dimensions (from DOM or stored)
  const canvasWidth = window.innerWidth - 260; // Subtract toolbar + properties panel
  const canvasHeight = window.innerHeight - 80; // Subtract topbar + statusbar

  // Calculate zoom to fit with padding
  const padding = 50;
  const scaleX = (canvasWidth - padding * 2) / bounds.width;
  const scaleY = (canvasHeight - padding * 2) / bounds.height;
  const zoom = Math.min(scaleX, scaleY, 5); // Cap at 500%

  // Calculate center position
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  // Set viewport to center content
  const viewportX = -centerX + (canvasWidth / 2) / zoom;
  const viewportY = -centerY + (canvasHeight / 2) / zoom;

  set({
    viewport: {
      x: viewportX,
      y: viewportY,
      zoom: Math.max(0.1, Math.min(zoom, 5))
    }
  });
}
```

**Keyboard Shortcut:** `Ctrl+0` or `Ctrl+Shift+0`

**Acceptance Criteria:**
- [ ] Zoom to fit shows all objects with padding
- [ ] Works with any number of objects
- [ ] Empty canvas resets to center at 100%
- [ ] Respects min/max zoom limits

---

### US-086: Zoom to Fit Selection
**Goal:** Center and zoom the viewport to show selected objects.

**Store Action:**
```typescript
zoomToSelection: () => {
  const state = get();
  const selectedObjects = Array.from(state.selectedIds)
    .map(id => state.objects.get(id))
    .filter((obj): obj is CanvasObject => obj !== undefined);

  if (selectedObjects.length === 0) {
    // Fall back to zoom to fit all
    state.zoomToFit();
    return;
  }

  const bounds = calculateBoundingBox(selectedObjects);

  // Same calculation as zoomToFit but using selection bounds
  const canvasWidth = window.innerWidth - 260;
  const canvasHeight = window.innerHeight - 80;
  const padding = 50;

  const scaleX = (canvasWidth - padding * 2) / bounds.width;
  const scaleY = (canvasHeight - padding * 2) / bounds.height;
  const zoom = Math.min(scaleX, scaleY, 5);

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  const viewportX = -centerX + (canvasWidth / 2) / zoom;
  const viewportY = -centerY + (canvasHeight / 2) / zoom;

  set({
    viewport: {
      x: viewportX,
      y: viewportY,
      zoom: Math.max(0.1, Math.min(zoom, 5))
    }
  });
}
```

**Keyboard Shortcut:** `Ctrl+2` or `Shift+2`

**Acceptance Criteria:**
- [ ] Zoom to selection shows selected objects with padding
- [ ] Falls back to zoom-to-fit if nothing selected
- [ ] Works with single and multiple selections

---

### US-087: Zoom Preset Buttons
**Goal:** Quick access to common zoom levels.

**Status Bar Enhancement:**
```typescript
const ZoomControls = () => {
  const { viewport, setViewport, zoomToFit, zoomToSelection } = useCanvasStore();
  const [showMenu, setShowMenu] = useState(false);

  const presets = [
    { label: '50%', value: 0.5 },
    { label: '100%', value: 1 },
    { label: '200%', value: 2 },
    { label: '400%', value: 4 },
  ];

  const setZoomPreset = (zoom: number) => {
    // Zoom toward canvas center
    const canvasWidth = window.innerWidth - 260;
    const canvasHeight = window.innerHeight - 80;
    const centerX = -viewport.x + canvasWidth / 2 / viewport.zoom;
    const centerY = -viewport.y + canvasHeight / 2 / viewport.zoom;

    setViewport({
      x: -centerX + canvasWidth / 2 / zoom,
      y: -centerY + canvasHeight / 2 / zoom,
      zoom
    });
  };

  return (
    <div className="zoom-controls">
      <button onClick={() => zoomOut()} title="Zoom Out (Ctrl+-)">−</button>

      <button
        className="zoom-display"
        onClick={() => setShowMenu(!showMenu)}
        title="Zoom presets"
      >
        {Math.round(viewport.zoom * 100)}%
      </button>

      <button onClick={() => zoomIn()} title="Zoom In (Ctrl+=)">+</button>

      {showMenu && (
        <div className="zoom-menu">
          <button onClick={() => { zoomToFit(); setShowMenu(false); }}>
            Fit All (Ctrl+0)
          </button>
          <button onClick={() => { zoomToSelection(); setShowMenu(false); }}>
            Fit Selection (Ctrl+2)
          </button>
          <div className="zoom-menu-divider" />
          {presets.map(preset => (
            <button
              key={preset.value}
              onClick={() => { setZoomPreset(preset.value); setShowMenu(false); }}
              className={viewport.zoom === preset.value ? 'active' : ''}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

**Keyboard Shortcuts:**
- `Ctrl+1` - Zoom to 100%
- `Ctrl+2` - Zoom to selection
- `Ctrl+3` - Zoom to 200%
- `Ctrl+0` - Fit all

**Acceptance Criteria:**
- [ ] Zoom percentage button opens preset menu
- [ ] Presets (50%, 100%, 200%, 400%) work correctly
- [ ] "Fit All" and "Fit Selection" options in menu
- [ ] Keyboard shortcuts work

---

### US-088: Minimap Navigation Overlay
**Goal:** Optional minimap showing overview of canvas with viewport indicator.

**Component (Canvas.tsx or new Minimap.tsx):**
```typescript
const Minimap = () => {
  const { objects, viewport, setViewport } = useCanvasStore();
  const minimapSize = { width: 150, height: 100 };
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate bounds of all objects plus viewport
  const allObjects = Array.from(objects.values());
  const contentBounds = calculateBoundingBox(allObjects);

  // Expand bounds to include current viewport
  const viewportBounds = getViewportBounds(viewport);
  const totalBounds = unionBounds(contentBounds, viewportBounds);

  // Calculate scale to fit in minimap
  const scale = Math.min(
    minimapSize.width / totalBounds.width,
    minimapSize.height / totalBounds.height
  ) * 0.9;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, minimapSize.width, minimapSize.height);

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, minimapSize.width, minimapSize.height);

    // Translate to center content
    ctx.save();
    ctx.translate(
      minimapSize.width / 2 - totalBounds.width * scale / 2 - totalBounds.x * scale,
      minimapSize.height / 2 - totalBounds.height * scale / 2 - totalBounds.y * scale
    );
    ctx.scale(scale, scale);

    // Draw objects as simplified shapes
    allObjects.forEach(obj => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    });

    // Draw viewport rectangle
    const vp = getViewportBounds(viewport);
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 2 / scale;
    ctx.strokeRect(vp.x, vp.y, vp.width, vp.height);

    ctx.restore();
  }, [objects, viewport, scale]);

  const handleMinimapClick = (e: React.MouseEvent) => {
    // Convert click to canvas coordinates and pan there
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale - totalBounds.x;
    const y = (e.clientY - rect.top) / scale - totalBounds.y;

    // Center viewport on clicked position
    const canvasWidth = window.innerWidth - 260;
    const canvasHeight = window.innerHeight - 80;

    setViewport({
      ...viewport,
      x: -x + canvasWidth / 2 / viewport.zoom,
      y: -y + canvasHeight / 2 / viewport.zoom
    });
  };

  return (
    <div className="minimap" onClick={handleMinimapClick}>
      <canvas
        ref={canvasRef}
        width={minimapSize.width}
        height={minimapSize.height}
      />
    </div>
  );
};
```

**Toggle Behavior:**
- Minimap appears in bottom-left corner of canvas
- Toggle via View menu or keyboard shortcut (M)
- Draggable viewport indicator

**Acceptance Criteria:**
- [ ] Minimap shows simplified canvas overview
- [ ] Viewport indicator shows visible area
- [ ] Click on minimap pans to that location
- [ ] Can drag viewport indicator to pan
- [ ] Toggle minimap on/off
- [ ] Minimap updates in real-time

---

### US-089: Keyboard Zoom to Cursor Position
**Goal:** Ctrl+scroll and keyboard zoom should zoom toward cursor position.

**Current Behavior:** Mouse wheel zoom already zooms toward cursor.

**Enhancement for Keyboard Zoom:**
```typescript
// In useKeyboardShortcuts.ts
const handleZoomShortcut = (zoomIn: boolean) => {
  const state = useCanvasStore.getState();
  const { viewport, cursorPosition } = state;

  // If cursor is on canvas, zoom toward it
  // Otherwise zoom toward center
  const zoomCenter = cursorPosition || {
    x: -viewport.x + (window.innerWidth - 260) / 2 / viewport.zoom,
    y: -viewport.y + (window.innerHeight - 80) / 2 / viewport.zoom
  };

  const zoomFactor = zoomIn ? 1.25 : 0.8;
  const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * zoomFactor));

  // Calculate new viewport position to keep zoomCenter fixed
  const newX = viewport.x - zoomCenter.x * (1 / viewport.zoom - 1 / newZoom);
  const newY = viewport.y - zoomCenter.y * (1 / viewport.zoom - 1 / newZoom);

  useCanvasStore.getState().setViewport({
    x: newX,
    y: newY,
    zoom: newZoom
  });
};
```

**Acceptance Criteria:**
- [ ] Ctrl++ zooms toward cursor if on canvas
- [ ] Ctrl+- zooms toward cursor if on canvas
- [ ] Falls back to center zoom when cursor not on canvas

---

## UI Specifications

### Zoom Menu Styling
```css
.zoom-controls {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
}

.zoom-display {
  min-width: 50px;
  padding: 4px 8px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-primary);
  font-size: 11px;
  cursor: pointer;
}

.zoom-menu {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 4px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 4px;
  min-width: 150px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.zoom-menu button {
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.zoom-menu button:hover {
  background: var(--color-bg-tertiary);
}

.zoom-menu button.active {
  color: var(--color-accent);
}

.zoom-menu-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}
```

### Minimap Styling
```css
.minimap {
  position: absolute;
  bottom: 20px;
  left: 20px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.minimap canvas {
  display: block;
}

.minimap:hover {
  border-color: var(--color-accent);
}
```

---

## Testing Checklist
- [ ] Zoom to fit shows all objects correctly
- [ ] Zoom to fit handles empty canvas
- [ ] Zoom to selection shows selected objects
- [ ] Zoom to selection falls back when nothing selected
- [ ] Zoom presets (50%, 100%, 200%, 400%) work
- [ ] Zoom menu opens and closes correctly
- [ ] Keyboard shortcuts work (Ctrl+0, Ctrl+1, Ctrl+2, Ctrl+3)
- [ ] Minimap renders correct overview
- [ ] Minimap click navigates correctly
- [ ] Minimap viewport indicator updates with pan/zoom
- [ ] Keyboard zoom considers cursor position

## Dependencies
- None (independent feature)

## Notes
- Minimap is optional and can be deferred if complexity is a concern
- Consider saving minimap visibility preference to localStorage
- Future: add zoom slider in addition to buttons
