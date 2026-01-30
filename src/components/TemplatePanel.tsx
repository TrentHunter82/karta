import { useState, useRef, useEffect } from 'react';
import { useTemplateStore, PRESET_TEMPLATES, type Template, type TemplateObject } from '../stores/templateStore';
import { useCanvasStore } from '../stores/canvasStore';
import { CANVAS_WIDTH_OFFSET, CANVAS_HEIGHT_OFFSET, TEMPLATE_PANEL_WIDTH } from '../constants/layout';
import './TemplatePanel.css';

// Calculate bounding box from template objects
function calculateBoundingBox(objects: TemplateObject[]) {
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
}

// Simplified thumbnail renderer
function TemplateThumbnail({ objects }: { objects: TemplateObject[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const size = 80;
    const bounds = calculateBoundingBox(objects);
    const padding = 8;
    const maxDim = Math.max(bounds.width, bounds.height);
    const scale = maxDim > 0 ? (size - padding * 2) / maxDim : 1;

    ctx.clearRect(0, 0, size, size);
    ctx.save();

    // Center the content
    const offsetX = (size - bounds.width * scale) / 2 - bounds.x * scale;
    const offsetY = (size - bounds.height * scale) / 2 - bounds.y * scale;
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw simplified objects
    objects.forEach(obj => {
      ctx.save();
      ctx.globalAlpha = obj.opacity ?? 1;

      const fill = obj.fill || '#4a4a4a';
      const stroke = obj.stroke;
      const strokeWidth = obj.strokeWidth || 0;

      switch (obj.type) {
        case 'rectangle': {
          const r = (obj as { cornerRadius?: number }).cornerRadius || 0;
          ctx.fillStyle = fill;
          if (r > 0) {
            ctx.beginPath();
            ctx.roundRect(obj.x, obj.y, obj.width, obj.height, r);
            ctx.fill();
            if (stroke && strokeWidth) {
              ctx.strokeStyle = stroke;
              ctx.lineWidth = strokeWidth;
              ctx.stroke();
            }
          } else {
            ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
            if (stroke && strokeWidth) {
              ctx.strokeStyle = stroke;
              ctx.lineWidth = strokeWidth;
              ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
            }
          }
          break;
        }
        case 'ellipse': {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.ellipse(
            obj.x + obj.width / 2,
            obj.y + obj.height / 2,
            obj.width / 2,
            obj.height / 2,
            0, 0, Math.PI * 2
          );
          ctx.fill();
          if (stroke && strokeWidth) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
          }
          break;
        }
        case 'text': {
          ctx.fillStyle = fill;
          ctx.font = `${obj.fontSize || 12}px Inter, sans-serif`;
          ctx.textBaseline = 'top';
          ctx.fillText(obj.text || '', obj.x, obj.y);
          break;
        }
        case 'line':
        case 'arrow': {
          ctx.strokeStyle = stroke || '#ffffff';
          ctx.lineWidth = strokeWidth || 2;
          ctx.beginPath();
          ctx.moveTo(obj.x + (obj.x1 || 0), obj.y + (obj.y1 || 0));
          ctx.lineTo(obj.x + (obj.x2 || obj.width), obj.y + (obj.y2 || 0));
          ctx.stroke();
          break;
        }
        case 'polygon': {
          const sides = obj.sides || 6;
          const cx = obj.x + obj.width / 2;
          const cy = obj.y + obj.height / 2;
          const r = Math.min(obj.width, obj.height) / 2;

          ctx.fillStyle = fill;
          ctx.beginPath();
          for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'star': {
          const pts = obj.points || 5;
          const inner = obj.innerRadius || 0.5;
          const cx = obj.x + obj.width / 2;
          const cy = obj.y + obj.height / 2;
          const outerR = Math.min(obj.width, obj.height) / 2;
          const innerR = outerR * inner;

          ctx.fillStyle = fill;
          ctx.beginPath();
          for (let i = 0; i < pts * 2; i++) {
            const angle = (i * Math.PI / pts) - Math.PI / 2;
            const rad = i % 2 === 0 ? outerR : innerR;
            const px = cx + rad * Math.cos(angle);
            const py = cy + rad * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
      }

      ctx.restore();
    });

    ctx.restore();
  }, [objects]);

  return <canvas ref={canvasRef} width={80} height={80} className="template-canvas" />;
}

export function TemplatePanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { userTemplates, removeTemplate, showTemplatePanel, setShowTemplatePanel } = useTemplateStore();
  const addObject = useCanvasStore((state) => state.addObject);
  const setSelection = useCanvasStore((state) => state.setSelection);
  const pushHistory = useCanvasStore((state) => state.pushHistory);
  const getNextZIndex = useCanvasStore((state) => state.getNextZIndex);
  const viewport = useCanvasStore((state) => state.viewport);

  if (!showTemplatePanel) return null;

  // Combine presets and user templates
  const allTemplates: Template[] = [...PRESET_TEMPLATES, ...userTemplates];

  // Get unique categories
  const categories = [...new Set(allTemplates.map(t => t.category))];

  // Filter templates
  const filteredTemplates = allTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !activeCategory || template.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleUseTemplate = (template: Template) => {
    // Calculate center of viewport
    const canvasWidth = window.innerWidth - CANVAS_WIDTH_OFFSET - TEMPLATE_PANEL_WIDTH;
    const canvasHeight = window.innerHeight - CANVAS_HEIGHT_OFFSET;
    const centerX = -viewport.x + canvasWidth / 2 / viewport.zoom;
    const centerY = -viewport.y + canvasHeight / 2 / viewport.zoom;

    // Calculate template bounds
    const bounds = calculateBoundingBox(template.objects);

    pushHistory();

    // Create new objects with unique IDs positioned at center
    const newObjectIds: string[] = [];
    template.objects.forEach(obj => {
      const newId = crypto.randomUUID();
      newObjectIds.push(newId);

      // Build the new object with required fields
      // Type assertion is safe because TemplateObject mirrors CanvasObject properties
      const newObject = {
        ...obj,
        id: newId,
        x: obj.x + centerX - bounds.width / 2 - bounds.x,
        y: obj.y + centerY - bounds.height / 2 - bounds.y,
        zIndex: getNextZIndex()
      } as unknown as CanvasObject;

      addObject(newObject);
    });

    setSelection(newObjectIds);
  };

  const handleDragStart = (e: React.DragEvent, template: Template) => {
    e.dataTransfer.setData('application/karta-template', JSON.stringify(template));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="template-panel">
      <div className="template-panel-header">
        <div className="template-panel-title-row">
          <h3>Templates</h3>
          <button
            className="template-panel-close"
            onClick={() => setShowTemplatePanel(false)}
            title="Close template panel"
          >
            ×
          </button>
        </div>
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="template-search"
        />
      </div>

      <div className="template-categories">
        <button
          className={`category-btn ${!activeCategory ? 'active' : ''}`}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            className={`category-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="template-grid">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            className="template-item"
            onClick={() => handleUseTemplate(template)}
            draggable
            onDragStart={e => handleDragStart(e, template)}
            title={`Click to add "${template.name}" to canvas`}
          >
            <div className="template-thumbnail">
              <TemplateThumbnail objects={template.objects} />
            </div>
            <span className="template-name">{template.name}</span>

            {/* Delete button for user templates only */}
            {!template.isPreset && (
              <button
                className="template-delete"
                onClick={e => {
                  e.stopPropagation();
                  removeTemplate(template.id);
                }}
                title="Delete template"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {filteredTemplates.length === 0 && (
          <div className="template-empty">
            {searchQuery ? 'No templates match your search' : 'No templates in this category'}
          </div>
        )}
      </div>
    </div>
  );
}
