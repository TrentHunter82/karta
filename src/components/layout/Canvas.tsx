import { useRef, useEffect, useState, useCallback } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useViewportStore } from '../../stores/viewportStore';
import { useGroupStore } from '../../stores/groupStore';
import { useToastStore } from '../../stores/toastStore';
import type { CanvasObject, RectangleObject, TextObject, ImageObject, VideoObject, GroupObject, LineObject, ArrowObject } from '../../types/canvas';
import { CursorPresence } from './CursorPresence';
import { Minimap } from './Minimap';
import { ContextMenu } from '../ContextMenu';
import { measureTextDimensions } from '../../utils/textMeasurement';
import { ToolManager } from '../../tools';
import type { ToolContext, ToolMouseEvent, HandleType as ToolHandleType, RotationHandle as ToolRotationHandle } from '../../tools/types';
import './Canvas.css';

// Image cache for loaded images
const imageCache = new Map<string, HTMLImageElement>();

// Video cache for loaded video thumbnails
const videoThumbnailCache = new Map<string, HTMLCanvasElement>();
const videoElementCache = new Map<string, HTMLVideoElement>();

// Zoom limits and sensitivity
const MIN_ZOOM = 0.1; // 10%
const MAX_ZOOM = 5.0; // 500%
const ZOOM_SENSITIVITY = 0.001;
const CTRL_ZOOM_SENSITIVITY = 0.01;

// Selection handle dimensions
const HANDLE_SIZE = 8;
const ROTATION_HANDLE_OFFSET = 20;
const SELECTION_COLOR = '#0066ff';

// Text rendering defaults
const DEFAULT_FONT_WEIGHT = 400;
const DEFAULT_LINE_HEIGHT = 1.2;

// Double-click detection timing
const DOUBLE_CLICK_THRESHOLD_MS = 300;
const EDITING_START_DELAY_MS = 500;

// Image import constraints
const MAX_IMPORTED_IMAGE_SIZE = 800;

// Toast durations
const ERROR_TOAST_DURATION_MS = 5000;

// Handle positions for drawing selection box
const HANDLE_POSITIONS = [
  { x: 0, y: 0 },
  { x: 0.5, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 0.5 },
  { x: 1, y: 1 },
  { x: 0.5, y: 1 },
  { x: 0, y: 1 },
  { x: 0, y: 0.5 },
];

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const frameInputRef = useRef<HTMLInputElement>(null);
  const lastClickTime = useRef<number>(0);
  const lastClickObjectId = useRef<string | null>(null);
  const justStartedEditingRef = useRef(false);

  // Store state
  const objects = useCanvasStore((state) => state.objects);
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const viewport = useViewportStore((state) => state.viewport);
  const activeTool = useCanvasStore((state) => state.activeTool);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const setSelection = useCanvasStore((state) => state.setSelection);
  const updateObjects = useCanvasStore((state) => state.updateObjects);
  const updateObject = useCanvasStore((state) => state.updateObject);
  const addObject = useCanvasStore((state) => state.addObject);
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);
  const getNextZIndex = useCanvasStore((state) => state.getNextZIndex);
  const setCursorPosition = useCanvasStore((state) => state.setCursorPosition);
  const pushHistory = useCanvasStore((state) => state.pushHistory);
  const editingGroupId = useGroupStore((state) => state.editingGroupId);
  const enterGroupEditMode = useCanvasStore((state) => state.enterGroupEditMode);
  const exitGroupEditMode = useCanvasStore((state) => state.exitGroupEditMode);
  const getAbsolutePosition = useCanvasStore((state) => state.getAbsolutePosition);
  const gridSettings = useCanvasStore((state) => state.gridSettings);
  const activeSnapGuides = useCanvasStore((state) => state.activeSnapGuides);

  // Local UI state
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [imageLoadTrigger, setImageLoadTrigger] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Tool system
  const toolManagerRef = useRef<ToolManager | null>(null);
  const [toolCursor, setToolCursor] = useState<string>('default');

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
        case 'rectangle': {
          const rectObj = obj as RectangleObject;
          const cornerRadius = (rectObj.cornerRadius || 0) * zoom;
          const r = Math.min(cornerRadius, width / 2, height / 2);

          if (r > 0) {
            ctx.beginPath();
            ctx.moveTo(r, 0);
            ctx.lineTo(width - r, 0);
            ctx.quadraticCurveTo(width, 0, width, r);
            ctx.lineTo(width, height - r);
            ctx.quadraticCurveTo(width, height, width - r, height);
            ctx.lineTo(r, height);
            ctx.quadraticCurveTo(0, height, 0, height - r);
            ctx.lineTo(0, r);
            ctx.quadraticCurveTo(0, 0, r, 0);
            ctx.closePath();

            if (obj.fill) {
              ctx.fillStyle = obj.fill;
              ctx.fill();
            }
            if (obj.stroke && obj.strokeWidth) {
              ctx.strokeStyle = obj.stroke;
              ctx.lineWidth = obj.strokeWidth * zoom;
              ctx.stroke();
            }
          } else {
            if (obj.fill) {
              ctx.fillStyle = obj.fill;
              ctx.fillRect(0, 0, width, height);
            }
            if (obj.stroke && obj.strokeWidth) {
              ctx.strokeStyle = obj.stroke;
              ctx.lineWidth = obj.strokeWidth * zoom;
              ctx.strokeRect(0, 0, width, height);
            }
          }
          break;
        }
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
          const textObj = obj as TextObject;
          ctx.fillStyle = textObj.fill || '#ffffff';
          const fontStyle = textObj.fontStyle || 'normal';
          const fontWeight = textObj.fontWeight || DEFAULT_FONT_WEIGHT;
          const fontSize = textObj.fontSize * zoom;
          ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${textObj.fontFamily}`;
          ctx.textAlign = textObj.textAlign || 'left';
          ctx.textBaseline = 'top';
          const textX = textObj.textAlign === 'center' ? width / 2 : textObj.textAlign === 'right' ? width : 0;

          const lines = textObj.text.split('\n');
          const lineHeightPx = fontSize * (textObj.lineHeight || DEFAULT_LINE_HEIGHT);

          lines.forEach((line, index) => {
            const y = index * lineHeightPx;
            ctx.fillText(line, textX, y);

            if (textObj.textDecoration && textObj.textDecoration !== 'none') {
              const metrics = ctx.measureText(line);
              const lineWidth = metrics.width;
              let decorationX = textX;

              if (textObj.textAlign === 'center') {
                decorationX = textX - lineWidth / 2;
              } else if (textObj.textAlign === 'right') {
                decorationX = textX - lineWidth;
              }

              ctx.strokeStyle = textObj.fill || '#ffffff';
              ctx.lineWidth = Math.max(1, fontSize / 12);
              ctx.beginPath();

              if (textObj.textDecoration === 'underline') {
                const underlineY = y + fontSize * 0.9;
                ctx.moveTo(decorationX, underlineY);
                ctx.lineTo(decorationX + lineWidth, underlineY);
              } else if (textObj.textDecoration === 'line-through') {
                const strikeY = y + fontSize * 0.5;
                ctx.moveTo(decorationX, strikeY);
                ctx.lineTo(decorationX + lineWidth, strikeY);
              }
              ctx.stroke();
            }
          });
          break;
        }
        case 'frame':
          ctx.fillStyle = obj.fill || '#2a2a2a';
          ctx.fillRect(0, 0, width, height);
          ctx.strokeStyle = obj.stroke || '#3a3a3a';
          ctx.lineWidth = (obj.strokeWidth || 1) * zoom;
          ctx.strokeRect(0, 0, width, height);
          ctx.fillStyle = '#888888';
          ctx.font = `${12 * zoom}px sans-serif`;
          ctx.textBaseline = 'bottom';
          ctx.fillText(obj.name, 0, -4 * zoom);
          break;
        case 'path':
          if (obj.points.length > 0) {
            // Calculate the original extent of points (stored at creation time)
            let maxPointX = 0, maxPointY = 0;
            for (const p of obj.points) {
              maxPointX = Math.max(maxPointX, p.x);
              maxPointY = Math.max(maxPointY, p.y);
            }
            // Scale points to current width/height (allows resizing)
            const scaleX = maxPointX > 0 ? width / maxPointX : zoom;
            const scaleY = maxPointY > 0 ? height / maxPointY : zoom;

            ctx.beginPath();
            const firstPoint = obj.points[0];
            ctx.moveTo(firstPoint.x * scaleX, firstPoint.y * scaleY);
            for (let i = 1; i < obj.points.length; i++) {
              ctx.lineTo(obj.points[i].x * scaleX, obj.points[i].y * scaleY);
            }
            ctx.strokeStyle = obj.stroke || '#ffffff';
            ctx.lineWidth = (obj.strokeWidth || 2) * zoom;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
          }
          break;
        case 'image': {
          const imgObj = obj as ImageObject;
          const cachedImg = imageCache.get(imgObj.src);
          if (!cachedImg) {
            if (!imageCache.has(imgObj.src)) {
              const newImg = new Image();
              newImg.crossOrigin = 'anonymous';
              imageCache.set(imgObj.src, newImg);
              newImg.onload = () => {
                setImageLoadTrigger((prev) => prev + 1);
              };
              newImg.src = imgObj.src;
            }
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = '#4a4a4a';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, width, height);
            ctx.fillStyle = '#666666';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Loading...', width / 2, height / 2);
          } else if (cachedImg.complete && cachedImg.naturalWidth > 0) {
            ctx.drawImage(cachedImg, 0, 0, width, height);
          } else {
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = '#4a4a4a';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, width, height);
            ctx.fillStyle = '#666666';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Loading...', width / 2, height / 2);
          }
          break;
        }
        case 'video': {
          const vidObj = obj as VideoObject;
          const thumbnailCanvas = videoThumbnailCache.get(vidObj.src);

          if (!thumbnailCanvas) {
            if (!videoElementCache.has(vidObj.src)) {
              const video = document.createElement('video');
              video.crossOrigin = 'anonymous';
              video.muted = true;
              video.preload = 'metadata';
              videoElementCache.set(vidObj.src, video);

              video.onloadeddata = () => {
                video.currentTime = 0;
              };

              video.onseeked = () => {
                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = video.videoWidth;
                thumbCanvas.height = video.videoHeight;
                const thumbCtx = thumbCanvas.getContext('2d');
                if (thumbCtx) {
                  thumbCtx.drawImage(video, 0, 0);
                  videoThumbnailCache.set(vidObj.src, thumbCanvas);
                  setImageLoadTrigger((prev) => prev + 1);
                }
              };

              video.src = vidObj.src;
            }

            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, width, height);
            ctx.fillStyle = '#666666';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Loading video...', width / 2, height / 2);
          } else {
            ctx.drawImage(thumbnailCanvas, 0, 0, width, height);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, 0, width, height);
          }

          // Draw play button overlay
          const buttonSize = Math.min(60, Math.min(width, height) * 0.3);
          const centerX = width / 2;
          const centerY = height / 2;

          ctx.beginPath();
          ctx.arc(centerX, centerY, buttonSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();

          const triangleSize = buttonSize * 0.4;
          ctx.beginPath();
          ctx.moveTo(centerX - triangleSize * 0.4, centerY - triangleSize * 0.5);
          ctx.lineTo(centerX + triangleSize * 0.6, centerY);
          ctx.lineTo(centerX - triangleSize * 0.4, centerY + triangleSize * 0.5);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fill();
          break;
        }
        case 'group': {
          ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(0, 0, width, height);
          ctx.setLineDash([]);
          break;
        }
        case 'line': {
          const lineObj = obj as LineObject;
          ctx.beginPath();
          ctx.moveTo(lineObj.x1 * zoom, lineObj.y1 * zoom);
          ctx.lineTo(lineObj.x2 * zoom, lineObj.y2 * zoom);
          ctx.strokeStyle = obj.stroke || '#ffffff';
          ctx.lineWidth = (obj.strokeWidth || 2) * zoom;
          ctx.lineCap = 'round';
          ctx.stroke();
          break;
        }
        case 'arrow': {
          const arrowObj = obj as ArrowObject;
          const arrowSize = (arrowObj.arrowSize || 1) * 10 * zoom;
          const strokeW = (obj.strokeWidth || 2) * zoom;

          ctx.beginPath();
          ctx.moveTo(arrowObj.x1 * zoom, arrowObj.y1 * zoom);
          ctx.lineTo(arrowObj.x2 * zoom, arrowObj.y2 * zoom);
          ctx.strokeStyle = obj.stroke || '#ffffff';
          ctx.lineWidth = strokeW;
          ctx.lineCap = 'round';
          ctx.stroke();

          const dx = arrowObj.x2 - arrowObj.x1;
          const dy = arrowObj.y2 - arrowObj.y1;
          const angle = Math.atan2(dy, dx);

          if (arrowObj.arrowEnd !== false) {
            ctx.save();
            ctx.translate(arrowObj.x2 * zoom, arrowObj.y2 * zoom);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-arrowSize, -arrowSize / 2);
            ctx.lineTo(-arrowSize, arrowSize / 2);
            ctx.closePath();
            ctx.fillStyle = obj.stroke || '#ffffff';
            ctx.fill();
            ctx.restore();
          }

          if (arrowObj.arrowStart) {
            ctx.save();
            ctx.translate(arrowObj.x1 * zoom, arrowObj.y1 * zoom);
            ctx.rotate(angle + Math.PI);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-arrowSize, -arrowSize / 2);
            ctx.lineTo(-arrowSize, arrowSize / 2);
            ctx.closePath();
            ctx.fillStyle = obj.stroke || '#ffffff';
            ctx.fill();
            ctx.restore();
          }
          break;
        }
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

      // Draw resize handles
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1;

      HANDLE_POSITIONS.forEach((pos) => {
        const hx = pos.x * width;
        const hy = pos.y * height;
        ctx.fillRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      });

      // Draw rotation handle
      const rotationHandleY = -ROTATION_HANDLE_OFFSET;

      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, rotationHandleY);
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.stroke();

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

    // Clear canvas with sleek dark gradient
    const gradient = ctx.createRadialGradient(
      rect.width / 2, 0, 0,
      rect.width / 2, rect.height, rect.height
    );
    gradient.addColorStop(0, '#141414');
    gradient.addColorStop(0.5, '#0a0a0a');
    gradient.addColorStop(1, '#050505');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw grid if visible
    if (gridSettings.visible) {
      const { zoom } = viewport;

      // Calculate grid bounds in screen space
      const startCanvasX = -viewport.x;
      const startCanvasY = -viewport.y;
      const endCanvasX = rect.width / zoom - viewport.x;
      const endCanvasY = rect.height / zoom - viewport.y;

      // Snap to grid lines
      const startX = Math.floor(startCanvasX / gridSettings.size) * gridSettings.size;
      const startY = Math.floor(startCanvasY / gridSettings.size) * gridSettings.size;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;

      // Draw vertical lines
      for (let x = startX; x <= endCanvasX; x += gridSettings.size) {
        const screenX = (x + viewport.x) * zoom;
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, rect.height);
        ctx.stroke();
      }

      // Draw horizontal lines
      for (let y = startY; y <= endCanvasY; y += gridSettings.size) {
        const screenY = (y + viewport.y) * zoom;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(rect.width, screenY);
        ctx.stroke();
      }
    }

    // Draw objects sorted by zIndex
    const sortedObjects = Array.from(objects.values())
      .filter((obj) => obj.visible !== false && !obj.parentId)
      .sort((a, b) => a.zIndex - b.zIndex);

    sortedObjects.forEach((obj) => {
      drawObject(ctx, obj);
      if (obj.type === 'group') {
        const group = obj as GroupObject;
        const groupPos = getAbsolutePosition(group);
        group.children.forEach((childId) => {
          const child = objects.get(childId);
          if (child && child.visible !== false) {
            const absChild = {
              ...child,
              x: groupPos.x + child.x,
              y: groupPos.y + child.y,
            };
            drawObject(ctx, absChild as CanvasObject);
          }
        });
      }
    });

    // Draw selection boxes
    selectedIds.forEach((id) => {
      const obj = objects.get(id);
      if (obj) {
        drawSelectionBox(ctx, obj);
      }
    });

    // Draw snap guides
    if (activeSnapGuides.length > 0) {
      const { zoom } = viewport;
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      for (const guide of activeSnapGuides) {
        const screenPos = guide.type === 'vertical'
          ? (guide.position + viewport.x) * zoom
          : (guide.position + viewport.y) * zoom;

        ctx.beginPath();
        if (guide.type === 'vertical') {
          ctx.moveTo(screenPos, 0);
          ctx.lineTo(screenPos, rect.height);
        } else {
          ctx.moveTo(0, screenPos);
          ctx.lineTo(rect.width, screenPos);
        }
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    // Render tool overlay (marquee, guides, etc.)
    if (toolManagerRef.current) {
      toolManagerRef.current.renderOverlay(ctx);
    }
  }, [viewport, objects, selectedIds, drawObject, drawSelectionBox, getAbsolutePosition, imageLoadTrigger, gridSettings, activeSnapGuides]);

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

  // Handle keyboard events for space key (temporary panning)
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

  // Window-level event listeners for panning
  useEffect(() => {
    if (!isPanning) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;

      if (dx !== 0 || dy !== 0) {
        setViewport({
          x: viewport.x + dx / viewport.zoom,
          y: viewport.y + dy / viewport.zoom,
        });
      }
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleWindowMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isPanning, viewport, setViewport]);

  // Helper function to check if a point is inside an object's bounds
  const isPointInObject = useCallback(
    (canvasPos: { x: number; y: number }, obj: CanvasObject, objAbsX?: number, objAbsY?: number): boolean => {
      const objX = objAbsX ?? obj.x;
      const objY = objAbsY ?? obj.y;

      const cos = Math.cos((-obj.rotation * Math.PI) / 180);
      const sin = Math.sin((-obj.rotation * Math.PI) / 180);

      const centerX = objX + obj.width / 2;
      const centerY = objY + obj.height / 2;
      const dx = canvasPos.x - centerX;
      const dy = canvasPos.y - centerY;

      const rotatedX = dx * cos - dy * sin + obj.width / 2;
      const rotatedY = dx * sin + dy * cos + obj.height / 2;

      return rotatedX >= 0 && rotatedX <= obj.width && rotatedY >= 0 && rotatedY <= obj.height;
    },
    []
  );

  // Hit test to find object at screen position
  const hitTest = useCallback(
    (screenX: number, screenY: number): CanvasObject | null => {
      const canvasPos = screenToCanvas(screenX, screenY);

      const topLevelObjects = Array.from(objects.values())
        .filter((obj) => obj.visible !== false && !obj.parentId)
        .sort((a, b) => b.zIndex - a.zIndex);

      if (editingGroupId) {
        const editingGroup = objects.get(editingGroupId) as GroupObject | undefined;
        if (editingGroup) {
          const groupPos = getAbsolutePosition(editingGroup);
          for (const childId of editingGroup.children) {
            const child = objects.get(childId);
            if (child && child.visible !== false) {
              const absX = groupPos.x + child.x;
              const absY = groupPos.y + child.y;
              if (isPointInObject(canvasPos, child, absX, absY)) {
                return child;
              }
            }
          }
        }
      }

      for (const obj of topLevelObjects) {
        if (obj.type === 'group') {
          const group = obj as GroupObject;
          const groupPos = getAbsolutePosition(group);

          if (editingGroupId !== group.id) {
            for (const childId of group.children) {
              const child = objects.get(childId);
              if (child && child.visible !== false) {
                const absX = groupPos.x + child.x;
                const absY = groupPos.y + child.y;
                if (isPointInObject(canvasPos, child, absX, absY)) {
                  return group;
                }
              }
            }
          }
          if (isPointInObject(canvasPos, obj)) {
            return obj;
          }
        } else {
          if (isPointInObject(canvasPos, obj)) {
            return obj;
          }
        }
      }

      return null;
    },
    [objects, screenToCanvas, editingGroupId, getAbsolutePosition, isPointInObject]
  );

  // Hit test for resize handles
  const hitTestHandle = useCallback(
    (screenX: number, screenY: number, obj: CanvasObject): ToolHandleType => {
      const { zoom } = viewport;
      const screenPos = canvasToScreen(obj.x, obj.y);
      const width = obj.width * zoom;
      const height = obj.height * zoom;

      const cos = Math.cos((-obj.rotation * Math.PI) / 180);
      const sin = Math.sin((-obj.rotation * Math.PI) / 180);

      const dx = screenX - screenPos.x;
      const dy = screenY - screenPos.y;

      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;

      const hitRadius = HANDLE_SIZE / 2 + 2;
      const handles: Array<{ type: ToolHandleType; x: number; y: number }> = [
        { type: 'nw', x: 0, y: 0 },
        { type: 'n', x: width / 2, y: 0 },
        { type: 'ne', x: width, y: 0 },
        { type: 'e', x: width, y: height / 2 },
        { type: 'se', x: width, y: height },
        { type: 's', x: width / 2, y: height },
        { type: 'sw', x: 0, y: height },
        { type: 'w', x: 0, y: height / 2 },
      ];

      for (const { type, x, y } of handles) {
        const distSq = (localX - x) ** 2 + (localY - y) ** 2;
        if (distSq <= hitRadius ** 2) {
          return type;
        }
      }

      return null;
    },
    [viewport, canvasToScreen]
  );

  // Hit test for rotation handle
  const hitTestRotationHandle = useCallback(
    (screenX: number, screenY: number, obj: CanvasObject): ToolRotationHandle => {
      const { zoom } = viewport;
      const screenPos = canvasToScreen(obj.x, obj.y);
      const width = obj.width * zoom;

      const cos = Math.cos((-obj.rotation * Math.PI) / 180);
      const sin = Math.sin((-obj.rotation * Math.PI) / 180);

      const dx = screenX - screenPos.x;
      const dy = screenY - screenPos.y;

      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;

      const rotationHandleX = width / 2;
      const rotationHandleY = -ROTATION_HANDLE_OFFSET;

      const hitRadius = HANDLE_SIZE / 2 + 4;
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
      const minX = Math.min(rectX1, rectX2);
      const maxX = Math.max(rectX1, rectX2);
      const minY = Math.min(rectY1, rectY2);
      const maxY = Math.max(rectY1, rectY2);

      const objRight = obj.x + obj.width;
      const objBottom = obj.y + obj.height;

      return !(obj.x > maxX || objRight < minX || obj.y > maxY || objBottom < minY);
    },
    []
  );

  // Create ToolContext for the tool system
  const createToolContext = useCallback((): ToolContext => ({
    getObjects: () => objects,
    getSelectedIds: () => selectedIds,
    getViewport: () => viewport,
    getEditingGroupId: () => editingGroupId,

    addObject,
    updateObject,
    updateObjects,
    deleteObject: (id: string) => useCanvasStore.getState().deleteObject(id),
    setSelection,
    pushHistory,
    setActiveTool,
    duplicateObjects: (ids: string[]) => {
      const newIds: string[] = [];
      const currentObjects = useCanvasStore.getState().objects;
      ids.forEach(id => {
        const obj = currentObjects.get(id);
        if (obj && !obj.locked) {
          const newObj = {
            ...JSON.parse(JSON.stringify(obj)),
            id: crypto.randomUUID(),
            zIndex: getNextZIndex(),
          };
          addObject(newObj);
          newIds.push(newObj.id);
        }
      });
      return newIds;
    },
    enterGroupEditMode,
    exitGroupEditMode,
    getAbsolutePosition,

    screenToCanvas: (x: number, y: number) => screenToCanvas(x, y),
    canvasToScreen: (x: number, y: number) => canvasToScreen(x, y),
    setViewport,

    getNextZIndex,
    getObjectsInsideFrame: (frameId: string) => useCanvasStore.getState().getObjectsInsideFrame(frameId),
    hitTest: (x: number, y: number) => hitTest(x, y),
    hitTestHandle: (x: number, y: number, obj: CanvasObject) => hitTestHandle(x, y, obj),
    hitTestRotationHandle: (x: number, y: number, obj: CanvasObject) => hitTestRotationHandle(x, y, obj),
    getObjectsInRect: (x1: number, y1: number, x2: number, y2: number) => {
      const intersectingIds: string[] = [];
      objects.forEach((obj) => {
        if (objectIntersectsRect(obj, x1, y1, x2, y2)) {
          intersectingIds.push(obj.id);
        }
      });
      return intersectingIds;
    },
    isPointInObject: (pos, obj, absX, absY) => isPointInObject(pos, obj, absX, absY),
    setCursor: (cursor: string) => setToolCursor(cursor),
  }), [
    objects, selectedIds, viewport, editingGroupId,
    addObject, updateObject, updateObjects, setSelection, pushHistory,
    setActiveTool, enterGroupEditMode, exitGroupEditMode, getAbsolutePosition,
    screenToCanvas, canvasToScreen, setViewport, getNextZIndex, hitTest, hitTestHandle,
    hitTestRotationHandle, objectIntersectsRect, isPointInObject
  ]);

  // Initialize and update ToolManager
  useEffect(() => {
    const ctx = createToolContext();

    if (!toolManagerRef.current) {
      toolManagerRef.current = new ToolManager(ctx);
      console.log('[Canvas] ToolManager initialized with all tools');
    } else {
      toolManagerRef.current.updateContext(ctx);
    }
  }, [createToolContext]);

  // Sync active tool with ToolManager
  useEffect(() => {
    if (!toolManagerRef.current) return;
    toolManagerRef.current.setActiveTool(activeTool);
  }, [activeTool]);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.ctrlKey ? -e.deltaY * CTRL_ZOOM_SENSITIVITY : -e.deltaY * ZOOM_SENSITIVITY;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * (1 + delta)));

    if (newZoom === viewport.zoom) return;

    const newPanX = viewport.x + mouseX * (1 / newZoom - 1 / viewport.zoom);
    const newPanY = viewport.y + mouseY * (1 / newZoom - 1 / viewport.zoom);

    setViewport({
      x: newPanX,
      y: newPanY,
      zoom: newZoom,
    });
  }, [viewport, setViewport]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Close context menu if open
    if (contextMenu) {
      setContextMenu(null);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Middle mouse button or left button with space - panning
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault();
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Route to ToolManager
    if (e.button === 0 && toolManagerRef.current) {
      const canvasPos = screenToCanvas(screenX, screenY);
      const toolEvent: ToolMouseEvent = {
        screenX,
        screenY,
        canvasX: canvasPos.x,
        canvasY: canvasPos.y,
        button: e.button,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      };

      const result = toolManagerRef.current.handleMouseDown(toolEvent);
      if (result.handled) {
        if (result.cursor) {
          setToolCursor(result.cursor);
        }

        // Handle text tool - start editing immediately for newly created text
        if (activeTool === 'text' && result.requestRedraw) {
          const currentState = useCanvasStore.getState();
          const currentSelectedIds = currentState.selectedIds;
          const currentObjects = currentState.objects;

          const newTextObj = Array.from(currentObjects.values()).find(
            obj => obj.type === 'text' && currentSelectedIds.has(obj.id)
          );
          if (newTextObj) {
            justStartedEditingRef.current = true;
            setEditingTextId(newTextObj.id);
            setTimeout(() => { justStartedEditingRef.current = false; }, EDITING_START_DELAY_MS);
          }
        }

        // Handle double-click on text/frame to enter edit mode
        if (activeTool === 'select') {
          const hitObject = hitTest(screenX, screenY);
          if (hitObject) {
            const now = Date.now();
            const isDoubleClick =
              lastClickObjectId.current === hitObject.id &&
              now - lastClickTime.current < DOUBLE_CLICK_THRESHOLD_MS;

            lastClickTime.current = now;
            lastClickObjectId.current = hitObject.id;

            if (isDoubleClick) {
              if (hitObject.type === 'text') {
                const textObj = hitObject as TextObject;
                const dimensions = measureTextDimensions({
                  text: textObj.text,
                  fontSize: textObj.fontSize,
                  fontFamily: textObj.fontFamily,
                  fontWeight: textObj.fontWeight,
                  fontStyle: textObj.fontStyle,
                  lineHeight: textObj.lineHeight,
                });
                updateObject(hitObject.id, {
                  width: dimensions.width,
                  height: dimensions.height,
                });
                setSelection([hitObject.id]);
                justStartedEditingRef.current = true;
                setEditingTextId(hitObject.id);
                setTimeout(() => { justStartedEditingRef.current = false; }, EDITING_START_DELAY_MS);
                return;
              }
              if (hitObject.type === 'frame') {
                setSelection([hitObject.id]);
                setEditingFrameId(hitObject.id);
                return;
              }
              if (hitObject.type === 'video') {
                if (playingVideoId === hitObject.id) {
                  setPlayingVideoId(null);
                } else {
                  setPlayingVideoId(hitObject.id);
                }
                return;
              }
            }
          }
        }

        return;
      }
    }
  }, [isSpacePressed, activeTool, hitTest, screenToCanvas, setSelection, updateObject, playingVideoId, contextMenu]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Update cursor position
    const canvasCursorPos = screenToCanvas(screenX, screenY);
    setCursorPosition(canvasCursorPos);

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

    // Route to ToolManager
    if (toolManagerRef.current) {
      const canvasPos = screenToCanvas(screenX, screenY);
      const toolEvent: ToolMouseEvent = {
        screenX,
        screenY,
        canvasX: canvasPos.x,
        canvasY: canvasPos.y,
        button: e.button,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      };

      const result = toolManagerRef.current.handleMouseMove(toolEvent);
      if (result.handled) {
        if (result.cursor) {
          setToolCursor(result.cursor);
        }
        if (result.requestRedraw) {
          draw();
        }
        return;
      }
    }
  }, [isPanning, viewport, setViewport, screenToCanvas, setCursorPosition, draw]);

  // Handle mouse up
  const handleMouseUp = useCallback((e?: React.MouseEvent<HTMLCanvasElement>) => {
    if (toolManagerRef.current) {
      const canvas = canvasRef.current;
      let screenX = 0, screenY = 0, canvasX = 0, canvasY = 0;
      if (canvas && e) {
        const rect = canvas.getBoundingClientRect();
        screenX = e.clientX - rect.left;
        screenY = e.clientY - rect.top;
        const canvasPos = screenToCanvas(screenX, screenY);
        canvasX = canvasPos.x;
        canvasY = canvasPos.y;
      }

      const toolEvent: ToolMouseEvent = {
        screenX,
        screenY,
        canvasX,
        canvasY,
        button: e?.button ?? 0,
        shiftKey: e?.shiftKey ?? false,
        ctrlKey: e?.ctrlKey ?? false,
        altKey: e?.altKey ?? false,
        metaKey: e?.metaKey ?? false,
      };

      const result = toolManagerRef.current.handleMouseUp(toolEvent);
      if (result.handled) {
        setToolCursor('default');
        return;
      }
    }

    setIsPanning(false);
  }, [screenToCanvas]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setCursorPosition(null);
  }, [setCursorPosition]);

  // Handle context menu (right-click)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    // Middle click - just prevent default
    if (e.button === 1) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Hit test to see if clicking on an object
    const hitObject = hitTest(screenX, screenY);

    // If clicking on unselected object, select it first
    if (hitObject && !selectedIds.has(hitObject.id)) {
      setSelection([hitObject.id]);
    }

    // Show context menu at click position
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [hitTest, selectedIds, setSelection]);

  // Handle drag over for file drops
  const handleDragOver = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  }, []);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;
    const canvasPos = screenToCanvas(dropX, dropY);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => {
      const type = file.type.toLowerCase();
      return type === 'image/png' || type === 'image/jpeg' || type === 'image/gif' || type === 'image/webp';
    });
    const videoFiles = files.filter((file) => {
      const type = file.type.toLowerCase();
      return type === 'video/mp4' || type === 'video/webm';
    });

    const totalFiles = imageFiles.length + videoFiles.length;
    if (totalFiles === 0) return;

    let offsetX = 0;
    let offsetY = 0;
    const OFFSET_INCREMENT = 20;
    let processedCount = 0;
    let lastAddedId = '';

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) return;

        const img = new Image();
        img.onload = () => {
          let imgWidth = img.naturalWidth;
          let imgHeight = img.naturalHeight;

          const maxSize = MAX_IMPORTED_IMAGE_SIZE;
          if (imgWidth > maxSize || imgHeight > maxSize) {
            const scale = Math.min(maxSize / imgWidth, maxSize / imgHeight);
            imgWidth = Math.round(imgWidth * scale);
            imgHeight = Math.round(imgHeight * scale);
          }

          const imageX = canvasPos.x - imgWidth / 2 + offsetX;
          const imageY = canvasPos.y - imgHeight / 2 + offsetY;

          const newImage: ImageObject = {
            id: crypto.randomUUID(),
            type: 'image',
            x: imageX,
            y: imageY,
            width: imgWidth,
            height: imgHeight,
            rotation: 0,
            opacity: 1,
            zIndex: getNextZIndex(),
            src: dataUrl,
          };

          addObject(newImage);
          lastAddedId = newImage.id;
          processedCount++;

          if (processedCount === totalFiles) {
            setSelection([lastAddedId]);
          }
        };
        img.onerror = () => {
          useToastStore.getState().addToast({
            message: 'Failed to load image. Please try a different file.',
            type: 'error',
            duration: ERROR_TOAST_DURATION_MS
          });
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        useToastStore.getState().addToast({
          message: 'Failed to read file. Please try again.',
          type: 'error'
        });
      };
      reader.readAsDataURL(file);

      offsetX += OFFSET_INCREMENT;
      offsetY += OFFSET_INCREMENT;
    });

    videoFiles.forEach((file) => {
      const currentOffsetX = offsetX;
      const currentOffsetY = offsetY;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) return;

        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          let vidWidth = video.videoWidth;
          let vidHeight = video.videoHeight;

          const maxSize = MAX_IMPORTED_IMAGE_SIZE;
          if (vidWidth > maxSize || vidHeight > maxSize) {
            const scale = Math.min(maxSize / vidWidth, maxSize / vidHeight);
            vidWidth = Math.round(vidWidth * scale);
            vidHeight = Math.round(vidHeight * scale);
          }

          const videoX = canvasPos.x - vidWidth / 2 + currentOffsetX;
          const videoY = canvasPos.y - vidHeight / 2 + currentOffsetY;

          const newVideo: VideoObject = {
            id: crypto.randomUUID(),
            type: 'video',
            x: videoX,
            y: videoY,
            width: vidWidth,
            height: vidHeight,
            rotation: 0,
            opacity: 1,
            zIndex: getNextZIndex(),
            src: dataUrl,
          };

          addObject(newVideo);
          lastAddedId = newVideo.id;
          processedCount++;

          if (processedCount === totalFiles) {
            setSelection([lastAddedId]);
          }
        };
        video.onerror = () => {
          useToastStore.getState().addToast({
            message: 'Failed to load video. Format may not be supported.',
            type: 'error',
            duration: ERROR_TOAST_DURATION_MS
          });
        };
        video.src = dataUrl;
      };
      reader.onerror = () => {
        useToastStore.getState().addToast({
          message: 'Failed to read file. Please try again.',
          type: 'error'
        });
      };
      reader.readAsDataURL(file);

      offsetX += OFFSET_INCREMENT;
      offsetY += OFFSET_INCREMENT;
    });
  }, [screenToCanvas, addObject, getNextZIndex, setSelection]);

  // Get cursor style
  const getCursorStyle = () => {
    if (isPanning) return 'grabbing';
    if (isSpacePressed || activeTool === 'hand') return 'grab';
    return toolCursor;
  };

  // Text input handlers
  const handleTextInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingTextId) return;

    const currentObjects = useCanvasStore.getState().objects;
    const textObj = currentObjects.get(editingTextId) as TextObject | undefined;
    if (!textObj || textObj.type !== 'text') return;

    const newText = e.target.value;
    const dimensions = measureTextDimensions({
      text: newText,
      fontSize: textObj.fontSize,
      fontFamily: textObj.fontFamily,
      fontWeight: textObj.fontWeight,
      fontStyle: textObj.fontStyle,
      lineHeight: textObj.lineHeight,
    });

    updateObject(editingTextId, {
      text: newText,
      width: dimensions.width,
      height: dimensions.height,
    });
  }, [editingTextId, updateObject]);

  const exitTextEditMode = useCallback(() => {
    if (editingTextId) {
      const currentObjects = useCanvasStore.getState().objects;
      const textObj = currentObjects.get(editingTextId) as TextObject | undefined;
      if (textObj && textObj.type === 'text') {
        const dimensions = measureTextDimensions({
          text: textObj.text,
          fontSize: textObj.fontSize,
          fontFamily: textObj.fontFamily,
          fontWeight: textObj.fontWeight,
          fontStyle: textObj.fontStyle,
          lineHeight: textObj.lineHeight,
        });
        updateObject(editingTextId, {
          width: dimensions.width,
          height: dimensions.height,
        });
      }
    }
    setEditingTextId(null);
  }, [editingTextId, updateObject]);

  const handleTextKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      exitTextEditMode();
    }
    e.stopPropagation();
  }, [exitTextEditMode]);

  useEffect(() => {
    if (editingTextId) {
      let retryCount = 0;
      const maxRetries = 5;

      const focusInput = () => {
        if (textInputRef.current) {
          textInputRef.current.focus();
          textInputRef.current.select();
          if (document.activeElement !== textInputRef.current && retryCount < maxRetries) {
            retryCount++;
            requestAnimationFrame(focusInput);
          }
        }
      };

      setTimeout(focusInput, 50);
    }
  }, [editingTextId]);

  const getEditingTextStyle = useCallback((): React.CSSProperties | null => {
    if (!editingTextId) return null;
    const textObj = objects.get(editingTextId) as TextObject | undefined;
    if (!textObj || textObj.type !== 'text') return null;

    const screenPos = canvasToScreen(textObj.x, textObj.y);
    const fontSize = textObj.fontSize * viewport.zoom;

    return {
      position: 'absolute',
      left: screenPos.x,
      top: screenPos.y,
      transform: `rotate(${textObj.rotation}deg)`,
      transformOrigin: 'top left',
      fontSize: `${fontSize}px`,
      fontFamily: textObj.fontFamily,
      fontWeight: textObj.fontWeight || DEFAULT_FONT_WEIGHT,
      fontStyle: textObj.fontStyle || 'normal',
      textDecoration: textObj.textDecoration || 'none',
      color: textObj.fill || '#ffffff',
      minWidth: '20px',
    };
  }, [editingTextId, objects, canvasToScreen, viewport.zoom]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (justStartedEditingRef.current) return;

    if (editingTextId) {
      const isClickOnInput = textInputRef.current && textInputRef.current.contains(e.target as Node);
      if (!isClickOnInput) {
        exitTextEditMode();
      }
    }
  }, [editingTextId, exitTextEditMode]);

  const getEditingTextValue = (): string => {
    if (!editingTextId) return '';
    const textObj = objects.get(editingTextId);
    if (!textObj || textObj.type !== 'text') return '';
    return textObj.text;
  };

  // Frame name editing handlers
  const handleFrameNameInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingFrameId) return;
    updateObject(editingFrameId, { name: e.target.value });
  }, [editingFrameId, updateObject]);

  const exitFrameNameEditMode = useCallback(() => {
    setEditingFrameId(null);
  }, []);

  const handleFrameNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      exitFrameNameEditMode();
    }
    e.stopPropagation();
  }, [exitFrameNameEditMode]);

  useEffect(() => {
    if (editingFrameId && frameInputRef.current) {
      frameInputRef.current.focus();
      frameInputRef.current.select();
    }
  }, [editingFrameId]);

  const getEditingFrameNameStyle = useCallback((): React.CSSProperties | null => {
    if (!editingFrameId) return null;
    const frameObj = objects.get(editingFrameId);
    if (!frameObj || frameObj.type !== 'frame') return null;

    const screenPos = canvasToScreen(frameObj.x, frameObj.y);
    const fontSize = 12 * viewport.zoom;

    return {
      position: 'absolute',
      left: screenPos.x,
      top: screenPos.y - fontSize - 4 * viewport.zoom,
      transform: `rotate(${frameObj.rotation}deg)`,
      transformOrigin: 'top left',
      fontSize: `${fontSize}px`,
      fontFamily: 'sans-serif',
      color: '#888888',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      padding: 0,
      margin: 0,
      minWidth: '50px',
      caretColor: '#888888',
    };
  }, [editingFrameId, objects, canvasToScreen, viewport.zoom]);

  const getEditingFrameNameValue = (): string => {
    if (!editingFrameId) return '';
    const frameObj = objects.get(editingFrameId);
    if (!frameObj || frameObj.type !== 'frame') return '';
    return frameObj.name;
  };

  // Video playback
  const getPlayingVideoStyle = useCallback((): React.CSSProperties | null => {
    if (!playingVideoId) return null;
    const videoObj = objects.get(playingVideoId);
    if (!videoObj || videoObj.type !== 'video') return null;

    const screenPos = canvasToScreen(videoObj.x, videoObj.y);
    const width = videoObj.width * viewport.zoom;
    const height = videoObj.height * viewport.zoom;

    return {
      position: 'absolute',
      left: screenPos.x,
      top: screenPos.y,
      width: `${width}px`,
      height: `${height}px`,
      transform: `rotate(${videoObj.rotation}deg)`,
      transformOrigin: 'top left',
      objectFit: 'cover' as const,
      opacity: videoObj.opacity,
      pointerEvents: 'none' as const,
      borderRadius: '0',
      zIndex: 100,
    };
  }, [playingVideoId, objects, canvasToScreen, viewport.zoom]);

  const getPlayingVideoSrc = (): string => {
    if (!playingVideoId) return '';
    const videoObj = objects.get(playingVideoId);
    if (!videoObj || videoObj.type !== 'video') return '';
    return videoObj.src;
  };

  const stopVideoPlayback = useCallback(() => {
    setPlayingVideoId(null);
  }, []);

  return (
    <main className="canvas-container" ref={containerRef} onClick={handleCanvasClick}>
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
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />
      {isDragOver && (
        <div className="drop-indicator">
          <div className="drop-indicator-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span>Drop media here</span>
          </div>
        </div>
      )}
      {playingVideoId && (
        <video
          key={playingVideoId}
          className="video-player"
          style={getPlayingVideoStyle() || undefined}
          src={getPlayingVideoSrc()}
          autoPlay
          muted
          playsInline
          onEnded={stopVideoPlayback}
        />
      )}
      {editingTextId && (
        <input
          ref={textInputRef}
          type="text"
          className="text-edit-input"
          style={getEditingTextStyle() || { position: 'absolute', left: 100, top: 100, color: '#ffffff' }}
          value={getEditingTextValue()}
          onChange={handleTextInput}
          onKeyDown={handleTextKeyDown}
          onBlur={() => {
            if (justStartedEditingRef.current) return;
            setTimeout(() => {
              if (justStartedEditingRef.current) return;
              if (document.activeElement !== textInputRef.current) {
                exitTextEditMode();
              }
            }, 100);
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          autoFocus
          placeholder="Type here..."
        />
      )}
      {editingFrameId && (
        <input
          ref={frameInputRef}
          type="text"
          className="frame-name-input"
          style={getEditingFrameNameStyle() || undefined}
          value={getEditingFrameNameValue()}
          onChange={handleFrameNameInput}
          onKeyDown={handleFrameNameKeyDown}
          onBlur={exitFrameNameEditMode}
        />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          targetObjectId={null}
        />
      )}
      <CursorPresence />
      <Minimap />
    </main>
  );
}
