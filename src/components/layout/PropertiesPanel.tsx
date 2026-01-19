import { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useToastStore } from '../../stores/toastStore';
import type { CanvasObject, ImageObject, VideoObject, GroupObject, TextObject } from '../../types/canvas';
import { measureTextDimensions } from '../../utils/textMeasurement';
import './PropertiesPanel.css';

// Image cache for export (reusing same approach as Canvas.tsx)
const exportImageCache = new Map<string, HTMLImageElement>();
const exportVideoThumbnailCache = new Map<string, HTMLCanvasElement>();

// Load an image and cache it
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

// Load video thumbnail
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

// Draw a single object to export canvas (simplified version without viewport transform)
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

      // Handle multi-line text
      const lines = textObj.text.split('\n');
      const lineHeightPx = fontSize * (textObj.lineHeight || 1.2);

      lines.forEach((line, index) => {
        const y = index * lineHeightPx;
        ctx.fillText(line, textX, y);

        // Draw text decoration (underline or line-through)
        if (textObj.textDecoration && textObj.textDecoration !== 'none') {
          const metrics = ctx.measureText(line);
          const lineWidth = metrics.width;
          let decorationX = textX;

          // Adjust starting X based on text alignment
          if (textObj.textAlign === 'center') {
            decorationX = textX - lineWidth / 2;
          } else if (textObj.textAlign === 'right') {
            decorationX = textX - lineWidth;
          }

          ctx.strokeStyle = textObj.fill || '#ffffff';
          ctx.lineWidth = Math.max(1, fontSize / 12);
          ctx.beginPath();

          if (textObj.textDecoration === 'underline') {
            const underlineY = y + fontSize * 0.9;
            ctx.moveTo(decorationX, underlineY);
            ctx.lineTo(decorationX + lineWidth, underlineY);
          } else if (textObj.textDecoration === 'line-through') {
            const strikeY = y + fontSize * 0.5;
            ctx.moveTo(decorationX, strikeY);
            ctx.lineTo(decorationX + lineWidth, strikeY);
          }
          ctx.stroke();
        }
      });
      break;
    }
    case 'frame':
      ctx.fillStyle = obj.fill || '#2a2a2a';
      ctx.fillRect(0, 0, obj.width, obj.height);
      ctx.strokeStyle = obj.stroke || '#3a3a3a';
      ctx.lineWidth = obj.strokeWidth || 1;
      ctx.strokeRect(0, 0, obj.width, obj.height);
      // Draw frame label
      ctx.fillStyle = '#888888';
      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(obj.name, 0, -4);
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
        // If image fails to load, draw placeholder
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
        // If thumbnail fails to load, draw placeholder
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, obj.width, obj.height);
      }
      break;
    }
  }

  ctx.restore();
}

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

interface EditablePropertyRowProps {
  label: string;
  value: string;
  disabled?: boolean;
  isMixed?: boolean;
  onChange: (value: number) => void;
  onChangeStart?: () => void;
}

function EditablePropertyRow({ label, value, disabled = false, isMixed = false, onChange, onChangeStart }: EditablePropertyRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const originalValueRef = useRef(value);

  const handleClick = () => {
    if (disabled || value === '---') return;
    originalValueRef.current = value;
    // For mixed values, start with empty input so user can type new value
    setEditValue(isMixed ? '' : value);
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
      // Push history before committing change
      onChangeStart?.();
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
  const displayValue = isMixed ? 'Mixed' : value;
  const isEditable = !disabled && value !== '---';

  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="property-input"
          value={editValue}
          placeholder={isMixed ? 'Mixed' : undefined}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      ) : (
        <span
          className={`property-value ${isEditable ? 'editable' : ''} ${isMixed ? 'mixed' : ''}`}
          onClick={handleClick}
        >
          {displayValue}
        </span>
      )}
    </div>
  );
}

interface OpacityControlProps {
  value: number;
  disabled: boolean;
  isMixed?: boolean;
  onChange: (value: number) => void;
  onChangeStart?: () => void;
}

function OpacityControl({ value, disabled, isMixed = false, onChange, onChangeStart }: OpacityControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState((value * 100).toString());
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const originalValueRef = useRef(value);

  const handleInputClick = () => {
    if (disabled) return;
    originalValueRef.current = value;
    setEditValue(isMixed ? '' : Math.round(value * 100).toString());
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
      // Clamp to 0-100 and convert to 0-1
      numValue = Math.max(0, Math.min(100, numValue)) / 100;
      // Push history before committing change
      onChangeStart?.();
      onChange(numValue);
    }
    setIsEditing(false);
  };

  const revertChange = () => {
    setEditValue((originalValueRef.current * 100).toString());
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

  // Calculate opacity from mouse position on slider
  const getOpacityFromMouse = useCallback((clientX: number): number => {
    if (!sliderRef.current) return 0;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage;
  }, []);

  const handleSliderMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    // Push history before starting drag
    onChangeStart?.();
    setIsDragging(true);
    const newValue = getOpacityFromMouse(e.clientX);
    onChange(newValue);
  }, [disabled, onChange, getOpacityFromMouse, onChangeStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newValue = getOpacityFromMouse(e.clientX);
      onChange(newValue);
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
  }, [isDragging, getOpacityFromMouse, onChange]);

  const displayValue = disabled ? '---' : isMixed ? 'Mixed' : `${Math.round(value * 100)}%`;
  const sliderPercentage = value * 100;

  return (
    <div className="opacity-control">
      <div className="property-row">
        <span className="property-label">OPACITY</span>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="property-input"
            value={editValue}
            placeholder={isMixed ? 'Mixed' : undefined}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        ) : (
          <span
            className={`property-value ${!disabled ? 'editable' : ''} ${isMixed ? 'mixed' : ''}`}
            onClick={handleInputClick}
          >
            {displayValue}
          </span>
        )}
      </div>
      <div
        ref={sliderRef}
        className={`opacity-slider ${disabled ? 'disabled' : ''} ${isDragging ? 'dragging' : ''} ${isMixed ? 'mixed' : ''}`}
        onMouseDown={handleSliderMouseDown}
      >
        <div className="opacity-slider-track" />
        <div
          className="opacity-slider-fill"
          style={{ width: disabled ? '0%' : `${sliderPercentage}%` }}
        />
        <div
          className="opacity-slider-handle"
          style={{ left: disabled ? '0%' : `${sliderPercentage}%` }}
        />
      </div>
    </div>
  );
}

interface StrokeControlProps {
  color: string | undefined;
  width: number | undefined;
  enabled: boolean;
  disabled: boolean;
  isColorMixed?: boolean;
  isWidthMixed?: boolean;
  isIndeterminate?: boolean;
  onColorChange: (value: string) => void;
  onWidthChange: (value: number) => void;
  onEnabledChange: (enabled: boolean) => void;
  onChangeStart?: () => void;
}

function StrokeControl({ color, width, enabled, disabled, isColorMixed = false, isWidthMixed = false, isIndeterminate = false, onColorChange, onWidthChange, onEnabledChange, onChangeStart }: StrokeControlProps) {
  const [isEditingColor, setIsEditingColor] = useState(false);
  const [editColorValue, setEditColorValue] = useState(color ?? '#ffffff');
  const [isEditingWidth, setIsEditingWidth] = useState(false);
  const [editWidthValue, setEditWidthValue] = useState((width ?? 2).toString());
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const widthInputRef = useRef<HTMLInputElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const originalColorRef = useRef(color ?? '#ffffff');
  const originalWidthRef = useRef(width ?? 2);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Handle indeterminate checkbox state
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleColorInputClick = () => {
    if (disabled) return;
    originalColorRef.current = color ?? '#ffffff';
    setEditColorValue(isColorMixed ? '' : (color ?? '#ffffff'));
    setIsEditingColor(true);
  };

  const handleWidthInputClick = () => {
    if (disabled) return;
    originalWidthRef.current = width ?? 2;
    setEditWidthValue(isWidthMixed ? '' : (width ?? 2).toString());
    setIsEditingWidth(true);
  };

  useEffect(() => {
    if (isEditingColor && colorInputRef.current) {
      colorInputRef.current.focus();
      colorInputRef.current.select();
    }
  }, [isEditingColor]);

  useEffect(() => {
    if (isEditingWidth && widthInputRef.current) {
      widthInputRef.current.focus();
      widthInputRef.current.select();
    }
  }, [isEditingWidth]);

  // Close color picker when clicking outside
  useEffect(() => {
    if (!showColorPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

  const commitColorChange = () => {
    const hexRegex = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
    let cleanValue = editColorValue.trim();
    if (!cleanValue.startsWith('#')) {
      cleanValue = '#' + cleanValue;
    }
    if (hexRegex.test(cleanValue)) {
      // Normalize to 6 digit hex
      if (cleanValue.length === 4) {
        cleanValue = '#' + cleanValue[1] + cleanValue[1] + cleanValue[2] + cleanValue[2] + cleanValue[3] + cleanValue[3];
      }
      // Push history before committing change
      onChangeStart?.();
      onColorChange(cleanValue.toLowerCase());
    }
    setIsEditingColor(false);
  };

  const revertColorChange = () => {
    setEditColorValue(originalColorRef.current);
    setIsEditingColor(false);
  };

  const commitWidthChange = () => {
    const numValue = parseFloat(editWidthValue);
    if (!isNaN(numValue) && numValue > 0) {
      // Push history before committing change
      onChangeStart?.();
      onWidthChange(Math.max(1, Math.round(numValue)));
    }
    setIsEditingWidth(false);
  };

  const revertWidthChange = () => {
    setEditWidthValue(originalWidthRef.current.toString());
    setIsEditingWidth(false);
  };

  const handleColorKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      commitColorChange();
    } else if (e.key === 'Escape') {
      revertColorChange();
    }
  };

  const handleWidthKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      commitWidthChange();
    } else if (e.key === 'Escape') {
      revertWidthChange();
    }
  };

  const handleSwatchClick = () => {
    if (disabled) return;
    // Push history when opening color picker
    if (!showColorPicker) {
      onChangeStart?.();
    }
    setShowColorPicker(!showColorPicker);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeStart?.();
    onEnabledChange(e.target.checked);
  };

  const displayColor = disabled ? '---' : isColorMixed ? 'Mixed' : (color ?? '#ffffff');
  const swatchColor = disabled ? '#ffffff' : (color ?? '#ffffff');
  const displayWidth = disabled ? '---' : isWidthMixed ? 'Mixed' : `${width ?? 2}px`;

  return (
    <div className="stroke-control">
      <div className="property-row stroke-row">
        <div className="stroke-left">
          <input
            ref={checkboxRef}
            type="checkbox"
            className={`stroke-checkbox ${isIndeterminate ? 'indeterminate' : ''}`}
            checked={!disabled && enabled}
            disabled={disabled}
            onChange={handleCheckboxChange}
          />
          <span className="property-label">STROKE</span>
        </div>
        <div className="stroke-right">
          <button
            className={`color-swatch ${disabled ? 'disabled' : ''} ${isColorMixed ? 'mixed' : ''}`}
            style={{ backgroundColor: isColorMixed ? undefined : swatchColor }}
            onClick={handleSwatchClick}
            disabled={disabled}
            aria-label="Open stroke color picker"
          />
          {isEditingColor ? (
            <input
              ref={colorInputRef}
              type="text"
              className="property-input hex-input"
              value={editColorValue}
              placeholder={isColorMixed ? 'Mixed' : undefined}
              onChange={(e) => setEditColorValue(e.target.value)}
              onKeyDown={handleColorKeyDown}
              onBlur={commitColorChange}
            />
          ) : (
            <span
              className={`property-value ${!disabled ? 'editable' : ''} ${isColorMixed ? 'mixed' : ''}`}
              onClick={handleColorInputClick}
            >
              {displayColor}
            </span>
          )}
        </div>
      </div>
      <div className="property-row stroke-width-row">
        <span className="property-label">WIDTH</span>
        {isEditingWidth ? (
          <input
            ref={widthInputRef}
            type="text"
            className="property-input stroke-width-input"
            value={editWidthValue}
            placeholder={isWidthMixed ? 'Mixed' : undefined}
            onChange={(e) => setEditWidthValue(e.target.value)}
            onKeyDown={handleWidthKeyDown}
            onBlur={commitWidthChange}
          />
        ) : (
          <span
            className={`property-value ${!disabled ? 'editable' : ''} ${isWidthMixed ? 'mixed' : ''}`}
            onClick={handleWidthInputClick}
          >
            {displayWidth}
          </span>
        )}
      </div>
      {showColorPicker && !disabled && (
        <div className="color-picker-wrapper" ref={colorPickerRef}>
          <ColorPicker
            color={color ?? '#ffffff'}
            onChange={onColorChange}
          />
        </div>
      )}
    </div>
  );
}

interface FillControlProps {
  value: string | undefined;
  enabled: boolean;
  disabled: boolean;
  isMixed?: boolean;
  isIndeterminate?: boolean;
  onColorChange: (value: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onChangeStart?: () => void;
}

function FillControl({ value, enabled, disabled, isMixed = false, isIndeterminate = false, onColorChange, onEnabledChange, onChangeStart }: FillControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? '#4a4a4a');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const originalValueRef = useRef(value ?? '#4a4a4a');
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Handle indeterminate checkbox state
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleInputClick = () => {
    if (disabled) return;
    originalValueRef.current = value ?? '#4a4a4a';
    setEditValue(isMixed ? '' : (value ?? '#4a4a4a'));
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Close color picker when clicking outside
  useEffect(() => {
    if (!showColorPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

  const commitChange = () => {
    const hexRegex = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
    let cleanValue = editValue.trim();
    if (!cleanValue.startsWith('#')) {
      cleanValue = '#' + cleanValue;
    }
    if (hexRegex.test(cleanValue)) {
      // Normalize to 6 digit hex
      if (cleanValue.length === 4) {
        cleanValue = '#' + cleanValue[1] + cleanValue[1] + cleanValue[2] + cleanValue[2] + cleanValue[3] + cleanValue[3];
      }
      // Push history before committing change
      onChangeStart?.();
      onColorChange(cleanValue.toLowerCase());
    }
    setIsEditing(false);
  };

  const revertChange = () => {
    setEditValue(originalValueRef.current);
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

  const handleSwatchClick = () => {
    if (disabled) return;
    // Push history when opening color picker
    if (!showColorPicker) {
      onChangeStart?.();
    }
    setShowColorPicker(!showColorPicker);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeStart?.();
    onEnabledChange(e.target.checked);
  };

  const displayValue = disabled ? '---' : isMixed ? 'Mixed' : (value ?? '#4a4a4a');
  const swatchColor = disabled ? '#4a4a4a' : (value ?? '#4a4a4a');

  return (
    <div className="fill-control">
      <div className="property-row fill-row">
        <div className="fill-left">
          <input
            ref={checkboxRef}
            type="checkbox"
            className={`fill-checkbox ${isIndeterminate ? 'indeterminate' : ''}`}
            checked={!disabled && enabled}
            disabled={disabled}
            onChange={handleCheckboxChange}
          />
          <span className="property-label">FILL</span>
        </div>
        <div className="fill-right">
          <button
            className={`color-swatch ${disabled ? 'disabled' : ''} ${isMixed ? 'mixed' : ''}`}
            style={{ backgroundColor: isMixed ? undefined : swatchColor }}
            onClick={handleSwatchClick}
            disabled={disabled}
            aria-label="Open color picker"
          />
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="property-input hex-input"
              value={editValue}
              placeholder={isMixed ? 'Mixed' : undefined}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
            />
          ) : (
            <span
              className={`property-value ${!disabled ? 'editable' : ''} ${isMixed ? 'mixed' : ''}`}
              onClick={handleInputClick}
            >
              {displayValue}
            </span>
          )}
        </div>
      </div>
      {showColorPicker && !disabled && (
        <div className="color-picker-wrapper" ref={colorPickerRef}>
          <ColorPicker
            color={value ?? '#4a4a4a'}
            onChange={onColorChange}
          />
        </div>
      )}
    </div>
  );
}

// Helper functions for HSV <-> RGB conversion
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s * 100, v * 100];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h /= 360;
  s /= 100;
  v /= 100;
  let r = 0, g = 0, b = 0;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [74, 74, 74]; // default gray
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [isDraggingSV, setIsDraggingSV] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Parse current color to HSV
  const rgb = hexToRgb(color);
  const [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2]);

  const updateFromSV = useCallback((clientX: number, clientY: number) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const newS = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const newV = Math.max(0, Math.min(100, 100 - ((clientY - rect.top) / rect.height) * 100));
    const [r, g, b] = hsvToRgb(h, newS, newV);
    onChange(rgbToHex(r, g, b));
  }, [h, onChange]);

  const updateFromHue = useCallback((clientX: number) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const newH = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
    const [r, g, b] = hsvToRgb(newH, s, v);
    onChange(rgbToHex(r, g, b));
  }, [s, v, onChange]);

  const handleSVMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSV(true);
    updateFromSV(e.clientX, e.clientY);
  }, [updateFromSV]);

  const handleHueMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingHue(true);
    updateFromHue(e.clientX);
  }, [updateFromHue]);

  useEffect(() => {
    if (!isDraggingSV) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateFromSV(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      setIsDraggingSV(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSV, updateFromSV]);

  useEffect(() => {
    if (!isDraggingHue) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateFromHue(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDraggingHue(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingHue, updateFromHue]);

  // Get the pure hue color for the SV square background
  const [hueR, hueG, hueB] = hsvToRgb(h, 100, 100);
  const hueColor = rgbToHex(hueR, hueG, hueB);

  return (
    <div className="color-picker">
      {/* Saturation/Brightness square */}
      <div
        ref={svRef}
        className="color-picker-sv"
        style={{ backgroundColor: hueColor }}
        onMouseDown={handleSVMouseDown}
      >
        <div className="color-picker-sv-white" />
        <div className="color-picker-sv-black" />
        <div
          className="color-picker-sv-handle"
          style={{
            left: `${s}%`,
            top: `${100 - v}%`
          }}
        />
      </div>
      {/* Hue slider */}
      <div
        ref={hueRef}
        className="color-picker-hue"
        onMouseDown={handleHueMouseDown}
      >
        <div
          className="color-picker-hue-handle"
          style={{ left: `${(h / 360) * 100}%` }}
        />
      </div>
    </div>
  );
}

interface RotationControlProps {
  value: number;
  disabled: boolean;
  isMixed?: boolean;
  onChange: (value: number) => void;
  onChangeStart?: () => void;
}

function RotationControl({ value, disabled, isMixed = false, onChange, onChangeStart }: RotationControlProps) {
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
    setEditValue(isMixed ? '' : Math.round(value).toString());
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
      // Push history before committing change
      onChangeStart?.();
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
    // Push history before starting drag
    onChangeStart?.();
    setIsDragging(true);
    dragStartAngleRef.current = getAngleFromMouse(e.clientX, e.clientY);
    dragStartValueRef.current = value;
  }, [disabled, value, getAngleFromMouse, onChangeStart]);

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

  const displayValue = disabled ? '---' : isMixed ? 'Mixed' : `${Math.round(value)}°`;
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
            placeholder={isMixed ? 'Mixed' : undefined}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        ) : (
          <span
            className={`property-value ${!disabled ? 'editable' : ''} ${isMixed ? 'mixed' : ''}`}
            onClick={handleInputClick}
          >
            {displayValue}
          </span>
        )}
      </div>
      <div
        ref={dialRef}
        className={`rotation-dial ${disabled ? 'disabled' : ''} ${isDragging ? 'dragging' : ''} ${isMixed ? 'mixed' : ''}`}
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

interface ExportSectionProps {
  objects: Map<string, CanvasObject>;
  selectedIds: Set<string>;
}

function ExportSection({ objects, selectedIds }: ExportSectionProps) {
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      // Determine which objects to export
      const objectsToExport: CanvasObject[] = [];

      if (selectedIds.size > 0) {
        // Export selected objects
        selectedIds.forEach((id) => {
          const obj = objects.get(id);
          if (obj) objectsToExport.push(obj);
        });
      } else {
        // Export all objects
        objects.forEach((obj) => objectsToExport.push(obj));
      }

      if (objectsToExport.length === 0) {
        setIsExporting(false);
        return;
      }

      // Calculate bounding box of all objects to export
      const padding = 20; // Add padding around exported content
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      objectsToExport.forEach((obj) => {
        // Account for rotation by using a larger bounding box
        const diagonal = Math.sqrt(obj.width * obj.width + obj.height * obj.height);
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;

        minX = Math.min(minX, centerX - diagonal / 2);
        minY = Math.min(minY, centerY - diagonal / 2);
        maxX = Math.max(maxX, centerX + diagonal / 2);
        maxY = Math.max(maxY, centerY + diagonal / 2);
      });

      const width = Math.ceil(maxX - minX) + padding * 2;
      const height = Math.ceil(maxY - minY) + padding * 2;
      const offsetX = minX - padding;
      const offsetY = minY - padding;

      // Create export canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = width;
      exportCanvas.height = height;
      const ctx = exportCanvas.getContext('2d');

      if (!ctx) {
        useToastStore.getState().addToast({
          message: 'Export failed: Could not create canvas context',
          type: 'error',
          duration: 5000
        });
        setIsExporting(false);
        return;
      }

      // Fill background if not transparent
      if (!transparentBackground) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
      }

      // Sort objects by zIndex and draw them
      const sortedObjects = [...objectsToExport].sort((a, b) => a.zIndex - b.zIndex);

      for (const obj of sortedObjects) {
        await drawObjectForExport(ctx, obj, offsetX, offsetY);
      }

      // Download the image
      const dataUrl = exportCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = selectedIds.size > 0 ? 'selection.png' : 'canvas.png';
      link.href = dataUrl;
      link.click();

      useToastStore.getState().addToast({
        message: 'Exported as PNG',
        type: 'success'
      });
    } catch (error) {
      useToastStore.getState().addToast({
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
        duration: 5000
      });
    } finally {
      setIsExporting(false);
    }
  }, [objects, selectedIds, transparentBackground, isExporting]);

  const hasContent = objects.size > 0;
  const exportLabel = selectedIds.size > 0 ? 'EXPORT SELECTION' : 'EXPORT CANVAS';

  return (
    <div className="export-section">
      <div className="export-option">
        <label className="export-checkbox-label">
          <input
            type="checkbox"
            className="export-checkbox"
            checked={transparentBackground}
            onChange={(e) => setTransparentBackground(e.target.checked)}
            disabled={!hasContent}
          />
          <span className="export-option-text">Transparent background</span>
        </label>
      </div>
      <button
        className={`export-button ${isExporting ? 'exporting' : ''}`}
        onClick={handleExport}
        disabled={!hasContent || isExporting}
      >
        {isExporting ? 'Exporting...' : exportLabel}
      </button>
    </div>
  );
}

function HierarchySection() {
  const objects = useCanvasStore((state) => state.objects);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const setSelection = useCanvasStore((state) => state.setSelection);
  const reorderObject = useCanvasStore((state) => state.reorderObject);
  const updateObject = useCanvasStore((state) => state.updateObject);
  const editingGroupId = useCanvasStore((state) => state.editingGroupId);
  const enterGroupEditMode = useCanvasStore((state) => state.enterGroupEditMode);
  const exitGroupEditMode = useCanvasStore((state) => state.exitGroupEditMode);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Sort objects by zIndex (highest first for display - top of list = front)
  // Only show top-level objects (not children of groups)
  const sortedObjects = Array.from(objects.values())
    .filter((obj) => !obj.parentId)
    .sort((a, b) => b.zIndex - a.zIndex);

  const toggleGroupExpanded = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleVisibilityToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const obj = objects.get(id);
    if (obj) {
      updateObject(id, { visible: obj.visible === false ? true : false });
    }
  };

  const handleLockToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const obj = objects.get(id);
    if (obj) {
      updateObject(id, { locked: !obj.locked });
    }
  };

  const handleItemClick = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey && selectedIds.size > 0) {
      // Shift+click: toggle selection
      const newSelection = new Set(selectedIds);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      setSelection(Array.from(newSelection));
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+click: add to selection
      const newSelection = new Set(selectedIds);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      setSelection(Array.from(newSelection));
    } else {
      // Normal click: select only this object
      setSelection([id]);
    }
  };

  const handleItemDoubleClick = (id: string) => {
    const obj = objects.get(id);
    if (obj?.type === 'group') {
      enterGroupEditMode(id);
      setExpandedGroups(new Set([...expandedGroups, id]));
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId === id) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'above' : 'below';

    setDragOverId(id);
    setDragOverPosition(position);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
    setDragOverPosition(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      setDragOverPosition(null);
      return;
    }

    const draggedObj = objects.get(draggedId);
    const targetObj = objects.get(targetId);
    if (!draggedObj || !targetObj) return;

    // Calculate new zIndex based on drop position
    // Since we display highest zIndex at top, "above" means higher zIndex
    let newZIndex: number;
    if (dragOverPosition === 'above') {
      // Place above target (higher zIndex)
      newZIndex = targetObj.zIndex + 1;
    } else {
      // Place below target (lower zIndex)
      newZIndex = targetObj.zIndex;
    }

    // Clamp zIndex to valid range
    newZIndex = Math.max(0, Math.min(objects.size - 1, newZIndex));

    reorderObject(draggedId, newZIndex);

    setDraggedId(null);
    setDragOverId(null);
    setDragOverPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    setDragOverPosition(null);
  };

  const getObjectName = (obj: NonNullable<ReturnType<typeof objects.get>>) => {
    if (obj.type === 'text' && 'text' in obj) {
      return (obj as { text: string }).text.slice(0, 20) || 'Text';
    }
    if (obj.type === 'frame' && 'name' in obj) {
      return (obj as { name: string }).name;
    }
    if (obj.type === 'group') {
      const group = obj as GroupObject;
      return `Group (${group.children.length})`;
    }
    return obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'rectangle': return '▢';
      case 'ellipse': return '○';
      case 'text': return 'T';
      case 'frame': return '⬚';
      case 'path': return '✎';
      case 'image': return '🖼';
      case 'video': return '▶';
      case 'group': return '⊞';
      case 'line': return '⁄';
      case 'arrow': return '→';
      case 'polygon': return '⬡';
      case 'star': return '★';
      default: return '?';
    }
  };

  // Generate selection count text
  const getSelectionText = () => {
    if (selectedIds.size === 0) {
      return objects.size > 0 ? `${objects.size} Items` : 'Canvas Empty';
    }
    if (selectedIds.size === objects.size && objects.size > 0) {
      return `All (${objects.size} objects)`;
    }
    return `${selectedIds.size} ${selectedIds.size === 1 ? 'object' : 'objects'} selected`;
  };

  // Render a hierarchy item with its children (for groups)
  const renderHierarchyItem = (obj: CanvasObject, depth: number = 0) => {
    const isGroup = obj.type === 'group';
    const isExpanded = expandedGroups.has(obj.id);
    const isVisible = obj.visible !== false;
    const isLocked = obj.locked === true;
    const isEditingGroup = editingGroupId === obj.id;

    return (
      <div key={obj.id}>
        <div
          className={`hierarchy-item ${selectedIds.has(obj.id) ? 'selected' : ''} ${draggedId === obj.id ? 'dragging' : ''} ${dragOverId === obj.id ? `drag-over-${dragOverPosition}` : ''} ${isEditingGroup ? 'editing-group' : ''} ${!isVisible ? 'hidden-object' : ''} ${isLocked ? 'locked-object' : ''}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={(e) => handleItemClick(obj.id, e)}
          onDoubleClick={() => handleItemDoubleClick(obj.id)}
          draggable
          onDragStart={(e) => handleDragStart(e, obj.id)}
          onDragOver={(e) => handleDragOver(e, obj.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, obj.id)}
          onDragEnd={handleDragEnd}
        >
          <span className="hierarchy-drag-handle">⋮⋮</span>
          {isGroup && (
            <button
              className={`hierarchy-expand-btn ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleGroupExpanded(obj.id);
              }}
            >
              ▸
            </button>
          )}
          <span className="hierarchy-icon">
            {getTypeIcon(obj.type)}
          </span>
          <span className="hierarchy-name">
            {getObjectName(obj)}
          </span>
          <div className="hierarchy-controls">
            <button
              className={`hierarchy-visibility-btn ${!isVisible ? 'hidden' : ''}`}
              onClick={(e) => handleVisibilityToggle(e, obj.id)}
              title={isVisible ? 'Hide object' : 'Show object'}
            >
              {isVisible ? '👁' : '👁‍🗨'}
            </button>
            <button
              className={`hierarchy-lock-btn ${isLocked ? 'locked' : ''}`}
              onClick={(e) => handleLockToggle(e, obj.id)}
              title={isLocked ? 'Unlock object' : 'Lock object'}
            >
              {isLocked ? '🔒' : '🔓'}
            </button>
          </div>
        </div>
        {/* Render group children when expanded */}
        {isGroup && isExpanded && (
          <div className="hierarchy-group-children">
            {(obj as GroupObject).children.map((childId) => {
              const childObj = objects.get(childId);
              if (childObj) {
                return renderHierarchyItem(childObj, depth + 1);
              }
              return null;
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <CollapsibleSection title={`HIERARCHY`}>
      <div className="hierarchy-info">
        {getSelectionText()}
        {editingGroupId && (
          <button
            className="exit-group-edit-btn"
            onClick={() => exitGroupEditMode()}
            title="Exit group edit mode"
          >
            ← Exit Group
          </button>
        )}
      </div>
      <div className="hierarchy-list">
        {sortedObjects.map((obj) => renderHierarchyItem(obj))}
      </div>
    </CollapsibleSection>
  );
}

// Helper to get shared value across multiple objects
function getSharedValue<T>(
  objects: CanvasObject[],
  getter: (obj: CanvasObject) => T,
  compare?: (a: T, b: T) => boolean
): T | 'mixed' | undefined {
  if (objects.length === 0) return undefined;
  const firstValue = getter(objects[0]);
  const compareFn = compare || ((a, b) => a === b);
  const allSame = objects.every(obj => compareFn(getter(obj), firstValue));
  return allSame ? firstValue : 'mixed';
}

// Helper to get shared numeric value (rounded for display)
function getSharedNumericValue(
  objects: CanvasObject[],
  getter: (obj: CanvasObject) => number
): number | 'mixed' | undefined {
  if (objects.length === 0) return undefined;
  const firstValue = Math.round(getter(objects[0]));
  const allSame = objects.every(obj => Math.round(getter(obj)) === firstValue);
  return allSame ? firstValue : 'mixed';
}

// Helper to check checkbox state for multi-selection
function getCheckboxState(
  objects: CanvasObject[],
  getter: (obj: CanvasObject) => boolean
): { checked: boolean; indeterminate: boolean } {
  if (objects.length === 0) return { checked: false, indeterminate: false };
  const states = objects.map(getter);
  const allTrue = states.every(Boolean);
  const allFalse = states.every(s => !s);
  return {
    checked: allTrue,
    indeterminate: !allTrue && !allFalse
  };
}

export function PropertiesPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [constrainProportions, setConstrainProportions] = useState(true);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const objects = useCanvasStore((state) => state.objects);
  const updateObject = useCanvasStore((state) => state.updateObject);
  const updateObjects = useCanvasStore((state) => state.updateObjects);
  const pushHistory = useCanvasStore((state) => state.pushHistory);

  const hasSelection = selectedIds.size > 0;
  const selectedObjects = Array.from(selectedIds).map((id) => objects.get(id)).filter(Boolean) as CanvasObject[];
  const singleSelection = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const isMultiSelection = selectedObjects.length > 1;

  // Get display value for numeric properties
  const getDisplayValue = (getter: (obj: CanvasObject) => number): string => {
    if (!hasSelection || selectedObjects.length === 0) return '---';
    const result = getSharedNumericValue(selectedObjects, getter);
    if (result === undefined) return '---';
    if (result === 'mixed') return 'Mixed';
    return result.toString();
  };

  // Get actual numeric value for controls (returns first object's value for mixed)
  const getNumericValue = (getter: (obj: CanvasObject) => number): number => {
    if (selectedObjects.length === 0) return 0;
    return getter(selectedObjects[0]);
  };

  // Check if a numeric value is mixed
  const isValueMixed = (getter: (obj: CanvasObject) => number): boolean => {
    if (selectedObjects.length <= 1) return false;
    return getSharedNumericValue(selectedObjects, getter) === 'mixed';
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
              value={getDisplayValue((obj) => obj.x)}
              disabled={!hasSelection}
              isMixed={isValueMixed((obj) => obj.x)}
              onChange={(value) => {
                if (isMultiSelection) {
                  // Relative positioning: apply delta to all objects
                  const delta = value - selectedObjects[0].x;
                  updateObjects(selectedObjects.map(obj => ({
                    id: obj.id,
                    changes: { x: obj.x + delta }
                  })));
                } else if (singleSelection) {
                  updateObject(singleSelection.id, { x: value });
                }
              }}
              onChangeStart={pushHistory}
            />
            <EditablePropertyRow
              label="Y-POS"
              value={getDisplayValue((obj) => obj.y)}
              disabled={!hasSelection}
              isMixed={isValueMixed((obj) => obj.y)}
              onChange={(value) => {
                if (isMultiSelection) {
                  // Relative positioning: apply delta to all objects
                  const delta = value - selectedObjects[0].y;
                  updateObjects(selectedObjects.map(obj => ({
                    id: obj.id,
                    changes: { y: obj.y + delta }
                  })));
                } else if (singleSelection) {
                  updateObject(singleSelection.id, { y: value });
                }
              }}
              onChangeStart={pushHistory}
            />
            <div className="size-row">
              <EditablePropertyRow
                label="WIDTH"
                value={getDisplayValue((obj) => obj.width)}
                disabled={!hasSelection}
                isMixed={isValueMixed((obj) => obj.width)}
                onChange={(value) => {
                  if (isMultiSelection) {
                    // For multi-selection with constrain proportions, each object maintains its own ratio
                    if (constrainProportions) {
                      updateObjects(selectedObjects.map(obj => {
                        const aspectRatio = obj.height / obj.width;
                        return {
                          id: obj.id,
                          changes: {
                            width: value,
                            height: Math.round(value * aspectRatio)
                          }
                        };
                      }));
                    } else {
                      updateObjects(selectedObjects.map(obj => ({
                        id: obj.id,
                        changes: { width: value }
                      })));
                    }
                  } else if (singleSelection) {
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
                onChangeStart={pushHistory}
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
                value={getDisplayValue((obj) => obj.height)}
                disabled={!hasSelection}
                isMixed={isValueMixed((obj) => obj.height)}
                onChange={(value) => {
                  if (isMultiSelection) {
                    // For multi-selection with constrain proportions, each object maintains its own ratio
                    if (constrainProportions) {
                      updateObjects(selectedObjects.map(obj => {
                        const aspectRatio = obj.width / obj.height;
                        return {
                          id: obj.id,
                          changes: {
                            height: value,
                            width: Math.round(value * aspectRatio)
                          }
                        };
                      }));
                    } else {
                      updateObjects(selectedObjects.map(obj => ({
                        id: obj.id,
                        changes: { height: value }
                      })));
                    }
                  } else if (singleSelection) {
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
                onChangeStart={pushHistory}
              />
            </div>
            <RotationControl
              value={getNumericValue((obj) => obj.rotation)}
              disabled={!hasSelection}
              isMixed={isValueMixed((obj) => obj.rotation)}
              onChange={(value) => {
                if (isMultiSelection) {
                  // Absolute rotation: all objects get same rotation
                  updateObjects(selectedObjects.map(obj => ({
                    id: obj.id,
                    changes: { rotation: value }
                  })));
                } else if (singleSelection) {
                  updateObject(singleSelection.id, { rotation: value });
                }
              }}
              onChangeStart={pushHistory}
            />
          </CollapsibleSection>

          {/* Appearance Section */}
          <CollapsibleSection title="APPEARANCE">
            <OpacityControl
              value={getNumericValue((obj) => obj.opacity)}
              disabled={!hasSelection}
              isMixed={isValueMixed((obj) => obj.opacity)}
              onChange={(value) => {
                if (isMultiSelection) {
                  // Absolute opacity: all objects get same opacity
                  updateObjects(selectedObjects.map(obj => ({
                    id: obj.id,
                    changes: { opacity: value }
                  })));
                } else if (singleSelection) {
                  updateObject(singleSelection.id, { opacity: value });
                }
              }}
              onChangeStart={pushHistory}
            />
            <FillControl
              value={(() => {
                const result = getSharedValue(selectedObjects, obj => obj.fill);
                return result === 'mixed' ? undefined : result;
              })()}
              enabled={(() => {
                const state = getCheckboxState(selectedObjects, obj => obj.fill !== undefined);
                return state.checked;
              })()}
              disabled={!hasSelection}
              isMixed={getSharedValue(selectedObjects, obj => obj.fill) === 'mixed'}
              isIndeterminate={getCheckboxState(selectedObjects, obj => obj.fill !== undefined).indeterminate}
              onColorChange={(color) => {
                if (isMultiSelection) {
                  updateObjects(selectedObjects.map(obj => ({
                    id: obj.id,
                    changes: { fill: color }
                  })));
                } else if (singleSelection) {
                  updateObject(singleSelection.id, { fill: color });
                }
              }}
              onEnabledChange={(enabled) => {
                if (isMultiSelection) {
                  if (enabled) {
                    // Enable fill for all - use existing color or default
                    updateObjects(selectedObjects.map(obj => ({
                      id: obj.id,
                      changes: { fill: obj.fill ?? '#4a4a4a' }
                    })));
                  } else {
                    // Disable fill for all
                    updateObjects(selectedObjects.map(obj => ({
                      id: obj.id,
                      changes: { fill: undefined }
                    })));
                  }
                } else if (singleSelection) {
                  if (enabled) {
                    updateObject(singleSelection.id, { fill: '#4a4a4a' });
                  } else {
                    updateObject(singleSelection.id, { fill: undefined });
                  }
                }
              }}
              onChangeStart={pushHistory}
            />
            <StrokeControl
              color={(() => {
                const result = getSharedValue(selectedObjects, obj => obj.stroke);
                return result === 'mixed' ? undefined : result;
              })()}
              width={(() => {
                const result = getSharedNumericValue(selectedObjects, obj => obj.strokeWidth ?? 0);
                return result === 'mixed' ? undefined : result === undefined ? undefined : result;
              })()}
              enabled={(() => {
                const state = getCheckboxState(selectedObjects, obj => obj.stroke !== undefined);
                return state.checked;
              })()}
              disabled={!hasSelection}
              isColorMixed={getSharedValue(selectedObjects, obj => obj.stroke) === 'mixed'}
              isWidthMixed={getSharedNumericValue(selectedObjects, obj => obj.strokeWidth ?? 0) === 'mixed'}
              isIndeterminate={getCheckboxState(selectedObjects, obj => obj.stroke !== undefined).indeterminate}
              onColorChange={(color) => {
                if (isMultiSelection) {
                  updateObjects(selectedObjects.map(obj => ({
                    id: obj.id,
                    changes: { stroke: color }
                  })));
                } else if (singleSelection) {
                  updateObject(singleSelection.id, { stroke: color });
                }
              }}
              onWidthChange={(width) => {
                if (isMultiSelection) {
                  updateObjects(selectedObjects.map(obj => ({
                    id: obj.id,
                    changes: { strokeWidth: width }
                  })));
                } else if (singleSelection) {
                  updateObject(singleSelection.id, { strokeWidth: width });
                }
              }}
              onEnabledChange={(enabled) => {
                if (isMultiSelection) {
                  if (enabled) {
                    // Enable stroke for all - use existing values or defaults
                    updateObjects(selectedObjects.map(obj => ({
                      id: obj.id,
                      changes: {
                        stroke: obj.stroke ?? '#ffffff',
                        strokeWidth: obj.strokeWidth ?? 2
                      }
                    })));
                  } else {
                    // Disable stroke for all
                    updateObjects(selectedObjects.map(obj => ({
                      id: obj.id,
                      changes: { stroke: undefined, strokeWidth: undefined }
                    })));
                  }
                } else if (singleSelection) {
                  if (enabled) {
                    updateObject(singleSelection.id, { stroke: '#ffffff', strokeWidth: 2 });
                  } else {
                    updateObject(singleSelection.id, { stroke: undefined, strokeWidth: undefined });
                  }
                }
              }}
              onChangeStart={pushHistory}
            />
          </CollapsibleSection>

          {/* Shape Section - Only show when rectangle objects are selected */}
          {selectedObjects.some(obj => obj.type === 'rectangle') && (
            <CollapsibleSection title="SHAPE">
              {/* Corner Radius - Only for rectangles */}
              <EditablePropertyRow
                label="CORNER"
                value={(() => {
                  const rectObjs = selectedObjects.filter(obj => obj.type === 'rectangle');
                  if (rectObjs.length === 0) return '---';
                  const first = (rectObjs[0] as { cornerRadius?: number }).cornerRadius ?? 0;
                  const allSame = rectObjs.every(obj => ((obj as { cornerRadius?: number }).cornerRadius ?? 0) === first);
                  return allSame ? Math.round(first).toString() : 'Mixed';
                })()}
                disabled={!hasSelection}
                isMixed={(() => {
                  const rectObjs = selectedObjects.filter(obj => obj.type === 'rectangle');
                  if (rectObjs.length <= 1) return false;
                  const first = (rectObjs[0] as { cornerRadius?: number }).cornerRadius ?? 0;
                  return !rectObjs.every(obj => ((obj as { cornerRadius?: number }).cornerRadius ?? 0) === first);
                })()}
                onChange={(value) => {
                  const rectObjs = selectedObjects.filter(obj => obj.type === 'rectangle');
                  updateObjects(rectObjs.map(obj => ({
                    id: obj.id,
                    changes: { cornerRadius: Math.max(0, value) }
                  })));
                }}
                onChangeStart={pushHistory}
              />
            </CollapsibleSection>
          )}

          {/* Text Section - Only show when text objects are selected */}
          {selectedObjects.some(obj => obj.type === 'text') && (
            <CollapsibleSection title="TEXT">
              {/* Font Family */}
              <div className="property-row">
                <span className="property-label">Font</span>
                <select
                  className="font-select"
                  value={(() => {
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    if (textObjs.length === 0) return '';
                    const first = textObjs[0].fontFamily;
                    return textObjs.every(obj => obj.fontFamily === first) ? first : '';
                  })()}
                  onChange={(e) => {
                    pushHistory();
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    const newFontFamily = e.target.value;
                    updateObjects(textObjs.map(obj => {
                      const dimensions = measureTextDimensions({
                        text: obj.text,
                        fontSize: obj.fontSize,
                        fontFamily: newFontFamily,
                        fontWeight: obj.fontWeight,
                        fontStyle: obj.fontStyle,
                        lineHeight: obj.lineHeight,
                      });
                      return {
                        id: obj.id,
                        changes: { fontFamily: newFontFamily, width: dimensions.width, height: dimensions.height }
                      };
                    }));
                  }}
                  disabled={!hasSelection}
                >
                  <option value="Inter, system-ui, sans-serif">Inter</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Helvetica, sans-serif">Helvetica</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Times New Roman, serif">Times New Roman</option>
                  <option value="Courier New, monospace">Courier New</option>
                  <option value="SF Mono, Monaco, Consolas, monospace">SF Mono</option>
                </select>
              </div>

              {/* Font Size */}
              <EditablePropertyRow
                label="Size"
                value={(() => {
                  const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                  if (textObjs.length === 0) return '---';
                  const first = textObjs[0].fontSize;
                  return textObjs.every(obj => obj.fontSize === first) ? String(first) : 'Mixed';
                })()}
                disabled={!hasSelection}
                isMixed={(() => {
                  const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                  if (textObjs.length <= 1) return false;
                  const first = textObjs[0].fontSize;
                  return !textObjs.every(obj => obj.fontSize === first);
                })()}
                onChange={(value) => {
                  const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                  const newFontSize = value;
                  updateObjects(textObjs.map(obj => {
                    const dimensions = measureTextDimensions({
                      text: obj.text,
                      fontSize: newFontSize,
                      fontFamily: obj.fontFamily,
                      fontWeight: obj.fontWeight,
                      fontStyle: obj.fontStyle,
                      lineHeight: obj.lineHeight,
                    });
                    return {
                      id: obj.id,
                      changes: { fontSize: newFontSize, width: dimensions.width, height: dimensions.height }
                    };
                  }));
                }}
                onChangeStart={pushHistory}
              />

              {/* Text Style Buttons (Bold, Italic, Underline, Strikethrough) */}
              <div className="text-style-buttons">
                <button
                  className={`text-style-btn ${(() => {
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    return textObjs.every(obj => (obj.fontWeight || 400) >= 700) ? 'active' : '';
                  })()}`}
                  onClick={() => {
                    pushHistory();
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    const allBold = textObjs.every(obj => (obj.fontWeight || 400) >= 700);
                    const newFontWeight = allBold ? 400 : 700;
                    updateObjects(textObjs.map(obj => {
                      const dimensions = measureTextDimensions({
                        text: obj.text,
                        fontSize: obj.fontSize,
                        fontFamily: obj.fontFamily,
                        fontWeight: newFontWeight,
                        fontStyle: obj.fontStyle,
                        lineHeight: obj.lineHeight,
                      });
                      return {
                        id: obj.id,
                        changes: { fontWeight: newFontWeight, width: dimensions.width, height: dimensions.height }
                      };
                    }));
                  }}
                  disabled={!hasSelection}
                  title="Bold (Ctrl+B)"
                >
                  <strong>B</strong>
                </button>
                <button
                  className={`text-style-btn ${(() => {
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    return textObjs.every(obj => obj.fontStyle === 'italic') ? 'active' : '';
                  })()}`}
                  onClick={() => {
                    pushHistory();
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    const allItalic = textObjs.every(obj => obj.fontStyle === 'italic');
                    const newFontStyle = allItalic ? 'normal' : 'italic';
                    updateObjects(textObjs.map(obj => {
                      const dimensions = measureTextDimensions({
                        text: obj.text,
                        fontSize: obj.fontSize,
                        fontFamily: obj.fontFamily,
                        fontWeight: obj.fontWeight,
                        fontStyle: newFontStyle,
                        lineHeight: obj.lineHeight,
                      });
                      return {
                        id: obj.id,
                        changes: { fontStyle: newFontStyle, width: dimensions.width, height: dimensions.height }
                      };
                    }));
                  }}
                  disabled={!hasSelection}
                  title="Italic (Ctrl+I)"
                >
                  <em>I</em>
                </button>
                <button
                  className={`text-style-btn ${(() => {
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    return textObjs.every(obj => obj.textDecoration === 'underline') ? 'active' : '';
                  })()}`}
                  onClick={() => {
                    pushHistory();
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    const allUnderline = textObjs.every(obj => obj.textDecoration === 'underline');
                    updateObjects(textObjs.map(obj => ({
                      id: obj.id,
                      changes: { textDecoration: allUnderline ? 'none' : 'underline' }
                    })));
                  }}
                  disabled={!hasSelection}
                  title="Underline (Ctrl+U)"
                >
                  <span style={{ textDecoration: 'underline' }}>U</span>
                </button>
                <button
                  className={`text-style-btn ${(() => {
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    return textObjs.every(obj => obj.textDecoration === 'line-through') ? 'active' : '';
                  })()}`}
                  onClick={() => {
                    pushHistory();
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    const allStrike = textObjs.every(obj => obj.textDecoration === 'line-through');
                    updateObjects(textObjs.map(obj => ({
                      id: obj.id,
                      changes: { textDecoration: allStrike ? 'none' : 'line-through' }
                    })));
                  }}
                  disabled={!hasSelection}
                  title="Strikethrough"
                >
                  <span style={{ textDecoration: 'line-through' }}>S</span>
                </button>
              </div>

              {/* Text Alignment */}
              <div className="text-align-buttons">
                <button
                  className={`text-align-btn ${(() => {
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    return textObjs.every(obj => (obj.textAlign || 'left') === 'left') ? 'active' : '';
                  })()}`}
                  onClick={() => {
                    pushHistory();
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text');
                    updateObjects(textObjs.map(obj => ({
                      id: obj.id,
                      changes: { textAlign: 'left' }
                    })));
                  }}
                  disabled={!hasSelection}
                  title="Align Left"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <rect x="1" y="2" width="12" height="1.5" />
                    <rect x="1" y="5" width="8" height="1.5" />
                    <rect x="1" y="8" width="10" height="1.5" />
                    <rect x="1" y="11" width="6" height="1.5" />
                  </svg>
                </button>
                <button
                  className={`text-align-btn ${(() => {
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    return textObjs.every(obj => obj.textAlign === 'center') ? 'active' : '';
                  })()}`}
                  onClick={() => {
                    pushHistory();
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text');
                    updateObjects(textObjs.map(obj => ({
                      id: obj.id,
                      changes: { textAlign: 'center' }
                    })));
                  }}
                  disabled={!hasSelection}
                  title="Align Center"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <rect x="1" y="2" width="12" height="1.5" />
                    <rect x="3" y="5" width="8" height="1.5" />
                    <rect x="2" y="8" width="10" height="1.5" />
                    <rect x="4" y="11" width="6" height="1.5" />
                  </svg>
                </button>
                <button
                  className={`text-align-btn ${(() => {
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    return textObjs.every(obj => obj.textAlign === 'right') ? 'active' : '';
                  })()}`}
                  onClick={() => {
                    pushHistory();
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text');
                    updateObjects(textObjs.map(obj => ({
                      id: obj.id,
                      changes: { textAlign: 'right' }
                    })));
                  }}
                  disabled={!hasSelection}
                  title="Align Right"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <rect x="1" y="2" width="12" height="1.5" />
                    <rect x="5" y="5" width="8" height="1.5" />
                    <rect x="3" y="8" width="10" height="1.5" />
                    <rect x="7" y="11" width="6" height="1.5" />
                  </svg>
                </button>
              </div>

              {/* Line Height */}
              <div className="property-row">
                <span className="property-label">Line Height</span>
                <input
                  type="number"
                  className="property-input line-height-input"
                  step="0.1"
                  min="0.5"
                  max="3"
                  value={(() => {
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    if (textObjs.length === 0) return 1.2;
                    const first = textObjs[0].lineHeight || 1.2;
                    return textObjs.every(obj => (obj.lineHeight || 1.2) === first) ? first : '';
                  })()}
                  onChange={(e) => {
                    const textObjs = selectedObjects.filter(obj => obj.type === 'text') as TextObject[];
                    const newLineHeight = parseFloat(e.target.value) || 1.2;
                    updateObjects(textObjs.map(obj => {
                      const dimensions = measureTextDimensions({
                        text: obj.text,
                        fontSize: obj.fontSize,
                        fontFamily: obj.fontFamily,
                        fontWeight: obj.fontWeight,
                        fontStyle: obj.fontStyle,
                        lineHeight: newLineHeight,
                      });
                      return {
                        id: obj.id,
                        changes: { lineHeight: newLineHeight, width: dimensions.width, height: dimensions.height }
                      };
                    }));
                  }}
                  onFocus={() => pushHistory()}
                  disabled={!hasSelection}
                />
              </div>
            </CollapsibleSection>
          )}

          {/* Hierarchy Section */}
          <HierarchySection />

          {/* Export Section */}
          <div className="section">
            <div className="section-header export-header">
              <span className="section-title">EXPORT</span>
            </div>
            <div className="section-content">
              <ExportSection objects={objects} selectedIds={selectedIds} />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
