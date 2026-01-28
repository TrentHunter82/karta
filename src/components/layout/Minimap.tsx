import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasObject } from '../../types/canvas';
import './Minimap.css';

const MINIMAP_WIDTH = 150;
const MINIMAP_HEIGHT = 100;
const PADDING = 10;

// Calculate bounding box of objects
const calculateBounds = (objects: CanvasObject[]): { x: number; y: number; width: number; height: number } => {
  if (objects.length === 0) {
    return { x: -500, y: -500, width: 1000, height: 1000 };
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

// Get viewport bounds in canvas coordinates
const getViewportBounds = (viewport: { x: number; y: number; zoom: number }): { x: number; y: number; width: number; height: number } => {
  const canvasWidth = window.innerWidth - 260;
  const canvasHeight = window.innerHeight - 80;

  return {
    x: -viewport.x,
    y: -viewport.y,
    width: canvasWidth / viewport.zoom,
    height: canvasHeight / viewport.zoom
  };
};

// Union of two bounding boxes
const unionBounds = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): { x: number; y: number; width: number; height: number } => {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const objects = useCanvasStore((state) => state.objects);
  const viewport = useCanvasStore((state) => state.viewport);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const showMinimap = useCanvasStore((state) => state.showMinimap);

  // Calculate bounds and scale (memoized to avoid recalc every render)
  const allObjects = useMemo(() => Array.from(objects.values()), [objects]);
  const contentBounds = useMemo(() => calculateBounds(allObjects), [allObjects]);
  const viewportBounds = useMemo(() => getViewportBounds(viewport), [viewport]);

  const { totalBounds, scale } = useMemo(() => {
    const paddedContentBounds = {
      x: contentBounds.x - PADDING * 10,
      y: contentBounds.y - PADDING * 10,
      width: contentBounds.width + PADDING * 20,
      height: contentBounds.height + PADDING * 20
    };
    const total = unionBounds(paddedContentBounds, viewportBounds);
    const s = Math.min(
      (MINIMAP_WIDTH - PADDING * 2) / total.width,
      (MINIMAP_HEIGHT - PADDING * 2) / total.height
    ) * 0.9;
    return { totalBounds: total, scale: s };
  }, [contentBounds, viewportBounds]);

  // Draw minimap
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw background
    ctx.fillStyle = 'rgba(26, 26, 26, 0.95)';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Calculate offset to center content
    const offsetX = MINIMAP_WIDTH / 2 - (totalBounds.x + totalBounds.width / 2) * scale;
    const offsetY = MINIMAP_HEIGHT / 2 - (totalBounds.y + totalBounds.height / 2) * scale;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw objects as simplified shapes
    allObjects.forEach(obj => {
      // Use different colors based on object type
      switch (obj.type) {
        case 'rectangle':
        case 'ellipse':
          ctx.fillStyle = obj.fill || 'rgba(255, 255, 255, 0.3)';
          break;
        case 'text':
          ctx.fillStyle = 'rgba(255, 200, 100, 0.5)';
          break;
        case 'frame':
          ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
          break;
        case 'image':
        case 'video':
          ctx.fillStyle = 'rgba(100, 150, 255, 0.4)';
          break;
        case 'path':
        case 'line':
        case 'arrow':
          ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
          break;
        case 'group':
          ctx.fillStyle = 'rgba(150, 100, 200, 0.3)';
          break;
        default:
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      }

      // Draw simplified rectangle for each object
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    });

    // Draw viewport rectangle
    const vp = viewportBounds;
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 2 / scale;
    ctx.fillStyle = 'rgba(0, 102, 255, 0.1)';
    ctx.fillRect(vp.x, vp.y, vp.width, vp.height);
    ctx.strokeRect(vp.x, vp.y, vp.width, vp.height);

    ctx.restore();

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, MINIMAP_WIDTH - 1, MINIMAP_HEIGHT - 1);
  }, [allObjects, viewportBounds, totalBounds, scale]);

  // Redraw on changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Convert minimap click to canvas position
  const minimapToCanvas = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const minimapX = e.clientX - rect.left;
    const minimapY = e.clientY - rect.top;

    // Calculate offset used in drawing
    const offsetX = MINIMAP_WIDTH / 2 - (totalBounds.x + totalBounds.width / 2) * scale;
    const offsetY = MINIMAP_HEIGHT / 2 - (totalBounds.y + totalBounds.height / 2) * scale;

    // Convert to canvas coordinates
    const canvasX = (minimapX - offsetX) / scale;
    const canvasY = (minimapY - offsetY) / scale;

    return { x: canvasX, y: canvasY };
  }, [totalBounds, scale]);

  // Handle click on minimap to pan
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;

    const canvasPos = minimapToCanvas(e);

    // Get canvas dimensions
    const canvasWidth = window.innerWidth - 260;
    const canvasHeight = window.innerHeight - 80;

    // Center viewport on clicked position
    setViewport({
      x: -canvasPos.x + canvasWidth / 2 / viewport.zoom,
      y: -canvasPos.y + canvasHeight / 2 / viewport.zoom,
      zoom: viewport.zoom
    });
  }, [isDragging, minimapToCanvas, setViewport, viewport.zoom]);

  // Handle drag on minimap
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Check if clicking on the viewport rectangle
    const canvasPos = minimapToCanvas(e);
    const vp = viewportBounds;

    if (canvasPos.x >= vp.x && canvasPos.x <= vp.x + vp.width &&
        canvasPos.y >= vp.y && canvasPos.y <= vp.y + vp.height) {
      setIsDragging(true);
      e.preventDefault();
    }
  }, [minimapToCanvas, viewportBounds]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;

    const canvasPos = minimapToCanvas(e);

    // Get canvas dimensions
    const canvasWidth = window.innerWidth - 260;
    const canvasHeight = window.innerHeight - 80;

    // Center viewport on dragged position
    setViewport({
      x: -canvasPos.x + canvasWidth / 2 / viewport.zoom,
      y: -canvasPos.y + canvasHeight / 2 / viewport.zoom,
      zoom: viewport.zoom
    });
  }, [isDragging, minimapToCanvas, setViewport, viewport.zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!showMinimap) {
    return null;
  }

  return (
    <div className="minimap">
      <canvas
        ref={canvasRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      <div className="minimap-label">Press M to hide</div>
    </div>
  );
}
