import { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasObject, ImageObject, VideoObject } from '../../types/canvas';
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
      ctx.fillStyle = obj.fill || '#ffffff';
      ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
      ctx.textAlign = obj.textAlign;
      ctx.textBaseline = 'top';
      const textX = obj.textAlign === 'center' ? obj.width / 2 : obj.textAlign === 'right' ? obj.width : 0;
      ctx.fillText(obj.text, textX, 0);
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

interface OpacityControlProps {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

function OpacityControl({ value, disabled, onChange }: OpacityControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState((value * 100).toString());
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const originalValueRef = useRef(value);

  const handleInputClick = () => {
    if (disabled) return;
    originalValueRef.current = value;
    setEditValue(Math.round(value * 100).toString());
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
    setIsDragging(true);
    const newValue = getOpacityFromMouse(e.clientX);
    onChange(newValue);
  }, [disabled, onChange, getOpacityFromMouse]);

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

  const displayValue = disabled ? '---' : `${Math.round(value * 100)}%`;
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
        ref={sliderRef}
        className={`opacity-slider ${disabled ? 'disabled' : ''} ${isDragging ? 'dragging' : ''}`}
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
  onColorChange: (value: string) => void;
  onWidthChange: (value: number) => void;
  onEnabledChange: (enabled: boolean) => void;
}

function StrokeControl({ color, width, enabled, disabled, onColorChange, onWidthChange, onEnabledChange }: StrokeControlProps) {
  const [isEditingColor, setIsEditingColor] = useState(false);
  const [editColorValue, setEditColorValue] = useState(color ?? '#ffffff');
  const [isEditingWidth, setIsEditingWidth] = useState(false);
  const [editWidthValue, setEditWidthValue] = useState((width ?? 2).toString());
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const widthInputRef = useRef<HTMLInputElement>(null);
  const originalColorRef = useRef(color ?? '#ffffff');
  const originalWidthRef = useRef(width ?? 2);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const handleColorInputClick = () => {
    if (disabled) return;
    originalColorRef.current = color ?? '#ffffff';
    setEditColorValue(color ?? '#ffffff');
    setIsEditingColor(true);
  };

  const handleWidthInputClick = () => {
    if (disabled) return;
    originalWidthRef.current = width ?? 2;
    setEditWidthValue((width ?? 2).toString());
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
    setShowColorPicker(!showColorPicker);
  };

  const displayColor = disabled ? '---' : (color ?? '#ffffff');
  const swatchColor = disabled ? '#ffffff' : (color ?? '#ffffff');
  const displayWidth = disabled ? '---' : `${width ?? 2}px`;

  return (
    <div className="stroke-control">
      <div className="property-row stroke-row">
        <div className="stroke-left">
          <input
            type="checkbox"
            className="stroke-checkbox"
            checked={!disabled && enabled}
            disabled={disabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
          />
          <span className="property-label">STROKE</span>
        </div>
        <div className="stroke-right">
          <button
            className={`color-swatch ${disabled ? 'disabled' : ''}`}
            style={{ backgroundColor: swatchColor }}
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
              onChange={(e) => setEditColorValue(e.target.value)}
              onKeyDown={handleColorKeyDown}
              onBlur={commitColorChange}
            />
          ) : (
            <span
              className={`property-value ${!disabled ? 'editable' : ''}`}
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
            onChange={(e) => setEditWidthValue(e.target.value)}
            onKeyDown={handleWidthKeyDown}
            onBlur={commitWidthChange}
          />
        ) : (
          <span
            className={`property-value ${!disabled ? 'editable' : ''}`}
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
  onColorChange: (value: string) => void;
  onEnabledChange: (enabled: boolean) => void;
}

function FillControl({ value, enabled, disabled, onColorChange, onEnabledChange }: FillControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? '#4a4a4a');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const originalValueRef = useRef(value ?? '#4a4a4a');
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const handleInputClick = () => {
    if (disabled) return;
    originalValueRef.current = value ?? '#4a4a4a';
    setEditValue(value ?? '#4a4a4a');
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
    setShowColorPicker(!showColorPicker);
  };

  const displayValue = disabled ? '---' : (value ?? '#4a4a4a');
  const swatchColor = disabled ? '#4a4a4a' : (value ?? '#4a4a4a');

  return (
    <div className="fill-control">
      <div className="property-row fill-row">
        <div className="fill-left">
          <input
            type="checkbox"
            className="fill-checkbox"
            checked={!disabled && enabled}
            disabled={disabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
          />
          <span className="property-label">FILL</span>
        </div>
        <div className="fill-right">
          <button
            className={`color-swatch ${disabled ? 'disabled' : ''}`}
            style={{ backgroundColor: swatchColor }}
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

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);

  // Sort objects by zIndex (highest first for display - top of list = front)
  const sortedObjects = Array.from(objects.values()).sort((a, b) => b.zIndex - a.zIndex);

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
      default: return '?';
    }
  };

  return (
    <CollapsibleSection title={`HIERARCHY`}>
      <div className="hierarchy-info">
        {objects.size > 0 ? `${objects.size} Items` : 'Canvas Empty'}
      </div>
      <div className="hierarchy-list">
        {sortedObjects.map((obj) => (
          <div
            key={obj.id}
            className={`hierarchy-item ${selectedIds.has(obj.id) ? 'selected' : ''} ${draggedId === obj.id ? 'dragging' : ''} ${dragOverId === obj.id ? `drag-over-${dragOverPosition}` : ''}`}
            onClick={(e) => handleItemClick(obj.id, e)}
            draggable
            onDragStart={(e) => handleDragStart(e, obj.id)}
            onDragOver={(e) => handleDragOver(e, obj.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, obj.id)}
            onDragEnd={handleDragEnd}
          >
            <span className="hierarchy-drag-handle">⋮⋮</span>
            <span className="hierarchy-icon">
              {getTypeIcon(obj.type)}
            </span>
            <span className="hierarchy-name">
              {getObjectName(obj)}
            </span>
          </div>
        ))}
      </div>
    </CollapsibleSection>
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
            <OpacityControl
              value={singleSelection?.opacity ?? 1}
              disabled={!hasSelection}
              onChange={(value) => {
                if (singleSelection) {
                  updateObject(singleSelection.id, { opacity: value });
                }
              }}
            />
            <FillControl
              value={singleSelection?.fill}
              enabled={singleSelection?.fill !== undefined}
              disabled={!hasSelection}
              onColorChange={(color) => {
                if (singleSelection) {
                  updateObject(singleSelection.id, { fill: color });
                }
              }}
              onEnabledChange={(enabled) => {
                if (singleSelection) {
                  if (enabled) {
                    // Enable fill with default color
                    updateObject(singleSelection.id, { fill: '#4a4a4a' });
                  } else {
                    // Disable fill by setting to undefined
                    updateObject(singleSelection.id, { fill: undefined });
                  }
                }
              }}
            />
            <StrokeControl
              color={singleSelection?.stroke}
              width={singleSelection?.strokeWidth}
              enabled={singleSelection?.stroke !== undefined}
              disabled={!hasSelection}
              onColorChange={(color) => {
                if (singleSelection) {
                  updateObject(singleSelection.id, { stroke: color });
                }
              }}
              onWidthChange={(width) => {
                if (singleSelection) {
                  updateObject(singleSelection.id, { strokeWidth: width });
                }
              }}
              onEnabledChange={(enabled) => {
                if (singleSelection) {
                  if (enabled) {
                    // Enable stroke with default color and width
                    updateObject(singleSelection.id, { stroke: '#ffffff', strokeWidth: 2 });
                  } else {
                    // Disable stroke by setting to undefined
                    updateObject(singleSelection.id, { stroke: undefined, strokeWidth: undefined });
                  }
                }
              }}
            />
          </CollapsibleSection>

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
