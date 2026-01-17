import { useRef, useEffect, useState, useCallback } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasObject, RectangleObject, EllipseObject } from '../../types/canvas';
import './Canvas.css';

const MIN_ZOOM = 0.1; // 10%
const MAX_ZOOM = 5.0; // 500%
const ZOOM_SENSITIVITY = 0.001;
const GRID_SIZE = 20;
const HANDLE_SIZE = 8;
const ROTATION_HANDLE_OFFSET = 20;
const SELECTION_COLOR = '#0066ff';
const MIN_OBJECT_SIZE = 10;

// Handle types for resize
type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;
type RotationHandle = 'rotation' | null;

// Handle positions with their types
const HANDLE_POSITIONS: { type: HandleType; getPos: (w: number, h: number) => { x: number; y: number } }[] = [
  { type: 'nw', getPos: () => ({ x: 0, y: 0 }) },
  { type: 'n', getPos: (w) => ({ x: w / 2, y: 0 }) },
  { type: 'ne', getPos: (w) => ({ x: w, y: 0 }) },
  { type: 'e', getPos: (w, h) => ({ x: w, y: h / 2 }) },
  { type: 'se', getPos: (w, h) => ({ x: w, y: h }) },
  { type: 's', getPos: (w, h) => ({ x: w / 2, y: h }) },
  { type: 'sw', getPos: (_, h) => ({ x: 0, y: h }) },
  { type: 'w', getPos: (_, h) => ({ x: 0, y: h / 2 }) },
];

// Cursor styles for each handle type
const HANDLE_CURSORS: Record<NonNullable<HandleType>, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

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
  const updateObjects = useCanvasStore((state) => state.updateObjects);
  const addObject = useCanvasStore((state) => state.addObject);
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);

  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [activeResizeHandle, setActiveResizeHandle] = useState<HandleType>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<HandleType>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [hoveredRotationHandle, setHoveredRotationHandle] = useState<RotationHandle>(null);
  const [isDrawingRect, setIsDrawingRect] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const dragStartCanvasPos = useRef({ x: 0, y: 0 });
  const marqueeStart = useRef({ x: 0, y: 0 });
  const marqueeEnd = useRef({ x: 0, y: 0 });
  const marqueeShiftKey = useRef(false);
  const resizeHandle = useRef<HandleType>(null);
  const resizeStartObjState = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const resizeShiftKey = useRef(false);
  const rotationStartAngle = useRef(0);
  const rotationObjStartRotation = useRef(0);
  const rectDrawStart = useRef({ x: 0, y: 0 });
  const rectDrawEnd = useRef({ x: 0, y: 0 });
  const rectDrawShiftKey = useRef(false);
  const rectDrawAltKey = useRef(false); // Alt key for ellipse mode

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
        case 'text': {
          ctx.fillStyle = obj.fill || '#ffffff';
          ctx.font = `${obj.fontSize * zoom}px ${obj.fontFamily}`;
          ctx.textAlign = obj.textAlign;
          ctx.textBaseline = 'top';
          const textX = obj.textAlign === 'center' ? width / 2 : obj.textAlign === 'right' ? width : 0;
          ctx.fillText(obj.text, textX, 0);
          break;
        }
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

  // Draw marquee selection rectangle
  const drawMarqueeRect = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!isMarqueeSelecting) return;

      const startScreen = canvasToScreen(marqueeStart.current.x, marqueeStart.current.y);
      const endScreen = canvasToScreen(marqueeEnd.current.x, marqueeEnd.current.y);

      const x = Math.min(startScreen.x, endScreen.x);
      const y = Math.min(startScreen.y, endScreen.y);
      const width = Math.abs(endScreen.x - startScreen.x);
      const height = Math.abs(endScreen.y - startScreen.y);

      ctx.save();

      // Fill with semi-transparent blue
      ctx.fillStyle = 'rgba(0, 102, 255, 0.1)';
      ctx.fillRect(x, y, width, height);

      // Dashed blue border
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, width, height);

      ctx.restore();
    },
    [isMarqueeSelecting, canvasToScreen]
  );

  // Draw rectangle/ellipse preview while drawing
  const drawRectPreview = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!isDrawingRect) return;

      const start = rectDrawStart.current;
      const end = rectDrawEnd.current;
      const shiftKey = rectDrawShiftKey.current;
      const altKey = rectDrawAltKey.current;

      // Calculate dimensions
      let width = end.x - start.x;
      let height = end.y - start.y;

      // Constrain to square/circle if shift is held
      if (shiftKey) {
        const size = Math.max(Math.abs(width), Math.abs(height));
        width = width >= 0 ? size : -size;
        height = height >= 0 ? size : -size;
      }

      // Convert to screen coordinates
      const x = width >= 0 ? start.x : start.x + width;
      const y = height >= 0 ? start.y : start.y + height;
      const rectWidth = Math.abs(width);
      const rectHeight = Math.abs(height);

      const screenPos = canvasToScreen(x, y);
      const screenWidth = rectWidth * viewport.zoom;
      const screenHeight = rectHeight * viewport.zoom;

      ctx.save();

      if (altKey) {
        // Draw ellipse preview
        ctx.beginPath();
        ctx.ellipse(
          screenPos.x + screenWidth / 2,
          screenPos.y + screenHeight / 2,
          screenWidth / 2,
          screenHeight / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = '#4a4a4a';
        ctx.fill();

        // Draw a border to show the drawing area
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
      } else {
        // Draw rectangle with default fill
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(screenPos.x, screenPos.y, screenWidth, screenHeight);

        // Draw a border to show the drawing area
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(screenPos.x, screenPos.y, screenWidth, screenHeight);
      }

      ctx.restore();
    },
    [isDrawingRect, canvasToScreen, viewport.zoom]
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

    // Draw marquee selection rectangle
    drawMarqueeRect(ctx);

    // Draw rectangle preview while drawing
    drawRectPreview(ctx);
  }, [viewport, objects, selectedIds, drawObject, drawSelectionBox, drawMarqueeRect, drawRectPreview]);

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

  // Hit test for resize handles on a selected object
  const hitTestHandle = useCallback(
    (screenX: number, screenY: number, obj: CanvasObject): HandleType => {
      const { zoom } = viewport;
      const screenPos = canvasToScreen(obj.x, obj.y);
      const width = obj.width * zoom;
      const height = obj.height * zoom;

      // Transform click point to object's local coordinate system
      const cos = Math.cos((-obj.rotation * Math.PI) / 180);
      const sin = Math.sin((-obj.rotation * Math.PI) / 180);

      // Translate relative to object's screen position
      const dx = screenX - screenPos.x;
      const dy = screenY - screenPos.y;

      // Apply inverse rotation
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;

      // Check each handle
      const hitRadius = HANDLE_SIZE / 2 + 2; // Add a bit of tolerance
      for (const { type, getPos } of HANDLE_POSITIONS) {
        const handlePos = getPos(width, height);
        const distSq = (localX - handlePos.x) ** 2 + (localY - handlePos.y) ** 2;
        if (distSq <= hitRadius ** 2) {
          return type;
        }
      }

      return null;
    },
    [viewport, canvasToScreen]
  );

  // Hit test for rotation handle on a selected object
  const hitTestRotationHandle = useCallback(
    (screenX: number, screenY: number, obj: CanvasObject): RotationHandle => {
      const { zoom } = viewport;
      const screenPos = canvasToScreen(obj.x, obj.y);
      const width = obj.width * zoom;

      // Transform click point to object's local coordinate system
      const cos = Math.cos((-obj.rotation * Math.PI) / 180);
      const sin = Math.sin((-obj.rotation * Math.PI) / 180);

      // Translate relative to object's screen position
      const dx = screenX - screenPos.x;
      const dy = screenY - screenPos.y;

      // Apply inverse rotation
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;

      // Rotation handle position (top-center, above the object)
      const rotationHandleX = width / 2;
      const rotationHandleY = -ROTATION_HANDLE_OFFSET;

      const hitRadius = HANDLE_SIZE / 2 + 4; // Slightly larger hit area for rotation handle
      const distSq = (localX - rotationHandleX) ** 2 + (localY - rotationHandleY) ** 2;
      if (distSq <= hitRadius ** 2) {
        return 'rotation';
      }

      return null;
    },
    [viewport, canvasToScreen]
  );

  // Check if an object intersects with a rectangle (for marquee selection)
  const objectIntersectsRect = useCallback(
    (obj: CanvasObject, rectX1: number, rectY1: number, rectX2: number, rectY2: number): boolean => {
      // Normalize rectangle coordinates
      const minX = Math.min(rectX1, rectX2);
      const maxX = Math.max(rectX1, rectX2);
      const minY = Math.min(rectY1, rectY2);
      const maxY = Math.max(rectY1, rectY2);

      // Simple AABB intersection check (not accounting for rotation)
      const objRight = obj.x + obj.width;
      const objBottom = obj.y + obj.height;

      return !(obj.x > maxX || objRight < minX || obj.y > maxY || objBottom < minY);
    },
    []
  );

  // Get all objects that intersect with the marquee rectangle
  const getObjectsInMarquee = useCallback((): string[] => {
    const x1 = marqueeStart.current.x;
    const y1 = marqueeStart.current.y;
    const x2 = marqueeEnd.current.x;
    const y2 = marqueeEnd.current.y;

    const intersectingIds: string[] = [];
    objects.forEach((obj) => {
      if (objectIntersectsRect(obj, x1, y1, x2, y2)) {
        intersectingIds.push(obj.id);
      }
    });

    return intersectingIds;
  }, [objects, objectIntersectsRect]);

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

    // Left click with select tool - selection and dragging
    if (e.button === 0 && activeTool === 'select') {
      // Check if clicking on a resize or rotation handle of a selected object (only single selection)
      if (selectedIds.size === 1) {
        const selectedId = Array.from(selectedIds)[0];
        const selectedObj = objects.get(selectedId);
        if (selectedObj) {
          // Check rotation handle first
          const rotationHandle = hitTestRotationHandle(screenX, screenY, selectedObj);
          if (rotationHandle) {
            // Start rotating
            setIsRotating(true);

            // Calculate the center of the object in screen coordinates
            const centerX = selectedObj.x + selectedObj.width / 2;
            const centerY = selectedObj.y + selectedObj.height / 2;
            const screenCenter = canvasToScreen(centerX, centerY);

            // Calculate initial angle from center to mouse position
            const angleRad = Math.atan2(
              screenY - screenCenter.y,
              screenX - screenCenter.x
            );
            rotationStartAngle.current = (angleRad * 180) / Math.PI + 90; // +90 because handle is at top
            rotationObjStartRotation.current = selectedObj.rotation;
            return;
          }

          const handle = hitTestHandle(screenX, screenY, selectedObj);
          if (handle) {
            // Start resizing
            setIsResizing(true);
            setActiveResizeHandle(handle);
            resizeHandle.current = handle;
            resizeStartObjState.current = {
              x: selectedObj.x,
              y: selectedObj.y,
              width: selectedObj.width,
              height: selectedObj.height,
            };
            resizeShiftKey.current = e.shiftKey;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            dragStartCanvasPos.current = screenToCanvas(screenX, screenY);
            return;
          }
        }
      }

      const hitObject = hitTest(screenX, screenY);
      const canvasPos = screenToCanvas(screenX, screenY);

      if (hitObject) {
        // Click on object
        if (e.shiftKey) {
          // Shift+click - toggle selection
          if (selectedIds.has(hitObject.id)) {
            const newSelection = Array.from(selectedIds).filter((id) => id !== hitObject.id);
            setSelection(newSelection);
          } else {
            setSelection([...Array.from(selectedIds), hitObject.id]);
          }
        } else {
          // Normal click - check if clicking on already selected object
          if (selectedIds.has(hitObject.id)) {
            // Start dragging the selection
            setIsDragging(true);
            dragStartCanvasPos.current = { x: canvasPos.x, y: canvasPos.y };
            lastMousePos.current = { x: e.clientX, y: e.clientY };
          } else {
            // Select only this object and start dragging
            setSelection([hitObject.id]);
            setIsDragging(true);
            dragStartCanvasPos.current = { x: canvasPos.x, y: canvasPos.y };
            lastMousePos.current = { x: e.clientX, y: e.clientY };
          }
        }
      } else {
        // Click on empty canvas - start marquee selection
        const canvasPos = screenToCanvas(screenX, screenY);
        marqueeStart.current = { x: canvasPos.x, y: canvasPos.y };
        marqueeEnd.current = { x: canvasPos.x, y: canvasPos.y };
        marqueeShiftKey.current = e.shiftKey;
        setIsMarqueeSelecting(true);

        // Only clear selection if not holding shift
        if (!e.shiftKey) {
          setSelection([]);
        }
      }
    }

    // Left click with rectangle tool - draw rectangle/ellipse
    if (e.button === 0 && activeTool === 'rectangle') {
      const canvasPos = screenToCanvas(screenX, screenY);
      rectDrawStart.current = { x: canvasPos.x, y: canvasPos.y };
      rectDrawEnd.current = { x: canvasPos.x, y: canvasPos.y };
      rectDrawShiftKey.current = e.shiftKey;
      rectDrawAltKey.current = e.altKey; // Track Alt key for ellipse mode
      setIsDrawingRect(true);
      setSelection([]); // Clear selection when drawing
    }
  }, [isSpacePressed, activeTool, hitTest, hitTestHandle, hitTestRotationHandle, selectedIds, setSelection, screenToCanvas, canvasToScreen, objects]);

  // Handle mouse move for panning, dragging, and hover detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Handle panning
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;

      setViewport({
        x: viewport.x + dx / viewport.zoom,
        y: viewport.y + dy / viewport.zoom,
      });

      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Handle dragging selected objects
    if (isDragging && selectedIds.size > 0) {
      const dx = (e.clientX - lastMousePos.current.x) / viewport.zoom;
      const dy = (e.clientY - lastMousePos.current.y) / viewport.zoom;

      // Update all selected objects' positions
      const updates = Array.from(selectedIds).map((id) => {
        const obj = objects.get(id);
        if (!obj) return null;
        return {
          id,
          changes: {
            x: obj.x + dx,
            y: obj.y + dy,
          },
        };
      }).filter((u): u is { id: string; changes: { x: number; y: number } } => u !== null);

      if (updates.length > 0) {
        updateObjects(updates);
      }

      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Handle resizing
    if (isResizing && selectedIds.size === 1 && resizeHandle.current && resizeStartObjState.current) {
      const selectedId = Array.from(selectedIds)[0];
      const canvasPos = screenToCanvas(screenX, screenY);
      const startState = resizeStartObjState.current;
      const handle = resizeHandle.current;

      // Calculate delta in canvas coordinates from drag start
      const deltaX = canvasPos.x - dragStartCanvasPos.current.x;
      const deltaY = canvasPos.y - dragStartCanvasPos.current.y;

      let newX = startState.x;
      let newY = startState.y;
      let newWidth = startState.width;
      let newHeight = startState.height;

      // Calculate aspect ratio for proportional resize
      const aspectRatio = startState.width / startState.height;
      const isCornerHandle = handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se';
      // Corner handles: proportional by default, Shift for free resize
      // Edge handles: always single dimension
      const useProportional = isCornerHandle && !e.shiftKey;

      // Apply resize based on handle type
      switch (handle) {
        case 'nw': // top-left
          newWidth = startState.width - deltaX;
          newHeight = startState.height - deltaY;
          if (useProportional) {
            // Use the larger dimension change and maintain aspect ratio
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              newHeight = newWidth / aspectRatio;
            } else {
              newWidth = newHeight * aspectRatio;
            }
          }
          newX = startState.x + startState.width - newWidth;
          newY = startState.y + startState.height - newHeight;
          break;
        case 'n': // top
          newHeight = startState.height - deltaY;
          newY = startState.y + startState.height - newHeight;
          break;
        case 'ne': // top-right
          newWidth = startState.width + deltaX;
          newHeight = startState.height - deltaY;
          if (useProportional) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              newHeight = newWidth / aspectRatio;
            } else {
              newWidth = newHeight * aspectRatio;
            }
          }
          newY = startState.y + startState.height - newHeight;
          break;
        case 'e': // right
          newWidth = startState.width + deltaX;
          break;
        case 'se': // bottom-right
          newWidth = startState.width + deltaX;
          newHeight = startState.height + deltaY;
          if (useProportional) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              newHeight = newWidth / aspectRatio;
            } else {
              newWidth = newHeight * aspectRatio;
            }
          }
          break;
        case 's': // bottom
          newHeight = startState.height + deltaY;
          break;
        case 'sw': // bottom-left
          newWidth = startState.width - deltaX;
          newHeight = startState.height + deltaY;
          if (useProportional) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              newHeight = newWidth / aspectRatio;
            } else {
              newWidth = newHeight * aspectRatio;
            }
          }
          newX = startState.x + startState.width - newWidth;
          break;
        case 'w': // left
          newWidth = startState.width - deltaX;
          newX = startState.x + startState.width - newWidth;
          break;
      }

      // Enforce minimum size
      if (newWidth < MIN_OBJECT_SIZE) {
        newWidth = MIN_OBJECT_SIZE;
        // Recalculate X for left-side handles
        if (handle === 'nw' || handle === 'w' || handle === 'sw') {
          newX = startState.x + startState.width - MIN_OBJECT_SIZE;
        }
      }
      if (newHeight < MIN_OBJECT_SIZE) {
        newHeight = MIN_OBJECT_SIZE;
        // Recalculate Y for top-side handles
        if (handle === 'nw' || handle === 'n' || handle === 'ne') {
          newY = startState.y + startState.height - MIN_OBJECT_SIZE;
        }
      }

      updateObjects([{
        id: selectedId,
        changes: { x: newX, y: newY, width: newWidth, height: newHeight },
      }]);

      return;
    }

    // Handle rotation
    if (isRotating && selectedIds.size === 1) {
      const selectedId = Array.from(selectedIds)[0];
      const selectedObj = objects.get(selectedId);
      if (selectedObj) {
        // Calculate the center of the object in screen coordinates
        const centerX = selectedObj.x + selectedObj.width / 2;
        const centerY = selectedObj.y + selectedObj.height / 2;
        const screenCenter = canvasToScreen(centerX, centerY);

        // Calculate current angle from center to mouse position
        const currentAngleRad = Math.atan2(
          screenY - screenCenter.y,
          screenX - screenCenter.x
        );
        const currentAngle = (currentAngleRad * 180) / Math.PI + 90; // +90 because handle is at top

        // Calculate rotation delta
        const rotationDelta = currentAngle - rotationStartAngle.current;

        // Calculate new rotation
        let newRotation = rotationObjStartRotation.current + rotationDelta;

        // Normalize to 0-360 range
        newRotation = ((newRotation % 360) + 360) % 360;

        // Shift+drag snaps to 15° increments
        if (e.shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        }

        updateObjects([{
          id: selectedId,
          changes: { rotation: newRotation },
        }]);
      }
      return;
    }

    // Handle marquee selection
    if (isMarqueeSelecting) {
      const canvasPos = screenToCanvas(screenX, screenY);
      marqueeEnd.current = { x: canvasPos.x, y: canvasPos.y };
      // Force redraw to show marquee rectangle
      draw();
      return;
    }

    // Handle rectangle/ellipse drawing
    if (isDrawingRect) {
      const canvasPos = screenToCanvas(screenX, screenY);
      rectDrawEnd.current = { x: canvasPos.x, y: canvasPos.y };
      rectDrawShiftKey.current = e.shiftKey;
      rectDrawAltKey.current = e.altKey; // Track Alt key for ellipse mode
      // Force redraw to show rectangle/ellipse preview
      draw();
      return;
    }

    // Hover detection for resize handles, rotation handle, and move cursor (only when not dragging/panning/resizing)
    if (activeTool === 'select' && !isSpacePressed) {
      // First check for handle hover on selected objects
      if (selectedIds.size === 1) {
        const selectedId = Array.from(selectedIds)[0];
        const selectedObj = objects.get(selectedId);
        if (selectedObj) {
          // Check rotation handle first
          const rotHandle = hitTestRotationHandle(screenX, screenY, selectedObj);
          if (rotHandle) {
            setHoveredRotationHandle(rotHandle);
            setHoveredHandle(null);
            setHoveredObjectId(null);
            return;
          }

          const handle = hitTestHandle(screenX, screenY, selectedObj);
          if (handle) {
            setHoveredHandle(handle);
            setHoveredRotationHandle(null);
            setHoveredObjectId(null);
            return;
          }
        }
      }
      setHoveredHandle(null);
      setHoveredRotationHandle(null);

      // Then check for object hover
      const hitObject = hitTest(screenX, screenY);
      if (hitObject && selectedIds.has(hitObject.id)) {
        setHoveredObjectId(hitObject.id);
      } else {
        setHoveredObjectId(null);
      }
    }
  }, [isPanning, isDragging, isResizing, isRotating, isMarqueeSelecting, isDrawingRect, viewport, setViewport, selectedIds, objects, updateObjects, activeTool, isSpacePressed, hitTest, hitTestHandle, hitTestRotationHandle, screenToCanvas, canvasToScreen, draw]);

  // Handle mouse up to stop panning, dragging, and finalize marquee selection
  const handleMouseUp = useCallback(() => {
    // Finalize marquee selection
    if (isMarqueeSelecting) {
      const intersectingIds = getObjectsInMarquee();

      if (marqueeShiftKey.current) {
        // Shift was held: add to existing selection
        const newSelection = new Set(selectedIds);
        intersectingIds.forEach((id) => newSelection.add(id));
        setSelection(Array.from(newSelection));
      } else {
        // Normal marquee: select only intersecting objects
        setSelection(intersectingIds);
      }

      setIsMarqueeSelecting(false);
    }

    // Finalize rectangle/ellipse drawing
    if (isDrawingRect) {
      const start = rectDrawStart.current;
      const end = rectDrawEnd.current;
      const shiftKey = rectDrawShiftKey.current;
      const altKey = rectDrawAltKey.current;

      // Calculate dimensions
      let width = end.x - start.x;
      let height = end.y - start.y;

      // Constrain to square/circle if shift was held
      if (shiftKey) {
        const size = Math.max(Math.abs(width), Math.abs(height));
        width = width >= 0 ? size : -size;
        height = height >= 0 ? size : -size;
      }

      // Normalize to positive width/height
      const x = width >= 0 ? start.x : start.x + width;
      const y = height >= 0 ? start.y : start.y + height;
      const shapeWidth = Math.abs(width);
      const shapeHeight = Math.abs(height);

      // Only create shape if it has meaningful size
      if (shapeWidth >= MIN_OBJECT_SIZE && shapeHeight >= MIN_OBJECT_SIZE) {
        if (altKey) {
          // Create ellipse
          const newEllipse: EllipseObject = {
            id: crypto.randomUUID(),
            type: 'ellipse',
            x,
            y,
            width: shapeWidth,
            height: shapeHeight,
            rotation: 0,
            opacity: 1,
            fill: '#4a4a4a',
          };

          addObject(newEllipse);
          setSelection([newEllipse.id]);
        } else {
          // Create rectangle
          const newRect: RectangleObject = {
            id: crypto.randomUUID(),
            type: 'rectangle',
            x,
            y,
            width: shapeWidth,
            height: shapeHeight,
            rotation: 0,
            opacity: 1,
            fill: '#4a4a4a',
          };

          addObject(newRect);
          setSelection([newRect.id]);
        }
      }

      // Switch to select tool after drawing
      setActiveTool('select');
      setIsDrawingRect(false);
    }

    setIsPanning(false);
    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);
    setActiveResizeHandle(null);
    resizeHandle.current = null;
    resizeStartObjState.current = null;
  }, [isMarqueeSelecting, isDrawingRect, getObjectsInMarquee, selectedIds, setSelection, addObject, setActiveTool]);

  // Handle mouse leave to stop panning and dragging
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setIsDragging(false);
    setIsMarqueeSelecting(false);
    setIsResizing(false);
    setIsRotating(false);
    setIsDrawingRect(false);
    setActiveResizeHandle(null);
    setHoveredObjectId(null);
    setHoveredHandle(null);
    setHoveredRotationHandle(null);
    resizeHandle.current = null;
    resizeStartObjState.current = null;
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
    if (isRotating) return 'grab'; // Could use a custom rotate cursor
    if (isResizing && activeResizeHandle) return HANDLE_CURSORS[activeResizeHandle];
    if (isDragging) return 'move';
    if (isMarqueeSelecting) return 'crosshair';
    if (isDrawingRect) return 'crosshair';
    if (isSpacePressed || activeTool === 'hand') return 'grab';
    if (activeTool === 'select') {
      // Check for rotation handle hover
      if (hoveredRotationHandle) {
        return 'grab'; // Could use a custom rotate cursor
      }
      // Check for resize handle hover
      if (hoveredHandle) {
        return HANDLE_CURSORS[hoveredHandle];
      }
      if (hoveredObjectId && selectedIds.has(hoveredObjectId)) {
        return 'move';
      }
      return 'default';
    }
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
