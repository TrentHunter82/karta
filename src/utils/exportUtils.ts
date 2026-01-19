import type {
  CanvasObject,
  TextObject,
  RectangleObject,
  PathObject,
  LineObject,
  ArrowObject,
  PolygonObject,
  StarObject,
  Viewport,
  GroupObject,
} from '../types/canvas';
import { calculateBoundingBox, type BoundingBox } from './geometryUtils';

// Re-export for backwards compatibility
export { calculateBoundingBox };

// ============================================================================
// SVG Export
// ============================================================================

interface SVGExportOptions {
  includeBackground?: boolean;
  backgroundColor?: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getFillStroke(obj: { fill?: string; stroke?: string; strokeWidth?: number }): string {
  let attrs = '';
  if (obj.fill) {
    attrs += ` fill="${obj.fill}"`;
  } else {
    attrs += ' fill="none"';
  }
  if (obj.stroke) {
    attrs += ` stroke="${obj.stroke}"`;
    if (obj.strokeWidth) {
      attrs += ` stroke-width="${obj.strokeWidth}"`;
    }
  }
  return attrs;
}

function pathPointsToSVG(points: { x: number; y: number }[], offsetX: number, offsetY: number): string {
  if (points.length === 0) return '';

  let d = `M ${points[0].x + offsetX} ${points[0].y + offsetY}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x + offsetX} ${points[i].y + offsetY}`;
  }
  return d;
}

function generatePolygonPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  sides: number
): string {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;

  const points: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
    const px = cx + rx * Math.cos(angle);
    const py = cy + ry * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  return points.join(' ');
}

function generateStarPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  numPoints: number,
  innerRadius: number
): string {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const outerRx = width / 2;
  const outerRy = height / 2;
  const innerRx = outerRx * innerRadius;
  const innerRy = outerRy * innerRadius;

  const points: string[] = [];
  for (let i = 0; i < numPoints * 2; i++) {
    const angle = (i * Math.PI) / numPoints - Math.PI / 2;
    const isOuter = i % 2 === 0;
    const rx = isOuter ? outerRx : innerRx;
    const ry = isOuter ? outerRy : innerRy;
    const px = cx + rx * Math.cos(angle);
    const py = cy + ry * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  return points.join(' ');
}

function objectToSVG(obj: CanvasObject, x: number, y: number): string {
  const transform = obj.rotation
    ? ` transform="rotate(${obj.rotation} ${x + obj.width / 2} ${y + obj.height / 2})"`
    : '';
  const opacity = obj.opacity !== 1 ? ` opacity="${obj.opacity}"` : '';

  switch (obj.type) {
    case 'rectangle': {
      const rect = obj as RectangleObject;
      const rx = rect.cornerRadius ? ` rx="${rect.cornerRadius}"` : '';
      return `  <rect x="${x}" y="${y}" width="${obj.width}" height="${obj.height}"${rx}${getFillStroke(rect)}${opacity}${transform}/>\n`;
    }

    case 'ellipse': {
      const cx = x + obj.width / 2;
      const cy = y + obj.height / 2;
      const rx = obj.width / 2;
      const ry = obj.height / 2;
      return `  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${getFillStroke(obj)}${opacity}${transform}/>\n`;
    }

    case 'text': {
      const text = obj as TextObject;
      const fontStyle = text.fontStyle === 'italic' ? ' font-style="italic"' : '';
      const fontWeight = text.fontWeight !== 400 ? ` font-weight="${text.fontWeight}"` : '';
      const textAnchor = text.textAlign === 'center' ? 'middle' : text.textAlign === 'right' ? 'end' : 'start';
      const textX = text.textAlign === 'center' ? x + obj.width / 2 : text.textAlign === 'right' ? x + obj.width : x;

      // Handle multi-line text
      const lines = text.text.split('\n');
      if (lines.length === 1) {
        return `  <text x="${textX}" y="${y + text.fontSize}" font-family="${text.fontFamily}" font-size="${text.fontSize}"${fontStyle}${fontWeight} fill="${text.fill || '#ffffff'}" text-anchor="${textAnchor}"${opacity}${transform}>${escapeXml(text.text)}</text>\n`;
      }

      // Multi-line text
      let result = `  <text font-family="${text.fontFamily}" font-size="${text.fontSize}"${fontStyle}${fontWeight} fill="${text.fill || '#ffffff'}" text-anchor="${textAnchor}"${opacity}${transform}>\n`;
      const lineHeight = text.fontSize * (text.lineHeight || 1.2);
      lines.forEach((line, index) => {
        const ly = y + text.fontSize + index * lineHeight;
        result += `    <tspan x="${textX}" y="${ly}">${escapeXml(line)}</tspan>\n`;
      });
      result += '  </text>\n';
      return result;
    }

    case 'line': {
      const line = obj as LineObject;
      return `  <line x1="${x + line.x1}" y1="${y + line.y1}" x2="${x + line.x2}" y2="${y + line.y2}" stroke="${line.stroke || '#ffffff'}" stroke-width="${line.strokeWidth || 2}"${opacity}${transform}/>\n`;
    }

    case 'arrow': {
      const arrow = obj as ArrowObject;
      let result = '';
      const markerId = `arrow-${obj.id}`;

      // Add arrowhead marker definitions
      if (arrow.arrowStart || arrow.arrowEnd) {
        result += '  <defs>\n';
        if (arrow.arrowEnd) {
          result += `    <marker id="${markerId}-end" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><polygon points="0 0, 10 3, 0 6" fill="${arrow.stroke || '#ffffff'}"/></marker>\n`;
        }
        if (arrow.arrowStart) {
          result += `    <marker id="${markerId}-start" markerWidth="10" markerHeight="10" refX="1" refY="3" orient="auto"><polygon points="10 0, 0 3, 10 6" fill="${arrow.stroke || '#ffffff'}"/></marker>\n`;
        }
        result += '  </defs>\n';
      }

      result += `  <line x1="${x + arrow.x1}" y1="${y + arrow.y1}" x2="${x + arrow.x2}" y2="${y + arrow.y2}" stroke="${arrow.stroke || '#ffffff'}" stroke-width="${arrow.strokeWidth || 2}"${opacity}${transform}`;
      if (arrow.arrowEnd) {
        result += ` marker-end="url(#${markerId}-end)"`;
      }
      if (arrow.arrowStart) {
        result += ` marker-start="url(#${markerId}-start)"`;
      }
      result += '/>\n';
      return result;
    }

    case 'path': {
      const path = obj as PathObject;
      if (path.points.length === 0) return '';
      const d = pathPointsToSVG(path.points, x, y);
      return `  <path d="${d}" stroke="${path.stroke || '#ffffff'}" stroke-width="${path.strokeWidth || 2}" fill="none" stroke-linecap="round" stroke-linejoin="round"${opacity}${transform}/>\n`;
    }

    case 'polygon': {
      const poly = obj as PolygonObject;
      const points = generatePolygonPoints(x, y, obj.width, obj.height, poly.sides || 6);
      return `  <polygon points="${points}"${getFillStroke(poly)}${opacity}${transform}/>\n`;
    }

    case 'star': {
      const star = obj as StarObject;
      const points = generateStarPoints(x, y, obj.width, obj.height, star.points || 5, star.innerRadius || 0.5);
      return `  <polygon points="${points}"${getFillStroke(star)}${opacity}${transform}/>\n`;
    }

    case 'frame': {
      return `  <rect x="${x}" y="${y}" width="${obj.width}" height="${obj.height}" fill="${obj.fill || '#2a2a2a'}" stroke="${obj.stroke || '#3a3a3a'}"${opacity}${transform}/>\n`;
    }

    case 'image': {
      const img = obj as { src: string } & CanvasObject;
      return `  <image x="${x}" y="${y}" width="${obj.width}" height="${obj.height}" href="${img.src}"${opacity}${transform}/>\n`;
    }

    case 'video': {
      // Video can't be exported to SVG, show placeholder
      return `  <rect x="${x}" y="${y}" width="${obj.width}" height="${obj.height}" fill="#333333" stroke="#666666"${opacity}${transform}/>\n`;
    }

    case 'group': {
      // Groups should be rendered as SVG groups with transform for proper rotation handling
      const group = obj as GroupObject;
      const transform = obj.rotation
        ? ` transform="rotate(${obj.rotation} ${x + obj.width / 2} ${y + obj.height / 2})"`
        : '';
      const opacity = obj.opacity !== 1 ? ` opacity="${obj.opacity}"` : '';
      // Note: Group children are rendered separately with their own transforms
      // This returns the opening <g> tag. Children are handled in exportToSVG.
      return `  <g id="group-${group.id}"${opacity}${transform}>\n`;
    }

    default:
      return '';
  }
}

/**
 * Recursively renders an object and its children (for groups) to SVG.
 * Groups are rendered as SVG <g> elements with their children inside.
 */
function renderObjectToSVG(
  obj: CanvasObject,
  offsetX: number,
  offsetY: number,
  objectsMap: Map<string, CanvasObject>
): string {
  const x = obj.x + offsetX;
  const y = obj.y + offsetY;

  if (obj.type === 'group') {
    const group = obj as GroupObject;
    let result = objectToSVG(obj, x, y); // Opens <g> tag

    // Render children with offset relative to group position
    for (const childId of group.children) {
      const child = objectsMap.get(childId);
      if (child) {
        result += renderObjectToSVG(child, x, y, objectsMap);
      }
    }

    result += '  </g>\n'; // Close <g> tag
    return result;
  }

  return objectToSVG(obj, x, y);
}

export function exportToSVG(
  objects: CanvasObject[],
  options: SVGExportOptions = {}
): string {
  // Build a map for quick child lookup
  const objectsMap = new Map<string, CanvasObject>();
  objects.forEach(obj => objectsMap.set(obj.id, obj));

  const bounds = calculateBoundingBox(objects);
  const padding = 10;

  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;

  if (options.includeBackground) {
    svg += `  <rect width="100%" height="100%" fill="${options.backgroundColor || '#1a1a1a'}"/>\n`;
  }

  // Sort by z-index, filter to top-level objects only (not children of groups)
  const topLevelObjects = [...objects]
    .filter(obj => !obj.parentId)
    .sort((a, b) => a.zIndex - b.zIndex);

  topLevelObjects.forEach((obj) => {
    const offsetX = -bounds.x + padding;
    const offsetY = -bounds.y + padding;
    svg += renderObjectToSVG(obj, offsetX, offsetY, objectsMap);
  });

  svg += '</svg>';

  return svg;
}

export function downloadSVG(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// JSON Export (Project File)
// ============================================================================

export interface KartaProjectFile {
  version: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  canvas: {
    objects: CanvasObject[];
    viewport: Viewport;
  };
  metadata?: {
    author?: string;
    description?: string;
  };
}

export function exportToJSON(
  objects: CanvasObject[],
  viewport: Viewport,
  name: string,
  metadata?: { author?: string; description?: string }
): KartaProjectFile {
  return {
    version: '1.0.0',
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    canvas: {
      objects: Array.from(objects),
      viewport,
    },
    metadata,
  };
}

export function downloadJSON(project: KartaProjectFile): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${project.name}.karta.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function validateProjectFile(data: unknown): data is KartaProjectFile {
  if (!data || typeof data !== 'object') return false;
  const project = data as KartaProjectFile;

  if (!project.version || typeof project.version !== 'string') return false;
  if (!project.canvas || typeof project.canvas !== 'object') return false;
  if (!Array.isArray(project.canvas.objects)) return false;

  return true;
}

// ============================================================================
// PNG Export (Enhanced)
// ============================================================================

export type ExportScale = 1 | 2 | 3;

export interface PNGExportOptions {
  scale: ExportScale;
  transparent: boolean;
  backgroundColor?: string;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
