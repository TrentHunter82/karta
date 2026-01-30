# Karta World-Class Polish - Task Board

## Goal
Make every interaction feel premium. Users should think "wow, this feels good."

---

## Claude-1 [Microinteractions] - Make it feel ALIVE

### Hover States
- [x] Audit ALL buttons - ensure hover has subtle scale 1.02 + brightness shift
- [x] Toolbar buttons: add subtle glow on hover with accent color at 20% opacity
- [x] Properties panel inputs: focus ring animation expand from center
- [x] Canvas objects: subtle highlight on hover before selection

### Transitions
- [x] Add CSS transitions to all interactive elements 150ms ease-out default
- [x] Panel collapse/expand: smooth height animation not instant
- [x] Tool switch: subtle crossfade on cursor change
- [x] Selection box: animate appearance scale from 0.95 + fade

### Feedback
- [x] Add subtle click feedback scale 0.98 on mousedown, back to 1 on mouseup
- [x] Drag operations: show ghost/shadow of object being dragged
- [x] Snap feedback: brief flash/pulse when object snaps to grid or guide
- [x] Copy/paste: subtle toast or visual confirmation

## Claude-2 [Visual Polish] - Make it look PREMIUM

### Depth and Dimension
- [x] Add subtle drop shadows to floating panels 8px blur, 10% opacity
- [x] Toolbar: subtle inner shadow or gradient for depth
- [x] Selected objects: soft glow effect not just border
- [x] Canvas: subtle vignette at edges very subtle, 5% opacity gradient

### Color Refinement
- [x] Review accent color usage - ensure consistent #FF5500 or refine palette
- [x] Add subtle color variations for states hover +5% brightness, active -5%
- [x] Selection handles: gradient fill instead of flat color
- [x] Grid dots: subtle gradient fade at canvas edges

### Typography
- [x] Ensure consistent font weights 400 body, 500 labels, 600 headings
- [x] Add subtle letter-spacing to headings 0.02em
- [x] Number inputs: tabular-nums for aligned digits
- [x] Status bar: slightly smaller, more subtle text

### Icons
- [x] Audit all SVG icons for consistent stroke width 1.5px
- [x] Add subtle opacity transitions on icon hover
- [x] Consider icon fill on active state not just stroke

## Claude-3 [Performance] - Make it feel INSTANT

### Render Optimization
- [x] Profile Canvas.tsx render loop - identify any unnecessary redraws
- [ ] Implement dirty rectangle tracking only redraw changed regions
- [ ] Batch object updates that happen in same frame
- [x] Add render stats overlay dev mode showing FPS and draw calls

### Event Handling
- [x] Throttle mousemove handlers during drag operations requestAnimationFrame
- [x] Debounce property panel input updates 16ms
- [x] Use passive event listeners where possible
- [x] Profile and optimize hit testing for 100+ objects

### Memory
- [x] Audit for memory leaks - check event listener cleanup on unmount
- [x] Review large object handling images/videos - lazy loading
- [ ] Check Yjs memory usage with many objects
- [ ] Implement object pooling for frequently created/destroyed items

### Perceived Performance
- [ ] Add loading skeletons for async operations
- [ ] Optimistic UI updates update UI before server confirms
- [x] Preload likely-needed resources cursor images, fonts

## Claude-4 [Test Coverage] - Make it BULLETPROOF

### Coordinate Transforms
- [x] Test screenToCanvas with various zoom levels 0.1, 1.0, 5.0
- [x] Test canvasToScreen with pan offsets
- [x] Test coordinate transforms with rotated viewport (N/A - viewport has no rotation)
- [x] Test edge cases: negative coords, very large coords, zero zoom

### Selection Logic
- [x] Test single click selection
- [x] Test shift+click multi-selection add/remove
- [x] Test marquee selection left-to-right and right-to-left
- [x] Test selection with overlapping objects z-order
- [x] Test selection with rotated objects

### Clipboard Operations
- [x] Test copy single object
- [x] Test copy multiple objects
- [x] Test paste at cursor position (N/A - uses offset-based paste, tested)
- [x] Test paste with offset multiple pastes
- [x] Test duplicate Ctrl+D
- [x] Test paste when clipboard is empty

### History Operations
- [x] Test undo single operation
- [x] Test redo after undo
- [x] Test undo at boundary nothing to undo
- [x] Test redo at boundary nothing to redo
- [x] Test undo clears redo stack on new action
- [x] Test history limit 50 states

---

## Validation
After each task:
1. npm run typecheck - must pass
2. npm run test - must pass
3. Test in browser with npm run dev
