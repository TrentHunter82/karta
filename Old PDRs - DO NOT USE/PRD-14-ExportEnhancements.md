# PRD-14: Export Enhancements

## Overview
Add additional export formats (SVG, JSON) and improve export options (quality settings, frame export).

**Priority:** MEDIUM
**Estimated Complexity:** Medium
**Files Affected:** `PropertiesPanel.tsx`, new `exportUtils.ts`, `canvasStore.ts`

---

## Background
Current export only supports PNG with basic options. Design tools typically offer SVG for vector graphics, JSON for project files, and various quality/scale options.

---

## User Stories

### US-109: Export as SVG
**Goal:** Export canvas or selection as scalable vector graphics.

**Implementation (new file: src/utils/exportUtils.ts):**
```typescript
import type { CanvasObject, TextObject, RectangleObject } from '../types/canvas';

export const exportToSVG = (
  objects: CanvasObject[],
  options: { includeBackground?: boolean }
): string => {
  const bounds = calculateBoundingBox(objects);
  const padding = 10;

  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
`;

  if (options.includeBackground) {
    svg += `  <rect width="100%" height="100%" fill="#1a1a1a"/>
`;
  }

  // Sort by z-index
  const sortedObjects = [...objects].sort((a, b) => a.zIndex - b.zIndex);

  sortedObjects.forEach(obj => {
    const x = obj.x - bounds.x + padding;
    const y = obj.y - bounds.y + padding;

    svg += objectToSVG(obj, x, y);
  });

  svg += '</svg>';

  return svg;
};

const objectToSVG = (obj: CanvasObject, x: number, y: number): string => {
  const transform = obj.rotation
    ? ` transform="rotate(${obj.rotation} ${x + obj.width / 2} ${y + obj.height / 2})"`
    : '';
  const opacity = obj.opacity !== 1 ? ` opacity="${obj.opacity}"` : '';

  switch (obj.type) {
    case 'rectangle': {
      const rect = obj as RectangleObject;
      const rx = rect.cornerRadius ? ` rx="${rect.cornerRadius}"` : '';
      return `  <rect x="${x}" y="${y}" width="${obj.width}" height="${obj.height}"${rx}${getFillStroke(rect)}${opacity}${transform}/>
`;
    }

    case 'ellipse': {
      const cx = x + obj.width / 2;
      const cy = y + obj.height / 2;
      const rx = obj.width / 2;
      const ry = obj.height / 2;
      return `  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${getFillStroke(obj)}${opacity}${transform}/>
`;
    }

    case 'text': {
      const text = obj as TextObject;
      const fontStyle = text.fontStyle === 'italic' ? ' font-style="italic"' : '';
      const fontWeight = text.fontWeight !== 400 ? ` font-weight="${text.fontWeight}"` : '';
      const textAnchor = text.textAlign === 'center' ? 'middle' : text.textAlign === 'right' ? 'end' : 'start';
      const textX = text.textAlign === 'center' ? x + obj.width / 2 : text.textAlign === 'right' ? x + obj.width : x;

      return `  <text x="${textX}" y="${y + text.fontSize}" font-family="${text.fontFamily}" font-size="${text.fontSize}"${fontStyle}${fontWeight} fill="${text.fill || '#ffffff'}" text-anchor="${textAnchor}"${opacity}${transform}>${escapeXml(text.text)}</text>
`;
    }

    case 'line':
    case 'arrow': {
      const line = obj as any;
      let lineStr = `  <line x1="${x + line.x1}" y1="${y + line.y1}" x2="${x + line.x2}" y2="${y + line.y2}" stroke="${line.stroke}" stroke-width="${line.strokeWidth}"${opacity}${transform}`;

      if (obj.type === 'arrow' && line.arrowEnd) {
        // Add arrowhead marker
        const markerId = `arrow-${obj.id}`;
        lineStr = `  <defs><marker id="${markerId}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><polygon points="0 0, 10 3, 0 6" fill="${line.stroke}"/></marker></defs>
` + lineStr + ` marker-end="url(#${markerId})"`;
      }

      return lineStr + `/>
`;
    }

    case 'path': {
      const path = obj as any;
      const d = pathPointsToSVG(path.points, x, y);
      return `  <path d="${d}" stroke="${path.stroke}" stroke-width="${path.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"${opacity}${transform}/>
`;
    }

    case 'polygon': {
      const poly = obj as any;
      const points = generatePolygonPoints(x, y, obj.width, obj.height, poly.sides);
      return `  <polygon points="${points}"${getFillStroke(poly)}${opacity}${transform}/>
`;
    }

    case 'star': {
      const star = obj as any;
      const points = generateStarPoints(x, y, obj.width, obj.height, star.points, star.innerRadius);
      return `  <polygon points="${points}"${getFillStroke(star)}${opacity}${transform}/>
`;
    }

    case 'frame': {
      const frame = obj as any;
      return `  <rect x="${x}" y="${y}" width="${obj.width}" height="${obj.height}" fill="${frame.fill || '#2a2a2a'}" stroke="${frame.stroke || '#3a3a3a'}"${opacity}${transform}/>
`;
    }

    case 'image': {
      // Embed image as base64
      return `  <image x="${x}" y="${y}" width="${obj.width}" height="${obj.height}" href="${(obj as any).src}"${opacity}${transform}/>
`;
    }

    default:
      return '';
  }
};

const getFillStroke = (obj: any): string => {
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
};

const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};
```

**Download Function:**
```typescript
const downloadSVG = (svg: string, filename: string) => {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};
```

**Acceptance Criteria:**
- [ ] SVG export option available
- [ ] All shape types export correctly
- [ ] Text exports with proper fonts
- [ ] Rotation and opacity preserved
- [ ] Fill and stroke preserved
- [ ] Images embedded as base64

---

### US-110: Export as JSON (Project File)
**Goal:** Save entire canvas state as a JSON file for later import.

**Implementation:**
```typescript
interface KartaProjectFile {
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

export const exportToJSON = (
  objects: CanvasObject[],
  viewport: Viewport,
  name: string
): KartaProjectFile => {
  return {
    version: '1.0.0',
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    canvas: {
      objects: Array.from(objects),
      viewport
    }
  };
};

const downloadJSON = (project: KartaProjectFile) => {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${project.name}.karta.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};
```

**Acceptance Criteria:**
- [ ] JSON export saves all objects
- [ ] Viewport state saved
- [ ] File has .karta.json extension
- [ ] Version number included for compatibility
- [ ] File is human-readable (formatted JSON)

---

### US-111: Import JSON Project File
**Goal:** Load a previously exported project file.

**Implementation:**
```typescript
// In Toolbar.tsx or new ImportButton component
const handleImportProject = async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.karta.json';

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const project = JSON.parse(text) as KartaProjectFile;

      // Validate version
      if (!project.version || !project.canvas?.objects) {
        throw new Error('Invalid project file format');
      }

      // Confirm overwrite
      const hasObjects = useCanvasStore.getState().objects.size > 0;
      if (hasObjects) {
        const confirmed = window.confirm(
          'This will replace the current canvas. Continue?'
        );
        if (!confirmed) return;
      }

      // Clear current canvas and load project
      const store = useCanvasStore.getState();
      store.clearCanvas();

      // Generate new IDs to avoid conflicts
      const idMap = new Map<string, string>();
      const newObjects = project.canvas.objects.map(obj => {
        const newId = crypto.randomUUID();
        idMap.set(obj.id, newId);
        return { ...obj, id: newId };
      });

      // Update parent references (for groups)
      newObjects.forEach(obj => {
        if (obj.parentId && idMap.has(obj.parentId)) {
          obj.parentId = idMap.get(obj.parentId);
        }
      });

      // Add all objects
      store.addObjects(newObjects);

      // Restore viewport
      if (project.canvas.viewport) {
        store.setViewport(project.canvas.viewport);
      }

      useToastStore.getState().addToast({
        message: `Loaded project: ${project.name}`,
        type: 'success'
      });

    } catch (error) {
      useToastStore.getState().addToast({
        message: `Failed to load project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
        duration: 5000
      });
    }
  };

  input.click();
};
```

**Store Actions:**
```typescript
clearCanvas: () => {
  set({
    objects: new Map(),
    selectedIds: new Set(),
    clipboard: [],
    history: [],
    historyIndex: -1
  });

  // Clear Yjs
  yObjects.doc?.transact(() => {
    yObjects.forEach((_, key) => yObjects.delete(key));
  });
},

addObjects: (objects: CanvasObject[]) => {
  const state = get();
  state.pushHistory();

  const newObjects = new Map(state.objects);
  objects.forEach(obj => {
    newObjects.set(obj.id, obj);
  });

  set({ objects: newObjects });

  // Sync to Yjs
  yObjects.doc?.transact(() => {
    objects.forEach(obj => {
      const yMap = new Y.Map();
      Object.entries(obj).forEach(([key, value]) => {
        yMap.set(key, value);
      });
      yObjects.set(obj.id, yMap);
    });
  });
}
```

**Acceptance Criteria:**
- [ ] Can import .karta.json files
- [ ] Validates file format
- [ ] Warns before overwriting existing content
- [ ] Generates new IDs for imported objects
- [ ] Restores viewport position
- [ ] Shows success/error toast

---

### US-112: Export Quality Settings (1x, 2x, 3x)
**Goal:** Export PNG at different resolutions for various use cases.

**Implementation:**
```typescript
interface PNGExportOptions {
  scale: 1 | 2 | 3;
  transparent: boolean;
  includeSelection: boolean;
}

const exportToPNG = async (
  objects: CanvasObject[],
  options: PNGExportOptions
): Promise<Blob> => {
  const bounds = calculateBoundingBox(objects);
  const padding = 10;

  const width = (bounds.width + padding * 2) * options.scale;
  const height = (bounds.height + padding * 2) * options.scale;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d')!;

  // Scale for high DPI
  ctx.scale(options.scale, options.scale);

  // Background
  if (!options.transparent) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, bounds.width + padding * 2, bounds.height + padding * 2);
  }

  // Draw objects
  ctx.translate(padding - bounds.x, padding - bounds.y);

  for (const obj of objects.sort((a, b) => a.zIndex - b.zIndex)) {
    await drawObjectForExport(ctx, obj);
  }

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob!), 'image/png');
  });
};
```

**UI (PropertiesPanel.tsx):**
```typescript
const ExportSection = () => {
  const [scale, setScale] = useState<1 | 2 | 3>(1);
  const [transparent, setTransparent] = useState(false);
  const [format, setFormat] = useState<'png' | 'svg' | 'json'>('png');

  const handleExport = async () => {
    const objects = getExportObjects();

    if (format === 'svg') {
      const svg = exportToSVG(objects, { includeBackground: !transparent });
      downloadSVG(svg, 'canvas.svg');
    } else if (format === 'json') {
      const project = exportToJSON(objects, viewport, sessionName);
      downloadJSON(project);
    } else {
      const blob = await exportToPNG(objects, { scale, transparent });
      downloadBlob(blob, `canvas@${scale}x.png`);
    }
  };

  return (
    <div className="export-section">
      <h4>EXPORT</h4>

      <div className="export-format">
        <label>FORMAT</label>
        <div className="format-buttons">
          <button
            className={format === 'png' ? 'active' : ''}
            onClick={() => setFormat('png')}
          >
            PNG
          </button>
          <button
            className={format === 'svg' ? 'active' : ''}
            onClick={() => setFormat('svg')}
          >
            SVG
          </button>
          <button
            className={format === 'json' ? 'active' : ''}
            onClick={() => setFormat('json')}
          >
            JSON
          </button>
        </div>
      </div>

      {format === 'png' && (
        <div className="export-scale">
          <label>SCALE</label>
          <div className="scale-buttons">
            <button
              className={scale === 1 ? 'active' : ''}
              onClick={() => setScale(1)}
            >
              1x
            </button>
            <button
              className={scale === 2 ? 'active' : ''}
              onClick={() => setScale(2)}
            >
              2x
            </button>
            <button
              className={scale === 3 ? 'active' : ''}
              onClick={() => setScale(3)}
            >
              3x
            </button>
          </div>
        </div>
      )}

      {format !== 'json' && (
        <label className="export-checkbox">
          <input
            type="checkbox"
            checked={transparent}
            onChange={e => setTransparent(e.target.checked)}
          />
          Transparent background
        </label>
      )}

      <button className="export-button" onClick={handleExport}>
        {selectedIds.size > 0 ? 'EXPORT SELECTION' : 'EXPORT CANVAS'}
      </button>
    </div>
  );
};
```

**Acceptance Criteria:**
- [ ] 1x, 2x, 3x scale options for PNG
- [ ] Higher scales produce sharper images
- [ ] Scale indicator in filename
- [ ] Format selector (PNG/SVG/JSON)

---

### US-113: Export Specific Frame/Artboard
**Goal:** Export contents of a specific frame without selecting all objects.

**Implementation:**
```typescript
const exportFrame = async (frameId: string, options: ExportOptions) => {
  const store = useCanvasStore.getState();
  const frame = store.objects.get(frameId);

  if (!frame || frame.type !== 'frame') {
    throw new Error('Invalid frame');
  }

  // Find all objects contained within frame bounds
  const frameObjects = Array.from(store.objects.values()).filter(obj => {
    if (obj.id === frameId) return true; // Include frame itself
    return isContainedInFrame(obj, frame);
  });

  // Export with frame as bounding box
  if (options.format === 'svg') {
    return exportToSVG(frameObjects, options);
  } else {
    return exportToPNG(frameObjects, options);
  }
};

const isContainedInFrame = (obj: CanvasObject, frame: CanvasObject): boolean => {
  // Check if object's center is within frame bounds
  const objCenterX = obj.x + obj.width / 2;
  const objCenterY = obj.y + obj.height / 2;

  return (
    objCenterX >= frame.x &&
    objCenterX <= frame.x + frame.width &&
    objCenterY >= frame.y &&
    objCenterY <= frame.y + frame.height
  );
};
```

**UI Enhancement:**
When a frame is selected, show "Export Frame" button:
```typescript
{selectedFrame && (
  <button onClick={() => exportFrame(selectedFrame.id, options)}>
    EXPORT FRAME: {selectedFrame.name}
  </button>
)}
```

**Acceptance Criteria:**
- [ ] Frame selection shows "Export Frame" option
- [ ] Frame export includes all contained objects
- [ ] Frame bounds define export dimensions
- [ ] Frame name used in filename

---

## UI Specifications

### Export Section Styling
```css
.export-section {
  padding: 12px;
  border-top: 1px solid var(--color-border);
}

.export-section h4 {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  margin: 0 0 12px 0;
}

.export-format, .export-scale {
  margin-bottom: 12px;
}

.export-format label, .export-scale label {
  display: block;
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-bottom: 6px;
}

.format-buttons, .scale-buttons {
  display: flex;
  gap: 4px;
}

.format-buttons button, .scale-buttons button {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.format-buttons button.active, .scale-buttons button.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.export-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.export-button {
  width: 100%;
  padding: 10px;
  background: var(--color-accent);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.export-button:hover {
  background: var(--color-accent-hover);
}

.export-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## Testing Checklist
- [ ] PNG export at 1x, 2x, 3x scales
- [ ] SVG export with all shape types
- [ ] JSON export saves complete state
- [ ] JSON import loads project correctly
- [ ] Import warns about overwriting
- [ ] Import generates new IDs
- [ ] Transparent background option works
- [ ] Frame export includes contained objects
- [ ] Export button shows correct label
- [ ] Error handling for failed exports
- [ ] Success toast on export completion

## Dependencies
- PRD-07 (Shape Tools) - for exporting new shapes to SVG
- PRD-06 (Grouping) - for handling group export

## Notes
- SVG export may not perfectly match canvas rendering
- Consider adding PDF export in future
- JSON format versioning allows backward compatibility
- Could add batch export (all frames at once)
