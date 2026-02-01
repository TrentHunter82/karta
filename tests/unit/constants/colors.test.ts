/**
 * Tests for color constants
 *
 * Verifies brand colors and default shape colors are correctly defined
 */

import {
  COLOR_ACCENT,
  COLOR_ACCENT_HOVER,
  COLOR_WHITE,
  COLOR_BG_PRIMARY,
  COLOR_BG_SECONDARY,
  COLOR_BG_TERTIARY,
  COLOR_NEUTRAL_DARK,
  COLOR_NEUTRAL_MID,
  COLOR_NEUTRAL_LIGHT,
  DEFAULT_SHAPE_FILL,
  DEFAULT_SHAPE_STROKE,
  DEFAULT_SHAPE_STROKE_WIDTH,
  DEFAULT_FRAME_FILL,
  DEFAULT_FRAME_STROKE,
  DEFAULT_FRAME_STROKE_WIDTH,
  DEFAULT_LINE_STROKE,
  DEFAULT_LINE_STROKE_WIDTH,
} from '../../../src/constants/colors';

describe('colors constants', () => {
  describe('brand colors', () => {
    it('has TE Orange as accent color', () => {
      expect(COLOR_ACCENT).toBe('#FF5500');
    });

    it('has lighter orange for hover state', () => {
      expect(COLOR_ACCENT_HOVER).toBe('#FF6B1A');
    });

    it('has white color defined', () => {
      expect(COLOR_WHITE).toBe('#ffffff');
    });
  });

  describe('background colors', () => {
    it('has dark backgrounds from dark to light', () => {
      // Primary is darkest
      expect(COLOR_BG_PRIMARY).toBe('#121212');
      // Secondary is slightly lighter
      expect(COLOR_BG_SECONDARY).toBe('#1a1a1a');
      // Tertiary is lightest
      expect(COLOR_BG_TERTIARY).toBe('#2a2a2a');
    });

    it('backgrounds follow luminance ordering', () => {
      // Convert hex to numeric for comparison (simpler than full luminance calc)
      const primary = parseInt(COLOR_BG_PRIMARY.slice(1), 16);
      const secondary = parseInt(COLOR_BG_SECONDARY.slice(1), 16);
      const tertiary = parseInt(COLOR_BG_TERTIARY.slice(1), 16);

      expect(primary).toBeLessThan(secondary);
      expect(secondary).toBeLessThan(tertiary);
    });
  });

  describe('neutral colors', () => {
    it('has neutral palette from dark to light', () => {
      expect(COLOR_NEUTRAL_DARK).toBe('#3a3a3a');
      expect(COLOR_NEUTRAL_MID).toBe('#4a4a4a');
      expect(COLOR_NEUTRAL_LIGHT).toBe('#666666');
    });
  });

  describe('default shape colors', () => {
    it('uses transparent fill for shapes', () => {
      expect(DEFAULT_SHAPE_FILL).toBe('transparent');
    });

    it('uses accent color for shape stroke', () => {
      expect(DEFAULT_SHAPE_STROKE).toBe(COLOR_ACCENT);
      expect(DEFAULT_SHAPE_STROKE).toBe('#FF5500');
    });

    it('uses 2px stroke width for visibility', () => {
      expect(DEFAULT_SHAPE_STROKE_WIDTH).toBe(2);
    });
  });

  describe('default frame colors', () => {
    it('uses tertiary background for frame fill', () => {
      expect(DEFAULT_FRAME_FILL).toBe(COLOR_BG_TERTIARY);
      expect(DEFAULT_FRAME_FILL).toBe('#2a2a2a');
    });

    it('uses neutral dark for frame stroke', () => {
      expect(DEFAULT_FRAME_STROKE).toBe(COLOR_NEUTRAL_DARK);
      expect(DEFAULT_FRAME_STROKE).toBe('#3a3a3a');
    });

    it('uses 1px stroke width for subtle appearance', () => {
      expect(DEFAULT_FRAME_STROKE_WIDTH).toBe(1);
    });
  });

  describe('default line/arrow colors', () => {
    it('uses white for line stroke (visibility on dark bg)', () => {
      expect(DEFAULT_LINE_STROKE).toBe(COLOR_WHITE);
      expect(DEFAULT_LINE_STROKE).toBe('#ffffff');
    });

    it('uses 2px stroke width for visibility', () => {
      expect(DEFAULT_LINE_STROKE_WIDTH).toBe(2);
    });
  });

  describe('color format validation', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

    it('all hex colors are valid 6-digit format', () => {
      const hexColors = [
        COLOR_ACCENT,
        COLOR_ACCENT_HOVER,
        COLOR_WHITE,
        COLOR_BG_PRIMARY,
        COLOR_BG_SECONDARY,
        COLOR_BG_TERTIARY,
        COLOR_NEUTRAL_DARK,
        COLOR_NEUTRAL_MID,
        COLOR_NEUTRAL_LIGHT,
      ];

      for (const color of hexColors) {
        expect(color).toMatch(hexColorRegex);
      }
    });
  });
});
