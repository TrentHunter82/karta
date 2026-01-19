import { useState, useCallback } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useToastStore } from '../../stores/toastStore';
import { TransformSection } from './sections/TransformSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { TextSection } from './sections/TextSection';
import { FrameSection } from './sections/FrameSection';
import { LineSection } from './sections/LineSection';
import { LayoutSection } from './sections/LayoutSection';
import { LayerSection } from './sections/LayerSection';
import {
  exportToSVG,
  downloadSVG,
  exportToJSON,
  downloadJSON,
  calculateBoundingBox,
  downloadBlob,
  type ExportScale,
} from '../../utils/exportUtils';
import type { CanvasObject, TextObject, FrameObject, LineObject, ArrowObject, ImageObject, VideoObject } from '../../types/canvas';
import './properties.css';

// Image cache for export
const exportImageCache = new Map<string, HTMLImageElement>();
const exportVideoThumbnailCache = new Map<string, HTMLCanvasElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const cached = exportImageCache.get(src);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      resolve(cached);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      exportImageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

function loadVideoThumbnail(src: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const cached = exportVideoThumbnailCache.get(src);
    if (cached) {
      resolve(cached);
      return;
    }
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

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
        exportVideoThumbnailCache.set(src, thumbCanvas);
        resolve(thumbCanvas);
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };

    video.onerror = reject;
    video.src = src;
  });
}

async function drawObjectForExport(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  offsetX: number,
  offsetY: number
): Promise<void> {
  const x = obj.x - offsetX;
  const y = obj.y - offsetY;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((obj.rotation * Math.PI) / 180);
  ctx.globalAlpha = obj.opacity;

  switch (obj.type) {
    case 'rectangle':
      if (obj.fill) {
        ctx.fillStyle = obj.fill;
        ctx.fillRect(0, 0, obj.width, obj.height);
      }
      if (obj.stroke && obj.strokeWidth) {
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth;
        ctx.strokeRect(0, 0, obj.width, obj.height);
      }
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(obj.width / 2, obj.height / 2, obj.width / 2, obj.height / 2, 0, 0, Math.PI * 2);
      if (obj.fill) {
        ctx.fillStyle = obj.fill;
        ctx.fill();
      }
      if (obj.stroke && obj.strokeWidth) {
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth;
        ctx.stroke();
      }
      break;
    case 'text': {
      const textObj = obj as TextObject;
      ctx.fillStyle = textObj.fill || '#ffffff';
      const fontStyle = textObj.fontStyle || 'normal';
      const fontWeight = textObj.fontWeight || 400;
      const fontSize = textObj.fontSize;
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${textObj.fontFamily}`;
      ctx.textAlign = textObj.textAlign || 'left';
      ctx.textBaseline = 'top';
      const textX = textObj.textAlign === 'center' ? obj.width / 2 : textObj.textAlign === 'right' ? obj.width : 0;
      const lines = textObj.text.split('\n');
      const lineHeightPx = fontSize * (textObj.lineHeight || 1.2);
      lines.forEach((line, index) => {
        const ly = index * lineHeightPx;
        ctx.fillText(line, textX, ly);
      });
      break;
    }
    case 'frame':
      ctx.fillStyle = obj.fill || '#2a2a2a';
      ctx.fillRect(0, 0, obj.width, obj.height);
      ctx.strokeStyle = obj.stroke || '#3a3a3a';
      ctx.lineWidth = obj.strokeWidth || 1;
      ctx.strokeRect(0, 0, obj.width, obj.height);
      break;
    case 'path':
      if (obj.points.length > 0) {
        ctx.beginPath();
        const firstPoint = obj.points[0];
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < obj.points.length; i++) {
          ctx.lineTo(obj.points[i].x, obj.points[i].y);
        }
        ctx.strokeStyle = obj.stroke || '#ffffff';
        ctx.lineWidth = obj.strokeWidth || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      break;
    case 'image': {
      const imgObj = obj as ImageObject;
      try {
        const img = await loadImage(imgObj.src);
        ctx.drawImage(img, 0, 0, obj.width, obj.height);
      } catch {
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(0, 0, obj.width, obj.height);
      }
      break;
    }
    case 'video': {
      const vidObj = obj as VideoObject;
      try {
        const thumbnail = await loadVideoThumbnail(vidObj.src);
        ctx.drawImage(thumbnail, 0, 0, obj.width, obj.height);
      } catch {
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(0, 0, obj.width, obj.height);
      }
      break;
    }
    case 'line':
    case 'arrow':
      ctx.beginPath();
      ctx.moveTo((obj as LineObject | ArrowObject).x1, (obj as LineObject | ArrowObject).y1);
      ctx.lineTo((obj as LineObject | ArrowObject).x2, (obj as LineObject | ArrowObject).y2);
      ctx.strokeStyle = obj.stroke || '#ffffff';
      ctx.lineWidth = obj.strokeWidth || 2;
      ctx.lineCap = 'round';
      ctx.stroke();
      break;
    case 'polygon':
    case 'star':
      if (obj.fill) {
        ctx.fillStyle = obj.fill;
        ctx.fillRect(0, 0, obj.width, obj.height);
      }
      if (obj.stroke && obj.strokeWidth) {
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth;
        ctx.strokeRect(0, 0, obj.width, obj.height);
      }
      break;
  }

  ctx.restore();
}

type ExportFormat = 'png' | 'svg' | 'json';

interface ExportSectionProps {
  objects: Map<string, CanvasObject>;
  selectedIds: Set<string>;
}

function ExportSection({ objects, selectedIds }: ExportSectionProps) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState<ExportScale>(1);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const viewport = useCanvasStore((state) => state.viewport);

  const getObjectsToExport = useCallback((): CanvasObject[] => {
    const objectsToExport: CanvasObject[] = [];
    if (selectedIds.size > 0) {
      selectedIds.forEach((id) => {
        const obj = objects.get(id);
        if (obj) objectsToExport.push(obj);
      });
    } else {
      objects.forEach((obj) => objectsToExport.push(obj));
    }
    return objectsToExport;
  }, [objects, selectedIds]);

  const handleExportPNG = useCallback(async (objectsToExport: CanvasObject[]) => {
    const bounds = calculateBoundingBox(objectsToExport);
    const padding = 20;
    const exportWidth = (bounds.width + padding * 2) * scale;
    const exportHeight = (bounds.height + padding * 2) * scale;

    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Failed to create export canvas');

    ctx.scale(scale, scale);

    if (!transparentBackground) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, bounds.width + padding * 2, bounds.height + padding * 2);
    }

    const sortedObjects = [...objectsToExport].sort((a, b) => a.zIndex - b.zIndex);
    for (const obj of sortedObjects) {
      await drawObjectForExport(ctx, obj, bounds.x - padding, bounds.y - padding);
    }

    return new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `karta-export@${scale}x-${Date.now()}.png`);
        resolve();
      }, 'image/png');
    });
  }, [scale, transparentBackground]);

  const handleExportSVG = useCallback((objectsToExport: CanvasObject[]) => {
    const svg = exportToSVG(objectsToExport, {
      includeBackground: !transparentBackground,
      backgroundColor: '#1a1a1a',
    });
    downloadSVG(svg, `karta-export-${Date.now()}.svg`);
  }, [transparentBackground]);

  const handleExportJSON = useCallback((objectsToExport: CanvasObject[]) => {
    const project = exportToJSON(objectsToExport, viewport, `karta-project-${Date.now()}`);
    downloadJSON(project);
  }, [viewport]);

  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const objectsToExport = getObjectsToExport();
      if (objectsToExport.length === 0) {
        addToast({ message: 'Nothing to export', type: 'warning' });
        setIsExporting(false);
        return;
      }

      switch (format) {
        case 'png': await handleExportPNG(objectsToExport); break;
        case 'svg': handleExportSVG(objectsToExport); break;
        case 'json': handleExportJSON(objectsToExport); break;
      }

      addToast({ message: `${format.toUpperCase()} export successful!`, type: 'success' });
    } catch (error) {
      console.error('Export failed:', error);
      addToast({ message: 'Export failed', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  }, [format, isExporting, getObjectsToExport, handleExportPNG, handleExportSVG, handleExportJSON, addToast]);

  return (
    <div className="export-section">
      <div className="export-format-row">
        <span className="export-label">Format</span>
        <div className="export-format-buttons">
          <button className={`export-format-btn ${format === 'png' ? 'active' : ''}`} onClick={() => setFormat('png')}>PNG</button>
          <button className={`export-format-btn ${format === 'svg' ? 'active' : ''}`} onClick={() => setFormat('svg')}>SVG</button>
          <button className={`export-format-btn ${format === 'json' ? 'active' : ''}`} onClick={() => setFormat('json')}>JSON</button>
        </div>
      </div>

      {format === 'png' && (
        <div className="export-scale-row">
          <span className="export-label">Scale</span>
          <div className="export-scale-buttons">
            <button className={`export-scale-btn ${scale === 1 ? 'active' : ''}`} onClick={() => setScale(1)}>1x</button>
            <button className={`export-scale-btn ${scale === 2 ? 'active' : ''}`} onClick={() => setScale(2)}>2x</button>
            <button className={`export-scale-btn ${scale === 3 ? 'active' : ''}`} onClick={() => setScale(3)}>3x</button>
          </div>
        </div>
      )}

      {format !== 'json' && (
        <div className="export-option">
          <label className="export-checkbox-label">
            <input type="checkbox" className="export-checkbox" checked={transparentBackground} onChange={(e) => setTransparentBackground(e.target.checked)} />
            <span className="export-option-text">Transparent background</span>
          </label>
        </div>
      )}

      <button className={`export-button ${isExporting ? 'exporting' : ''}`} onClick={handleExport} disabled={isExporting || objects.size === 0}>
        {isExporting ? 'Exporting...' : selectedIds.size > 0 ? `Export Selection (${format.toUpperCase()})` : `Export All (${format.toUpperCase()})`}
      </button>
    </div>
  );
}

export function PropertiesPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const objects = useCanvasStore((state) => state.objects);

  const selectedObjects = Array.from(selectedIds)
    .map((id) => objects.get(id))
    .filter(Boolean) as CanvasObject[];

  const hasText = selectedObjects.some((o) => o.type === 'text');
  const hasFrame = selectedObjects.some((o) => o.type === 'frame');
  const hasLine = selectedObjects.some((o) => o.type === 'line' || o.type === 'arrow');

  return (
    <aside className={`properties-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <button
        className="properties-panel-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {isCollapsed ? '◀' : '▶'}
      </button>
      {!isCollapsed && (
        <div className="properties-panel-content">
          <div className="panel-header">
            <span className="panel-title">Properties</span>
          </div>

          {selectedObjects.length === 0 ? (
            <div className="properties-empty">
              <p>No selection</p>
            </div>
          ) : (
            <>
              <TransformSection objects={selectedObjects} />
              <AppearanceSection objects={selectedObjects} />
              {hasText && (
                <TextSection objects={selectedObjects.filter((o) => o.type === 'text') as TextObject[]} />
              )}
              {hasFrame && (
                <FrameSection objects={selectedObjects.filter((o) => o.type === 'frame') as FrameObject[]} />
              )}
              {hasLine && (
                <LineSection objects={selectedObjects.filter((o) => o.type === 'line' || o.type === 'arrow') as (LineObject | ArrowObject)[]} />
              )}
              {selectedObjects.length > 1 && <LayoutSection />}
            </>
          )}

          <LayerSection />

          <section className="properties-section">
            <div className="section-header">
              <span className="section-title">Export</span>
            </div>
            <div className="section-content">
              <ExportSection objects={objects} selectedIds={selectedIds} />
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
