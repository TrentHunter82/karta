import { useState, useRef, useCallback, useEffect } from 'react';

interface SliderInputProps {
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

export function SliderInput({
  label,
  value,
  onChange,
  onChangeEnd,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  disabled = false,
}: SliderInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value === 'mixed' ? '' : String(value));
  const sliderRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const originalValueRef = useRef(value === 'mixed' ? min : value);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const getValueFromMouse = useCallback((clientX: number): number => {
    if (!sliderRef.current) return min;
    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawValue = min + percentage * (max - min);
    return Math.round(rawValue / step) * step;
  }, [min, max, step]);

  const handleSliderMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    const newValue = getValueFromMouse(e.clientX);
    onChange(newValue);
  }, [disabled, onChange, getValueFromMouse]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newValue = getValueFromMouse(e.clientX);
      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onChangeEnd?.();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, getValueFromMouse, onChange, onChangeEnd]);

  const handleInputClick = () => {
    if (disabled) return;
    originalValueRef.current = value === 'mixed' ? min : value;
    setEditValue(value === 'mixed' ? '' : String(value));
    setIsEditing(true);
  };

  const commitChange = () => {
    let numValue = parseFloat(editValue);
    if (!isNaN(numValue)) {
      numValue = Math.max(min, Math.min(max, numValue));
      onChange(numValue);
    }
    setIsEditing(false);
    onChangeEnd?.();
  };

  const revertChange = () => {
    setEditValue(String(originalValueRef.current));
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

  const displayValue = disabled ? '---' : value === 'mixed' ? 'Mixed' : `${value}${unit}`;
  const percentage = value === 'mixed' ? 50 : ((value - min) / (max - min)) * 100;

  return (
    <div className="slider-input">
      <div className="slider-input-header">
        <label className="slider-input-label">{label}</label>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="slider-input-field"
            value={editValue}
            placeholder={value === 'mixed' ? 'Mixed' : undefined}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        ) : (
          <span
            className={`slider-input-value ${!disabled ? 'editable' : ''} ${value === 'mixed' ? 'mixed' : ''}`}
            onClick={handleInputClick}
          >
            {displayValue}
          </span>
        )}
      </div>
      <div
        ref={sliderRef}
        className={`slider-input-track-container ${disabled ? 'disabled' : ''} ${isDragging ? 'dragging' : ''} ${value === 'mixed' ? 'mixed' : ''}`}
        onMouseDown={handleSliderMouseDown}
      >
        <div className="slider-input-track" />
        <div
          className="slider-input-fill"
          style={{ width: disabled ? '0%' : `${percentage}%` }}
        />
        <div
          className="slider-input-handle"
          style={{ left: disabled ? '0%' : `${percentage}%` }}
        />
      </div>
    </div>
  );
}
