import { useRef, useEffect, useState, useCallback } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useToastStore } from '../../stores/toastStore';
import type { CanvasObject, RectangleObject, EllipseObject, TextObject, FrameObject, PathObject, PathPoint, ImageObject, VideoObject, GroupObject, LineObject, ArrowObject } from '../../types/canvas';
import { CursorPresence } from './CursorPresence';
import { Minimap } from './Minimap';
import { measureTextDimensions } from '../../utils/textMeasurement';
import './Canvas.css';

// Image cache for loaded images
const imageCache = new Map<string, HTMLImageElement>();

// Video cache for loaded video thumbnails
const videoThumbnailCache = new Map<string, HTMLCanvasElement>();
const videoElementCache = new Map<string, HTMLVideoElement>();

const MIN_ZOOM = 0.1; // 10%
const MAX_ZOOM = 5.0; // 500%
const ZOOM_SENSITIVITY = 0.001;
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
  const textInputRef = useRef<HTMLInputElement>(null);
  const lastClickTime = useRef<number>(0);
  const lastClickObjectId = useRef<string | null>(null);
  const justStartedEditingRef = useRef(false); // Guard flag to prevent blur during initial render

  // Store state
  const objects = useCanvasStore((state) => state.objects);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const viewport = useCanvasStore((state) => state.viewport);
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
  const editingGroupId = useCanvasStore((state) => state.editingGroupId);
  const enterGroupEditMode = useCanvasStore((state) => state.enterGroupEditMode);
  const exitGroupEditMode = useCanvasStore((state) => state.exitGroupEditMode);
  const getAbsolutePosition = useCanvasStore((state) => state.getAbsolutePosition);

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
  const [isDrawingFrame, setIsDrawingFrame] = useState(false);
  const [isDrawingPath, setIsDrawingPath] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [imageLoadTrigger, setImageLoadTrigger] = useState(0); // Trigger redraw when images load
  const [isDragOver, setIsDragOver] = useState(false); // Track when files are being dragged over canvas
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null); // Track currently playing video
  const lastMousePos = useRef({ x: 0, y: 0 });
  const dragStartCanvasPos = useRef({ x: 0, y: 0 });
  const marqueeStart = useRef({ x: 0, y: 0 });
  const marqueeEnd = useRef({ x: 0, y: 0 });
  const marqueeShiftKey = useRef(false);
  const resizeHandle = useRef<HandleType>(null);
  const resizeStartObjState = useRef<{ x: number; y: number; width: number; height: number; fontSize?: number } | null>(null);
  const resizeShiftKey = useRef(false);
  const rotationStartAngle = useRef(0);
  const rotationObjStartRotation = useRef(0);
  const rectDrawStart = useRef({ x: 0, y: 0 });
  const rectDrawEnd = useRef({ x: 0, y: 0 });
  const rectDrawShiftKey = useRef(false);
  const rectDrawAltKey = useRef(false); // Alt key for ellipse mode
  const frameDrawStart = useRef({ x: 0, y: 0 });
  const frameDrawEnd = useRef({ x: 0, y: 0 });
  const frameInputRef = useRef<HTMLInputElement>(null);
  const pathDrawPoints = useRef<PathPoint[]>([]);
  // Line/Arrow drawing state
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const lineDrawStart = useRef({ x: 0, y: 0 });
  const lineDrawEnd = useRef({ x: 0, y: 0 });
  const lineDrawShiftKey = useRef(false);

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
            // Draw rounded rectangle
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
            // Draw regular rectangle
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
          const fontWeight = textObj.fontWeight || 400;
          const fontSize = textObj.fontSize * zoom;
          ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${textObj.fontFamily}`;
          ctx.textAlign = textObj.textAlign || 'left';
          ctx.textBaseline = 'top';
          const textX = textObj.textAlign === 'center' ? width / 2 : textObj.textAlign === 'right' ? width : 0;

          // Handle multi-line text
          const lines = textObj.text.split('\n');
          const lineHeightPx = fontSize * (textObj.lineHeight || 1.2);

          lines.forEach((line, index) => {
            const y = index * lineHeightPx;
            ctx.fillText(line, textX, y);

            // Draw text decoration (underline or line-through)
            if (textObj.textDecoration && textObj.textDecoration !== 'none') {
              const metrics = ctx.measureText(line);
              const lineWidth = metrics.width;
              let decorationX = textX;

              // Adjust starting X based on text alignment
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
        case 'image': {
          const imgObj = obj as ImageObject;
          // Check if image is in cache
          const cachedImg = imageCache.get(imgObj.src);
          if (!cachedImg) {
            // Load the image if not already loading
            if (!imageCache.has(imgObj.src)) {
              const newImg = new Image();
              newImg.crossOrigin = 'anonymous';
              // Set a placeholder to indicate loading has started
              imageCache.set(imgObj.src, newImg);
              newImg.onload = () => {
                // Image is already in cache from above, just trigger redraw
                setImageLoadTrigger((prev) => prev + 1);
              };
              newImg.src = imgObj.src;
            }
            // Show placeholder while loading
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = '#4a4a4a';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, width, height);
            // Draw loading indicator
            ctx.fillStyle = '#666666';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Loading...', width / 2, height / 2);
          } else if (cachedImg.complete && cachedImg.naturalWidth > 0) {
            // Draw the cached image only if fully loaded
            ctx.drawImage(cachedImg, 0, 0, width, height);
          } else {
            // Image is still loading, show placeholder
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
            // Create video element and generate thumbnail
            if (!videoElementCache.has(vidObj.src)) {
              const video = document.createElement('video');
              video.crossOrigin = 'anonymous';
              video.muted = true;
              video.preload = 'metadata';
              videoElementCache.set(vidObj.src, video);

              video.onloadeddata = () => {
                // Seek to first frame for thumbnail
                video.currentTime = 0;
              };

              video.onseeked = () => {
                // Create thumbnail canvas from video frame
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

            // Show placeholder while loading
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, width, height);
            // Draw loading text
            ctx.fillStyle = '#666666';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Loading video...', width / 2, height / 2);
          } else {
            // Draw the thumbnail
            ctx.drawImage(thumbnailCanvas, 0, 0, width, height);

            // Draw semi-transparent overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, 0, width, height);
          }

          // Draw play button overlay
          const buttonSize = Math.min(60, Math.min(width, height) * 0.3);
          const centerX = width / 2;
          const centerY = height / 2;

          // Play button circle background
          ctx.beginPath();
          ctx.arc(centerX, centerY, buttonSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Play triangle
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
          // Groups are rendered as dashed bounding boxes when selected or in edit mode
          // The children are rendered separately
          // Draw a subtle indicator for the group bounds
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

          // Draw the line
          ctx.beginPath();
          ctx.moveTo(arrowObj.x1 * zoom, arrowObj.y1 * zoom);
          ctx.lineTo(arrowObj.x2 * zoom, arrowObj.y2 * zoom);
          ctx.strokeStyle = obj.stroke || '#ffffff';
          ctx.lineWidth = strokeW;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Calculate arrow direction
          const dx = arrowObj.x2 - arrowObj.x1;
          const dy = arrowObj.y2 - arrowObj.y1;
          const angle = Math.atan2(dy, dx);

          // Draw arrowhead at end
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

          // Draw arrowhead at start
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

      // Debug log for text objects
      if (obj.type === 'text') {
        console.log('[drawSelectionBox] Text object dimensions:', { id: obj.id, objWidth: obj.width, objHeight: obj.height, zoom, screenWidth: width, screenHeight: height });
      }

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

  // Draw frame preview while drawing
  const drawFramePreview = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!isDrawingFrame) return;

      const start = frameDrawStart.current;
      const end = frameDrawEnd.current;

      // Calculate dimensions
      const width = end.x - start.x;
      const height = end.y - start.y;

      // Convert to screen coordinates
      const x = width >= 0 ? start.x : start.x + width;
      const y = height >= 0 ? start.y : start.y + height;
      const frameWidth = Math.abs(width);
      const frameHeight = Math.abs(height);

      const screenPos = canvasToScreen(x, y);
      const screenWidth = frameWidth * viewport.zoom;
      const screenHeight = frameHeight * viewport.zoom;

      ctx.save();

      // Draw frame with background
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(screenPos.x, screenPos.y, screenWidth, screenHeight);

      // Draw frame border
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(screenPos.x, screenPos.y, screenWidth, screenHeight);

      // Draw frame label placeholder
      ctx.fillStyle = '#888888';
      ctx.font = `${12 * viewport.zoom}px sans-serif`;
      ctx.textBaseline = 'bottom';
      ctx.fillText('Frame', screenPos.x, screenPos.y - 4 * viewport.zoom);

      // Draw a selection border to show the drawing area
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(screenPos.x, screenPos.y, screenWidth, screenHeight);

      ctx.restore();
    },
    [isDrawingFrame, canvasToScreen, viewport.zoom]
  );

  // Draw path preview while drawing
  const drawPathPreview = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!isDrawingPath || pathDrawPoints.current.length === 0) return;

      const points = pathDrawPoints.current;

      ctx.save();

      ctx.beginPath();
      const firstScreenPos = canvasToScreen(points[0].x, points[0].y);
      ctx.moveTo(firstScreenPos.x, firstScreenPos.y);

      for (let i = 1; i < points.length; i++) {
        const screenPos = canvasToScreen(points[i].x, points[i].y);
        ctx.lineTo(screenPos.x, screenPos.y);
      }

      ctx.strokeStyle = '#ffffff'; // Default white stroke
      ctx.lineWidth = 2 * viewport.zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.restore();
    },
    [isDrawingPath, canvasToScreen, viewport.zoom]
  );

  // Draw line/arrow preview while drawing
  const drawLinePreview = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!isDrawingLine) return;

      const start = lineDrawStart.current;
      const end = lineDrawEnd.current;

      const startScreen = canvasToScreen(start.x, start.y);
      const endScreen = canvasToScreen(end.x, end.y);

      ctx.save();

      // Draw line
      ctx.beginPath();
      ctx.moveTo(startScreen.x, startScreen.y);
      ctx.lineTo(endScreen.x, endScreen.y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * viewport.zoom;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Draw arrowhead for arrow tool
      if (activeTool === 'arrow') {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const arrowSize = 10 * viewport.zoom;

        ctx.save();
        ctx.translate(endScreen.x, endScreen.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-arrowSize, -arrowSize / 2);
        ctx.lineTo(-arrowSize, arrowSize / 2);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    },
    [isDrawingLine, activeTool, canvasToScreen, viewport.zoom]
  );

  // Draw the canvas content
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();

    // Clear canvas with sleek dark gradient - TE inspired
    const gradient = ctx.createRadialGradient(
      rect.width / 2, 0, 0,
      rect.width / 2, rect.height, rect.height
    );
    gradient.addColorStop(0, '#141414');
    gradient.addColorStop(0.5, '#0a0a0a');
    gradient.addColorStop(1, '#050505');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw objects sorted by zIndex (lowest first so higher zIndex renders on top)
    // Skip objects that are hidden (visible === false) or are children of groups (they're rendered with their parent)
    const sortedObjects = Array.from(objects.values())
      .filter((obj) => obj.visible !== false && !obj.parentId)
      .sort((a, b) => a.zIndex - b.zIndex);
    sortedObjects.forEach((obj) => {
      drawObject(ctx, obj);
      // If this is a group, render its children with absolute positions
      if (obj.type === 'group') {
        const group = obj as GroupObject;
        const groupPos = getAbsolutePosition(group);
        group.children.forEach((childId) => {
          const child = objects.get(childId);
          if (child && child.visible !== false) {
            // Create a temporary object with absolute position for rendering
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

    // Draw frame preview while drawing
    drawFramePreview(ctx);

    // Draw path preview while drawing
    drawPathPreview(ctx);

    // Draw line/arrow preview while drawing
    drawLinePreview(ctx);
  }, [viewport, objects, selectedIds, drawObject, drawSelectionBox, drawMarqueeRect, drawRectPreview, drawFramePreview, drawPathPreview, drawLinePreview, imageLoadTrigger]);

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

  // Window-level event listeners for drag operations
  // This ensures dragging continues smoothly even when mouse leaves the canvas
  useEffect(() => {
    if (!isDragging && !isPanning && !isResizing && !isRotating) return;

    let animationFrameId: number | null = null;
    let pendingMouseEvent: MouseEvent | null = null;

    const processMouseMove = () => {
      const e = pendingMouseEvent;
      if (!e) return;
      pendingMouseEvent = null;
      animationFrameId = null;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      // Handle dragging objects
      if (isDragging && selectedIds.size > 0) {
        const dx = (e.clientX - lastMousePos.current.x) / viewport.zoom;
        const dy = (e.clientY - lastMousePos.current.y) / viewport.zoom;

        // Only update if there's actual movement
        if (dx !== 0 || dy !== 0) {
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
        }
      }

      // Handle panning
      if (isPanning) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;

        if (dx !== 0 || dy !== 0) {
          setViewport({
            x: viewport.x + dx / viewport.zoom,
            y: viewport.y + dy / viewport.zoom,
          });
        }
      }

      // Update the last mouse position
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      // Update cursor position if mouse is over canvas
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const canvasCursorPos = {
          x: screenX / viewport.zoom - viewport.x,
          y: screenY / viewport.zoom - viewport.y,
        };
        setCursorPosition(canvasCursorPos);
      }
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      // Store the latest mouse event and schedule processing via requestAnimationFrame
      // This throttles updates to 60fps for smooth performance with many objects
      pendingMouseEvent = e;
      if (animationFrameId === null) {
        animationFrameId = requestAnimationFrame(processMouseMove);
      }
    };

    const handleWindowMouseUp = () => {
      // Cancel any pending animation frame
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      // Process any final pending mouse movement
      if (pendingMouseEvent) {
        processMouseMove();
      }

      setIsDragging(false);
      setIsPanning(false);
      setIsResizing(false);
      setIsRotating(false);
      setActiveResizeHandle(null);
      resizeHandle.current = null;
      resizeStartObjState.current = null;
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDragging, isPanning, isResizing, isRotating, selectedIds, objects, viewport, updateObjects, setViewport, setCursorPosition]);

  // Helper function to check if a point is inside an object's bounds
  const isPointInObject = useCallback(
    (canvasPos: { x: number; y: number }, obj: CanvasObject, objAbsX?: number, objAbsY?: number): boolean => {
      const objX = objAbsX ?? obj.x;
      const objY = objAbsY ?? obj.y;

      const cos = Math.cos((-obj.rotation * Math.PI) / 180);
      const sin = Math.sin((-obj.rotation * Math.PI) / 180);

      // Translate point relative to object center
      const centerX = objX + obj.width / 2;
      const centerY = objY + obj.height / 2;
      const dx = canvasPos.x - centerX;
      const dy = canvasPos.y - centerY;

      // Rotate point back
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

      // Get all top-level objects (not children of groups) sorted by zIndex descending
      const topLevelObjects = Array.from(objects.values())
        .filter((obj) => obj.visible !== false && !obj.parentId)
        .sort((a, b) => b.zIndex - a.zIndex);

      // If we're in group edit mode, also check the children of the editing group
      if (editingGroupId) {
        const editingGroup = objects.get(editingGroupId) as GroupObject | undefined;
        if (editingGroup) {
          const groupPos = getAbsolutePosition(editingGroup);
          // Check children of the editing group first (they should be on top)
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
        // If this is a group, check its children first (for visual accuracy)
        if (obj.type === 'group') {
          const group = obj as GroupObject;
          const groupPos = getAbsolutePosition(group);

          // If not in edit mode for this group, just check if click is in group bounds
          if (editingGroupId !== group.id) {
            // Check if we hit any visible child
            for (const childId of group.children) {
              const child = objects.get(childId);
              if (child && child.visible !== false) {
                const absX = groupPos.x + child.x;
                const absY = groupPos.y + child.y;
                if (isPointInObject(canvasPos, child, absX, absY)) {
                  // Return the group, not the child (unless in edit mode)
                  return group;
                }
              }
            }
          }
          // Also check group bounds itself
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

  // Handle mouse wheel zoom (zoom toward cursor position)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom delta (handle both wheel and trackpad pinch-to-zoom)
    // Trackpad pinch-to-zoom sends ctrlKey=true with deltaY
    const delta = e.ctrlKey ? -e.deltaY * 0.01 : -e.deltaY * ZOOM_SENSITIVITY;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * (1 + delta)));

    // If zoom didn't change, don't update
    if (newZoom === viewport.zoom) return;

    // Calculate new pan to keep cursor position fixed in canvas space
    // Formula: canvas_pos = screen_pos / zoom - pan
    // We want: canvas_pos_before = canvas_pos_after
    // So: screen / old_zoom - old_pan = screen / new_zoom - new_pan
    // Therefore: new_pan = screen / new_zoom - screen / old_zoom + old_pan
    const newPanX = viewport.x + mouseX * (1 / newZoom - 1 / viewport.zoom);
    const newPanY = viewport.y + mouseY * (1 / newZoom - 1 / viewport.zoom);

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

    // Middle mouse button (1) or left button with space pressed or hand tool - panning
    if (e.button === 1 || (e.button === 0 && isSpacePressed) || (e.button === 0 && activeTool === 'hand')) {
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
        // Don't allow resize/rotate for locked objects
        if (selectedObj && !selectedObj.locked) {
          // Check rotation handle first
          const rotationHandle = hitTestRotationHandle(screenX, screenY, selectedObj);
          if (rotationHandle) {
            // Save state before rotation for undo
            pushHistory();
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
            // Save state before resize for undo
            pushHistory();
            // Start resizing
            setIsResizing(true);
            setActiveResizeHandle(handle);
            resizeHandle.current = handle;
            resizeStartObjState.current = {
              x: selectedObj.x,
              y: selectedObj.y,
              width: selectedObj.width,
              height: selectedObj.height,
              fontSize: selectedObj.type === 'text' ? (selectedObj as TextObject).fontSize : undefined,
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
        const now = Date.now();
        const isDoubleClick =
          lastClickObjectId.current === hitObject.id &&
          now - lastClickTime.current < 300; // 300ms double-click threshold

        // Update click tracking
        lastClickTime.current = now;
        lastClickObjectId.current = hitObject.id;

        // Handle double-click on text objects to enter edit mode
        if (isDoubleClick && hitObject.type === 'text') {
          const textObj = hitObject as TextObject;
          // Recalculate and update dimensions to match actual text content
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
          justStartedEditingRef.current = true; // Set guard flag before entering edit mode
          setEditingTextId(hitObject.id);
          setTimeout(() => { justStartedEditingRef.current = false; }, 500); // Clear guard after 500ms
          return; // Don't start dragging
        }

        // Handle double-click on frame objects to edit name
        if (isDoubleClick && hitObject.type === 'frame') {
          setSelection([hitObject.id]);
          setEditingFrameId(hitObject.id);
          return; // Don't start dragging
        }

        // Handle double-click on group objects to enter group edit mode
        if (isDoubleClick && hitObject.type === 'group') {
          setSelection([hitObject.id]);
          enterGroupEditMode(hitObject.id);
          return; // Don't start dragging
        }

        // Handle double-click on video objects to toggle play/pause
        if (isDoubleClick && hitObject.type === 'video') {
          setSelection([hitObject.id]);
          // Toggle video playback
          if (playingVideoId === hitObject.id) {
            setPlayingVideoId(null);
          } else {
            setPlayingVideoId(hitObject.id);
          }
          return; // Don't start dragging
        }

        // Check if object is locked - don't allow dragging locked objects
        if (hitObject.locked) {
          // Still allow selection, but don't start dragging
          if (!e.shiftKey) {
            setSelection([hitObject.id]);
          } else {
            // Shift+click - toggle selection
            if (selectedIds.has(hitObject.id)) {
              const newSelection = Array.from(selectedIds).filter((id) => id !== hitObject.id);
              setSelection(newSelection);
            } else {
              setSelection([...Array.from(selectedIds), hitObject.id]);
            }
          }
          return; // Don't start dragging locked objects
        }

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
          // Normal click - save state before drag for undo
          pushHistory();

          // Check if clicking on already selected object
          if (selectedIds.has(hitObject.id)) {
            // Start dragging the selection (if not locked)
            const allUnlocked = Array.from(selectedIds).every((id) => {
              const obj = objects.get(id);
              return obj && !obj.locked;
            });
            if (allUnlocked) {
              setIsDragging(true);
              dragStartCanvasPos.current = { x: canvasPos.x, y: canvasPos.y };
              lastMousePos.current = { x: e.clientX, y: e.clientY };
            }
          } else {
            // Select only this object and start dragging
            setSelection([hitObject.id]);
            setIsDragging(true);
            dragStartCanvasPos.current = { x: canvasPos.x, y: canvasPos.y };
            lastMousePos.current = { x: e.clientX, y: e.clientY };
          }
        }
      } else {
        // Click on empty canvas - exit group edit mode if active
        if (editingGroupId) {
          exitGroupEditMode();
        }
        // Start marquee selection
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

    // Left click with text tool - create text object
    if (e.button === 0 && activeTool === 'text') {
      const canvasPos = screenToCanvas(screenX, screenY);

      // Measure initial dimensions for empty text
      const initialDimensions = measureTextDimensions({
        text: '',
        fontSize: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: 1.2,
      });

      console.log('[createText] Initial dimensions:', initialDimensions);

      // Create a new text object at the click position
      const newText: TextObject = {
        id: crypto.randomUUID(),
        type: 'text',
        x: canvasPos.x,
        y: canvasPos.y,
        width: initialDimensions.width,
        height: initialDimensions.height,
        rotation: 0,
        opacity: 1,
        zIndex: getNextZIndex(),
        fill: '#ffffff', // White text
        text: '',
        fontSize: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 400,
        fontStyle: 'normal',
        textDecoration: 'none',
        textAlign: 'left',
        lineHeight: 1.2,
      };

      console.log('[createText] Adding text object with dimensions:', { width: newText.width, height: newText.height, id: newText.id });
      addObject(newText);

      // Verify the object was added with correct dimensions
      setTimeout(() => {
        const addedObj = useCanvasStore.getState().objects.get(newText.id);
        console.log('[createText] Verified stored dimensions:', { width: addedObj?.width, height: addedObj?.height });
      }, 100);

      setSelection([newText.id]);
      justStartedEditingRef.current = true; // Set guard flag before entering edit mode
      setEditingTextId(newText.id); // Enter edit mode immediately
      setTimeout(() => { justStartedEditingRef.current = false; }, 500); // Clear guard after 500ms
      setActiveTool('select'); // Switch to select tool
    }

    // Left click with frame tool - start drawing frame
    if (e.button === 0 && activeTool === 'frame') {
      const canvasPos = screenToCanvas(screenX, screenY);
      frameDrawStart.current = { x: canvasPos.x, y: canvasPos.y };
      frameDrawEnd.current = { x: canvasPos.x, y: canvasPos.y };
      setIsDrawingFrame(true);
      setSelection([]); // Clear selection when drawing
    }

    // Left click with pen tool - start drawing path
    if (e.button === 0 && activeTool === 'pen') {
      const canvasPos = screenToCanvas(screenX, screenY);
      pathDrawPoints.current = [{ x: canvasPos.x, y: canvasPos.y }];
      setIsDrawingPath(true);
      setSelection([]); // Clear selection when drawing
    }

    // Left click with ellipse tool - draw ellipse
    if (e.button === 0 && activeTool === 'ellipse') {
      const canvasPos = screenToCanvas(screenX, screenY);
      rectDrawStart.current = { x: canvasPos.x, y: canvasPos.y };
      rectDrawEnd.current = { x: canvasPos.x, y: canvasPos.y };
      rectDrawShiftKey.current = e.shiftKey;
      rectDrawAltKey.current = true; // Force ellipse mode
      setIsDrawingRect(true);
      setSelection([]); // Clear selection when drawing
    }

    // Left click with line tool - draw line
    if (e.button === 0 && activeTool === 'line') {
      const canvasPos = screenToCanvas(screenX, screenY);
      lineDrawStart.current = { x: canvasPos.x, y: canvasPos.y };
      lineDrawEnd.current = { x: canvasPos.x, y: canvasPos.y };
      lineDrawShiftKey.current = e.shiftKey;
      setIsDrawingLine(true);
      setSelection([]); // Clear selection when drawing
    }

    // Left click with arrow tool - draw arrow
    if (e.button === 0 && activeTool === 'arrow') {
      const canvasPos = screenToCanvas(screenX, screenY);
      lineDrawStart.current = { x: canvasPos.x, y: canvasPos.y };
      lineDrawEnd.current = { x: canvasPos.x, y: canvasPos.y };
      lineDrawShiftKey.current = e.shiftKey;
      setIsDrawingLine(true);
      setSelection([]); // Clear selection when drawing
    }
  }, [isSpacePressed, activeTool, hitTest, hitTestHandle, hitTestRotationHandle, selectedIds, setSelection, screenToCanvas, canvasToScreen, objects, addObject, setActiveTool, getNextZIndex, playingVideoId, pushHistory, enterGroupEditMode, exitGroupEditMode, editingGroupId]);

  // Handle mouse move for panning, dragging, and hover detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Update cursor position in canvas coordinates for status bar
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

      // For text objects, scale fontSize proportionally
      const selectedObj = objects.get(selectedId);
      if (selectedObj && selectedObj.type === 'text' && startState.fontSize) {
        const textObj = selectedObj as TextObject;
        const scaleRatio = newWidth / startState.width;
        const newFontSize = Math.max(1, Math.round(startState.fontSize * scaleRatio));

        // Use measureTextDimensions to get proper dimensions for the new font size
        const dimensions = measureTextDimensions({
          text: textObj.text,
          fontSize: newFontSize,
          fontFamily: textObj.fontFamily,
          fontWeight: textObj.fontWeight || 400,
          fontStyle: textObj.fontStyle || 'normal',
          lineHeight: textObj.lineHeight || 1.2,
        });

        updateObjects([{
          id: selectedId,
          changes: {
            x: newX,
            y: newY,
            width: dimensions.width,
            height: dimensions.height,
            fontSize: newFontSize,
          },
        }]);
      } else {
        updateObjects([{
          id: selectedId,
          changes: { x: newX, y: newY, width: newWidth, height: newHeight },
        }]);
      }

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
      // Only update altKey for rectangle tool (ellipse tool forces it to true)
      if (activeTool === 'rectangle') {
        rectDrawAltKey.current = e.altKey;
      }
      // Force redraw to show rectangle/ellipse preview
      draw();
      return;
    }

    // Handle frame drawing
    if (isDrawingFrame) {
      const canvasPos = screenToCanvas(screenX, screenY);
      frameDrawEnd.current = { x: canvasPos.x, y: canvasPos.y };
      // Force redraw to show frame preview
      draw();
      return;
    }

    // Handle path drawing
    if (isDrawingPath) {
      const canvasPos = screenToCanvas(screenX, screenY);
      pathDrawPoints.current.push({ x: canvasPos.x, y: canvasPos.y });
      // Force redraw to show path preview
      draw();
      return;
    }

    // Handle line/arrow drawing
    if (isDrawingLine) {
      const canvasPos = screenToCanvas(screenX, screenY);
      let endX = canvasPos.x;
      let endY = canvasPos.y;

      // Shift key constrains to 45° angles
      if (lineDrawShiftKey.current || e.shiftKey) {
        const dx = endX - lineDrawStart.current.x;
        const dy = endY - lineDrawStart.current.y;
        const angle = Math.atan2(dy, dx);
        const length = Math.sqrt(dx * dx + dy * dy);
        // Snap to 45° increments
        const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        endX = lineDrawStart.current.x + length * Math.cos(snappedAngle);
        endY = lineDrawStart.current.y + length * Math.sin(snappedAngle);
      }

      lineDrawEnd.current = { x: endX, y: endY };
      lineDrawShiftKey.current = e.shiftKey;
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
  }, [isPanning, isDragging, isResizing, isRotating, isMarqueeSelecting, isDrawingRect, isDrawingFrame, isDrawingPath, isDrawingLine, viewport, setViewport, selectedIds, objects, updateObjects, activeTool, isSpacePressed, hitTest, hitTestHandle, hitTestRotationHandle, screenToCanvas, canvasToScreen, draw, setCursorPosition]);

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
            zIndex: getNextZIndex(),
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
            zIndex: getNextZIndex(),
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

    // Finalize frame drawing
    if (isDrawingFrame) {
      const start = frameDrawStart.current;
      const end = frameDrawEnd.current;

      // Calculate dimensions
      const width = end.x - start.x;
      const height = end.y - start.y;

      // Normalize to positive width/height
      const x = width >= 0 ? start.x : start.x + width;
      const y = height >= 0 ? start.y : start.y + height;
      const frameWidth = Math.abs(width);
      const frameHeight = Math.abs(height);

      // Only create frame if it has meaningful size
      if (frameWidth >= MIN_OBJECT_SIZE && frameHeight >= MIN_OBJECT_SIZE) {
        // Create frame object
        const newFrame: FrameObject = {
          id: crypto.randomUUID(),
          type: 'frame',
          x,
          y,
          width: frameWidth,
          height: frameHeight,
          rotation: 0,
          opacity: 1,
          zIndex: getNextZIndex(),
          fill: '#2a2a2a',
          stroke: '#3a3a3a',
          strokeWidth: 1,
          name: 'Frame',
        };

        addObject(newFrame);
        setSelection([newFrame.id]);
        setEditingFrameId(newFrame.id); // Enter name edit mode immediately
      }

      // Switch to select tool after drawing
      setActiveTool('select');
      setIsDrawingFrame(false);
    }

    // Finalize path drawing
    if (isDrawingPath) {
      const points = pathDrawPoints.current;

      // Only create path if it has at least 2 points
      if (points.length >= 2) {
        // Calculate bounding box
        let minX = points[0].x;
        let minY = points[0].y;
        let maxX = points[0].x;
        let maxY = points[0].y;

        for (const point of points) {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        }

        // Normalize points relative to the bounding box
        const normalizedPoints: PathPoint[] = points.map((p) => ({
          x: p.x - minX,
          y: p.y - minY,
        }));

        // Create path object
        const newPath: PathObject = {
          id: crypto.randomUUID(),
          type: 'path',
          x: minX,
          y: minY,
          width: Math.max(maxX - minX, 1), // Ensure minimum width of 1
          height: Math.max(maxY - minY, 1), // Ensure minimum height of 1
          rotation: 0,
          opacity: 1,
          zIndex: getNextZIndex(),
          stroke: '#ffffff', // Default white stroke
          strokeWidth: 2,
          points: normalizedPoints,
        };

        addObject(newPath);
        setSelection([newPath.id]);
      }

      // Switch to select tool after drawing
      setActiveTool('select');
      setIsDrawingPath(false);
      pathDrawPoints.current = [];
    }

    // Finalize line/arrow drawing
    if (isDrawingLine) {
      const start = lineDrawStart.current;
      const end = lineDrawEnd.current;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      // Only create line if it has meaningful length
      if (length >= MIN_OBJECT_SIZE) {
        // Normalize coordinates
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.max(Math.abs(dx), 1);
        const height = Math.max(Math.abs(dy), 1);

        // Calculate relative positions
        const x1 = start.x - x;
        const y1 = start.y - y;
        const x2 = end.x - x;
        const y2 = end.y - y;

        if (activeTool === 'arrow') {
          // Create arrow object
          const newArrow: ArrowObject = {
            id: crypto.randomUUID(),
            type: 'arrow',
            x,
            y,
            width,
            height,
            rotation: 0,
            opacity: 1,
            zIndex: getNextZIndex(),
            stroke: '#ffffff',
            strokeWidth: 2,
            x1,
            y1,
            x2,
            y2,
            arrowStart: false,
            arrowEnd: true,
            arrowSize: 1,
          };
          addObject(newArrow);
          setSelection([newArrow.id]);
        } else {
          // Create line object
          const newLine: LineObject = {
            id: crypto.randomUUID(),
            type: 'line',
            x,
            y,
            width,
            height,
            rotation: 0,
            opacity: 1,
            zIndex: getNextZIndex(),
            stroke: '#ffffff',
            strokeWidth: 2,
            x1,
            y1,
            x2,
            y2,
          };
          addObject(newLine);
          setSelection([newLine.id]);
        }
      }

      // Switch to select tool after drawing
      setActiveTool('select');
      setIsDrawingLine(false);
    }

    setIsPanning(false);
    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);
    setActiveResizeHandle(null);
    resizeHandle.current = null;
    resizeStartObjState.current = null;
  }, [isMarqueeSelecting, isDrawingRect, isDrawingFrame, isDrawingPath, isDrawingLine, activeTool, getObjectsInMarquee, selectedIds, setSelection, addObject, setActiveTool, getNextZIndex]);

  // Handle mouse leave - only reset UI states, not drag states
  // Drag states (isDragging, isPanning, isResizing, isRotating) are handled by window-level listeners
  // so dragging continues smoothly even when mouse leaves the canvas
  const handleMouseLeave = useCallback(() => {
    // Only reset drawing and UI states - NOT drag states!
    // isDragging, isPanning, isResizing, isRotating are handled by window listeners
    setIsMarqueeSelecting(false);
    setIsDrawingRect(false);
    setIsDrawingFrame(false);
    setIsDrawingPath(false);
    setIsDrawingLine(false);
    setHoveredObjectId(null);
    setHoveredHandle(null);
    setHoveredRotationHandle(null);
    pathDrawPoints.current = [];
    // Clear cursor position when mouse leaves canvas
    setCursorPosition(null);
  }, [setCursorPosition]);

  // Prevent context menu on middle click
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
    }
  }, []);

  // Handle drag over event for file drops
  const handleDragOver = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if the dragged items include files
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  // Handle drag enter event
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  // Handle drag leave event
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the canvas (not entering a child element)
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  }, []);

  // Handle file drop event
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

    // Get dropped files
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

    // Process each file
    let offsetX = 0;
    let offsetY = 0;
    const OFFSET_INCREMENT = 20; // Offset each subsequent file slightly
    let processedCount = 0;
    let lastAddedId = '';

    // Process image files
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) return;

        // Load image to get dimensions
        const img = new Image();
        img.onload = () => {
          let imgWidth = img.naturalWidth;
          let imgHeight = img.naturalHeight;

          // Scale down large images to max 800px
          const maxSize = 800;
          if (imgWidth > maxSize || imgHeight > maxSize) {
            const scale = Math.min(maxSize / imgWidth, maxSize / imgHeight);
            imgWidth = Math.round(imgWidth * scale);
            imgHeight = Math.round(imgHeight * scale);
          }

          // Calculate position with offset for multiple files
          const imageX = canvasPos.x - imgWidth / 2 + offsetX;
          const imageY = canvasPos.y - imgHeight / 2 + offsetY;

          // Create image object
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

          // Select the last file (when all are loaded)
          if (processedCount === totalFiles) {
            setSelection([lastAddedId]);
          }
        };
        img.onerror = () => {
          useToastStore.getState().addToast({
            message: 'Failed to load image. Please try a different file.',
            type: 'error',
            duration: 5000
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

      // Increment offset for next file
      offsetX += OFFSET_INCREMENT;
      offsetY += OFFSET_INCREMENT;
    });

    // Process video files
    videoFiles.forEach((file) => {
      const currentOffsetX = offsetX;
      const currentOffsetY = offsetY;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) return;

        // Load video to get dimensions
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          let vidWidth = video.videoWidth;
          let vidHeight = video.videoHeight;

          // Scale down large videos to max 800px
          const maxSize = 800;
          if (vidWidth > maxSize || vidHeight > maxSize) {
            const scale = Math.min(maxSize / vidWidth, maxSize / vidHeight);
            vidWidth = Math.round(vidWidth * scale);
            vidHeight = Math.round(vidHeight * scale);
          }

          // Calculate position with offset for multiple files
          const videoX = canvasPos.x - vidWidth / 2 + currentOffsetX;
          const videoY = canvasPos.y - vidHeight / 2 + currentOffsetY;

          // Create video object
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

          // Select the last file (when all are loaded)
          if (processedCount === totalFiles) {
            setSelection([lastAddedId]);
          }
        };
        video.onerror = () => {
          useToastStore.getState().addToast({
            message: 'Failed to load video. Format may not be supported.',
            type: 'error',
            duration: 5000
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

      // Increment offset for next file
      offsetX += OFFSET_INCREMENT;
      offsetY += OFFSET_INCREMENT;
    });
  }, [screenToCanvas, addObject, getNextZIndex, setSelection]);

  // Determine cursor style
  const getCursorStyle = () => {
    if (isPanning) return 'grabbing';
    if (isRotating) return 'grab'; // Could use a custom rotate cursor
    if (isResizing && activeResizeHandle) return HANDLE_CURSORS[activeResizeHandle];
    if (isDragging) return 'move';
    if (isMarqueeSelecting) return 'crosshair';
    if (isDrawingRect) return 'crosshair';
    if (isDrawingFrame) return 'crosshair';
    if (isDrawingPath) return 'crosshair';
    if (isDrawingLine) return 'crosshair';
    if (isSpacePressed || activeTool === 'hand') return 'grab';
    if (activeTool === 'frame') return 'crosshair';
    if (activeTool === 'pen') return 'crosshair';
    if (activeTool === 'ellipse') return 'crosshair';
    if (activeTool === 'line') return 'crosshair';
    if (activeTool === 'arrow') return 'crosshair';
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

  // Handle text input changes
  const handleTextInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingTextId) return;

    // Get fresh state from store to avoid stale closure issues
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

    console.log('[handleTextInput] Updating dimensions:', { newText, dimensions, textObj: { fontSize: textObj.fontSize, fontFamily: textObj.fontFamily } });

    updateObject(editingTextId, {
      text: newText,
      width: dimensions.width,
      height: dimensions.height,
    });
  }, [editingTextId, updateObject]);

  // Exit text edit mode
  const exitTextEditMode = useCallback(() => {
    if (editingTextId) {
      // Get fresh state from store
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
        console.log('[exitTextEditMode] Final dimensions:', { text: textObj.text, dimensions });
        updateObject(editingTextId, {
          width: dimensions.width,
          height: dimensions.height,
        });
      }
    }
    setEditingTextId(null);
  }, [editingTextId, updateObject]);

  // Handle keyboard events for text editing
  const handleTextKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      exitTextEditMode();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      exitTextEditMode();
    }
    // Allow arrow keys and selection shortcuts to work naturally
    // The native input handles: ArrowLeft, ArrowRight, Shift+Arrow, Home, End, Ctrl+A, etc.
    // Stop propagation to prevent tool shortcuts from firing
    e.stopPropagation();
  }, [exitTextEditMode]);

  // Focus the text input when entering edit mode
  useEffect(() => {
    if (editingTextId) {
      let retryCount = 0;
      const maxRetries = 5;

      const focusInput = () => {
        if (textInputRef.current) {
          textInputRef.current.focus();
          textInputRef.current.select();
          // Verify focus was successful, retry if not
          if (document.activeElement !== textInputRef.current && retryCount < maxRetries) {
            retryCount++;
            requestAnimationFrame(focusInput);
          }
        }
      };

      // Delay initial focus attempt to ensure input is fully mounted
      setTimeout(focusInput, 50);
    }
  }, [editingTextId]);

  // Get the editing text object and its screen position
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
      fontWeight: textObj.fontWeight || 400,
      fontStyle: textObj.fontStyle || 'normal',
      textDecoration: textObj.textDecoration || 'none',
      color: textObj.fill || '#ffffff',
      minWidth: '20px', // Minimal width, selection handles match actual text size
    };
  }, [editingTextId, objects, canvasToScreen, viewport.zoom]);

  // Handle click outside to exit text edit mode
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't process if we just started editing (guard against race conditions)
    if (justStartedEditingRef.current) return;

    // If clicking on the canvas container or canvas itself but not on the input, exit edit mode
    if (editingTextId) {
      const isClickOnInput = textInputRef.current && textInputRef.current.contains(e.target as Node);
      if (!isClickOnInput) {
        exitTextEditMode();
      }
    }
  }, [editingTextId, exitTextEditMode]);

  // Get the current text for the editing input
  const getEditingTextValue = (): string => {
    if (!editingTextId) return '';
    const textObj = objects.get(editingTextId);
    if (!textObj || textObj.type !== 'text') return '';
    return textObj.text;
  };

  // Handle frame name input changes
  const handleFrameNameInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingFrameId) return;
    updateObject(editingFrameId, { name: e.target.value });
  }, [editingFrameId, updateObject]);

  // Exit frame name edit mode
  const exitFrameNameEditMode = useCallback(() => {
    setEditingFrameId(null);
  }, []);

  // Handle keyboard events for frame name editing
  const handleFrameNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      exitFrameNameEditMode();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      exitFrameNameEditMode();
    }
    // Stop propagation to prevent tool shortcuts from firing
    e.stopPropagation();
  }, [exitFrameNameEditMode]);

  // Focus the frame name input when entering edit mode
  useEffect(() => {
    if (editingFrameId && frameInputRef.current) {
      frameInputRef.current.focus();
      frameInputRef.current.select(); // Select all text for easy replacement
    }
  }, [editingFrameId]);

  // Get the editing frame object and its screen position for the name input
  const getEditingFrameNameStyle = useCallback((): React.CSSProperties | null => {
    if (!editingFrameId) return null;
    const frameObj = objects.get(editingFrameId);
    if (!frameObj || frameObj.type !== 'frame') return null;

    const screenPos = canvasToScreen(frameObj.x, frameObj.y);
    const fontSize = 12 * viewport.zoom;

    return {
      position: 'absolute',
      left: screenPos.x,
      top: screenPos.y - fontSize - 4 * viewport.zoom, // Position above the frame
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

  // Get the current frame name for the editing input
  const getEditingFrameNameValue = (): string => {
    if (!editingFrameId) return '';
    const frameObj = objects.get(editingFrameId);
    if (!frameObj || frameObj.type !== 'frame') return '';
    return frameObj.name;
  };

  // Get the playing video object and its screen position/size
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
      pointerEvents: 'auto' as const,
      borderRadius: '0',
      zIndex: 100,
    };
  }, [playingVideoId, objects, canvasToScreen, viewport.zoom]);

  // Get the playing video source
  const getPlayingVideoSrc = (): string => {
    if (!playingVideoId) return '';
    const videoObj = objects.get(playingVideoId);
    if (!videoObj || videoObj.type !== 'video') return '';
    return videoObj.src;
  };

  // Stop video playback
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
          controls
          onEnded={stopVideoPlayback}
          onClick={(e) => e.stopPropagation()}
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
            // Don't exit if we just started editing (guard against focus race conditions)
            if (justStartedEditingRef.current) return;
            // Small delay to prevent immediate exit when focus shifts during render
            setTimeout(() => {
              // Don't exit if guard flag is set (could be set during the timeout)
              if (justStartedEditingRef.current) return;
              // Only exit if the input is not focused anymore
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
      <CursorPresence />
      <Minimap />
    </main>
  );
}
