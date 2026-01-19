import { useState, useRef, useEffect, useCallback } from 'react';

interface ColorInputProps {
  label: string;
  value: string | 'mixed';
  onChange: (value: string) => void;
  onChangeEnd?: () => void;
  allowNone?: boolean;
}

// HSV to RGB conversion
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

// RGB to HSV conversion
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    if (max === r) h = 60 * ((g - b) / d % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }

  if (h < 0) h += 360;

  return { h, s, v };
}

// Hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function ColorInput({
  label,
  value,
  onChange,
  onChangeEnd,
  allowNone = false,
}: ColorInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hsv, setHsv] = useState({ h: 0, s: 1, v: 1 });
  const [isDraggingSV, setIsDraggingSV] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Parse initial color
  useEffect(() => {
    if (value !== 'mixed' && value !== 'none') {
      const rgb = hexToRgb(value);
      if (rgb) {
        const newHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        setHsv(newHsv);
      }
    }
  }, [value]);

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

  const updateColorFromHsv = useCallback((newHsv: { h: number; s: number; v: number }) => {
    const rgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    onChange(hex);
  }, [onChange]);

  // SV picker handlers
  const handleSVMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSV(true);
    updateSVFromMouse(e.clientX, e.clientY);
  }, []);

  const updateSVFromMouse = useCallback((clientX: number, clientY: number) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    const newHsv = { ...hsv, s, v };
    setHsv(newHsv);
    updateColorFromHsv(newHsv);
  }, [hsv, updateColorFromHsv]);

  useEffect(() => {
    if (!isDraggingSV) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateSVFromMouse(e.clientX, e.clientY);
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
  }, [isDraggingSV, updateSVFromMouse]);

  // Hue picker handlers
  const handleHueMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingHue(true);
    updateHueFromMouse(e.clientX);
  }, []);

  const updateHueFromMouse = useCallback((clientX: number) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, (clientX - rect.left) / rect.width * 360));
    const newHsv = { ...hsv, h };
    setHsv(newHsv);
    updateColorFromHsv(newHsv);
  }, [hsv, updateColorFromHsv]);

  useEffect(() => {
    if (!isDraggingHue) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateHueFromMouse(e.clientX);
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
  }, [isDraggingHue, updateHueFromMouse]);

  const hueColor = `hsl(${hsv.h}, 100%, 50%)`;

  return (
    <div className="color-input">
      <label className="color-input-label">{label}</label>
      <button
        className={`color-input-swatch ${value === 'mixed' ? 'mixed' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          backgroundColor: value === 'mixed' || value === 'none' ? 'transparent' : value,
          backgroundImage: value === 'none' ? 'linear-gradient(45deg, #444 25%, transparent 25%, transparent 75%, #444 75%, #444), linear-gradient(45deg, #444 25%, transparent 25%, transparent 75%, #444 75%, #444)' : undefined,
          backgroundSize: value === 'none' ? '8px 8px' : undefined,
          backgroundPosition: value === 'none' ? '0 0, 4px 4px' : undefined,
        }}
      >
        {value === 'mixed' && <span className="mixed-indicator">?</span>}
      </button>

      {isOpen && (
        <div className="color-input-popup" ref={popupRef}>
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
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
              }}
            />
          </div>

          <div
            ref={hueRef}
            className="color-picker-hue"
            onMouseDown={handleHueMouseDown}
          >
            <div
              className="color-picker-hue-handle"
              style={{ left: `${(hsv.h / 360) * 100}%` }}
            />
          </div>

          {allowNone && (
            <button
              className="color-none-btn"
              onClick={() => { onChange('none'); setIsOpen(false); onChangeEnd?.(); }}
            >
              No {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
