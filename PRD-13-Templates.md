# PRD-13: Templates & Presets

## Overview
Add a template system for saving and reusing common shapes, components, and layouts.

**Priority:** LOW
**Estimated Complexity:** Medium
**Files Affected:** New `TemplatePanel.tsx`, `TemplatePanel.css`, `templateStore.ts`, `Toolbar.tsx`

---

## Background
Users often need to create similar elements repeatedly (buttons, cards, icons). A template system allows saving and reusing designs, improving productivity.

---

## User Stories

### US-105: Preset Shapes Library
**Goal:** Provide built-in preset shapes and components.

**Preset Categories:**
```typescript
interface PresetTemplate {
  id: string;
  name: string;
  category: string;
  thumbnail: string; // Base64 or generated
  objects: CanvasObject[];
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'basic-button',
    name: 'Button',
    category: 'UI Components',
    thumbnail: '',
    objects: [
      {
        type: 'rectangle',
        x: 0, y: 0, width: 120, height: 40,
        fill: '#0066ff',
        cornerRadius: 8
      },
      {
        type: 'text',
        x: 30, y: 12, width: 60, height: 20,
        text: 'Button',
        fontSize: 14,
        fill: '#ffffff',
        textAlign: 'center'
      }
    ]
  },
  {
    id: 'card',
    name: 'Card',
    category: 'UI Components',
    objects: [
      {
        type: 'rectangle',
        x: 0, y: 0, width: 200, height: 150,
        fill: '#2a2a2a',
        cornerRadius: 12
      },
      {
        type: 'text',
        x: 16, y: 16, width: 168, height: 24,
        text: 'Card Title',
        fontSize: 18,
        fontWeight: 600,
        fill: '#ffffff'
      },
      {
        type: 'text',
        x: 16, y: 48, width: 168, height: 80,
        text: 'Card description goes here...',
        fontSize: 14,
        fill: '#888888'
      }
    ]
  },
  // More presets...
  {
    id: 'circle-icon',
    name: 'Circle Icon',
    category: 'Icons',
    objects: [{ type: 'ellipse', x: 0, y: 0, width: 48, height: 48, fill: '#4a4a4a' }]
  },
  {
    id: 'badge',
    name: 'Badge',
    category: 'UI Components',
    objects: [
      { type: 'rectangle', x: 0, y: 0, width: 60, height: 24, fill: '#22c55e', cornerRadius: 12 },
      { type: 'text', x: 8, y: 4, width: 44, height: 16, text: 'Badge', fontSize: 12, fill: '#ffffff', textAlign: 'center' }
    ]
  },
  {
    id: 'input-field',
    name: 'Input Field',
    category: 'UI Components',
    objects: [
      { type: 'rectangle', x: 0, y: 0, width: 200, height: 40, fill: '#1a1a1a', stroke: '#3a3a3a', strokeWidth: 1, cornerRadius: 6 },
      { type: 'text', x: 12, y: 12, width: 176, height: 16, text: 'Placeholder...', fontSize: 14, fill: '#666666' }
    ]
  },
  // Shapes
  {
    id: 'arrow-right',
    name: 'Arrow Right',
    category: 'Shapes',
    objects: [{ type: 'arrow', x: 0, y: 0, width: 100, height: 2, x1: 0, y1: 0, x2: 100, y2: 0, stroke: '#ffffff', strokeWidth: 2, arrowEnd: true }]
  },
  {
    id: 'star-5',
    name: '5-Point Star',
    category: 'Shapes',
    objects: [{ type: 'star', x: 0, y: 0, width: 48, height: 48, points: 5, innerRadius: 0.5, fill: '#fbbf24' }]
  }
];
```

**Acceptance Criteria:**
- [ ] Built-in presets available
- [ ] Presets organized by category
- [ ] Presets show thumbnail previews
- [ ] Clicking preset adds to canvas

---

### US-106: Save Selection as Template
**Goal:** Allow users to save their own templates from selected objects.

**Store (new file: src/stores/templateStore.ts):**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CanvasObject } from '../types/canvas';

interface UserTemplate {
  id: string;
  name: string;
  category: string;
  objects: CanvasObject[];
  createdAt: number;
}

interface TemplateState {
  userTemplates: UserTemplate[];
  addTemplate: (template: Omit<UserTemplate, 'id' | 'createdAt'>) => void;
  removeTemplate: (id: string) => void;
  renameTemplate: (id: string, name: string) => void;
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set) => ({
      userTemplates: [],

      addTemplate: (template) => {
        const newTemplate: UserTemplate = {
          ...template,
          id: crypto.randomUUID(),
          createdAt: Date.now()
        };

        set((state) => ({
          userTemplates: [...state.userTemplates, newTemplate]
        }));
      },

      removeTemplate: (id) => {
        set((state) => ({
          userTemplates: state.userTemplates.filter(t => t.id !== id)
        }));
      },

      renameTemplate: (id, name) => {
        set((state) => ({
          userTemplates: state.userTemplates.map(t =>
            t.id === id ? { ...t, name } : t
          )
        }));
      }
    }),
    {
      name: 'karta-templates'
    }
  )
);
```

**Save Template Dialog:**
```typescript
const SaveTemplateDialog = ({ objects, onClose }: Props) => {
  const [name, setName] = useState('My Template');
  const [category, setCategory] = useState('My Templates');
  const addTemplate = useTemplateStore(state => state.addTemplate);

  const handleSave = () => {
    // Normalize object positions relative to group origin
    const bounds = calculateBoundingBox(objects);
    const normalizedObjects = objects.map(obj => ({
      ...obj,
      x: obj.x - bounds.x,
      y: obj.y - bounds.y
    }));

    addTemplate({
      name,
      category,
      objects: normalizedObjects
    });

    onClose();
  };

  return (
    <div className="dialog-overlay">
      <div className="save-template-dialog">
        <h3>Save as Template</h3>

        <label>
          Name
          <input value={name} onChange={e => setName(e.target.value)} />
        </label>

        <label>
          Category
          <input value={category} onChange={e => setCategory(e.target.value)} />
        </label>

        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()}>Save</button>
        </div>
      </div>
    </div>
  );
};
```

**Trigger:** Right-click context menu "Save as Template..." or Ctrl+Shift+S

**Acceptance Criteria:**
- [ ] Can save selected objects as template
- [ ] Template name and category are customizable
- [ ] Template positions are normalized
- [ ] Templates persist to localStorage

---

### US-107: Template Browser Sidebar
**Goal:** Add a panel for browsing and using templates.

**Component (new file: src/components/TemplatePanel.tsx):**
```typescript
import { useState } from 'react';
import { useTemplateStore } from '../stores/templateStore';
import { useCanvasStore } from '../stores/canvasStore';
import { PRESET_TEMPLATES } from '../data/presets';
import './TemplatePanel.css';

export const TemplatePanel = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { userTemplates, removeTemplate } = useTemplateStore();
  const { addObjects, viewport } = useCanvasStore();

  // Combine presets and user templates
  const allTemplates = [...PRESET_TEMPLATES, ...userTemplates];

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
    const centerX = -viewport.x + (window.innerWidth - 260) / 2 / viewport.zoom;
    const centerY = -viewport.y + (window.innerHeight - 80) / 2 / viewport.zoom;

    // Calculate template bounds
    const bounds = calculateBoundingBox(template.objects);

    // Create new objects with unique IDs positioned at center
    const newObjects = template.objects.map(obj => ({
      ...obj,
      id: crypto.randomUUID(),
      x: obj.x + centerX - bounds.width / 2,
      y: obj.y + centerY - bounds.height / 2,
      zIndex: useCanvasStore.getState().getNextZIndex()
    }));

    addObjects(newObjects);
  };

  return (
    <div className="template-panel">
      <div className="template-panel-header">
        <h3>Templates</h3>
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="template-categories">
        <button
          className={!activeCategory ? 'active' : ''}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            className={activeCategory === cat ? 'active' : ''}
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
          >
            <div className="template-thumbnail">
              <TemplateThumbnail objects={template.objects} />
            </div>
            <span className="template-name">{template.name}</span>

            {/* Delete button for user templates */}
            {'createdAt' in template && (
              <button
                className="template-delete"
                onClick={e => {
                  e.stopPropagation();
                  removeTemplate(template.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Acceptance Criteria:**
- [ ] Template panel shows all templates
- [ ] Can search templates by name
- [ ] Can filter by category
- [ ] Click on template adds it to canvas center
- [ ] User templates show delete button
- [ ] Preset templates cannot be deleted

---

### US-108: Drag Templates onto Canvas
**Goal:** Drag templates from panel directly to desired canvas position.

**Drag Implementation:**
```typescript
// In TemplatePanel.tsx
const handleDragStart = (e: React.DragEvent, template: Template) => {
  e.dataTransfer.setData('application/karta-template', JSON.stringify(template));
  e.dataTransfer.effectAllowed = 'copy';

  // Create drag preview
  const preview = createTemplatePreview(template);
  e.dataTransfer.setDragImage(preview, preview.width / 2, preview.height / 2);
};

// In Canvas.tsx
const handleTemplateDrop = (e: React.DragEvent) => {
  const templateData = e.dataTransfer.getData('application/karta-template');
  if (!templateData) return;

  const template = JSON.parse(templateData);
  const canvasPos = screenToCanvas(e.clientX, e.clientY);

  // Calculate template bounds
  const bounds = calculateBoundingBox(template.objects);

  // Create new objects centered on drop position
  const newObjects = template.objects.map(obj => ({
    ...obj,
    id: crypto.randomUUID(),
    x: obj.x + canvasPos.x - bounds.width / 2,
    y: obj.y + canvasPos.y - bounds.height / 2,
    zIndex: getNextZIndex()
  }));

  pushHistory();
  addObjects(newObjects);
  setSelection(new Set(newObjects.map(obj => obj.id)));
};

// Add to canvas event handlers
<div
  onDrop={handleDrop}
  onDragOver={e => {
    if (e.dataTransfer.types.includes('application/karta-template')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }}
>
```

**Acceptance Criteria:**
- [ ] Can drag template from panel
- [ ] Template shows preview while dragging
- [ ] Dropping places template at cursor position
- [ ] Dropped template objects are selected

---

## UI Specifications

### Template Panel Styling
```css
.template-panel {
  width: 240px;
  height: 100%;
  background: var(--color-bg-secondary);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
}

.template-panel-header {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
}

.template-panel-header h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--color-text-primary);
}

.template-panel-header input {
  width: 100%;
  padding: 8px 10px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-primary);
  font-size: 13px;
}

.template-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.template-categories button {
  padding: 4px 8px;
  font-size: 11px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.template-categories button.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.template-grid {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.template-item {
  position: relative;
  aspect-ratio: 1;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.template-item:hover {
  border-color: var(--color-accent);
}

.template-thumbnail {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

.template-name {
  padding: 4px 8px;
  font-size: 10px;
  color: var(--color-text-secondary);
  text-align: center;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
}

.template-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 50%;
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s;
}

.template-item:hover .template-delete {
  opacity: 1;
}
```

### Thumbnail Generation
```typescript
const TemplateThumbnail = ({ objects }: { objects: CanvasObject[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const size = 80;
    const bounds = calculateBoundingBox(objects);
    const scale = Math.min(
      (size - 16) / bounds.width,
      (size - 16) / bounds.height
    );

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(
      size / 2 - bounds.width * scale / 2 - bounds.x * scale,
      size / 2 - bounds.height * scale / 2 - bounds.y * scale
    );
    ctx.scale(scale, scale);

    objects.forEach(obj => drawObjectSimplified(ctx, obj));

    ctx.restore();
  }, [objects]);

  return <canvas ref={canvasRef} width={80} height={80} />;
};
```

---

## Testing Checklist
- [ ] Preset templates display correctly
- [ ] Clicking template adds it to canvas
- [ ] Save selection as template works
- [ ] User templates persist to localStorage
- [ ] Can delete user templates
- [ ] Cannot delete preset templates
- [ ] Search filters templates
- [ ] Category filter works
- [ ] Drag and drop works
- [ ] Templates placed at correct position
- [ ] Template panel toggle works
- [ ] Thumbnail generation works

## Dependencies
- PRD-07 (Shape Tools) - for shape type templates
- PRD-08 (Text Formatting) - for text styling in templates

## Notes
- Consider cloud sync for templates in future
- Could add import/export templates as JSON
- Template sharing between users would require server
- Consider adding template versioning
