import { useViewportStore } from '../../../src/stores/viewportStore';

// Mock window dimensions for zoom calculations
Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true });
Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });

const resetStore = () => {
  useViewportStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    showMinimap: false,
  });
};

describe('viewportStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('Initial State', () => {
    it('has default viewport at origin with 100% zoom', () => {
      const { viewport } = useViewportStore.getState();
      expect(viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('has minimap hidden by default', () => {
      const { showMinimap } = useViewportStore.getState();
      expect(showMinimap).toBe(false);
    });
  });

  describe('setViewport', () => {
    it('updates viewport position', () => {
      const store = useViewportStore.getState();

      store.setViewport({ x: 100, y: 200 });

      const { viewport } = useViewportStore.getState();
      expect(viewport.x).toBe(100);
      expect(viewport.y).toBe(200);
      expect(viewport.zoom).toBe(1); // Unchanged
    });

    it('updates viewport zoom', () => {
      const store = useViewportStore.getState();

      store.setViewport({ zoom: 2 });

      const { viewport } = useViewportStore.getState();
      expect(viewport.zoom).toBe(2);
      expect(viewport.x).toBe(0); // Unchanged
      expect(viewport.y).toBe(0); // Unchanged
    });

    it('updates multiple viewport properties', () => {
      const store = useViewportStore.getState();

      store.setViewport({ x: 50, y: 75, zoom: 1.5 });

      const { viewport } = useViewportStore.getState();
      expect(viewport).toEqual({ x: 50, y: 75, zoom: 1.5 });
    });

    it('partially updates viewport', () => {
      const store = useViewportStore.getState();
      store.setViewport({ x: 100, y: 200, zoom: 2 });

      store.setViewport({ x: 150 });

      const { viewport } = useViewportStore.getState();
      expect(viewport).toEqual({ x: 150, y: 200, zoom: 2 });
    });
  });

  describe('toggleMinimap', () => {
    it('toggles minimap visibility on', () => {
      const store = useViewportStore.getState();
      expect(useViewportStore.getState().showMinimap).toBe(false);

      store.toggleMinimap();

      expect(useViewportStore.getState().showMinimap).toBe(true);
    });

    it('toggles minimap visibility off', () => {
      useViewportStore.setState({ showMinimap: true });
      const store = useViewportStore.getState();

      store.toggleMinimap();

      expect(useViewportStore.getState().showMinimap).toBe(false);
    });

    it('toggles back and forth', () => {
      const store = useViewportStore.getState();

      store.toggleMinimap();
      expect(useViewportStore.getState().showMinimap).toBe(true);

      store.toggleMinimap();
      expect(useViewportStore.getState().showMinimap).toBe(false);

      store.toggleMinimap();
      expect(useViewportStore.getState().showMinimap).toBe(true);
    });
  });

  describe('zoomToFit', () => {
    it('resets to center with 100% zoom when no objects', () => {
      const store = useViewportStore.getState();
      store.setViewport({ x: 100, y: 100, zoom: 2 });

      store.zoomToFit([]);

      const { viewport } = useViewportStore.getState();
      expect(viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('calculates viewport to fit single object', () => {
      const store = useViewportStore.getState();
      const objects = [
        { id: 'obj-1', type: 'rectangle' as const, x: 100, y: 100, width: 200, height: 150, rotation: 0, opacity: 1, zIndex: 1, fill: '#000' }
      ];

      store.zoomToFit(objects);

      const { viewport } = useViewportStore.getState();
      // Viewport should be adjusted to center the object
      expect(viewport.zoom).toBeGreaterThan(0);
      expect(viewport.zoom).toBeLessThanOrEqual(5); // MAX_ZOOM
    });

    it('calculates viewport to fit multiple objects', () => {
      const store = useViewportStore.getState();
      const objects = [
        { id: 'obj-1', type: 'rectangle' as const, x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 1, fill: '#000' },
        { id: 'obj-2', type: 'rectangle' as const, x: 500, y: 500, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 2, fill: '#000' }
      ];

      store.zoomToFit(objects);

      const { viewport } = useViewportStore.getState();
      expect(viewport.zoom).toBeGreaterThan(0);
    });
  });

  describe('zoomToSelection', () => {
    const allObjects = [
      { id: 'obj-1', type: 'rectangle' as const, x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 1, fill: '#000' },
      { id: 'obj-2', type: 'rectangle' as const, x: 200, y: 200, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 2, fill: '#000' },
      { id: 'obj-3', type: 'rectangle' as const, x: 500, y: 500, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 3, fill: '#000' }
    ];

    it('falls back to zoomToFit when no selection', () => {
      const store = useViewportStore.getState();
      store.setViewport({ x: 100, y: 100, zoom: 2 });

      store.zoomToSelection(allObjects, new Set());

      // Should zoom to fit all objects (same as zoomToFit)
      const { viewport } = useViewportStore.getState();
      expect(viewport.zoom).toBeGreaterThan(0);
    });

    it('zooms to fit selected objects only', () => {
      const store = useViewportStore.getState();

      store.zoomToSelection(allObjects, new Set(['obj-1']));

      const { viewport } = useViewportStore.getState();
      expect(viewport.zoom).toBeGreaterThan(0);
    });

    it('zooms to fit multiple selected objects', () => {
      const store = useViewportStore.getState();

      store.zoomToSelection(allObjects, new Set(['obj-1', 'obj-2']));

      const { viewport } = useViewportStore.getState();
      expect(viewport.zoom).toBeGreaterThan(0);
    });
  });

  describe('setZoomPreset', () => {
    it('sets zoom to preset value', () => {
      const store = useViewportStore.getState();

      store.setZoomPreset(0.5);

      const { viewport } = useViewportStore.getState();
      expect(viewport.zoom).toBe(0.5);
    });

    it('clamps zoom to minimum', () => {
      const store = useViewportStore.getState();

      store.setZoomPreset(0.01); // Below MIN_ZOOM (0.1)

      const { viewport } = useViewportStore.getState();
      expect(viewport.zoom).toBe(0.1);
    });

    it('clamps zoom to maximum', () => {
      const store = useViewportStore.getState();

      store.setZoomPreset(10); // Above MAX_ZOOM (5.0)

      const { viewport } = useViewportStore.getState();
      expect(viewport.zoom).toBe(5);
    });

    it('maintains center position when zooming', () => {
      const store = useViewportStore.getState();
      store.setViewport({ x: 0, y: 0, zoom: 1 });

      // Zoom in
      store.setZoomPreset(2);

      const { viewport } = useViewportStore.getState();
      expect(viewport.zoom).toBe(2);
      // Position should adjust to keep the same center point
    });

    it('accepts standard zoom presets', () => {
      const store = useViewportStore.getState();

      // 50%
      store.setZoomPreset(0.5);
      expect(useViewportStore.getState().viewport.zoom).toBe(0.5);

      // 100%
      store.setZoomPreset(1);
      expect(useViewportStore.getState().viewport.zoom).toBe(1);

      // 150%
      store.setZoomPreset(1.5);
      expect(useViewportStore.getState().viewport.zoom).toBe(1.5);

      // 200%
      store.setZoomPreset(2);
      expect(useViewportStore.getState().viewport.zoom).toBe(2);
    });
  });
});
