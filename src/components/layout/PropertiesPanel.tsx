import { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import './PropertiesPanel.css';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="section">
      <button
        className="section-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="section-title">{title}</span>
        <span className={`section-toggle ${isOpen ? 'open' : ''}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </span>
      </button>
      {isOpen && <div className="section-content">{children}</div>}
    </div>
  );
}

interface PropertyRowProps {
  label: string;
  value: string;
}

function PropertyRow({ label, value }: PropertyRowProps) {
  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <span className="property-value">{value}</span>
    </div>
  );
}

interface EditablePropertyRowProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function EditablePropertyRow({ label, value, disabled = false, onChange }: EditablePropertyRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const originalValueRef = useRef(value);

  const handleClick = () => {
    if (disabled || value === '---') return;
    originalValueRef.current = value;
    setEditValue(value);
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitChange = () => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue)) {
      onChange(Math.round(numValue));
    }
    setIsEditing(false);
  };

  const revertChange = () => {
    setEditValue(originalValueRef.current);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // Prevent tool shortcuts
    if (e.key === 'Enter') {
      commitChange();
    } else if (e.key === 'Escape') {
      revertChange();
    }
  };

  const handleBlur = () => {
    commitChange();
  };

  // When not editing, display the prop value directly (no sync needed)
  // When editing, display the local editValue
  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="property-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      ) : (
        <span
          className={`property-value ${!disabled && value !== '---' ? 'editable' : ''}`}
          onClick={handleClick}
        >
          {value}
        </span>
      )}
    </div>
  );
}

interface RotationControlProps {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

function RotationControl({ value, disabled, onChange }: RotationControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const originalValueRef = useRef(value);
  const dragStartAngleRef = useRef(0);
  const dragStartValueRef = useRef(0);

  const handleInputClick = () => {
    if (disabled) return;
    originalValueRef.current = value;
    setEditValue(Math.round(value).toString());
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitChange = () => {
    let numValue = parseFloat(editValue);
    if (!isNaN(numValue)) {
      // Normalize to 0-360
      numValue = ((numValue % 360) + 360) % 360;
      onChange(Math.round(numValue));
    }
    setIsEditing(false);
  };

  const revertChange = () => {
    setEditValue(originalValueRef.current.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      commitChange();
    } else if (e.key === 'Escape') {
      revertChange();
    }
  };

  const handleBlur = () => {
    commitChange();
  };

  // Calculate angle from center of dial to mouse position
  const getAngleFromMouse = useCallback((clientX: number, clientY: number): number => {
    if (!dialRef.current) return 0;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    // atan2 returns angle with 0 at right, we want 0 at top
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    // Normalize to 0-360
    angle = ((angle % 360) + 360) % 360;
    return angle;
  }, []);

  const handleDialMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartAngleRef.current = getAngleFromMouse(e.clientX, e.clientY);
    dragStartValueRef.current = value;
  }, [disabled, value, getAngleFromMouse]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentAngle = getAngleFromMouse(e.clientX, e.clientY);
      let deltaAngle = currentAngle - dragStartAngleRef.current;

      // Handle wrapping around 0/360
      if (deltaAngle > 180) deltaAngle -= 360;
      if (deltaAngle < -180) deltaAngle += 360;

      let newValue = dragStartValueRef.current + deltaAngle;
      // Normalize to 0-360
      newValue = ((newValue % 360) + 360) % 360;
      onChange(Math.round(newValue));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, getAngleFromMouse, onChange]);

  const displayValue = disabled ? '---' : `${Math.round(value)}°`;
  // Dial indicator angle: rotate from top (0°)
  const indicatorStyle = disabled ? {} : { transform: `rotate(${value}deg)` };

  return (
    <div className="rotation-control">
      <div className="property-row">
        <span className="property-label">ROTATION</span>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="property-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        ) : (
          <span
            className={`property-value ${!disabled ? 'editable' : ''}`}
            onClick={handleInputClick}
          >
            {displayValue}
          </span>
        )}
      </div>
      <div
        ref={dialRef}
        className={`rotation-dial ${disabled ? 'disabled' : ''} ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleDialMouseDown}
      >
        <div className="rotation-dial-track" />
        <div className="rotation-dial-indicator" style={indicatorStyle}>
          <div className="rotation-dial-handle" />
        </div>
        <div className="rotation-dial-center" />
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [constrainProportions, setConstrainProportions] = useState(true);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const objects = useCanvasStore((state) => state.objects);
  const updateObject = useCanvasStore((state) => state.updateObject);

  const hasSelection = selectedIds.size > 0;
  const selectedObjects = Array.from(selectedIds).map((id) => objects.get(id)).filter(Boolean);
  const singleSelection = selectedObjects.length === 1 ? selectedObjects[0] : null;

  // Check if multiple objects have same value for a property
  const getMultiSelectValue = (getter: (obj: NonNullable<typeof singleSelection>) => number): string => {
    if (!hasSelection || selectedObjects.length === 0) return '---';
    if (selectedObjects.length === 1) {
      return Math.round(getter(selectedObjects[0]!)).toString();
    }
    // Multiple selection - check if all have same value
    const firstValue = Math.round(getter(selectedObjects[0]!));
    const allSame = selectedObjects.every((obj) => Math.round(getter(obj!)) === firstValue);
    return allSame ? firstValue.toString() : '---';
  };

  // Get display values - show "---" when nothing selected, or actual values when single selection
  const getDisplayValue = (getter: () => string): string => {
    if (!hasSelection) return '---';
    if (!singleSelection) return '---'; // Multiple selection shows "---" for now
    return getter();
  };

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
          {/* Panel Header */}
          <div className="panel-header">
            <span className="panel-title">PROPERTIES</span>
            <button className="settings-button" aria-label="Settings">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0-1a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
                <path d="M13.5 5.5h-1.12a5.5 5.5 0 0 0-.55-1.33l.79-.79a.5.5 0 0 0 0-.71l-.71-.71a.5.5 0 0 0-.71 0l-.79.79a5.5 5.5 0 0 0-1.33-.55V1.08a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5V2.2a5.5 5.5 0 0 0-1.33.55l-.79-.79a.5.5 0 0 0-.71 0l-.71.71a.5.5 0 0 0 0 .71l.79.79A5.5 5.5 0 0 0 2.7 5.5H1.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1.2a5.5 5.5 0 0 0 .55 1.33l-.79.79a.5.5 0 0 0 0 .71l.71.71a.5.5 0 0 0 .71 0l.79-.79a5.5 5.5 0 0 0 1.33.55v1.12a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1.12a5.5 5.5 0 0 0 1.33-.55l.79.79a.5.5 0 0 0 .71 0l.71-.71a.5.5 0 0 0 0-.71l-.79-.79a5.5 5.5 0 0 0 .55-1.33h1.12a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5z" />
              </svg>
            </button>
          </div>

          {/* Transform Section */}
          <CollapsibleSection title="TRANSFORM">
            <EditablePropertyRow
              label="X-POS"
              value={getMultiSelectValue((obj) => obj.x)}
              disabled={!hasSelection}
              onChange={(value) => {
                if (singleSelection) {
                  updateObject(singleSelection.id, { x: value });
                }
              }}
            />
            <EditablePropertyRow
              label="Y-POS"
              value={getMultiSelectValue((obj) => obj.y)}
              disabled={!hasSelection}
              onChange={(value) => {
                if (singleSelection) {
                  updateObject(singleSelection.id, { y: value });
                }
              }}
            />
            <div className="size-row">
              <EditablePropertyRow
                label="WIDTH"
                value={getMultiSelectValue((obj) => obj.width)}
                disabled={!hasSelection}
                onChange={(value) => {
                  if (singleSelection) {
                    if (constrainProportions && singleSelection.width > 0) {
                      const aspectRatio = singleSelection.height / singleSelection.width;
                      updateObject(singleSelection.id, {
                        width: value,
                        height: Math.round(value * aspectRatio)
                      });
                    } else {
                      updateObject(singleSelection.id, { width: value });
                    }
                  }
                }}
              />
              <button
                className={`constrain-toggle ${constrainProportions ? 'active' : ''}`}
                onClick={() => setConstrainProportions(!constrainProportions)}
                title={constrainProportions ? 'Constrain proportions: ON' : 'Constrain proportions: OFF'}
                aria-label="Toggle constrain proportions"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  {constrainProportions ? (
                    <>
                      <path d="M3 4V2.5C3 1.67 3.67 1 4.5 1h3C8.33 1 9 1.67 9 2.5V4" />
                      <path d="M3 8v1.5c0 .83.67 1.5 1.5 1.5h3c.83 0 1.5-.67 1.5-1.5V8" />
                      <path d="M6 4v4" />
                    </>
                  ) : (
                    <>
                      <path d="M3 4V2.5C3 1.67 3.67 1 4.5 1h3C8.33 1 9 1.67 9 2.5V4" />
                      <path d="M3 8v1.5c0 .83.67 1.5 1.5 1.5h3c.83 0 1.5-.67 1.5-1.5V8" />
                    </>
                  )}
                </svg>
              </button>
              <EditablePropertyRow
                label="HEIGHT"
                value={getMultiSelectValue((obj) => obj.height)}
                disabled={!hasSelection}
                onChange={(value) => {
                  if (singleSelection) {
                    if (constrainProportions && singleSelection.height > 0) {
                      const aspectRatio = singleSelection.width / singleSelection.height;
                      updateObject(singleSelection.id, {
                        height: value,
                        width: Math.round(value * aspectRatio)
                      });
                    } else {
                      updateObject(singleSelection.id, { height: value });
                    }
                  }
                }}
              />
            </div>
            <RotationControl
              value={singleSelection?.rotation ?? 0}
              disabled={!hasSelection}
              onChange={(value) => {
                if (singleSelection) {
                  updateObject(singleSelection.id, { rotation: value });
                }
              }}
            />
          </CollapsibleSection>

          {/* Appearance Section */}
          <CollapsibleSection title="APPEARANCE">
            <PropertyRow
              label="OPACITY"
              value={getDisplayValue(() => `${Math.round((singleSelection!.opacity ?? 1) * 100)}%`)}
            />
            <PropertyRow
              label="FILL"
              value={getDisplayValue(() => singleSelection!.fill ?? '---')}
            />
            <PropertyRow
              label="STROKE"
              value={getDisplayValue(() => singleSelection!.stroke ?? '---')}
            />
          </CollapsibleSection>

          {/* Hierarchy Section */}
          <CollapsibleSection title="HIERARCHY">
            <div className="hierarchy-info">
              {objects.size > 0 ? `${objects.size} Items` : 'Canvas Empty'}
            </div>
            <div className="hierarchy-list">
              {Array.from(objects.values()).map((obj) => (
                <div
                  key={obj.id}
                  className={`hierarchy-item ${selectedIds.has(obj.id) ? 'selected' : ''}`}
                >
                  <span className="hierarchy-icon">
                    {obj.type === 'rectangle' && '▢'}
                    {obj.type === 'ellipse' && '○'}
                    {obj.type === 'text' && 'T'}
                    {obj.type === 'frame' && '⬚'}
                    {obj.type === 'path' && '✎'}
                    {obj.type === 'image' && '🖼'}
                    {obj.type === 'video' && '▶'}
                  </span>
                  <span className="hierarchy-name">
                    {obj.type === 'text' && 'text' in obj
                      ? (obj as { text: string }).text.slice(0, 20) || 'Text'
                      : obj.type === 'frame' && 'name' in obj
                        ? (obj as { name: string }).name
                        : obj.type.charAt(0).toUpperCase() + obj.type.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}
    </aside>
  );
}
