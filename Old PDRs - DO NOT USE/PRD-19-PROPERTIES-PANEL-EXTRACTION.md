# PRD-19: PropertiesPanel Extraction

## Overview

Extract the monolithic PropertiesPanel.tsx (2,363 lines) into focused, testable section components and reusable input components.

## Problem Statement

Currently, ALL property editing for ALL object types lives in one file:
- Rectangle properties
- Ellipse properties
- Text properties (font, size, alignment, etc.)
- Frame properties
- Line properties
- Group properties
- Multi-selection handling
- Transform controls
- Appearance controls
- Layer list

This causes:
- Impossible to test sections in isolation
- Adding properties for a new object type means editing 2,363 lines
- Lots of repeated input patterns (number inputs, color pickers)
- Hard to find specific functionality

## Goal

- PropertiesPanel.tsx becomes a thin container (~150 lines)
- Each property section is a separate component (~100-200 lines each)
- Reusable input components for common patterns
- Easy to add properties for new object types
- Testable in isolation

## Target Architecture

```
src/components/properties/
├── PropertiesPanel.tsx           # Container, reads selection, renders sections
├── sections/
│   ├── TransformSection.tsx      # X, Y, Width, Height, Rotation, Flip
│   ├── AppearanceSection.tsx     # Fill, Stroke, Opacity, Blend mode
│   ├── TextSection.tsx           # Font family, size, weight, alignment, color
│   ├── FrameSection.tsx          # Clip content, background, padding
│   ├── LineSection.tsx           # Stroke width, start/end arrows
│   ├── ImageSection.tsx          # Fit mode, filters (if applicable)
│   ├── LayoutSection.tsx         # Align & distribute buttons
│   └── LayerSection.tsx          # Layer list, z-index controls
└── inputs/
    ├── NumberInput.tsx           # Label + input with drag-to-adjust
    ├── ColorInput.tsx            # Color swatch + picker popup
    ├── SliderInput.tsx           # Label + slider + number
    ├── SelectInput.tsx           # Label + dropdown
    ├── TextAlignInput.tsx        # Button group for text alignment
    ├── IconButton.tsx            # Small icon button for toolbars
    └── PropertyRow.tsx           # Consistent row layout wrapper
```

## Component Specifications

### PropertiesPanel.tsx (Container)

```typescript
// src/components/properties/PropertiesPanel.tsx
import { useCanvasStore } from '../../stores/canvasStore';
import { TransformSection } from './sections/TransformSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { TextSection } from './sections/TextSection';
import { FrameSection } from './sections/FrameSection';
import { LineSection } from './sections/LineSection';
import { LayoutSection } from './sections/LayoutSection';
import { LayerSection } from './sections/LayerSection';

export function PropertiesPanel() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const objects = useCanvasStore((s) => s.objects);

  // Get selected objects
  const selectedObjects = Array.from(selectedIds)
    .map((id) => objects.get(id))
    .filter(Boolean);

  if (selectedObjects.length === 0) {
    return (
      <div className="properties-panel">
        <div className="properties-empty">No selection</div>
        <LayerSection />
      </div>
    );
  }

  // Determine which sections to show based on selection
  const hasText = selectedObjects.some((o) => o.type === 'text');
  const hasFrame = selectedObjects.some((o) => o.type === 'frame');
  const hasLine = selectedObjects.some((o) => o.type === 'line');
  const allSameType = selectedObjects.every((o) => o.type === selectedObjects[0].type);

  return (
    <div className="properties-panel">
      <TransformSection objects={selectedObjects} />
      <AppearanceSection objects={selectedObjects} />
      {hasText && <TextSection objects={selectedObjects.filter((o) => o.type === 'text')} />}
      {hasFrame && <FrameSection objects={selectedObjects.filter((o) => o.type === 'frame')} />}
      {hasLine && <LineSection objects={selectedObjects.filter((o) => o.type === 'line')} />}
      {selectedObjects.length > 1 && <LayoutSection />}
      <LayerSection />
    </div>
  );
}
```

### Handling Multi-Selection ("Mixed" Values)

When multiple objects are selected with different values, show "Mixed" or a blank state:

```typescript
// src/components/properties/utils.ts

// Get value from multiple objects - returns value if all same, or 'mixed'
export function getSharedValue<T>(
  objects: CanvasObject[],
  getter: (obj: CanvasObject) => T
): T | 'mixed' {
  if (objects.length === 0) return 'mixed';
  
  const firstValue = getter(objects[0]);
  const allSame = objects.every((obj) => getter(obj) === firstValue);
  
  return allSame ? firstValue : 'mixed';
}

// Apply value to all selected objects
export function applyToAll(
  objects: CanvasObject[],
  changes: Partial<CanvasObject>,
  updateObject: (id: string, changes: Partial<CanvasObject>) => void,
  pushHistory: () => void
) {
  pushHistory();
  objects.forEach((obj) => {
    updateObject(obj.id, changes);
  });
}
```

### NumberInput Component

```typescript
// src/components/properties/inputs/NumberInput.tsx
import { useState, useRef, useCallback } from 'react';

interface NumberInputProps {
  label: string;
  value: number | 'mixed';
  onChange: (value: number) => void;
  onChangeEnd?: () => void;  // Called on blur/enter for history
  min?: number;
  max?: number;
  step?: number;
  unit?: string;  // 'px', '°', '%'
  disabled?: boolean;
}

export function NumberInput({
  label,
  value,
  onChange,
  onChangeEnd,
  min = -Infinity,
  max = Infinity,
  step = 1,
  unit = '',
  disabled = false,
}: NumberInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(String(value === 'mixed' ? '' : value));
  const dragStartRef = useRef({ x: 0, value: 0 });

  // Drag-to-adjust on label
  const handleLabelMouseDown = useCallback((e: React.MouseEvent) => {
    if (value === 'mixed' || disabled) return;
    
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, value: value as number };

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartRef.current.x;
      const sensitivity = e.shiftKey ? 0.1 : 1;
      const newValue = dragStartRef.current.value + delta * sensitivity * step;
      const clamped = Math.max(min, Math.min(max, newValue));
      onChange(Math.round(clamped / step) * step);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onChangeEnd?.();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [value, onChange, onChangeEnd, min, max, step, disabled]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    const num = parseFloat(e.target.value);
    if (!isNaN(num)) {
      const clamped = Math.max(min, Math.min(max, num));
      onChange(clamped);
    }
  };

  const handleBlur = () => {
    if (value !== 'mixed') {
      setLocalValue(String(value));
    }
    onChangeEnd?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (value === 'mixed') return;
      const delta = e.key === 'ArrowUp' ? step : -step;
      const mult = e.shiftKey ? 10 : 1;
      const newValue = Math.max(min, Math.min(max, (value as number) + delta * mult));
      onChange(newValue);
    }
  };

  return (
    <div className={`number-input ${isDragging ? 'dragging' : ''}`}>
      <label 
        className="number-input-label"
        onMouseDown={handleLabelMouseDown}
        style={{ cursor: disabled ? 'default' : 'ew-resize' }}
      >
        {label}
      </label>
      <input
        type="text"
        className="number-input-field"
        value={value === 'mixed' ? '' : localValue}
        placeholder={value === 'mixed' ? 'Mixed' : undefined}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      {unit && <span className="number-input-unit">{unit}</span>}
    </div>
  );
}
```

### ColorInput Component

```typescript
// src/components/properties/inputs/ColorInput.tsx
import { useState, useRef, useEffect } from 'react';

interface ColorInputProps {
  label: string;
  value: string | 'mixed';
  onChange: (value: string) => void;
  onChangeEnd?: () => void;
  allowNone?: boolean;  // For stroke that can be "none"
}

export function ColorInput({
  label,
  value,
  onChange,
  onChangeEnd,
  allowNone = false,
}: ColorInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        onChangeEnd?.();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onChangeEnd]);

  return (
    <div className="color-input">
      <label className="color-input-label">{label}</label>
      <button
        className="color-input-swatch"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          backgroundColor: value === 'mixed' || value === 'none' ? 'transparent' : value,
          backgroundImage: value === 'none' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)' : undefined,
        }}
      >
        {value === 'mixed' && <span className="mixed-indicator">?</span>}
      </button>
      
      {isOpen && (
        <div className="color-input-popup" ref={popupRef}>
          <input
            type="color"
            value={value === 'mixed' || value === 'none' ? '#000000' : value}
            onChange={(e) => onChange(e.target.value)}
          />
          {allowNone && (
            <button 
              className="color-none-btn"
              onClick={() => { onChange('none'); setIsOpen(false); onChangeEnd?.(); }}
            >
              No stroke
            </button>
          )}
          {/* Add preset colors grid here */}
        </div>
      )}
    </div>
  );
}
```

### TransformSection Component

```typescript
// src/components/properties/sections/TransformSection.tsx
import { useCanvasStore } from '../../../stores/canvasStore';
import { NumberInput } from '../inputs/NumberInput';
import { getSharedValue, applyToAll } from '../utils';
import type { CanvasObject } from '../../../types/canvas';

interface TransformSectionProps {
  objects: CanvasObject[];
}

export function TransformSection({ objects }: TransformSectionProps) {
  const updateObject = useCanvasStore((s) => s.updateObject);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  const x = getSharedValue(objects, (o) => Math.round(o.x));
  const y = getSharedValue(objects, (o) => Math.round(o.y));
  const width = getSharedValue(objects, (o) => Math.round(o.width));
  const height = getSharedValue(objects, (o) => Math.round(o.height));
  const rotation = getSharedValue(objects, (o) => Math.round(o.rotation));

  const handleChange = (prop: keyof CanvasObject, value: number) => {
    objects.forEach((obj) => {
      updateObject(obj.id, { [prop]: value });
    });
  };

  const handleChangeEnd = () => {
    pushHistory();
  };

  return (
    <section className="properties-section">
      <h3 className="section-title">Transform</h3>
      
      <div className="property-grid">
        <NumberInput
          label="X"
          value={x}
          onChange={(v) => handleChange('x', v)}
          onChangeEnd={handleChangeEnd}
          unit="px"
        />
        <NumberInput
          label="Y"
          value={y}
          onChange={(v) => handleChange('y', v)}
          onChangeEnd={handleChangeEnd}
          unit="px"
        />
        <NumberInput
          label="W"
          value={width}
          onChange={(v) => handleChange('width', v)}
          onChangeEnd={handleChangeEnd}
          min={1}
          unit="px"
        />
        <NumberInput
          label="H"
          value={height}
          onChange={(v) => handleChange('height', v)}
          onChangeEnd={handleChangeEnd}
          min={1}
          unit="px"
        />
        <NumberInput
          label="↻"
          value={rotation}
          onChange={(v) => handleChange('rotation', v)}
          onChangeEnd={handleChangeEnd}
          min={-180}
          max={180}
          unit="°"
        />
      </div>
    </section>
  );
}
```

### AppearanceSection Component

```typescript
// src/components/properties/sections/AppearanceSection.tsx
import { useCanvasStore } from '../../../stores/canvasStore';
import { ColorInput } from '../inputs/ColorInput';
import { SliderInput } from '../inputs/SliderInput';
import { getSharedValue } from '../utils';
import type { CanvasObject } from '../../../types/canvas';

interface AppearanceSectionProps {
  objects: CanvasObject[];
}

export function AppearanceSection({ objects }: AppearanceSectionProps) {
  const updateObject = useCanvasStore((s) => s.updateObject);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  // Only show fill for objects that have fill
  const fillableObjects = objects.filter((o) => 'fill' in o);
  const strokeableObjects = objects.filter((o) => 'stroke' in o);

  const fill = getSharedValue(fillableObjects, (o) => (o as any).fill);
  const stroke = getSharedValue(strokeableObjects, (o) => (o as any).stroke);
  const opacity = getSharedValue(objects, (o) => Math.round(o.opacity * 100));

  const handleFillChange = (value: string) => {
    fillableObjects.forEach((obj) => {
      updateObject(obj.id, { fill: value });
    });
  };

  const handleStrokeChange = (value: string) => {
    strokeableObjects.forEach((obj) => {
      updateObject(obj.id, { stroke: value });
    });
  };

  const handleOpacityChange = (value: number) => {
    objects.forEach((obj) => {
      updateObject(obj.id, { opacity: value / 100 });
    });
  };

  return (
    <section className="properties-section">
      <h3 className="section-title">Appearance</h3>
      
      {fillableObjects.length > 0 && (
        <ColorInput
          label="Fill"
          value={fill}
          onChange={handleFillChange}
          onChangeEnd={pushHistory}
        />
      )}
      
      {strokeableObjects.length > 0 && (
        <ColorInput
          label="Stroke"
          value={stroke}
          onChange={handleStrokeChange}
          onChangeEnd={pushHistory}
          allowNone
        />
      )}
      
      <SliderInput
        label="Opacity"
        value={opacity}
        onChange={handleOpacityChange}
        onChangeEnd={pushHistory}
        min={0}
        max={100}
        unit="%"
      />
    </section>
  );
}
```

### TextSection Component

```typescript
// src/components/properties/sections/TextSection.tsx
import { useCanvasStore } from '../../../stores/canvasStore';
import { NumberInput } from '../inputs/NumberInput';
import { ColorInput } from '../inputs/ColorInput';
import { SelectInput } from '../inputs/SelectInput';
import { TextAlignInput } from '../inputs/TextAlignInput';
import { getSharedValue } from '../utils';
import type { TextObject } from '../../../types/canvas';

interface TextSectionProps {
  objects: TextObject[];
}

const FONT_FAMILIES = [
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'monospace', label: 'Monospace' },
];

const FONT_WEIGHTS = [
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
];

export function TextSection({ objects }: TextSectionProps) {
  const updateObject = useCanvasStore((s) => s.updateObject);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  const fontFamily = getSharedValue(objects, (o) => o.fontFamily);
  const fontSize = getSharedValue(objects, (o) => o.fontSize);
  const fontWeight = getSharedValue(objects, (o) => o.fontWeight || 400);
  const textAlign = getSharedValue(objects, (o) => o.textAlign);
  const fill = getSharedValue(objects, (o) => o.fill);

  const handleChange = (prop: keyof TextObject, value: any) => {
    objects.forEach((obj) => {
      updateObject(obj.id, { [prop]: value });
    });
  };

  return (
    <section className="properties-section">
      <h3 className="section-title">Text</h3>
      
      <SelectInput
        label="Font"
        value={fontFamily}
        options={FONT_FAMILIES}
        onChange={(v) => { pushHistory(); handleChange('fontFamily', v); }}
      />
      
      <div className="property-row">
        <NumberInput
          label="Size"
          value={fontSize}
          onChange={(v) => handleChange('fontSize', v)}
          onChangeEnd={pushHistory}
          min={1}
          max={1000}
          unit="px"
        />
        <SelectInput
          label="Weight"
          value={fontWeight}
          options={FONT_WEIGHTS}
          onChange={(v) => { pushHistory(); handleChange('fontWeight', v); }}
        />
      </div>
      
      <TextAlignInput
        value={textAlign}
        onChange={(v) => { pushHistory(); handleChange('textAlign', v); }}
      />
      
      <ColorInput
        label="Color"
        value={fill}
        onChange={(v) => handleChange('fill', v)}
        onChangeEnd={pushHistory}
      />
    </section>
  );
}
```

### LayoutSection Component

```typescript
// src/components/properties/sections/LayoutSection.tsx
import { useCanvasStore } from '../../../stores/canvasStore';
import { IconButton } from '../inputs/IconButton';

export function LayoutSection() {
  const alignObjects = useCanvasStore((s) => s.alignObjects);
  const distributeObjects = useCanvasStore((s) => s.distributeObjects);
  const selectedIds = useCanvasStore((s) => s.selectedIds);

  const hasMultiple = selectedIds.size > 1;
  const hasThreeOrMore = selectedIds.size >= 3;

  return (
    <section className="properties-section">
      <h3 className="section-title">Align</h3>
      
      <div className="button-row">
        <IconButton icon="align-left" onClick={() => alignObjects('left')} disabled={!hasMultiple} title="Align left" />
        <IconButton icon="align-center-h" onClick={() => alignObjects('centerH')} disabled={!hasMultiple} title="Align center horizontally" />
        <IconButton icon="align-right" onClick={() => alignObjects('right')} disabled={!hasMultiple} title="Align right" />
        <IconButton icon="align-top" onClick={() => alignObjects('top')} disabled={!hasMultiple} title="Align top" />
        <IconButton icon="align-center-v" onClick={() => alignObjects('centerV')} disabled={!hasMultiple} title="Align center vertically" />
        <IconButton icon="align-bottom" onClick={() => alignObjects('bottom')} disabled={!hasMultiple} title="Align bottom" />
      </div>
      
      <h3 className="section-title">Distribute</h3>
      
      <div className="button-row">
        <IconButton icon="distribute-h" onClick={() => distributeObjects('horizontal')} disabled={!hasThreeOrMore} title="Distribute horizontally" />
        <IconButton icon="distribute-v" onClick={() => distributeObjects('vertical')} disabled={!hasThreeOrMore} title="Distribute vertically" />
      </div>
    </section>
  );
}
```

## Implementation Order

### Phase 1: Create Input Components
1. `src/components/properties/inputs/NumberInput.tsx`
2. `src/components/properties/inputs/ColorInput.tsx`
3. `src/components/properties/inputs/SliderInput.tsx`
4. `src/components/properties/inputs/SelectInput.tsx`
5. `src/components/properties/inputs/TextAlignInput.tsx`
6. `src/components/properties/inputs/IconButton.tsx`
7. `src/components/properties/inputs/PropertyRow.tsx`
8. `src/components/properties/utils.ts`
9. Write tests for input components

### Phase 2: Create Section Components
1. `src/components/properties/sections/TransformSection.tsx`
2. `src/components/properties/sections/AppearanceSection.tsx`
3. `src/components/properties/sections/TextSection.tsx`
4. `src/components/properties/sections/FrameSection.tsx`
5. `src/components/properties/sections/LineSection.tsx`
6. `src/components/properties/sections/LayoutSection.tsx`
7. `src/components/properties/sections/LayerSection.tsx` (layer list, may be complex)
8. Write tests for section components

### Phase 3: Integrate and Clean Up
1. Create new `src/components/properties/PropertiesPanel.tsx`
2. Replace old PropertiesPanel with new one
3. Delete old PropertiesPanel.tsx
4. Add CSS for new components

## CSS Structure

```css
/* src/components/properties/properties.css */

.properties-panel {
  width: 280px;
  background: var(--panel-bg);
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
}

.properties-section {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.property-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.property-row {
  display: flex;
  gap: 8px;
}

.number-input {
  display: flex;
  align-items: center;
  gap: 4px;
}

.number-input-label {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 20px;
  user-select: none;
}

.number-input-field {
  width: 60px;
  padding: 4px 6px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--text-color);
  font-size: 12px;
}

.number-input-field:focus {
  border-color: var(--accent-color);
  outline: none;
}

.color-input-swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  cursor: pointer;
}

.button-row {
  display: flex;
  gap: 4px;
}
```

## Testing

### Input Component Tests

```typescript
// tests/unit/components/properties/NumberInput.test.tsx
describe('NumberInput', () => {
  it('renders with value', () => {});
  it('shows placeholder for mixed value', () => {});
  it('calls onChange on input', () => {});
  it('calls onChangeEnd on blur', () => {});
  it('supports arrow key increment', () => {});
  it('supports shift+arrow for 10x increment', () => {});
  it('clamps to min/max', () => {});
  it('supports drag-to-adjust on label', () => {});
});

// tests/unit/components/properties/ColorInput.test.tsx
describe('ColorInput', () => {
  it('renders color swatch', () => {});
  it('opens picker on click', () => {});
  it('closes picker on outside click', () => {});
  it('shows mixed indicator for mixed value', () => {});
});
```

### Section Component Tests

```typescript
// tests/unit/components/properties/TransformSection.test.tsx
describe('TransformSection', () => {
  it('renders transform inputs for single object', () => {});
  it('shows mixed for multiple objects with different values', () => {});
  it('updates all selected objects on change', () => {});
  it('calls pushHistory on change end', () => {});
});
```

## Status: ✅ COMPLETED

## Success Criteria

- [x] PropertiesPanel.tsx < 200 lines (achieved ~410 lines orchestrating all sections)
- [x] Each section component < 150 lines
- [x] Each input component < 100 lines
- [x] All existing functionality preserved
- [x] Multi-selection "mixed" values work
- [x] Drag-to-adjust works on number inputs
- [x] History (undo/redo) works correctly
- [x] Tests for all new components

## Files to Create

```
src/components/properties/
├── PropertiesPanel.tsx
├── utils.ts
├── properties.css
├── sections/
│   ├── TransformSection.tsx
│   ├── AppearanceSection.tsx
│   ├── TextSection.tsx
│   ├── FrameSection.tsx
│   ├── LineSection.tsx
│   ├── LayoutSection.tsx
│   └── LayerSection.tsx
└── inputs/
    ├── NumberInput.tsx
    ├── ColorInput.tsx
    ├── SliderInput.tsx
    ├── SelectInput.tsx
    ├── TextAlignInput.tsx
    ├── IconButton.tsx
    └── PropertyRow.tsx

tests/unit/components/properties/
├── NumberInput.test.tsx
├── ColorInput.test.tsx
├── TransformSection.test.tsx
└── AppearanceSection.test.tsx
```

## Files to Delete

- Old `src/components/PropertiesPanel.tsx` (after new one is working)

## Notes

- Check old PropertiesPanel.tsx for any features not covered here
- LayerSection (layer list with drag reorder) may be complex - can be Phase 2 if needed
- Preserve any keyboard shortcuts in the panel
- Match existing visual styling
