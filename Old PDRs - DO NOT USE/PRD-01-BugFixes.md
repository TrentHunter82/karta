# PRD-01: Critical Bug Fixes & Stability

## Overview
Fix critical bugs that affect core functionality and stability.

**Priority:** HIGH
**Estimated Complexity:** Medium
**Files Affected:** `canvasStore.ts`, `collaborationStore.ts`, `Canvas.tsx` (specific sections only)

---

## User Stories

### US-040: Fix Redo Logic Bug
**Problem:** The `canRedo()` function has an incorrect condition that prevents redo in most scenarios.

**Current Code (canvasStore.ts:569):**
```typescript
canRedo: () => {
  const state = get();
  return state.historyIndex < state.history.length - 2; // BUG: should be -1
}
```

**Root Cause:** After undo, historyIndex points to current state. The `-2` check is too restrictive.

**Fix:**
```typescript
canRedo: () => {
  const state = get();
  return state.historyIndex < state.history.length - 1;
}
```

**Also review:** The `redo()` function's `targetIndex = state.historyIndex + 2` logic on line 577 - this may need adjustment to `+1`.

**Acceptance Criteria:**
- [ ] Create 3 objects, undo twice, redo twice - all operations work
- [ ] Undo/redo work correctly with any number of history states
- [ ] Add unit test for undo/redo edge cases

---

### US-041: Fix Image CORS for Export
**Problem:** Images loaded without `crossOrigin` attribute taint the canvas, breaking PNG export.

**Location:** `Canvas.tsx` image loading (around line 223-267)

**Current Code:**
```typescript
const img = new Image();
img.onload = () => { ... };
img.src = imageObj.src;
```

**Fix:**
```typescript
const img = new Image();
img.crossOrigin = 'anonymous';
img.onload = () => { ... };
img.src = imageObj.src;
```

**Also fix in:**
- `Toolbar.tsx` - image import file picker
- `PropertiesPanel.tsx` - export image loading

**Acceptance Criteria:**
- [ ] Import image from URL, export as PNG - works without error
- [ ] Drag-drop external images, export - works without "tainted canvas" error

---

### US-042: Fix Yjs Memory Leak
**Problem:** Y.Doc is created at module scope and never destroyed, causing memory leaks.

**Location:** `collaborationStore.ts:53`

**Current Code:**
```typescript
const ydoc = new Y.Doc(); // Module scope, never cleaned up
```

**Fix:**
1. Move ydoc creation into the store or make it lazily initialized
2. Add cleanup in `disconnect()` action:
```typescript
disconnect: () => {
  if (provider) {
    provider.destroy();
    provider = null;
  }
  if (ydoc) {
    ydoc.destroy();
    // Recreate for next connection
    ydoc = new Y.Doc();
  }
  set({ connectionStatus: 'disconnected' });
}
```

**Acceptance Criteria:**
- [ ] Connect, disconnect, reconnect multiple times - no memory growth
- [ ] Yjs document state is fresh after reconnection

---

### US-043: Fix Global Mutable State Anti-pattern
**Problem:** `isApplyingRemoteChanges` and `awarenessChangeHandler` are module-scope globals.

**Location:** `canvasStore.ts:61-62`

**Current Code:**
```typescript
let isApplyingRemoteChanges = false;
let awarenessChangeHandler: (() => void) | null = null;
```

**Fix:** Move these into the Zustand store state or use a ref pattern:
```typescript
interface CanvasState {
  // ... existing state
  _internal: {
    isApplyingRemoteChanges: boolean;
    awarenessChangeHandler: (() => void) | null;
  };
}
```

Or use Zustand's second parameter for non-reactive state.

**Acceptance Criteria:**
- [ ] Multiple store instances (e.g., in tests) don't share mutable state
- [ ] No ESLint warnings about module-scope mutable variables

---

### US-044: Add Type Validation for Yjs Objects
**Problem:** Objects from Yjs are cast without validation, risking crashes.

**Location:** `canvasStore.ts:101`

**Current Code:**
```typescript
return obj as unknown as CanvasObject; // Dangerous double cast
```

**Fix:** Add runtime validation:
```typescript
function validateCanvasObject(obj: unknown): CanvasObject | null {
  if (!obj || typeof obj !== 'object') return null;
  const record = obj as Record<string, unknown>;
  if (typeof record.id !== 'string') return null;
  if (typeof record.type !== 'string') return null;
  if (typeof record.x !== 'number') return null;
  if (typeof record.y !== 'number') return null;
  if (typeof record.width !== 'number') return null;
  if (typeof record.height !== 'number') return null;
  // ... validate type-specific fields
  return record as CanvasObject;
}
```

**Acceptance Criteria:**
- [ ] Malformed objects from Yjs are filtered out with console warning
- [ ] Valid objects render correctly
- [ ] No runtime crashes from missing properties

---

## Testing Checklist
- [ ] All undo/redo scenarios work correctly
- [ ] Image export works with external images
- [ ] Memory doesn't grow with repeated connect/disconnect
- [ ] Type validation catches malformed objects
- [ ] No regressions in existing functionality

## Notes
- These fixes are isolated to specific functions/sections
- Should not conflict with other PRDs
- Consider adding error boundary after these fixes (separate task)
