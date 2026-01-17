import { useRef, useEffect, useState, useCallback } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasObject } from '../../types/canvas';
import './Canvas.css';

const MIN_ZOOM = 0.1; // 10%
const MAX_ZOOM = 5.0; // 500%
const ZOOM_SENSITIVITY = 0.001;
const GRID_SIZE = 20;
const HANDLE_SIZE = 8;
const ROTATION_HANDLE_OFFSET = 20;
const SELECTION_COLOR = '#0066ff';

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Store state
  const objects = useCanvasStore((state) => state.objects);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const viewport = useCanvasStore((state) => state.viewport);
  const activeTool = useCanvasStore((state) => state.activeTool);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const setSelection = useCanvasStore((state) => state.setSelection);

  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Resize canvas to fill container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback(
    (x: number, y: number) => ({
      x: (x + viewport.x) * viewport.zoom,
      y: (y + viewport.y) * viewport.zoom,
    }),
    [viewport]
  );

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (x: number, y: number) => ({
      x: x / viewport.zoom - viewport.x,
      y: y / viewport.zoom - viewport.y,
    }),
    [viewport]
  );

  // Draw a single object on the canvas
  const drawObject = useCallback(
    (ctx: CanvasRenderingContext2D, obj: CanvasObject) => {
      const { zoom } = viewport;
      const screenPos = canvasToScreen(obj.x, obj.y);

      ctx.save();
      ctx.translate(screenPos.x, screenPos.y);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      ctx.globalAlpha = obj.opacity;

      const width = obj.width * zoom;
      const height = obj.height * zoom;

      switch (obj.type) {
        case 'rectangle':
          if (obj.fill) {
            ctx.fillStyle = obj.fill;
            ctx.fillRect(0, 0, width, height);
          }
          if (obj.stroke && obj.strokeWidth) {
            ctx.strokeStyle = obj.stroke;
            ctx.lineWidth = obj.strokeWidth * zoom;
            ctx.strokeRect(0, 0, width, height);
          }
          break;
        case 'ellipse':
          ctx.beginPath();
          ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
          if (obj.fill) {
            ctx.fillStyle = obj.fill;
            ctx.fill();
          }
          if (obj.stroke && obj.strokeWidth) {
            ctx.strokeStyle = obj.stroke;
            ctx.lineWidth = obj.strokeWidth * zoom;
            ctx.stroke();
          }
          break;
        case 'text':
          ctx.fillStyle = obj.fill || '#ffffff';
          ctx.font = `${obj.fontSize * zoom}px ${obj.fontFamily}`;
          ctx.textAlign = obj.textAlign;
          ctx.textBaseline = 'top';
          const textX = obj.textAlign === 'center' ? width / 2 : obj.textAlign === 'right' ? width : 0;
          ctx.fillText(obj.text, textX, 0);
          break;
        case 'frame':
          ctx.fillStyle = obj.fill || '#2a2a2a';
          ctx.fillRect(0, 0, width, height);
          ctx.strokeStyle = obj.stroke || '#3a3a3a';
          ctx.lineWidth = (obj.strokeWidth || 1) * zoom;
          ctx.strokeRect(0, 0, width, height);
          // Draw frame label
          ctx.fillStyle = '#888888';
          ctx.font = `${12 * zoom}px sans-serif`;
          ctx.textBaseline = 'bottom';
          ctx.fillText(obj.name, 0, -4 * zoom);
          break;
        case 'path':
          if (obj.points.length > 0) {
            ctx.beginPath();
            const firstPoint = obj.points[0];
            ctx.moveTo(firstPoint.x * zoom, firstPoint.y * zoom);
            for (let i = 1; i < obj.points.length; i++) {
              ctx.lineTo(obj.points[i].x * zoom, obj.points[i].y * zoom);
            }
            ctx.strokeStyle = obj.stroke || '#ffffff';
            ctx.lineWidth = (obj.strokeWidth || 2) * zoom;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
          }
          break;
        case 'image':
        case 'video':
          // Placeholder for media - will be implemented later
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(0, 0, width, height);
          ctx.strokeStyle = '#4a4a4a';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, width, height);
          break;
      }

      ctx.restore();
    },
    [viewport, canvasToScreen]
  );

  // Draw selection box with handles
  const drawSelectionBox = useCallback(
    (ctx: CanvasRenderingContext2D, obj: CanvasObject) => {
      const { zoom } = viewport;
      const screenPos = canvasToScreen(obj.x, obj.y);
      const width = obj.width * zoom;
      const height = obj.height * zoom;

      ctx.save();
      ctx.translate(screenPos.x, screenPos.y);
      ctx.rotate((obj.rotation * Math.PI) / 180);

      // Draw bounding box
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(-0.5, -0.5, width + 1, height + 1);

      // Draw resize handles (8 handles)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1;

      const handlePositions = [
        { x: 0, y: 0 }, // top-left
        { x: width / 2, y: 0 }, // top-center
        { x: width, y: 0 }, // top-right
        { x: width, y: height / 2 }, // right-center
        { x: width, y: height }, // bottom-right
        { x: width / 2, y: height }, // bottom-center
        { x: 0, y: height }, // bottom-left
        { x: 0, y: height / 2 }, // left-center
      ];

      handlePositions.forEach((pos) => {
        ctx.fillRect(
          pos.x - HANDLE_SIZE / 2,
          pos.y - HANDLE_SIZE / 2,
          HANDLE_SIZE,
          HANDLE_SIZE
        );
        ctx.strokeRect(
          pos.x - HANDLE_SIZE / 2,
          pos.y - HANDLE_SIZE / 2,
          HANDLE_SIZE,
          HANDLE_SIZE
        );
      });

      // Draw rotation handle
      const rotationHandleY = -ROTATION_HANDLE_OFFSET;

      // Line connecting to rotation handle
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, rotationHandleY);
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.stroke();

      // Rotation handle circle
      ctx.beginPath();
      ctx.arc(width / 2, rotationHandleY, HANDLE_SIZE / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.stroke();

      ctx.restore();
    },
    [viewport, canvasToScreen]
  );

  // Draw the canvas content
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const { x: panX, y: panY, zoom } = viewport;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw dot grid pattern
    ctx.save();

    // Calculate grid spacing based on zoom
    const gridSpacing = GRID_SIZE * zoom;

    // Calculate offset for panning
    const offsetX = (panX * zoom) % gridSpacing;
    const offsetY = (panY * zoom) % gridSpacing;

    // Draw dots
    ctx.fillStyle = '#3a3a3a';
    const dotSize = Math.max(1, 2 * zoom);

    for (let x = offsetX; x < rect.width; x += gridSpacing) {
      for (let y = offsetY; y < rect.height; y += gridSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Draw objects
    objects.forEach((obj) => {
      drawObject(ctx, obj);
    });

    // Draw selection boxes for selected objects
    selectedIds.forEach((id) => {
      const obj = objects.get(id);
      if (obj) {
        drawSelectionBox(ctx, obj);
      }
    });
  }, [viewport, objects, selectedIds, drawObject, drawSelectionBox]);

  // Handle window resize
  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Draw on viewport change
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle keyboard events for space key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Hit test to find object at screen position
  const hitTest = useCallback(
    (screenX: number, screenY: number): CanvasObject | null => {
      const canvasPos = screenToCanvas(screenX, screenY);

      // Iterate objects in reverse order (top-most first)
      const objectsArray = Array.from(objects.values()).reverse();

      for (const obj of objectsArray) {
        // Simple bounding box hit test (doesn't account for rotation)
        // For more accuracy, we would need to apply inverse rotation
        const cos = Math.cos((-obj.rotation * Math.PI) / 180);
        const sin = Math.sin((-obj.rotation * Math.PI) / 180);

        // Translate point relative to object center
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        const dx = canvasPos.x - centerX;
        const dy = canvasPos.y - centerY;

        // Rotate point back
        const rotatedX = dx * cos - dy * sin + obj.width / 2;
        const rotatedY = dx * sin + dy * cos + obj.height / 2;

        // Check if within bounds
        if (
          rotatedX >= 0 &&
          rotatedX <= obj.width &&
          rotatedY >= 0 &&
          rotatedY <= obj.height
        ) {
          return obj;
        }
      }

      return null;
    },
    [objects, screenToCanvas]
  );

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * (1 + delta)));
    const zoomFactor = newZoom / viewport.zoom;

    // Adjust pan to zoom centered on cursor
    const newPanX = mouseX / viewport.zoom - (mouseX / viewport.zoom - viewport.x) / zoomFactor;
    const newPanY = mouseY / viewport.zoom - (mouseY / viewport.zoom - viewport.y) / zoomFactor;

    setViewport({
      x: newPanX,
      y: newPanY,
      zoom: newZoom,
    });
  }, [viewport, setViewport]);

  // Handle mouse down for panning and selection
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Middle mouse button (1) or left button with space pressed - panning
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault();
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Left click with select tool - selection
    if (e.button === 0 && activeTool === 'select') {
      const hitObject = hitTest(screenX, screenY);

      if (hitObject) {
        // Click on object - select it
        if (e.shiftKey) {
          // Shift+click - toggle selection
          if (selectedIds.has(hitObject.id)) {
            const newSelection = Array.from(selectedIds).filter((id) => id !== hitObject.id);
            setSelection(newSelection);
          } else {
            setSelection([...Array.from(selectedIds), hitObject.id]);
          }
        } else {
          // Normal click - select only this object
          setSelection([hitObject.id]);
        }
      } else {
        // Click on empty canvas - deselect all
        setSelection([]);
      }
    }
  }, [isSpacePressed, activeTool, hitTest, selectedIds, setSelection]);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanning) return;

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    setViewport({
      x: viewport.x + dx / viewport.zoom,
      y: viewport.y + dy / viewport.zoom,
    });

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, [isPanning, viewport, setViewport]);

  // Handle mouse up to stop panning
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle mouse leave to stop panning
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Prevent context menu on middle click
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
    }
  }, []);

  // Determine cursor style
  const getCursorStyle = () => {
    if (isPanning) return 'grabbing';
    if (isSpacePressed || activeTool === 'hand') return 'grab';
    if (activeTool === 'select') return 'default';
    return 'crosshair';
  };

  return (
    <main className="canvas-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="canvas"
        style={{ cursor: getCursorStyle() }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      />
    </main>
  );
}
