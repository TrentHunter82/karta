# PRD-08: Text Formatting

## Overview
Add rich text formatting capabilities including font selection, styling (bold/italic/underline), alignment, and line height control.

**Priority:** MEDIUM
**Estimated Complexity:** Medium
**Files Affected:** `types/canvas.ts`, `Canvas.tsx`, `PropertiesPanel.tsx`, `PropertiesPanel.css`

---

## Background
Currently, text objects have minimal formatting: only font family, font size, and color (via fill). Standard design tools offer comprehensive text formatting options.

---

## User Stories

### US-079: Font Family Picker
**Goal:** Allow users to select from available system fonts.

**Type Update (types/canvas.ts):**
```typescript
interface TextObject extends BaseObject {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;    // NEW: 100-900, default 400
  fontStyle: 'normal' | 'italic';  // NEW
  textDecoration: 'none' | 'underline' | 'line-through';  // NEW
  textAlign: 'left' | 'center' | 'right';  // NEW
  lineHeight: number;    // NEW: multiplier, default 1.2
  fill: string;
}
```

**Font List:**
```typescript
const FONT_FAMILIES = [
  { name: 'System UI', value: 'system-ui, -apple-system, sans-serif' },
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Helvetica', value: 'Helvetica, sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Times New Roman', value: '"Times New Roman", serif' },
  { name: 'Courier New', value: '"Courier New", monospace' },
  { name: 'Monaco', value: 'Monaco, monospace' },
  { name: 'Comic Sans MS', value: '"Comic Sans MS", cursive' },
];
```

**Properties Panel UI:**
```typescript
const FontFamilyPicker = ({ value, onChange }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="font-family-picker">
      <button className="font-picker-button" onClick={() => setIsOpen(!isOpen)}>
        <span style={{ fontFamily: value }}>{getFontDisplayName(value)}</span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="font-picker-dropdown">
          {FONT_FAMILIES.map(font => (
            <button
              key={font.value}
              className="font-option"
              style={{ fontFamily: font.value }}
              onClick={() => {
                onChange(font.value);
                setIsOpen(false);
              }}
            >
              {font.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

**Acceptance Criteria:**
- [ ] Font dropdown shows available fonts
- [ ] Font preview in dropdown shows actual font
- [ ] Selected font applies to text object
- [ ] Font syncs via Yjs

---

### US-080: Font Size Control
**Goal:** Editable font size with common presets.

**Properties Panel UI:**
```typescript
const FontSizeControl = ({ value, onChange }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const presets = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];

  return (
    <div className="font-size-control">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={1}
        max={999}
      />
      <button onClick={() => setIsOpen(!isOpen)}>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="font-size-dropdown">
          {presets.map(size => (
            <button key={size} onClick={() => { onChange(size); setIsOpen(false); }}>
              {size}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

**Acceptance Criteria:**
- [ ] Can type custom font size
- [ ] Dropdown shows common presets
- [ ] Minimum 1px, no maximum
- [ ] Size updates in real-time

---

### US-081: Bold/Italic/Underline Toggles
**Goal:** Toggle text styling with buttons.

**Properties Panel UI:**
```typescript
const TextStyleButtons = ({ obj, updateObject }: Props) => {
  const isBold = obj.fontWeight >= 600;
  const isItalic = obj.fontStyle === 'italic';
  const isUnderline = obj.textDecoration === 'underline';

  return (
    <div className="text-style-buttons">
      <button
        className={`style-btn ${isBold ? 'active' : ''}`}
        onClick={() => updateObject(obj.id, {
          fontWeight: isBold ? 400 : 700
        })}
        title="Bold (Ctrl+B)"
      >
        <BoldIcon />
      </button>

      <button
        className={`style-btn ${isItalic ? 'active' : ''}`}
        onClick={() => updateObject(obj.id, {
          fontStyle: isItalic ? 'normal' : 'italic'
        })}
        title="Italic (Ctrl+I)"
      >
        <ItalicIcon />
      </button>

      <button
        className={`style-btn ${isUnderline ? 'active' : ''}`}
        onClick={() => updateObject(obj.id, {
          textDecoration: isUnderline ? 'none' : 'underline'
        })}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon />
      </button>
    </div>
  );
};
```

**Keyboard Shortcuts (when text is selected or editing):**
- Ctrl+B - Toggle bold
- Ctrl+I - Toggle italic
- Ctrl+U - Toggle underline

**Acceptance Criteria:**
- [ ] Bold button toggles font weight (400/700)
- [ ] Italic button toggles font style
- [ ] Underline button toggles text decoration
- [ ] Keyboard shortcuts work when text selected
- [ ] Buttons show active state when style is applied

---

### US-082: Text Alignment
**Goal:** Align text left, center, or right within its bounding box.

**Properties Panel UI:**
```typescript
const TextAlignButtons = ({ obj, updateObject }: Props) => {
  return (
    <div className="text-align-buttons">
      <button
        className={`align-btn ${obj.textAlign === 'left' ? 'active' : ''}`}
        onClick={() => updateObject(obj.id, { textAlign: 'left' })}
        title="Align Left"
      >
        <AlignLeftIcon />
      </button>

      <button
        className={`align-btn ${obj.textAlign === 'center' ? 'active' : ''}`}
        onClick={() => updateObject(obj.id, { textAlign: 'center' })}
        title="Align Center"
      >
        <AlignCenterIcon />
      </button>

      <button
        className={`align-btn ${obj.textAlign === 'right' ? 'active' : ''}`}
        onClick={() => updateObject(obj.id, { textAlign: 'right' })}
        title="Align Right"
      >
        <AlignRightIcon />
      </button>
    </div>
  );
};
```

**Canvas Rendering Update:**
```typescript
const drawTextObject = (obj: TextObject) => {
  ctx.save();

  // Apply transforms
  ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
  ctx.rotate((obj.rotation || 0) * Math.PI / 180);

  // Set text properties
  ctx.font = `${obj.fontStyle || 'normal'} ${obj.fontWeight || 400} ${obj.fontSize}px ${obj.fontFamily}`;
  ctx.fillStyle = obj.fill || '#ffffff';
  ctx.globalAlpha = obj.opacity;

  // Calculate text position based on alignment
  let textX = -obj.width / 2;
  ctx.textAlign = 'left';

  if (obj.textAlign === 'center') {
    textX = 0;
    ctx.textAlign = 'center';
  } else if (obj.textAlign === 'right') {
    textX = obj.width / 2;
    ctx.textAlign = 'right';
  }

  // Handle underline manually
  if (obj.textDecoration === 'underline') {
    const metrics = ctx.measureText(obj.text);
    const underlineY = -obj.height / 2 + obj.fontSize;
    ctx.beginPath();
    ctx.moveTo(textX - (obj.textAlign === 'center' ? metrics.width / 2 : 0), underlineY + 2);
    ctx.lineTo(textX + (obj.textAlign === 'center' ? metrics.width / 2 : metrics.width), underlineY + 2);
    ctx.strokeStyle = obj.fill || '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillText(obj.text, textX, -obj.height / 2 + obj.fontSize);

  ctx.restore();
};
```

**Acceptance Criteria:**
- [ ] Three alignment buttons (left, center, right)
- [ ] Text renders aligned within bounding box
- [ ] Alignment syncs via Yjs

---

### US-083: Text Color Control
**Goal:** Separate text color control (already exists as fill).

**Note:** Text color is already controlled via the Fill property. This story ensures the UI is clear.

**Enhancement:**
- Rename "FILL" to "TEXT COLOR" when text object is selected
- Or add separate "TEXT COLOR" label pointing to same property

**Acceptance Criteria:**
- [ ] Label shows "TEXT COLOR" for text objects
- [ ] Color picker works the same as fill

---

### US-084: Line Height Control
**Goal:** Adjust spacing between lines of multi-line text.

**Properties Panel UI:**
```typescript
const LineHeightControl = ({ value, onChange }: Props) => {
  const presets = [1, 1.2, 1.5, 2];

  return (
    <div className="line-height-control">
      <label>LINE HEIGHT</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={0.5}
        max={5}
        step={0.1}
      />
      <div className="line-height-presets">
        {presets.map(lh => (
          <button
            key={lh}
            className={value === lh ? 'active' : ''}
            onClick={() => onChange(lh)}
          >
            {lh}
          </button>
        ))}
      </div>
    </div>
  );
};
```

**Multi-line Text Rendering:**
```typescript
const drawMultilineText = (obj: TextObject) => {
  const lines = obj.text.split('\n');
  const lineHeight = obj.fontSize * (obj.lineHeight || 1.2);

  lines.forEach((line, index) => {
    const y = -obj.height / 2 + obj.fontSize + (index * lineHeight);
    ctx.fillText(line, textX, y);
  });
};
```

**Acceptance Criteria:**
- [ ] Line height adjustable via input
- [ ] Preset buttons for common values
- [ ] Multi-line text respects line height
- [ ] Line height syncs via Yjs

---

## UI Specifications

### Text Section Layout
```
┌─────────────────────────────────────────┐
│ TEXT                                 [−]│
├─────────────────────────────────────────┤
│ FONT     [Inter              ▾]         │
│ SIZE     [16 ▾]  [B] [I] [U]           │
│ ALIGN    [≡] [≡] [≡]                    │
│ HEIGHT   [1.2]  [1] [1.2] [1.5] [2]    │
│ COLOR    [■ #ffffff]                    │
└─────────────────────────────────────────┘
```

### CSS Styles
```css
.text-section {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
}

.font-family-picker {
  position: relative;
}

.font-picker-button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-primary);
  cursor: pointer;
}

.font-picker-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  margin-top: 2px;
  z-index: 100;
}

.font-option {
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
}

.font-option:hover {
  background: var(--color-bg-tertiary);
}

.text-style-buttons, .text-align-buttons {
  display: flex;
  gap: 2px;
}

.style-btn, .align-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 4px;
  cursor: pointer;
}

.style-btn:hover, .align-btn:hover {
  background: var(--color-bg-tertiary);
}

.style-btn.active, .align-btn.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.font-size-control {
  display: flex;
  gap: 2px;
}

.font-size-control input {
  width: 50px;
  padding: 4px 8px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 4px 0 0 4px;
  color: var(--color-text-primary);
}

.line-height-presets {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.line-height-presets button {
  flex: 1;
  padding: 4px;
  font-size: 11px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 4px;
  cursor: pointer;
}

.line-height-presets button.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}
```

---

## Testing Checklist
- [ ] Font family picker shows all fonts
- [ ] Font preview displays correctly
- [ ] Font size input and presets work
- [ ] Bold/Italic/Underline toggles work
- [ ] Keyboard shortcuts (Ctrl+B/I/U) work when text selected
- [ ] Text alignment renders correctly
- [ ] Line height affects multi-line text
- [ ] All properties sync via Yjs
- [ ] Undo/redo works for text formatting changes
- [ ] Text editing overlay respects formatting
- [ ] Export includes text formatting

## Dependencies
- None (enhances existing text functionality)

## Notes
- Rich text (different formatting within same text object) is out of scope
- Web fonts loading could be added in future iteration
- Consider adding letter spacing and paragraph spacing
