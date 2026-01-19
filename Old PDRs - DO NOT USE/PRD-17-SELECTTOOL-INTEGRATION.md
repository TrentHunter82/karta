# PRD-17: Integrate SelectTool into Canvas.tsx

## Overview

Wire up the new tool system to Canvas.tsx so SelectTool is actually used. This proves the architecture works before extracting more tools.

## Goal

- Canvas.tsx uses ToolManager for select tool functionality
- All existing select/move/resize/rotate behavior works identically
- Canvas.tsx shrinks by removing inline select tool logic
- Other tools (rectangle, ellipse, etc.) still work via old code temporarily

## Implementation Steps

### Step 1: Create ToolContext in Canvas.tsx

Add a function that creates the ToolContext interface from Canvas's existing state and methods:

```typescript
// Inside Canvas component, create the context for tools
const createToolContext = useCallback((): ToolContext => ({
  // Read-only state access
  getObjects: () => objects,
  getSelectedIds: () => selectedIds,
  getViewport: () => viewport,
  
  // State mutations - delegate to store
  addObject: (obj) => addObject(obj),
  updateObject: (id, changes) => updateObject(id, changes),
  updateObjects: (updates) => updateObjects(updates),
  deleteObject: (id) => deleteObject(id),
  setSelection: (ids) => setSelection(ids),
  pushHistory: () => pushHistory(),
  
  // Coordinate conversion - use existing functions
  screenToCanvas: (x, y) => screenToCanvas(x, y),
  canvasToScreen: (x, y) => canvasToScreen(x, y),
  
  // Utilities
  getNextZIndex: () => getNextZIndex(),
  hitTest: (x, y) => hitTestObject(x, y),  // Use existing hit test
  getObjectsInRect: (rect) => getObjectsInRect(rect),  // Use existing or spatial index
}), [objects, selectedIds, viewport, /* other deps */]);
```

### Step 2: Instantiate ToolManager

```typescript
// At top of Canvas component
const toolContextRef = useRef<ToolContext | null>(null);
const toolManagerRef = useRef<ToolManager | null>(null);

// Update context when dependencies change
useEffect(() => {
  toolContextRef.current = createToolContext();
  
  if (!toolManagerRef.current) {
    toolManagerRef.current = new ToolManager(toolContextRef.current);
  } else {
    // Update context reference if manager exists
    toolManagerRef.current.updateContext(toolContextRef.current);
  }
}, [createToolContext]);
```

**Note:** You may need to add an `updateContext` method to ToolManager:

```typescript
// In ToolManager.ts
updateContext(ctx: ToolContext): void {
  this.ctx = ctx;
  // Update context for all registered tools
  this.tools.forEach(tool => tool.updateContext(ctx));
}

// In BaseTool.ts
updateContext(ctx: ToolContext): void {
  this.ctx = ctx;
}
```

### Step 3: Route Events Through ToolManager (Select Tool Only)

Modify mouse handlers to use ToolManager when select tool is active:

```typescript
const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  const pos = screenToCanvas(e.clientX, e.clientY);
  
  // Use new tool system for select tool
  if (activeTool === 'select' && toolManagerRef.current) {
    toolManagerRef.current.setActiveTool('select');
    const handled = toolManagerRef.current.handleMouseDown(e.nativeEvent, pos);
    if (handled) return;
  }
  
  // Fall through to existing logic for other tools
  // ... existing handleMouseDown code for rectangle, ellipse, etc.
}, [activeTool, screenToCanvas, /* other deps */]);

const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  const pos = screenToCanvas(e.clientX, e.clientY);
  
  if (activeTool === 'select' && toolManagerRef.current) {
    const handled = toolManagerRef.current.handleMouseMove(e.nativeEvent, pos);
    if (handled) {
      // Update cursor
      const cursor = toolManagerRef.current.getCursor();
      if (canvasRef.current) {
        canvasRef.current.style.cursor = cursor;
      }
      return;
    }
  }
  
  // ... existing handleMouseMove code
}, [activeTool, screenToCanvas]);

const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  const pos = screenToCanvas(e.clientX, e.clientY);
  
  if (activeTool === 'select' && toolManagerRef.current) {
    const handled = toolManagerRef.current.handleMouseUp(e.nativeEvent, pos);
    if (handled) return;
  }
  
  // ... existing handleMouseUp code
}, [activeTool, screenToCanvas]);
```

### Step 4: Route Keyboard Events

```typescript
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if (activeTool === 'select' && toolManagerRef.current) {
    const handled = toolManagerRef.current.handleKeyDown(e);
    if (handled) return;
  }
  
  // ... existing keyboard handling
}, [activeTool]);
```

### Step 5: Render Tool Overlay

In the render/draw function, add tool overlay rendering:

```typescript
const draw = useCallback(() => {
  // ... existing drawing code ...
  
  // After drawing objects and selection, render tool overlay
  if (toolManagerRef.current) {
    toolManagerRef.current.renderOverlay(ctx);
  }
}, [/* deps */]);
```

### Step 6: Handle Double-Click

```typescript
const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  const pos = screenToCanvas(e.clientX, e.clientY);
  
  if (activeTool === 'select' && toolManagerRef.current) {
    const handled = toolManagerRef.current.handleDoubleClick(e.nativeEvent, pos);
    if (handled) return;
  }
  
  // ... existing double-click handling
}, [activeTool, screenToCanvas]);
```

### Step 7: Sync Active Tool with Store

When `activeTool` changes in the store, update ToolManager:

```typescript
useEffect(() => {
  if (toolManagerRef.current && activeTool === 'select') {
    toolManagerRef.current.setActiveTool('select');
  }
}, [activeTool]);
```

## Testing Strategy

1. **Manual Testing Checklist:**
   - [ ] Click to select single object
   - [ ] Shift+click to add to selection
   - [ ] Click empty space to deselect
   - [ ] Drag to move selected objects
   - [ ] Drag corner handle to resize
   - [ ] Shift+drag to maintain aspect ratio
   - [ ] Drag rotation handle to rotate
   - [ ] Shift+rotate snaps to 15° increments
   - [ ] Drag on empty space for marquee selection
   - [ ] Double-click text to edit
   - [ ] Double-click group to enter edit mode
   - [ ] Locked objects can't be moved/resized
   - [ ] Undo/redo works after moves

2. **Run existing tests:**
   ```bash
   npm test
   ```
   All 115 tests should still pass.

## What NOT to Change Yet

- Don't remove the old select tool code yet - keep it as fallback
- Don't extract other tools yet - prove this works first
- Don't modify canvasStore.ts
- Don't modify collaborationStore.ts

## Status: ✅ COMPLETED

## Success Criteria

- [x] SelectTool works identically to before
- [x] All 115 tests pass (now 392+ tests)
- [x] No console errors
- [x] Collaboration still works (test with 2 browser tabs)
- [x] Undo/redo works correctly

## Rollback Plan

If something breaks badly, the integration is isolated:

```typescript
// Quick disable - just bypass ToolManager
if (activeTool === 'select' && toolManagerRef.current && USE_NEW_TOOL_SYSTEM) {
  // new code
}
```

Add `const USE_NEW_TOOL_SYSTEM = true;` at top of file, set to `false` to rollback.

## Files to Modify

- `src/components/Canvas.tsx` - Add ToolManager integration
- `src/tools/ToolManager.ts` - Add `updateContext()` method
- `src/tools/BaseTool.ts` - Add `updateContext()` method

## After This Works

Once SelectTool is proven working in Canvas.tsx:
1. Remove the old inline select tool code from Canvas.tsx
2. Extract HandTool (simplest)
3. Extract drawing tools (Rectangle, Ellipse, etc.)
4. Canvas.tsx becomes a thin coordinator
