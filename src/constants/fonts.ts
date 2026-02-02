/**
 * Curated font library for Karta text tool
 *
 * Based on 2026 typography trends and top advertising agency preferences.
 * Sources: Creative Boom, Typewolf, Fontfabric, Google Fonts analytics,
 *          Adobe Fonts trends, Envato Elements, Creative Bloq
 *
 * Selection criteria:
 * - Free and open source (Google Fonts)
 * - High quality and widely used by top agencies
 * - Good coverage of 2026 trends (bold expression, retro revival, variable fonts)
 * - Better than Figma's default offering
 */

export type FontCategory =
  | 'sans-serif'
  | 'serif'
  | 'display'
  | 'retro'
  | 'handwritten'
  | 'monospace';

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
  /** Brief description for tooltip (optional) */
  description?: string;
}

/**
 * Designer-curated font library - 40+ fonts across 6 categories
 * Organized to beat Figma's default font selection
 */
export const FONT_LIBRARY: FontDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // SANS-SERIF - Clean, modern, highly readable
  // Top picks for UI, tech brands, corporate design
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Inter',
    family: 'Inter, system-ui, sans-serif',
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    hasItalic: false,
    description: 'Screen-optimized, 414B+ views. Industry standard.',
  },
  {
    name: 'Roboto',
    family: 'Roboto, sans-serif',
    category: 'sans-serif',
    weights: [400, 500, 700],
    hasItalic: true,
    description: 'Google\'s flagship. Neo-grotesque, universal.',
  },
  {
    name: 'Open Sans',
    family: '"Open Sans", sans-serif',
    category: 'sans-serif',
    weights: [400, 600, 700],
    hasItalic: true,
    description: 'Humanist warmth, exceptional legibility.',
  },
  {
    name: 'Poppins',
    family: 'Poppins, sans-serif',
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    hasItalic: true,
    description: 'Geometric with soft curves. Startup favorite.',
  },
  {
    name: 'Space Grotesk',
    family: '"Space Grotesk", sans-serif',
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    hasItalic: false,
    description: 'Futuristic tech vibe. Trending in 2026.',
  },
  {
    name: 'DM Sans',
    family: '"DM Sans", sans-serif',
    category: 'sans-serif',
    weights: [400, 500, 700],
    hasItalic: true,
    description: 'Low-contrast geometric. Screen-optimized.',
  },
  {
    name: 'Outfit',
    family: 'Outfit, sans-serif',
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    hasItalic: false,
    description: 'Clean geometric. Versatile workhorse.',
  },
  {
    name: 'Plus Jakarta Sans',
    family: '"Plus Jakarta Sans", sans-serif',
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    hasItalic: true,
    description: 'Modern geometric with humanist touches.',
  },
  {
    name: 'Work Sans',
    family: '"Work Sans", sans-serif',
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    hasItalic: true,
    description: 'Optimized for screens. Great for UI.',
  },
  {
    name: 'Nunito',
    family: 'Nunito, sans-serif',
    category: 'sans-serif',
    weights: [400, 600, 700],
    hasItalic: true,
    description: 'Rounded terminals. Friendly and balanced.',
  },
  {
    name: 'Lato',
    family: 'Lato, sans-serif',
    category: 'sans-serif',
    weights: [400, 700],
    hasItalic: true,
    description: 'Semi-rounded. Figma Pairings Guide pick.',
  },
  {
    name: 'Manrope',
    family: 'Manrope, sans-serif',
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    hasItalic: false,
    description: 'Modern geometric grotesque. Rising star.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SERIF - Elegant, editorial, luxury
  // For sophisticated brands, publishing, high-end aesthetics
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Playfair Display',
    family: '"Playfair Display", serif',
    category: 'serif',
    weights: [400, 500, 600, 700],
    hasItalic: true,
    description: '18th-century elegance. Luxury brand staple.',
  },
  {
    name: 'Merriweather',
    family: 'Merriweather, serif',
    category: 'serif',
    weights: [400, 700],
    hasItalic: true,
    description: 'Designed for screens. Editorial excellence.',
  },
  {
    name: 'Lora',
    family: 'Lora, serif',
    category: 'serif',
    weights: [400, 500, 600, 700],
    hasItalic: true,
    description: 'Contemporary serif. Print and digital.',
  },
  {
    name: 'Libre Baskerville',
    family: '"Libre Baskerville", serif',
    category: 'serif',
    weights: [400, 700],
    hasItalic: true,
    description: 'Classic Baskerville for body text.',
  },
  {
    name: 'Cormorant Garamond',
    family: '"Cormorant Garamond", serif',
    category: 'serif',
    weights: [400, 500, 600, 700],
    hasItalic: true,
    description: 'Elegant display Garamond. High contrast.',
  },
  {
    name: 'DM Serif Display',
    family: '"DM Serif Display", serif',
    category: 'serif',
    weights: [400],
    hasItalic: true,
    description: 'High-contrast headlines. Modern classic.',
  },
  {
    name: 'Abril Fatface',
    family: '"Abril Fatface", serif',
    category: 'serif',
    weights: [400],
    hasItalic: false,
    description: 'Bold advertising poster style. Impactful.',
  },
  {
    name: 'Crimson Pro',
    family: '"Crimson Pro", serif',
    category: 'serif',
    weights: [400, 500, 600, 700],
    hasItalic: true,
    description: 'Book-inspired. Long-form reading.',
  },
  {
    name: 'Source Serif 4',
    family: '"Source Serif 4", serif',
    category: 'serif',
    weights: [400, 600, 700],
    hasItalic: true,
    description: 'Adobe\'s open source serif. Professional.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPLAY - Bold headlines, maximum impact
  // For hero text, announcements, brand statements
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Bebas Neue',
    family: '"Bebas Neue", sans-serif',
    category: 'display',
    weights: [400],
    hasItalic: false,
    description: 'All-caps impact. Poster favorite.',
  },
  {
    name: 'Oswald',
    family: 'Oswald, sans-serif',
    category: 'display',
    weights: [400, 500, 600, 700],
    hasItalic: false,
    description: 'Condensed headlines. Strong presence.',
  },
  {
    name: 'Montserrat',
    family: 'Montserrat, sans-serif',
    category: 'display',
    weights: [400, 500, 600, 700, 800, 900],
    hasItalic: true,
    description: 'Urban signage inspired. Geometric power.',
  },
  {
    name: 'Anton',
    family: 'Anton, sans-serif',
    category: 'display',
    weights: [400],
    hasItalic: false,
    description: 'Bold condensed. Maximum impact.',
  },
  {
    name: 'Archivo Black',
    family: '"Archivo Black", sans-serif',
    category: 'display',
    weights: [400],
    hasItalic: false,
    description: 'Heavy grotesque. Statement maker.',
  },
  {
    name: 'Alfa Slab One',
    family: '"Alfa Slab One", serif',
    category: 'display',
    weights: [400],
    hasItalic: false,
    description: 'Slab serif impact. Advertising staple.',
  },
  {
    name: 'Bungee',
    family: 'Bungee, sans-serif',
    category: 'display',
    weights: [400],
    hasItalic: false,
    description: 'Bold, colorful, signage-inspired.',
  },
  {
    name: 'Rubik',
    family: 'Rubik, sans-serif',
    category: 'display',
    weights: [400, 500, 600, 700, 800, 900],
    hasItalic: true,
    description: 'Slightly rounded. Friendly but strong.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RETRO - Vintage, groovy, nostalgic
  // 2026 trend: Mutant Heritage, 70s revival, funky serifs
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Righteous',
    family: 'Righteous, sans-serif',
    category: 'retro',
    weights: [400],
    hasItalic: false,
    description: '70s swagger. Flower power vibes.',
  },
  {
    name: 'Lobster',
    family: 'Lobster, cursive',
    category: 'retro',
    weights: [400],
    hasItalic: false,
    description: 'Retro script charm. Vintage ads.',
  },
  {
    name: 'Monoton',
    family: 'Monoton, sans-serif',
    category: 'retro',
    weights: [400],
    hasItalic: false,
    description: '80s disco glam. Parallel line effect.',
  },
  {
    name: 'Yellowtail',
    family: 'Yellowtail, cursive',
    category: 'retro',
    weights: [400],
    hasItalic: false,
    description: '60s script. Vintage signage style.',
  },
  {
    name: 'Passion One',
    family: '"Passion One", sans-serif',
    category: 'retro',
    weights: [400, 700],
    hasItalic: false,
    description: 'Bold condensed. Sports/action vibe.',
  },
  {
    name: 'Fredoka',
    family: 'Fredoka, sans-serif',
    category: 'retro',
    weights: [400, 500, 600, 700],
    hasItalic: false,
    description: 'Rounded, playful. Friendly retro.',
  },
  {
    name: 'Fascinate',
    family: 'Fascinate, sans-serif',
    category: 'retro',
    weights: [400],
    hasItalic: false,
    description: '70s glamour. Art deco influence.',
  },
  {
    name: 'Press Start 2P',
    family: '"Press Start 2P", monospace',
    category: 'retro',
    weights: [400],
    hasItalic: false,
    description: '80s arcade pixel. Gaming nostalgia.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDWRITTEN - Scripts, casual, personal
  // For invitations, personal brands, creative projects
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Caveat',
    family: 'Caveat, cursive',
    category: 'handwritten',
    weights: [400, 500, 600, 700],
    hasItalic: false,
    description: 'Natural handwriting. Casual notes.',
  },
  {
    name: 'Dancing Script',
    family: '"Dancing Script", cursive',
    category: 'handwritten',
    weights: [400, 500, 600, 700],
    hasItalic: false,
    description: 'Lively, bouncy script. Celebrations.',
  },
  {
    name: 'Pacifico',
    family: 'Pacifico, cursive',
    category: 'handwritten',
    weights: [400],
    hasItalic: false,
    description: 'Surf culture. Retro California.',
  },
  {
    name: 'Permanent Marker',
    family: '"Permanent Marker", cursive',
    category: 'handwritten',
    weights: [400],
    hasItalic: false,
    description: 'Bold marker stroke. Urgent, raw.',
  },
  {
    name: 'Satisfy',
    family: 'Satisfy, cursive',
    category: 'handwritten',
    weights: [400],
    hasItalic: false,
    description: 'Elegant brush script. Sophisticated.',
  },
  {
    name: 'Sacramento',
    family: 'Sacramento, cursive',
    category: 'handwritten',
    weights: [400],
    hasItalic: false,
    description: 'Calligraphy-inspired. Wedding favorite.',
  },
  {
    name: 'Indie Flower',
    family: '"Indie Flower", cursive',
    category: 'handwritten',
    weights: [400],
    hasItalic: false,
    description: 'Casual doodle style. Playful.',
  },
  {
    name: 'Kalam',
    family: 'Kalam, cursive',
    category: 'handwritten',
    weights: [400, 700],
    hasItalic: false,
    description: 'Natural handwriting. Authentic.',
  },
  {
    name: 'Amatic SC',
    family: '"Amatic SC", cursive',
    category: 'handwritten',
    weights: [400, 700],
    hasItalic: false,
    description: 'Hand-drawn narrow. Artisan feel.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MONOSPACE - Code, technical, modern
  // For developers, tech brands, data visualization
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'JetBrains Mono',
    family: '"JetBrains Mono", monospace',
    category: 'monospace',
    weights: [400, 500, 700],
    hasItalic: true,
    description: 'Developer favorite. Ligature support.',
  },
  {
    name: 'Fira Code',
    family: '"Fira Code", monospace',
    category: 'monospace',
    weights: [400, 500, 700],
    hasItalic: false,
    description: 'Coding ligatures. Mozilla heritage.',
  },
  {
    name: 'Source Code Pro',
    family: '"Source Code Pro", monospace',
    category: 'monospace',
    weights: [400, 500, 700],
    hasItalic: true,
    description: 'Adobe\'s code font. Clean, professional.',
  },
  {
    name: 'Space Mono',
    family: '"Space Mono", monospace',
    category: 'monospace',
    weights: [400, 700],
    hasItalic: true,
    description: 'Futuristic mono. Tech brand aesthetic.',
  },
  {
    name: 'IBM Plex Mono',
    family: '"IBM Plex Mono", monospace',
    category: 'monospace',
    weights: [400, 500, 700],
    hasItalic: true,
    description: 'Enterprise quality. 300K+ IBM users.',
  },
  {
    name: 'Inconsolata',
    family: 'Inconsolata, monospace',
    category: 'monospace',
    weights: [400, 700],
    hasItalic: false,
    description: 'Classic coding font. Highly legible.',
  },
  {
    name: 'Roboto Mono',
    family: '"Roboto Mono", monospace',
    category: 'monospace',
    weights: [400, 500, 700],
    hasItalic: true,
    description: 'Roboto\'s monospace sibling. Versatile.',
  },
];

/** Default font for new text objects */
export const DEFAULT_FONT = FONT_LIBRARY[0]; // Inter

/** Category display names for UI */
export const CATEGORY_LABELS: Record<FontCategory, string> = {
  'sans-serif': 'Sans Serif',
  'serif': 'Serif',
  'display': 'Display',
  'retro': 'Retro & Groovy',
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
  return FONT_LIBRARY.find((f) => f.family === family);
}

/** Get font definition by name */
export function findFontByName(name: string): FontDefinition | undefined {
  return FONT_LIBRARY.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

/** Get total font count */
export function getFontCount(): number {
  return FONT_LIBRARY.length;
}

/** Get fonts by category name */
export function getFontsInCategory(category: FontCategory): FontDefinition[] {
  return FONT_LIBRARY.filter((f) => f.category === category);
}
