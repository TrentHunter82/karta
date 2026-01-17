# PRD: Karta - Visual Ideation Canvas

## Introduction

Karta is a lightweight, intuitive visual ideation tool for creating mood boards, sharing photos/videos, and making simple diagrams. It features real-time multiplayer collaboration, enabling teams to ideate together seamlessly. The interface prioritizes simplicity and beauty while ensuring every tool works flawlessly.

## Goals

- Provide a fast, responsive infinite canvas for visual ideation
- Support real-time multiplayer collaboration with cursor presence
- Implement core design tools: selection, shapes, text, pen, frames
- Enable media import (images, videos) with drag-and-drop
- Deliver a polished, professional UI matching the mockup aesthetic
- Ensure rock-solid foundation with clean architecture

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Canvas:** HTML Canvas 2D API with custom renderer
- **State:** Zustand (local) + Yjs (collaborative)
- **Collaboration:** Yjs + y-websocket
- **Styling:** CSS Modules or Tailwind CSS

---

## User Stories

### Phase 1: Project Foundation

#### US-001: Initialize project with Vite + React + TypeScript
**Description:** As a developer, I need a properly configured project so I can build the application with modern tooling.

**Acceptance Criteria:**
- [x] Vite project created with React + TypeScript template
- [x] ESLint + Prettier configured
- [x] Project runs with `npm run dev`
- [x] Basic folder structure: `src/components`, `src/hooks`, `src/stores`, `src/utils`, `src/types`
- [x] Typecheck passes

---

#### US-002: Create app shell with layout structure
**Description:** As a user, I want to see the basic app layout so I understand the interface structure.

**Acceptance Criteria:**
- [x] App shell with CSS Grid/Flexbox layout
- [x] Left toolbar area (48px wide, dark background)
- [x] Top bar area (40px tall)
- [x] Right properties panel (280px wide, collapsible)
- [x] Main canvas area (fills remaining space)
- [x] Bottom status bar (24px tall)
- [x] Dark theme matching mockup (#1a1a1a background, #2a2a2a panels)
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-003: Implement canvas with pan and zoom
**Description:** As a user, I want to pan and zoom the infinite canvas so I can navigate my workspace.

**Acceptance Criteria:**
- [x] HTML Canvas element renders in main area
- [x] Canvas fills container and resizes with window
- [x] Mouse wheel zooms in/out (centered on cursor)
- [x] Middle-mouse drag or Space+drag pans the canvas
- [x] Zoom level clamped between 10% and 500%
- [x] Grid/dot pattern renders on canvas background
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-004: Create Zustand store for canvas state
**Description:** As a developer, I need centralized state management so canvas data is consistent across components.

**Acceptance Criteria:**
- [x] Zustand store created with canvas state: `objects`, `selectedIds`, `viewport` (pan, zoom)
- [x] Actions: `addObject`, `updateObject`, `deleteObject`, `setSelection`, `setViewport`
- [x] Objects have base interface: `id`, `type`, `x`, `y`, `width`, `height`, `rotation`, `opacity`
- [x] Store is typed with TypeScript interfaces
- [x] Typecheck passes

---

### Phase 2: Left Toolbar & Tools Infrastructure

#### US-005: Build left toolbar with tool buttons
**Description:** As a user, I want a toolbar so I can select different tools.

**Acceptance Criteria:**
- [x] Vertical toolbar with icon buttons
- [x] Tools: Select (V), Hand (H), Rectangle (R), Text (T), Frame (F), Pen (P)
- [x] Active tool highlighted with accent color
- [x] Tooltip on hover showing tool name + shortcut
- [x] Divider line separating tool groups (after Text)
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-006: Implement tool state and keyboard shortcuts
**Description:** As a user, I want keyboard shortcuts so I can quickly switch tools.

**Acceptance Criteria:**
- [x] Tool state in Zustand store: `activeTool`
- [x] Keyboard shortcuts: V (select), H (hand), R (rectangle), T (text), F (frame), P (pen)
- [x] Shortcuts work when canvas is focused
- [x] Shortcuts disabled when typing in input fields
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### Phase 3: Core Drawing Tools

#### US-007: Implement selection tool with click-to-select
**Description:** As a user, I want to click objects to select them so I can modify them.

**Acceptance Criteria:**
- [x] Click on object selects it (updates `selectedIds`)
- [x] Click on empty canvas deselects all
- [x] Selected object shows bounding box with handles
- [x] Bounding box has 8 resize handles + rotation handle
- [x] Selection highlight color: blue (#0066ff)
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-008: Implement selection tool drag-to-move
**Description:** As a user, I want to drag selected objects to reposition them.

**Acceptance Criteria:**
- [x] Drag selected object moves it
- [x] Multiple selected objects move together
- [x] Position updates in real-time during drag
- [x] Cursor changes to "move" when hovering selected object
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-009: Implement marquee selection
**Description:** As a user, I want to drag a selection box to select multiple objects.

**Acceptance Criteria:**
- [x] Drag on empty canvas draws selection rectangle
- [x] Objects intersecting rectangle are selected on mouse up
- [x] Shift+drag adds to existing selection
- [x] Selection rectangle has dashed blue border
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-010: Implement resize via selection handles
**Description:** As a user, I want to drag handles to resize objects.

**Acceptance Criteria:**
- [x] Drag corner handles resizes proportionally (with Shift for free resize)
- [x] Drag edge handles resizes in one dimension
- [x] Minimum size enforced (10x10px)
- [x] Cursor changes to resize cursor on handle hover
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-011: Implement rotation via handle
**Description:** As a user, I want to rotate objects using the rotation handle.

**Acceptance Criteria:**
- [x] Rotation handle appears above top-center of selection
- [x] Drag rotation handle rotates object around center
- [x] Shift+drag snaps to 15° increments
- [x] Rotation displayed in properties panel
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-012: Implement rectangle tool
**Description:** As a user, I want to draw rectangles on the canvas.

**Acceptance Criteria:**
- [x] With Rectangle tool active, drag on canvas creates rectangle
- [x] Rectangle has default fill (#4a4a4a) and no stroke
- [x] Shift+drag constrains to square
- [x] Rectangle added to store on mouse up
- [x] Tool switches to Select after drawing
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-013: Implement ellipse shape variant
**Description:** As a user, I want to draw ellipses/circles.

**Acceptance Criteria:**
- [x] Shape tool has dropdown or modifier for ellipse
- [x] Alt+Rectangle tool draws ellipse instead
- [x] Shift constrains to circle
- [x] Ellipse renders correctly with fill/stroke
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-014: Implement text tool
**Description:** As a user, I want to add text to the canvas.

**Acceptance Criteria:**
- [x] Click with Text tool creates text object at click position
- [x] Text object enters edit mode immediately
- [x] Typing updates text content in real-time
- [x] Click outside or Escape exits edit mode
- [x] Default font: Inter or system sans-serif, 16px, white
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-015: Implement text editing on existing text
**Description:** As a user, I want to edit existing text by double-clicking.

**Acceptance Criteria:**
- [x] Double-click on text object enters edit mode
- [x] Cursor position tracked within text
- [x] Arrow keys navigate cursor
- [x] Selection within text (Shift+arrows, double-click word)
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-016: Implement frame tool
**Description:** As a user, I want to create frames to group content.

**Acceptance Criteria:**
- [x] Drag with Frame tool creates frame object
- [x] Frame has label showing name (editable)
- [x] Frame has subtle background (#2a2a2a) and border
- [x] Objects inside frame visually contained
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-017: Implement pen tool for freehand drawing
**Description:** As a user, I want to draw freehand lines and shapes.

**Acceptance Criteria:**
- [x] Drag with Pen tool creates path from mouse movement
- [x] Path stored as array of points
- [x] Path renders as smooth line (with line smoothing algorithm)
- [x] Default stroke: white, 2px
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### Phase 4: Properties Panel

#### US-018: Build properties panel structure
**Description:** As a user, I want a properties panel to view and edit object properties.

**Acceptance Criteria:**
- [x] Panel header: "PROPERTIES" with settings icon
- [x] Collapsible sections: Transform, Appearance, Hierarchy
- [x] Sections have header with label and collapse toggle
- [x] Empty state shows "---" for all values when nothing selected
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-019: Implement transform section (position)
**Description:** As a user, I want to see and edit object position numerically.

**Acceptance Criteria:**
- [x] X-POS and Y-POS input fields
- [x] Values update when object selected
- [x] Typing in field updates object position
- [x] Enter commits change, Escape reverts
- [x] Shows "---" when multiple objects with different values
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-020: Implement transform section (size)
**Description:** As a user, I want to see and edit object dimensions numerically.

**Acceptance Criteria:**
- [x] WIDTH and HEIGHT input fields
- [x] Values update when object selected
- [x] Typing in field updates object size
- [x] Constrain proportions toggle (chain link icon)
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-021: Implement transform section (rotation)
**Description:** As a user, I want to see and edit object rotation numerically.

**Acceptance Criteria:**
- [x] ROTATION label with degree input field
- [x] Circular slider/dial for visual rotation adjustment
- [x] Value shows degrees (0-360)
- [x] Dragging dial rotates object in real-time
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-022: Implement appearance section (opacity)
**Description:** As a user, I want to adjust object opacity.

**Acceptance Criteria:**
- [x] Opacity row with percentage input
- [x] Slider for visual adjustment (0-100%)
- [x] Updates object opacity in real-time
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-023: Implement appearance section (fill)
**Description:** As a user, I want to change object fill color.

**Acceptance Criteria:**
- [x] Fill row with color swatch and hex input
- [x] Checkbox to enable/disable fill
- [x] Click swatch opens color picker
- [x] Color picker with hue slider and saturation/brightness square
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-024: Implement appearance section (stroke)
**Description:** As a user, I want to change object stroke color and width.

**Acceptance Criteria:**
- [x] Stroke row with color swatch and hex input
- [x] Checkbox to enable/disable stroke
- [x] Stroke width input (px)
- [x] Updates object in real-time
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-025: Implement hierarchy section
**Description:** As a user, I want to see all objects in a layer list.

**Acceptance Criteria:**
- [x] "HIERARCHY" header with item count ("X Items")
- [x] List of all objects with name and type icon
- [x] Click item selects object on canvas
- [x] Selected items highlighted in list
- [x] Drag to reorder (changes z-index)
- [x] Empty state: "Canvas Empty"
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### Phase 5: Top Bar & Status Bar

#### US-026: Build top bar with branding
**Description:** As a user, I want a top bar showing app name and session info.

**Acceptance Criteria:**
- [x] Left: App logo/icon + "KARTA" + version "V1.0.0"
- [x] Center: Session/document name (editable)
- [x] Right: Connection status icon, user avatar
- [x] Matches mockup styling (dark theme, subtle borders)
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-027: Build bottom status bar
**Description:** As a user, I want a status bar showing cursor position and selection.

**Acceptance Criteria:**
- [x] Left: "POS X:--- Y:---" showing cursor position on canvas
- [x] Updates in real-time as mouse moves over canvas
- [x] Shows canvas coordinates (accounting for pan/zoom)
- [x] Right: "SEL NONE" or "SEL X objects" showing selection count
- [x] Typecheck passes
- [x] Verify changes work in browser

---

#### US-028: Implement zoom controls
**Description:** As a user, I want zoom buttons to control canvas zoom level.

**Acceptance Criteria:**
- [ ] Bottom-right: + and - buttons
- [ ] + increases zoom by 25%, - decreases by 25%
- [ ] Zoom percentage displayed between buttons (optional)
- [ ] Keyboard shortcuts: Ctrl+= (zoom in), Ctrl+- (zoom out), Ctrl+0 (reset to 100%)
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### Phase 6: Media Support

#### US-029: Implement image import via file picker
**Description:** As a user, I want to import images from my computer.

**Acceptance Criteria:**
- [ ] File > Import Image menu option or toolbar button
- [ ] File picker accepts .png, .jpg, .gif, .webp
- [ ] Image placed at canvas center with original dimensions
- [ ] Large images scaled down to fit viewport (max 800px)
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

#### US-030: Implement image drag-and-drop
**Description:** As a user, I want to drag images onto the canvas from my file system.

**Acceptance Criteria:**
- [ ] Drag image file over canvas shows drop indicator
- [ ] Drop places image at drop position
- [ ] Supports multiple files dropped at once
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

#### US-031: Implement video import and playback
**Description:** As a user, I want to add videos to my canvas.

**Acceptance Criteria:**
- [ ] Import supports .mp4, .webm video files
- [ ] Video thumbnail displays on canvas
- [ ] Click video shows play button overlay
- [ ] Video plays inline when activated
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### Phase 7: Real-time Collaboration

#### US-032: Set up Yjs document and WebSocket provider
**Description:** As a developer, I need Yjs infrastructure for real-time sync.

**Acceptance Criteria:**
- [ ] Yjs document created for canvas state
- [ ] y-websocket provider connects to collaboration server
- [ ] Connection status tracked (connected/disconnected)
- [ ] Graceful handling of connection loss
- [ ] Typecheck passes

---

#### US-033: Sync canvas objects via Yjs
**Description:** As a user, I want my changes to sync with other users in real-time.

**Acceptance Criteria:**
- [ ] Object creation syncs to other clients
- [ ] Object updates (move, resize, property changes) sync
- [ ] Object deletion syncs
- [ ] No conflicts or data loss during concurrent edits
- [ ] Typecheck passes
- [ ] Verify changes work in browser (with 2 tabs)

---

#### US-034: Implement cursor presence
**Description:** As a user, I want to see other users' cursors on the canvas.

**Acceptance Criteria:**
- [ ] Each user's cursor position broadcast via Yjs awareness
- [ ] Other users' cursors displayed with name label and color
- [ ] Cursors update smoothly (throttled to ~30fps)
- [ ] Cursors fade out after user inactive for 5s
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

#### US-035: Implement user avatar and presence list
**Description:** As a user, I want to see who is in the session.

**Acceptance Criteria:**
- [ ] Top bar shows avatars of connected users
- [ ] Avatars are colored circles with initials
- [ ] Tooltip shows username on hover
- [ ] "+N" indicator if more than 4 users
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### Phase 8: Export & History

#### US-036: Implement export selection as PNG
**Description:** As a user, I want to export my work as an image.

**Acceptance Criteria:**
- [ ] "EXPORT SELECTION" button in properties panel
- [ ] If selection: exports selected objects with padding
- [ ] If no selection: exports entire canvas content
- [ ] Downloads as PNG file
- [ ] Transparent background option
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

#### US-037: Implement undo/redo
**Description:** As a user, I want to undo and redo my actions.

**Acceptance Criteria:**
- [ ] Ctrl+Z undoes last action
- [ ] Ctrl+Shift+Z or Ctrl+Y redoes
- [ ] History stores last 50 states
- [ ] Works with all object operations (create, update, delete)
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

#### US-038: Implement delete selected objects
**Description:** As a user, I want to delete objects with keyboard.

**Acceptance Criteria:**
- [ ] Delete or Backspace key deletes selected objects
- [ ] Multiple selected objects deleted together
- [ ] Deletion is undoable
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

#### US-039: Implement copy/paste
**Description:** As a user, I want to copy and paste objects.

**Acceptance Criteria:**
- [ ] Ctrl+C copies selected objects to clipboard (internal)
- [ ] Ctrl+V pastes with slight offset (10px, 10px)
- [ ] Ctrl+D duplicates in place
- [ ] Pasted objects become new selection
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

## Non-Goals

- Audio recording/playback features (BPM, MIC input from mockup)
- Advanced vector editing (bezier curve manipulation)
- Component/symbol libraries
- Prototyping/interaction design
- Comments/annotations system
- Version history/branching
- Offline-first with sync (online-only for MVP)
- Mobile/touch optimization

## Technical Considerations

- **Canvas Rendering:** Use requestAnimationFrame loop with dirty-rect optimization
- **Object Model:** Each object is a plain JS object with unique ID (nanoid)
- **Coordinate System:** Canvas coordinates with viewport transform (pan/zoom matrix)
- **Collaboration:** Yjs Y.Map for objects, Y.Array for ordering, awareness for cursors
- **State Shape:**
```typescript
interface CanvasState {
  objects: Map<string, CanvasObject>
  selectedIds: Set<string>
  viewport: { x: number; y: number; zoom: number }
  activeTool: ToolType
}

interface CanvasObject {
  id: string
  type: 'rectangle' | 'ellipse' | 'text' | 'frame' | 'path' | 'image' | 'video'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  // Type-specific properties...
}
```
