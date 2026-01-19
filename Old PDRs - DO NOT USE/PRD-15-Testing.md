# PRD-15: Testing Infrastructure

## Overview
Set up comprehensive testing infrastructure including unit tests, component tests, and end-to-end tests.

**Priority:** HIGH
**Estimated Complexity:** High
**Files Affected:** New `tests/` directory, `vitest.config.ts`, `playwright.config.ts`, `package.json`

---

## Background
Currently the project has no automated tests. Testing is critical for maintaining code quality, catching regressions, and enabling confident refactoring.

---

## User Stories

### US-114: Setup Vitest for Unit Testing
**Goal:** Configure Vitest testing framework for unit and component tests.

**Dependencies to Install:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event
```

**Configuration (vitest.config.ts):**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.*'
      ]
    }
  }
});
```

**Setup File (tests/setup.ts):**
```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => Math.random().toString(36).substring(2, 15)
  }
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock canvas context
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  ellipse: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  setLineDash: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 100 }),
  fillText: vi.fn(),
  drawImage: vi.fn(),
  createLinearGradient: vi.fn().mockReturnValue({
    addColorStop: vi.fn()
  })
});
```

**Package.json Scripts:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

**Acceptance Criteria:**
- [ ] Vitest configured and running
- [ ] Test command works: `npm test`
- [ ] Coverage reporting enabled
- [ ] Mock helpers set up for canvas, crypto, etc.

---

### US-115: Unit Tests for canvasStore Actions
**Goal:** Test all canvas store actions.

**Test File (tests/stores/canvasStore.test.ts):**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../../src/stores/canvasStore';
import type { RectangleObject } from '../../src/types/canvas';

describe('canvasStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useCanvasStore.setState({
      objects: new Map(),
      selectedIds: new Set(),
      viewport: { x: 0, y: 0, zoom: 1 },
      activeTool: 'select',
      clipboard: [],
      history: [],
      historyIndex: -1
    });
  });

  describe('addObject', () => {
    it('should add an object to the store', () => {
      const { addObject, objects } = useCanvasStore.getState();

      const rect: RectangleObject = {
        id: 'test-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        fill: '#ff0000'
      };

      addObject(rect);

      expect(useCanvasStore.getState().objects.size).toBe(1);
      expect(useCanvasStore.getState().objects.get('test-1')).toEqual(rect);
    });

    it('should push history when adding object', () => {
      const { addObject } = useCanvasStore.getState();

      addObject(createTestRect('test-1'));

      expect(useCanvasStore.getState().history.length).toBe(1);
    });
  });

  describe('updateObject', () => {
    it('should update object properties', () => {
      const { addObject, updateObject } = useCanvasStore.getState();

      addObject(createTestRect('test-1'));
      updateObject('test-1', { x: 200, y: 200 });

      const obj = useCanvasStore.getState().objects.get('test-1');
      expect(obj?.x).toBe(200);
      expect(obj?.y).toBe(200);
    });

    it('should not update non-existent object', () => {
      const { updateObject } = useCanvasStore.getState();

      updateObject('non-existent', { x: 100 });

      expect(useCanvasStore.getState().objects.size).toBe(0);
    });
  });

  describe('deleteObject', () => {
    it('should remove object from store', () => {
      const { addObject, deleteObject } = useCanvasStore.getState();

      addObject(createTestRect('test-1'));
      deleteObject('test-1');

      expect(useCanvasStore.getState().objects.size).toBe(0);
    });

    it('should remove object from selection', () => {
      const { addObject, setSelection, deleteObject } = useCanvasStore.getState();

      addObject(createTestRect('test-1'));
      setSelection(new Set(['test-1']));
      deleteObject('test-1');

      expect(useCanvasStore.getState().selectedIds.size).toBe(0);
    });
  });

  describe('selection', () => {
    it('should set selection', () => {
      const { addObject, setSelection } = useCanvasStore.getState();

      addObject(createTestRect('test-1'));
      addObject(createTestRect('test-2'));
      setSelection(new Set(['test-1', 'test-2']));

      expect(useCanvasStore.getState().selectedIds.size).toBe(2);
    });

    it('should clear selection', () => {
      const { addObject, setSelection } = useCanvasStore.getState();

      addObject(createTestRect('test-1'));
      setSelection(new Set(['test-1']));
      setSelection(new Set());

      expect(useCanvasStore.getState().selectedIds.size).toBe(0);
    });
  });

  describe('undo/redo', () => {
    it('should undo last action', () => {
      const { addObject, undo } = useCanvasStore.getState();

      addObject(createTestRect('test-1'));
      expect(useCanvasStore.getState().objects.size).toBe(1);

      undo();
      expect(useCanvasStore.getState().objects.size).toBe(0);
    });

    it('should redo undone action', () => {
      const { addObject, undo, redo } = useCanvasStore.getState();

      addObject(createTestRect('test-1'));
      undo();
      redo();

      expect(useCanvasStore.getState().objects.size).toBe(1);
    });

    it('should report canUndo correctly', () => {
      const { addObject, canUndo } = useCanvasStore.getState();

      expect(canUndo()).toBe(false);

      addObject(createTestRect('test-1'));
      expect(useCanvasStore.getState().canUndo()).toBe(true);
    });
  });

  describe('copy/paste', () => {
    it('should copy selected objects', () => {
      const { addObject, setSelection, copySelection } = useCanvasStore.getState();

      addObject(createTestRect('test-1'));
      setSelection(new Set(['test-1']));
      copySelection();

      expect(useCanvasStore.getState().clipboard.length).toBe(1);
    });

    it('should paste with offset', () => {
      const { addObject, setSelection, copySelection, paste } = useCanvasStore.getState();

      const rect = createTestRect('test-1');
      rect.x = 100;
      rect.y = 100;

      addObject(rect);
      setSelection(new Set(['test-1']));
      copySelection();
      paste();

      const objects = Array.from(useCanvasStore.getState().objects.values());
      const pasted = objects.find(o => o.id !== 'test-1');

      expect(pasted?.x).toBe(110); // Original + 10 offset
      expect(pasted?.y).toBe(110);
    });
  });

  describe('viewport', () => {
    it('should update viewport', () => {
      const { setViewport } = useCanvasStore.getState();

      setViewport({ x: 100, y: 200, zoom: 2 });

      const viewport = useCanvasStore.getState().viewport;
      expect(viewport.x).toBe(100);
      expect(viewport.y).toBe(200);
      expect(viewport.zoom).toBe(2);
    });

    it('should clamp zoom to valid range', () => {
      const { setViewport } = useCanvasStore.getState();

      setViewport({ x: 0, y: 0, zoom: 10 });
      expect(useCanvasStore.getState().viewport.zoom).toBe(5); // Max

      setViewport({ x: 0, y: 0, zoom: 0.01 });
      expect(useCanvasStore.getState().viewport.zoom).toBe(0.1); // Min
    });
  });
});

// Helper function
function createTestRect(id: string): RectangleObject {
  return {
    id,
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    fill: '#ff0000'
  };
}
```

**Acceptance Criteria:**
- [ ] Tests for addObject, updateObject, deleteObject
- [ ] Tests for selection management
- [ ] Tests for undo/redo
- [ ] Tests for copy/paste/duplicate
- [ ] Tests for viewport management
- [ ] All tests passing

---

### US-116: Unit Tests for collaborationStore
**Goal:** Test collaboration store functionality.

**Test File (tests/stores/collaborationStore.test.ts):**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCollaborationStore } from '../../src/stores/collaborationStore';

// Mock Yjs
vi.mock('yjs', () => ({
  Doc: vi.fn().mockImplementation(() => ({
    getMap: vi.fn().mockReturnValue(new Map()),
    getArray: vi.fn().mockReturnValue([]),
    transact: vi.fn(fn => fn()),
    destroy: vi.fn()
  }))
}));

vi.mock('y-websocket', () => ({
  WebsocketProvider: vi.fn().mockImplementation(() => ({
    awareness: {
      setLocalStateField: vi.fn(),
      getLocalState: vi.fn().mockReturnValue({}),
      getStates: vi.fn().mockReturnValue(new Map()),
      on: vi.fn(),
      off: vi.fn()
    },
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    destroy: vi.fn()
  }))
}));

describe('collaborationStore', () => {
  beforeEach(() => {
    useCollaborationStore.setState({
      connectionStatus: 'disconnected',
      localUser: { name: 'Test User', color: '#ff0000' },
      remoteUsers: new Map()
    });
  });

  describe('connection', () => {
    it('should start with disconnected status', () => {
      expect(useCollaborationStore.getState().connectionStatus).toBe('disconnected');
    });

    it('should generate random user name and color', () => {
      const state = useCollaborationStore.getState();
      expect(state.localUser.name).toBeTruthy();
      expect(state.localUser.color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('cursor presence', () => {
    it('should set local cursor position', () => {
      const { setLocalCursor } = useCollaborationStore.getState();

      setLocalCursor(100, 200);

      // Verify awareness was updated (mocked)
      // In real test, would verify awareness.setLocalStateField was called
    });

    it('should clear local cursor', () => {
      const { clearLocalCursor } = useCollaborationStore.getState();

      clearLocalCursor();

      // Verify awareness was updated
    });
  });

  describe('remote users', () => {
    it('should track remote users', () => {
      useCollaborationStore.setState({
        remoteUsers: new Map([
          [1, { clientId: 1, name: 'User 1', color: '#00ff00', cursor: { x: 0, y: 0 } }]
        ])
      });

      expect(useCollaborationStore.getState().remoteUsers.size).toBe(1);
    });
  });
});
```

**Acceptance Criteria:**
- [ ] Tests for connection state management
- [ ] Tests for user presence
- [ ] Tests for cursor broadcasting
- [ ] Mock Yjs properly

---

### US-117: Component Tests for Canvas Interactions
**Goal:** Test Canvas component with user interactions.

**Test File (tests/components/Canvas.test.tsx):**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Canvas } from '../../src/components/layout/Canvas';
import { useCanvasStore } from '../../src/stores/canvasStore';

describe('Canvas', () => {
  beforeEach(() => {
    // Reset store
    useCanvasStore.setState({
      objects: new Map(),
      selectedIds: new Set(),
      viewport: { x: 0, y: 0, zoom: 1 },
      activeTool: 'select'
    });
  });

  describe('rendering', () => {
    it('should render canvas element', () => {
      render(<Canvas />);
      expect(screen.getByRole('img')).toBeInTheDocument(); // Canvas has img role
    });
  });

  describe('tool behavior', () => {
    it('should change cursor based on active tool', () => {
      const { rerender } = render(<Canvas />);

      useCanvasStore.setState({ activeTool: 'hand' });
      rerender(<Canvas />);

      // Verify cursor style (would need to check canvas element style)
    });
  });

  describe('selection', () => {
    it('should select object on click', async () => {
      // Add a test object
      const rect = {
        id: 'test-rect',
        type: 'rectangle' as const,
        x: 100, y: 100, width: 50, height: 50,
        rotation: 0, opacity: 1, zIndex: 1
      };

      useCanvasStore.setState({
        objects: new Map([[rect.id, rect]]),
        activeTool: 'select'
      });

      render(<Canvas />);

      // Simulate click at object position
      const canvas = screen.getByRole('img');
      fireEvent.mouseDown(canvas, { clientX: 125, clientY: 125, button: 0 });
      fireEvent.mouseUp(canvas, { clientX: 125, clientY: 125, button: 0 });

      // Note: This test is simplified - real test would need proper
      // coordinate transformation and hit testing
    });

    it('should deselect on empty canvas click', () => {
      useCanvasStore.setState({
        selectedIds: new Set(['test-1']),
        activeTool: 'select'
      });

      render(<Canvas />);

      const canvas = screen.getByRole('img');
      fireEvent.mouseDown(canvas, { clientX: 500, clientY: 500, button: 0 });
      fireEvent.mouseUp(canvas, { clientX: 500, clientY: 500, button: 0 });

      expect(useCanvasStore.getState().selectedIds.size).toBe(0);
    });
  });

  describe('pan and zoom', () => {
    it('should zoom on wheel event', () => {
      render(<Canvas />);

      const canvas = screen.getByRole('img');
      fireEvent.wheel(canvas, { deltaY: -100, ctrlKey: true });

      expect(useCanvasStore.getState().viewport.zoom).toBeGreaterThan(1);
    });

    it('should pan with middle mouse button', () => {
      render(<Canvas />);

      const canvas = screen.getByRole('img');

      fireEvent.mouseDown(canvas, { button: 1, clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(canvas, { button: 1 });

      const viewport = useCanvasStore.getState().viewport;
      expect(viewport.x).not.toBe(0);
      expect(viewport.y).not.toBe(0);
    });
  });

  describe('drawing tools', () => {
    it('should create rectangle on drag with rectangle tool', () => {
      useCanvasStore.setState({ activeTool: 'rectangle' });

      render(<Canvas />);

      const canvas = screen.getByRole('img');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100, button: 0 });
      fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
      fireEvent.mouseUp(canvas, { clientX: 200, clientY: 200, button: 0 });

      expect(useCanvasStore.getState().objects.size).toBe(1);

      const obj = Array.from(useCanvasStore.getState().objects.values())[0];
      expect(obj.type).toBe('rectangle');
    });
  });
});
```

**Acceptance Criteria:**
- [ ] Tests for canvas rendering
- [ ] Tests for selection behavior
- [ ] Tests for pan and zoom
- [ ] Tests for drawing tools
- [ ] Tests for keyboard shortcuts integration

---

### US-118: E2E Tests with Playwright
**Goal:** Set up end-to-end tests for critical user flows.

**Installation:**
```bash
npm install -D @playwright/test
npx playwright install
```

**Configuration (playwright.config.ts):**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

**E2E Test File (tests/e2e/canvas.spec.ts):**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Canvas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForSelector('canvas');
  });

  test('should load the application', async ({ page }) => {
    await expect(page.locator('.top-bar')).toBeVisible();
    await expect(page.locator('.toolbar')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('.properties-panel')).toBeVisible();
  });

  test('should switch tools via toolbar', async ({ page }) => {
    // Click rectangle tool
    await page.click('[title*="Rectangle"]');

    // Verify tool is active (button has active class)
    await expect(page.locator('[title*="Rectangle"]')).toHaveClass(/active/);
  });

  test('should switch tools via keyboard shortcuts', async ({ page }) => {
    // Press R for rectangle
    await page.keyboard.press('r');

    await expect(page.locator('[title*="Rectangle"]')).toHaveClass(/active/);

    // Press V for select
    await page.keyboard.press('v');

    await expect(page.locator('[title*="Select"]')).toHaveClass(/active/);
  });

  test('should draw a rectangle', async ({ page }) => {
    // Select rectangle tool
    await page.keyboard.press('r');

    // Draw on canvas
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    await page.mouse.move(box!.x + 100, box!.y + 100);
    await page.mouse.down();
    await page.mouse.move(box!.x + 200, box!.y + 200);
    await page.mouse.up();

    // Verify rectangle was created (properties panel should show values)
    await expect(page.locator('.properties-panel')).toContainText('WIDTH');
  });

  test('should select and move an object', async ({ page }) => {
    // Create a rectangle first
    await page.keyboard.press('r');
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    await page.mouse.move(box!.x + 100, box!.y + 100);
    await page.mouse.down();
    await page.mouse.move(box!.x + 200, box!.y + 200);
    await page.mouse.up();

    // Switch to select tool
    await page.keyboard.press('v');

    // Click to select
    await page.mouse.click(box!.x + 150, box!.y + 150);

    // Verify selection (properties panel should be active)
    await expect(page.locator('.properties-panel input')).toBeEnabled();

    // Drag to move
    await page.mouse.move(box!.x + 150, box!.y + 150);
    await page.mouse.down();
    await page.mouse.move(box!.x + 250, box!.y + 250);
    await page.mouse.up();
  });

  test('should undo and redo', async ({ page }) => {
    // Draw a rectangle
    await page.keyboard.press('r');
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    await page.mouse.move(box!.x + 100, box!.y + 100);
    await page.mouse.down();
    await page.mouse.move(box!.x + 200, box!.y + 200);
    await page.mouse.up();

    // Undo
    await page.keyboard.press('Control+z');

    // Redo
    await page.keyboard.press('Control+Shift+z');
  });

  test('should copy and paste', async ({ page }) => {
    // Create and select a rectangle
    await page.keyboard.press('r');
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    await page.mouse.move(box!.x + 100, box!.y + 100);
    await page.mouse.down();
    await page.mouse.move(box!.x + 200, box!.y + 200);
    await page.mouse.up();

    await page.keyboard.press('v');
    await page.mouse.click(box!.x + 150, box!.y + 150);

    // Copy
    await page.keyboard.press('Control+c');

    // Paste
    await page.keyboard.press('Control+v');
  });

  test('should zoom with keyboard', async ({ page }) => {
    // Zoom in
    await page.keyboard.press('Control+=');

    // Verify zoom changed (check status bar)
    const zoomDisplay = page.locator('.zoom-controls');
    await expect(zoomDisplay).not.toContainText('100%');
  });
});
```

**Package.json Scripts:**
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

**Acceptance Criteria:**
- [ ] Playwright configured and running
- [ ] Tests for app loading
- [ ] Tests for tool switching
- [ ] Tests for drawing shapes
- [ ] Tests for selection and movement
- [ ] Tests for undo/redo
- [ ] Tests for copy/paste
- [ ] Tests for zoom/pan
- [ ] Tests run in CI

---

## Project Structure

```
tests/
├── setup.ts              # Test setup and mocks
├── stores/
│   ├── canvasStore.test.ts
│   └── collaborationStore.test.ts
├── components/
│   ├── Canvas.test.tsx
│   ├── Toolbar.test.tsx
│   └── PropertiesPanel.test.tsx
├── utils/
│   └── geometry.test.ts  # Hit testing, bounds calculation
└── e2e/
    ├── canvas.spec.ts
    ├── collaboration.spec.ts
    └── export.spec.ts
```

---

## Testing Checklist
- [ ] Vitest configured and running
- [ ] Unit tests for canvasStore (90%+ coverage)
- [ ] Unit tests for collaborationStore
- [ ] Component tests for Canvas
- [ ] Component tests for Toolbar
- [ ] Component tests for PropertiesPanel
- [ ] E2E tests for critical flows
- [ ] CI pipeline runs tests
- [ ] Coverage reports generated
- [ ] All tests passing

## Dependencies
- None (can be done in parallel with all other PRDs)

## Notes
- Testing is completely separate from production code
- Start with store tests (most critical logic)
- E2E tests catch integration issues
- Consider visual regression testing in future (Percy, Chromatic)
- Mock Yjs carefully to isolate tests
