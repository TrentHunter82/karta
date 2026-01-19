# PRD-10: Performance Optimization

## Overview
Optimize canvas rendering and Yjs synchronization for large canvases with many objects.

**Priority:** HIGH
**Estimated Complexity:** High
**Files Affected:** `canvasStore.ts`, `Canvas.tsx`, `collaborationStore.ts`

---

## Background
Current implementation re-renders all objects on every frame and syncs all changes immediately to Yjs. This works well for small canvases (<100 objects) but may degrade with larger projects.

---

## Prerequisites
- Should be implemented after core features are stable
- Consider after PRD-06 (Grouping) to optimize group rendering

---

## User Stories

### US-090: Virtual Rendering (Viewport Culling)
**Goal:** Only render objects that are visible in the current viewport.

**Implementation (Canvas.tsx):**
```typescript
const getViewportBounds = () => {
  const { viewport } = useCanvasStore.getState();
  const canvasWidth = window.innerWidth - 260;
  const canvasHeight = window.innerHeight - 80;

  return {
    x: -viewport.x,
    y: -viewport.y,
    width: canvasWidth / viewport.zoom,
    height: canvasHeight / viewport.zoom
  };
};

const isInViewport = (obj: CanvasObject, viewportBounds: Bounds): boolean => {
  // Expand object bounds slightly for rotation
  const padding = Math.max(obj.width, obj.height) * 0.5;

  return !(
    obj.x + obj.width + padding < viewportBounds.x ||
    obj.x - padding > viewportBounds.x + viewportBounds.width ||
    obj.y + obj.height + padding < viewportBounds.y ||
    obj.y - padding > viewportBounds.y + viewportBounds.height
  );
};

const drawObjects = () => {
  const viewportBounds = getViewportBounds();

  // Filter to visible objects
  const visibleObjects = sortedObjects.filter(obj =>
    isInViewport(obj, viewportBounds)
  );

  // Render only visible objects
  visibleObjects.forEach(obj => {
    if (!obj.visible) return;
    drawObject(obj);
  });

  // Debug: show culling stats
  if (DEBUG_MODE) {
    console.log(`Rendering ${visibleObjects.length}/${sortedObjects.length} objects`);
  }
};
```

**Acceptance Criteria:**
- [ ] Objects outside viewport are not rendered
- [ ] Selection boxes still render for selected off-screen objects (optional indicator)
- [ ] No visual artifacts at viewport edges
- [ ] Performance improves with many off-screen objects

---

### US-091: Spatial Indexing (Quadtree)
**Goal:** Fast object lookup for hit testing and culling using spatial data structure.

**Implementation (new file: src/utils/quadtree.ts):**
```typescript
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface QuadTreeNode<T> {
  bounds: Bounds;
  items: T[];
  children: QuadTreeNode<T>[] | null;
}

export class QuadTree<T extends { id: string } & Bounds> {
  private root: QuadTreeNode<T>;
  private maxItems = 10;
  private maxDepth = 8;

  constructor(bounds: Bounds) {
    this.root = { bounds, items: [], children: null };
  }

  insert(item: T): void {
    this.insertIntoNode(this.root, item, 0);
  }

  private insertIntoNode(node: QuadTreeNode<T>, item: T, depth: number): void {
    if (node.children) {
      // Find appropriate child
      const childIndex = this.getChildIndex(node, item);
      if (childIndex !== -1) {
        this.insertIntoNode(node.children[childIndex], item, depth + 1);
        return;
      }
    }

    node.items.push(item);

    // Subdivide if needed
    if (!node.children && node.items.length > this.maxItems && depth < this.maxDepth) {
      this.subdivide(node);

      // Redistribute items
      const items = [...node.items];
      node.items = [];
      items.forEach(i => this.insertIntoNode(node, i, depth));
    }
  }

  query(bounds: Bounds): T[] {
    const results: T[] = [];
    this.queryNode(this.root, bounds, results);
    return results;
  }

  private queryNode(node: QuadTreeNode<T>, bounds: Bounds, results: T[]): void {
    if (!this.intersects(node.bounds, bounds)) return;

    node.items.forEach(item => {
      if (this.intersects(item, bounds)) {
        results.push(item);
      }
    });

    if (node.children) {
      node.children.forEach(child => this.queryNode(child, bounds, results));
    }
  }

  clear(): void {
    this.root = { bounds: this.root.bounds, items: [], children: null };
  }

  // ... helper methods for subdivide, intersects, getChildIndex
}
```

**Store Integration:**
```typescript
// In canvasStore.ts
interface CanvasState {
  // ... existing
  spatialIndex: QuadTree<CanvasObject> | null;
}

rebuildSpatialIndex: () => {
  const state = get();
  const objects = Array.from(state.objects.values());

  // Calculate world bounds
  const bounds = objects.length > 0
    ? calculateBoundingBox(objects)
    : { x: -10000, y: -10000, width: 20000, height: 20000 };

  // Expand bounds for future objects
  const expandedBounds = {
    x: bounds.x - 1000,
    y: bounds.y - 1000,
    width: bounds.width + 2000,
    height: bounds.height + 2000
  };

  const index = new QuadTree<CanvasObject>(expandedBounds);
  objects.forEach(obj => index.insert(obj));

  set({ spatialIndex: index });
}
```

**Usage for Hit Testing:**
```typescript
const hitTest = (point: { x: number; y: number }): CanvasObject | null => {
  const { spatialIndex } = useCanvasStore.getState();

  // Query small area around point
  const queryBounds = {
    x: point.x - 1,
    y: point.y - 1,
    width: 2,
    height: 2
  };

  const candidates = spatialIndex?.query(queryBounds) || [];

  // Sort by zIndex and check detailed hit test
  const sorted = candidates.sort((a, b) => b.zIndex - a.zIndex);

  for (const obj of sorted) {
    if (pointInObject(point, obj)) {
      return obj;
    }
  }

  return null;
};
```

**Acceptance Criteria:**
- [ ] Spatial index built on canvas load
- [ ] Index updated on object add/remove/move
- [ ] Hit testing uses spatial index
- [ ] Viewport culling uses spatial index
- [ ] Performance improvement measurable with 1000+ objects

---

### US-092: Canvas Layer Caching
**Goal:** Cache static objects to avoid re-rendering unchanged content.

**Implementation:**
```typescript
// Use multiple canvas layers
const canvasLayers = {
  background: null as HTMLCanvasElement | null, // Grid
  static: null as HTMLCanvasElement | null,      // Non-selected objects
  active: null as HTMLCanvasElement | null,      // Selected objects
  overlay: null as HTMLCanvasElement | null      // Selection boxes, guides
};

const draw = () => {
  const mainCtx = mainCanvas.getContext('2d')!;

  // Clear main canvas
  mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

  // Draw cached background layer
  if (gridDirty) {
    redrawGridLayer();
    gridDirty = false;
  }
  mainCtx.drawImage(canvasLayers.background!, 0, 0);

  // Draw cached static layer (only redraw if needed)
  if (staticDirty) {
    redrawStaticLayer();
    staticDirty = false;
  }
  mainCtx.drawImage(canvasLayers.static!, 0, 0);

  // Always redraw active layer (selected objects being manipulated)
  redrawActiveLayer();
  mainCtx.drawImage(canvasLayers.active!, 0, 0);

  // Draw overlay (selection boxes, guides, cursors)
  redrawOverlayLayer();
  mainCtx.drawImage(canvasLayers.overlay!, 0, 0);
};

// Mark layers dirty when relevant state changes
const markStaticDirty = () => { staticDirty = true; };
const markGridDirty = () => { gridDirty = true; };
```

**Dirty Tracking:**
- Grid layer: dirty on zoom/pan change
- Static layer: dirty on non-selected object change
- Active layer: always redrawn (selected objects during drag)
- Overlay layer: always redrawn (selection UI)

**Acceptance Criteria:**
- [ ] Canvas uses multiple layers
- [ ] Static objects not re-rendered during selection manipulation
- [ ] Grid only re-rendered on zoom/pan
- [ ] No visual artifacts from caching
- [ ] Memory usage reasonable (4 canvas buffers)

---

### US-093: Debounced Yjs Sync
**Goal:** Batch rapid updates to reduce Yjs sync overhead.

**Implementation (canvasStore.ts):**
```typescript
// Debounce configuration
const SYNC_DEBOUNCE_MS = 50; // Batch updates within 50ms window
let syncTimeout: NodeJS.Timeout | null = null;
let pendingUpdates: Map<string, Partial<CanvasObject>> = new Map();

const queueYjsUpdate = (id: string, changes: Partial<CanvasObject>) => {
  // Merge with pending updates for same object
  const existing = pendingUpdates.get(id) || {};
  pendingUpdates.set(id, { ...existing, ...changes });

  // Debounce sync
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    flushYjsUpdates();
  }, SYNC_DEBOUNCE_MS);
};

const flushYjsUpdates = () => {
  if (pendingUpdates.size === 0) return;

  // Batch all updates in single transaction
  yObjects.doc?.transact(() => {
    pendingUpdates.forEach((changes, id) => {
      const yMap = yObjects.get(id);
      if (yMap) {
        Object.entries(changes).forEach(([key, value]) => {
          yMap.set(key, value);
        });
      }
    });
  });

  pendingUpdates.clear();
  syncTimeout = null;
};

// Update updateObject to use queue
updateObject: (id, changes) => {
  const state = get();
  const obj = state.objects.get(id);
  if (!obj) return;

  // Update local state immediately
  const newObjects = new Map(state.objects);
  newObjects.set(id, { ...obj, ...changes });
  set({ objects: newObjects });

  // Queue Yjs sync
  if (!isApplyingRemoteChanges) {
    queueYjsUpdate(id, changes);
  }
}
```

**Immediate Sync for Critical Operations:**
```typescript
// Some operations should sync immediately
const immediateSync = (id: string, obj: CanvasObject) => {
  flushYjsUpdates(); // Flush pending first

  yObjects.doc?.transact(() => {
    const yMap = yObjects.get(id) || new Y.Map();
    Object.entries(obj).forEach(([key, value]) => {
      yMap.set(key, value);
    });
    yObjects.set(id, yMap);
  });
};

// Use immediate sync for:
// - Object creation
// - Object deletion
// - Selection changes (optional, could be debounced too)
```

**Acceptance Criteria:**
- [ ] Drag operations batch updates (not every mouse move)
- [ ] Final position syncs after drag ends
- [ ] No lost updates from debouncing
- [ ] Remote collaborators see smooth-ish movement
- [ ] Reduced network traffic measurable

---

### US-094: Image/Video Lazy Loading
**Goal:** Defer loading of off-screen media content.

**Implementation:**
```typescript
// Track which images are loaded
const loadedImages = new Map<string, HTMLImageElement>();
const loadingImages = new Set<string>();
const imageLoadCallbacks = new Map<string, (() => void)[]>();

const getImage = (src: string, callback?: () => void): HTMLImageElement | null => {
  // Already loaded
  if (loadedImages.has(src)) {
    return loadedImages.get(src)!;
  }

  // Register callback
  if (callback) {
    const callbacks = imageLoadCallbacks.get(src) || [];
    callbacks.push(callback);
    imageLoadCallbacks.set(src, callbacks);
  }

  // Already loading
  if (loadingImages.has(src)) {
    return null;
  }

  // Start loading
  loadingImages.add(src);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    loadedImages.set(src, img);
    loadingImages.delete(src);

    // Trigger callbacks
    const callbacks = imageLoadCallbacks.get(src) || [];
    callbacks.forEach(cb => cb());
    imageLoadCallbacks.delete(src);
  };
  img.onerror = () => {
    loadingImages.delete(src);
    imageLoadCallbacks.delete(src);
  };
  img.src = src;

  return null;
};

// In draw loop
const drawImageObject = (obj: ImageObject) => {
  const viewportBounds = getViewportBounds();

  // Skip if not in viewport
  if (!isInViewport(obj, viewportBounds)) {
    // Unload if memory pressure (optional)
    return;
  }

  const img = getImage(obj.src, () => {
    // Trigger redraw when image loads
    requestRedraw();
  });

  if (img) {
    ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
  } else {
    // Draw placeholder
    ctx.fillStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Loading...', obj.x + obj.width / 2, obj.y + obj.height / 2);
  }
};
```

**Memory Management (Optional):**
```typescript
// Unload images that haven't been visible for a while
const MAX_CACHED_IMAGES = 50;

const pruneImageCache = () => {
  if (loadedImages.size <= MAX_CACHED_IMAGES) return;

  // Get currently visible image objects
  const visibleSrcs = new Set<string>();
  const viewportBounds = getViewportBounds();

  objects.forEach(obj => {
    if (obj.type === 'image' && isInViewport(obj, viewportBounds)) {
      visibleSrcs.add(obj.src);
    }
  });

  // Remove least recently used non-visible images
  let removed = 0;
  const toRemove = loadedImages.size - MAX_CACHED_IMAGES;

  for (const [src] of loadedImages) {
    if (!visibleSrcs.has(src)) {
      loadedImages.delete(src);
      removed++;
      if (removed >= toRemove) break;
    }
  }
};
```

**Acceptance Criteria:**
- [ ] Off-screen images show placeholder until scrolled into view
- [ ] Images load when scrolled into viewport
- [ ] Loading state shown during load
- [ ] Image cache doesn't grow unbounded
- [ ] Video thumbnails use same lazy loading

---

## Performance Benchmarks

Target metrics for a canvas with 1000 objects:
- Frame rate: 60fps during pan/zoom
- Hit test: <5ms per test
- Initial render: <500ms
- Yjs sync: <100 updates/second transmitted

---

## Testing Checklist
- [ ] Viewport culling reduces rendered object count
- [ ] Spatial index speeds up hit testing
- [ ] Canvas layers reduce redraw overhead
- [ ] Yjs debouncing reduces network traffic
- [ ] Lazy loading defers off-screen images
- [ ] No visual artifacts from optimizations
- [ ] Performance improved with 1000+ objects
- [ ] Memory usage stays reasonable
- [ ] All existing functionality still works

## Dependencies
- Should be done after core features are stable
- PRD-06 (Grouping) may affect optimization strategy

## Notes
- Start with viewport culling (biggest impact, lowest risk)
- Quadtree may be overkill for <500 objects
- Layer caching has memory cost (4x canvas buffers)
- Consider Web Workers for heavy computation (future)
