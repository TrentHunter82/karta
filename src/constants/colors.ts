/**
 * Brand Color Constants
 *
 * Teenage Engineering inspired palette with #FF5500 as accent.
 * These constants ensure consistency across all tools and components.
 */

// Brand Colors
export const COLOR_ACCENT = '#FF5500';
export const COLOR_ACCENT_HOVER = '#FF6B1A';
export const COLOR_WHITE = '#ffffff';

// Background Colors (from dark to light)
export const COLOR_BG_PRIMARY = '#121212';
export const COLOR_BG_SECONDARY = '#1a1a1a';
export const COLOR_BG_TERTIARY = '#2a2a2a';

// Neutral Colors
export const COLOR_NEUTRAL_DARK = '#3a3a3a';
export const COLOR_NEUTRAL_MID = '#4a4a4a';
export const COLOR_NEUTRAL_LIGHT = '#666666';

/**
 * Default Shape Colors
 *
 * Rectangle/Ellipse: Accent stroke for visibility on dark canvas
 * - Fill: transparent for lightweight appearance
 * - Stroke: accent orange for brand consistency
 * - StrokeWidth: 2px for visibility
 */
export const DEFAULT_SHAPE_FILL = 'transparent';
export const DEFAULT_SHAPE_STROKE = COLOR_ACCENT;
export const DEFAULT_SHAPE_STROKE_WIDTH = 2;

/**
 * Frame Colors
 *
 * Frames are containers - subtle appearance to not distract from content
 */
export const DEFAULT_FRAME_FILL = COLOR_BG_TERTIARY;
export const DEFAULT_FRAME_STROKE = COLOR_NEUTRAL_DARK;
export const DEFAULT_FRAME_STROKE_WIDTH = 1;

/**
 * Line/Arrow Colors
 *
 * White stroke for maximum visibility on dark background
 */
export const DEFAULT_LINE_STROKE = COLOR_WHITE;
export const DEFAULT_LINE_STROKE_WIDTH = 2;
