import { useRef, useState, useEffect } from 'react';
import { FONT_LIBRARY, CATEGORY_LABELS, type FontCategory, type FontDefinition } from '../../../constants/fonts';

interface FontSelectProps {
  label: string;
  value: string | 'mixed';
  onChange: (family: string) => void;
  disabled?: boolean;
}

// Order for category display
const CATEGORY_ORDER: FontCategory[] = [
  'sans-serif',
  'serif',
  'display',
  'retro',
  'handwritten',
  'monospace',
];

// Group fonts by category in display order
function getGroupedFonts(): Array<{ category: FontCategory; label: string; fonts: FontDefinition[] }> {
  const groups: Array<{ category: FontCategory; label: string; fonts: FontDefinition[] }> = [];

  for (const category of CATEGORY_ORDER) {
    const fonts = FONT_LIBRARY.filter(f => f.category === category);
    if (fonts.length > 0) {
      groups.push({
        category,
        label: CATEGORY_LABELS[category],
        fonts,
      });
    }
  }

  return groups;
}

export function FontSelect({ label, value, onChange, disabled = false }: FontSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const groupedFonts = getGroupedFonts();

  // Find current font for display
  const currentFont = FONT_LIBRARY.find(f => f.family === value);
  const displayValue = value === 'mixed' ? 'Mixed' : (currentFont?.name || 'Inter');

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleSelect = (font: FontDefinition) => {
    onChange(font.family);
    setIsOpen(false);
  };

  return (
    <div className="font-select" ref={containerRef}>
      <label className="font-select-label">{label}</label>
      <button
        type="button"
        className={`font-select-trigger ${isOpen ? 'open' : ''} ${value === 'mixed' ? 'mixed' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{ fontFamily: currentFont?.family }}
      >
        <span className="font-select-value">{displayValue}</span>
        <svg
          className="font-select-arrow"
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="font-select-dropdown" ref={dropdownRef}>
          {groupedFonts.map(({ category, label: categoryLabel, fonts }) => (
            <div key={category} className="font-select-group">
              <div className="font-select-group-label">{categoryLabel}</div>
              {fonts.map((font) => (
                <button
                  key={font.name}
                  type="button"
                  className={`font-select-option ${font.family === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(font)}
                  style={{ fontFamily: font.family }}
                >
                  {font.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
