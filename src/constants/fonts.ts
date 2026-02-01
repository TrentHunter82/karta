/**
 * Curated font library for Karta text tool
 *
 * Selection criteria:
 * - Free and open source (Google Fonts)
 * - High quality and widely used
 * - Good coverage of styles
 * - 15-20 fonts total (curated, not overwhelming)
 */

export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwritten' | 'monospace';

export interface FontDefinition {
  /** Display name shown in UI */
  name: string;
  /** CSS font-family value with fallbacks */
  family: string;
  /** Category for grouping in dropdown */
  category: FontCategory;
  /** Available font weights */
  weights: number[];
  /** Whether italic variants are available */
  hasItalic: boolean;
}

/**
 * Designer-curated font library based on industry research
 * Sources: Google Fonts analytics, Typewolf, design tool surveys
 */
export const FONT_LIBRARY: FontDefinition[] = [
  // Sans-Serif - Clean, modern, highly readable
  {
    name: 'Inter',
    family: 'Inter, system-ui, sans-serif',
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    hasItalic: false,
  },
  {
    name: 'Roboto',
    family: 'Roboto, sans-serif',
    category: 'sans-serif',
    weights: [400, 500, 700],
    hasItalic: true,
  },
  {
    name: 'Open Sans',
    family: '"Open Sans", sans-serif',
    category: 'sans-serif',
    weights: [400, 600, 700],
    hasItalic: true,
  },
  {
    name: 'Poppins',
    family: 'Poppins, sans-serif',
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    hasItalic: true,
  },
  {
    name: 'Nunito',
    family: 'Nunito, sans-serif',
    category: 'sans-serif',
    weights: [400, 600, 700],
    hasItalic: true,
  },

  // Serif - Elegant, editorial, classic
  {
    name: 'Playfair Display',
    family: '"Playfair Display", serif',
    category: 'serif',
    weights: [400, 500, 600, 700],
    hasItalic: true,
  },
  {
    name: 'Merriweather',
    family: 'Merriweather, serif',
    category: 'serif',
    weights: [400, 700],
    hasItalic: true,
  },
  {
    name: 'Lora',
    family: 'Lora, serif',
    category: 'serif',
    weights: [400, 500, 600, 700],
    hasItalic: true,
  },
  {
    name: 'Crimson Text',
    family: '"Crimson Text", serif',
    category: 'serif',
    weights: [400, 600, 700],
    hasItalic: true,
  },

  // Display - Bold headlines, impactful
  {
    name: 'Bebas Neue',
    family: '"Bebas Neue", sans-serif',
    category: 'display',
    weights: [400],
    hasItalic: false,
  },
  {
    name: 'Oswald',
    family: 'Oswald, sans-serif',
    category: 'display',
    weights: [400, 500, 600, 700],
    hasItalic: false,
  },
  {
    name: 'Montserrat',
    family: 'Montserrat, sans-serif',
    category: 'display',
    weights: [400, 500, 600, 700],
    hasItalic: true,
  },

  // Handwritten - Casual, personal, creative
  {
    name: 'Caveat',
    family: 'Caveat, cursive',
    category: 'handwritten',
    weights: [400, 500, 600, 700],
    hasItalic: false,
  },
  {
    name: 'Dancing Script',
    family: '"Dancing Script", cursive',
    category: 'handwritten',
    weights: [400, 500, 600, 700],
    hasItalic: false,
  },
  {
    name: 'Permanent Marker',
    family: '"Permanent Marker", cursive',
    category: 'handwritten',
    weights: [400],
    hasItalic: false,
  },
  {
    name: 'Pacifico',
    family: 'Pacifico, cursive',
    category: 'handwritten',
    weights: [400],
    hasItalic: false,
  },

  // Monospace - Code, technical, modern
  {
    name: 'JetBrains Mono',
    family: '"JetBrains Mono", monospace',
    category: 'monospace',
    weights: [400, 500, 700],
    hasItalic: true,
  },
  {
    name: 'Fira Code',
    family: '"Fira Code", monospace',
    category: 'monospace',
    weights: [400, 500, 700],
    hasItalic: false,
  },
  {
    name: 'Source Code Pro',
    family: '"Source Code Pro", monospace',
    category: 'monospace',
    weights: [400, 500, 700],
    hasItalic: true,
  },
];

/** Default font for new text objects */
export const DEFAULT_FONT = FONT_LIBRARY[0]; // Inter

/** Category display names for UI */
export const CATEGORY_LABELS: Record<FontCategory, string> = {
  'sans-serif': 'Sans Serif',
  'serif': 'Serif',
  'display': 'Display',
  'handwritten': 'Handwritten',
  'monospace': 'Monospace',
};

/** Get fonts grouped by category */
export function getFontsByCategory(): Map<FontCategory, FontDefinition[]> {
  const grouped = new Map<FontCategory, FontDefinition[]>();

  for (const font of FONT_LIBRARY) {
    const existing = grouped.get(font.category) || [];
    existing.push(font);
    grouped.set(font.category, existing);
  }

  return grouped;
}

/** Find a font definition by family string */
export function findFontByFamily(family: string): FontDefinition | undefined {
  return FONT_LIBRARY.find(f => f.family === family);
}

/** Get font definition by name */
export function findFontByName(name: string): FontDefinition | undefined {
  return FONT_LIBRARY.find(f => f.name.toLowerCase() === name.toLowerCase());
}
