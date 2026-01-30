/**
 * Viewport Store
 *
 * Manages pan, zoom, and minimap visibility for the canvas viewport.
 * Extracted from canvasStore for separation of concerns.
 *
 * Key responsibilities:
 * - Track viewport offset (x, y) and zoom level
 * - Handle zoom operations (zoom in, out, to fit, to selection)
 * - Apply zoom constraints (MIN_ZOOM to MAX_ZOOM)
 * - Toggle minimap visibility
 *
 * Coordinate system:
 * - viewport.x/y: offset in screen pixels
 * - viewport.zoom: scale factor (1.0 = 100%)
 * - Canvas coords = (screen coords - offset) / zoom
 *
 * @see canvasStore.ts - Main store delegates viewport state here
 * @see constants/layout.ts - MIN_ZOOM, MAX_ZOOM values
 */
import { create } from 'zustand';
import type { Viewport, CanvasObject } from '../types/canvas';
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_VIEWPORT_PADDING, CANVAS_WIDTH_OFFSET, CANVAS_HEIGHT_OFFSET } from '../constants/layout';

const DEFAULT_PADDING = DEFAULT_VIEWPORT_PADDING;

/**
 * Calculate bounding box from an array of objects
 */
const calculateBoundingBox = (objects: CanvasObject[]): { x: number; y: number; width: number; height: number } => {
  if (objects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  objects.forEach(obj => {
    minX = Math.min(minX, obj.x);
    minY = Math.min(minY, obj.y);
    maxX = Math.max(maxX, obj.x + obj.width);
    maxY = Math.max(maxY, obj.y + obj.height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

interface ViewportState {
  // State
  viewport: Viewport;
  showMinimap: boolean;

  // Actions
  setViewport: (updates: Partial<Viewport>) => void;

  // Zoom operations - these need objects passed in
  zoomToFit: (objects: CanvasObject[]) => void;
  zoomToSelection: (objects: CanvasObject[], selectedIds: Set<string>) => void;
  setZoomPreset: (zoom: number) => void;

  toggleMinimap: () => void;
}

export const useViewportStore = create<ViewportState>((set, get) => ({
  // Initial state
  viewport: { x: 0, y: 0, zoom: 1 },
  showMinimap: false,

  setViewport: (updates) =>
    set((state) => ({
      viewport: { ...state.viewport, ...updates },
    })),

  zoomToFit: (objects) => {
    if (objects.length === 0) {
      // Reset to center with 100% zoom
      set({ viewport: { x: 0, y: 0, zoom: 1 } });
      return;
    }

    // Calculate bounding box of all objects
    const bounds = calculateBoundingBox(objects);

    // Guard against zero dimensions to prevent Infinity
    if (bounds.width <= 0 || bounds.height <= 0) {
      set({ viewport: { x: 0, y: 0, zoom: 1 } });
      return;
    }

    // Get canvas dimensions
    const canvasWidth = window.innerWidth - CANVAS_WIDTH_OFFSET;
    const canvasHeight = window.innerHeight - CANVAS_HEIGHT_OFFSET;

    // Calculate zoom to fit with padding
    const scaleX = (canvasWidth - DEFAULT_PADDING * 2) / bounds.width;
    const scaleY = (canvasHeight - DEFAULT_PADDING * 2) / bounds.height;
    const zoom = Math.min(scaleX, scaleY, MAX_ZOOM);

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
        zoom: Math.max(MIN_ZOOM, Math.min(zoom, MAX_ZOOM))
      }
    });

  },

  zoomToSelection: (objects, selectedIds) => {
    const selectedObjects = objects.filter(obj => selectedIds.has(obj.id));

    if (selectedObjects.length === 0) {
      // Fall back to zoom to fit all
      get().zoomToFit(objects);
      return;
    }

    const bounds = calculateBoundingBox(selectedObjects);

    // Guard against zero dimensions to prevent Infinity
    if (bounds.width <= 0 || bounds.height <= 0) {
      get().zoomToFit(objects);
      return;
    }

    // Get canvas dimensions
    const canvasWidth = window.innerWidth - CANVAS_WIDTH_OFFSET;
    const canvasHeight = window.innerHeight - CANVAS_HEIGHT_OFFSET;

    const scaleX = (canvasWidth - DEFAULT_PADDING * 2) / bounds.width;
    const scaleY = (canvasHeight - DEFAULT_PADDING * 2) / bounds.height;
    const zoom = Math.min(scaleX, scaleY, MAX_ZOOM);

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    const viewportX = -centerX + (canvasWidth / 2) / zoom;
    const viewportY = -centerY + (canvasHeight / 2) / zoom;

    set({
      viewport: {
        x: viewportX,
        y: viewportY,
        zoom: Math.max(MIN_ZOOM, Math.min(zoom, MAX_ZOOM))
      }
    });

  },

  setZoomPreset: (zoom) => {
    const state = get();
    const { viewport } = state;

    // Get canvas dimensions
    const canvasWidth = window.innerWidth - CANVAS_WIDTH_OFFSET;
    const canvasHeight = window.innerHeight - CANVAS_HEIGHT_OFFSET;

    // Calculate current center in canvas coordinates
    const centerX = -viewport.x + canvasWidth / 2 / viewport.zoom;
    const centerY = -viewport.y + canvasHeight / 2 / viewport.zoom;

    // Calculate new viewport to keep the center fixed
    const newX = -centerX + canvasWidth / 2 / zoom;
    const newY = -centerY + canvasHeight / 2 / zoom;

    set({
      viewport: {
        x: newX,
        y: newY,
        zoom: Math.max(MIN_ZOOM, Math.min(zoom, MAX_ZOOM))
      }
    });

  },

  toggleMinimap: () => {
    set((state) => ({
      showMinimap: !state.showMinimap
    }));
  },
}));
