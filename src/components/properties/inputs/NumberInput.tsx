import { useState, useRef, useCallback, useEffect } from 'react';

interface NumberInputProps {
  label: string;
  value: number | 'mixed';
  onChange: (value: number) => void;
  onChangeEnd?: () => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
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
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(''); // Only used while editing
  const inputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef({ x: 0, value: 0 });

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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
    setEditValue(e.target.value);
    const num = parseFloat(e.target.value);
    if (!isNaN(num)) {
      const clamped = Math.max(min, Math.min(max, num));
      onChange(clamped);
    }
  };

  const handleClick = () => {
    if (disabled) return;
    setEditValue(value === 'mixed' ? '' : String(value));
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (value !== 'mixed') {
      setEditValue(String(value));
    }
    onChangeEnd?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === 'Escape') {
      setEditValue(value === 'mixed' ? '' : String(value));
      setIsEditing(false);
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
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="number-input-field"
          value={editValue}
          placeholder={value === 'mixed' ? 'Mixed' : undefined}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
      ) : (
        <span
          className={`number-input-value ${!disabled ? 'editable' : ''} ${value === 'mixed' ? 'mixed' : ''}`}
          onClick={handleClick}
        >
          {value === 'mixed' ? 'Mixed' : `${value}${unit}`}
        </span>
      )}
    </div>
  );
}
