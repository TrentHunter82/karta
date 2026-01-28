# Karta

A lightweight visual ideation canvas for creating mood boards, sharing media, and making simple diagrams — with real-time multiplayer collaboration.

Built with React, TypeScript, and HTML Canvas 2D.

## Features

- **Infinite canvas** with pan (scroll/space+drag) and zoom (scroll wheel, pinch)
- **Drawing tools** — Rectangle, Ellipse, Line, Arrow, Frame, Pen (freehand), Text
- **Selection tool** — Click, marquee select, drag-to-move, resize handles, rotation
- **Properties panel** — Transform (position, size, rotation), fill/stroke color, opacity, hierarchy list
- **Media support** — Drag-and-drop images and videos onto the canvas
- **Real-time collaboration** — Yjs + WebSocket sync with live cursor presence
- **Snap-to-grid and snap-to-objects** — Alignment guides and grid snapping
- **Undo/Redo** — Ctrl+Z / Ctrl+Shift+Z with 50-state history
- **Copy/Paste/Duplicate** — Ctrl+C, Ctrl+V, Ctrl+D
- **Export** — PNG export of selection or entire canvas
- **Templates** — Starter templates for quick setup
- **Keyboard shortcuts** — Full shortcut support (V, R, T, F, P, L, etc.)
- **Context menu** — Right-click for common actions
- **Minimap** — Overview navigation

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Canvas | HTML Canvas 2D API (custom renderer) |
| State | Zustand 5 |
| Collaboration | Yjs + y-websocket |
| Testing | Vitest + Testing Library |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check and build for production |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run test` | Run tests with Vitest |
| `npm run preview` | Preview production build |

## Project Structure

```
src/
├── components/       # React UI components
│   ├── layout/       # Canvas, Toolbar, TopBar, StatusBar, Minimap
│   └── properties/   # PropertiesPanel, inputs, sections
├── stores/           # Zustand state (canvas, selection, viewport, history, clipboard, etc.)
├── tools/            # Tool system (Select, Rectangle, Text, Pen, Line, Arrow, Frame, etc.)
├── constants/        # Shared constants (layout offsets, zoom limits, snap values)
├── types/            # TypeScript type definitions (includes type guards)
├── utils/            # Geometry, spatial indexing (QuadTree), Yjs utilities
└── hooks/            # Custom React hooks
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select tool |
| H | Hand (pan) tool |
| R | Rectangle tool |
| T | Text tool |
| F | Frame tool |
| P | Pen tool |
| L | Line tool |
| Shift+L | Arrow tool |
| Delete/Backspace | Delete selected |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+C / Ctrl+V | Copy / Paste |
| Ctrl+D | Duplicate |
| Ctrl+A | Select all |
| Ctrl+0 | Reset zoom to 100% |
| Ctrl+= / Ctrl+- | Zoom in / out |

## Design

Dark theme inspired by Teenage Engineering's industrial design language. JetBrains Mono monospace font, orange accent (#FF5500), dark backgrounds.

## License

Private
