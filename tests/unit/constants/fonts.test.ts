/**
 * Tests for font library constants
 *
 * Verifies font library has required categories and expected fonts
 */

import {
  FONT_LIBRARY,
  DEFAULT_FONT,
  CATEGORY_LABELS,
  getFontsByCategory,
  findFontByFamily,
  findFontByName,
  type FontCategory,
  type FontDefinition,
} from '../../../src/constants/fonts';

describe('fonts constants', () => {
  describe('FONT_LIBRARY', () => {
    it('contains 15-20 fonts (curated, not overwhelming)', () => {
      expect(FONT_LIBRARY.length).toBeGreaterThanOrEqual(15);
      expect(FONT_LIBRARY.length).toBeLessThanOrEqual(20);
    });

    it('contains all required categories', () => {
      const categories = new Set(FONT_LIBRARY.map(f => f.category));
      expect(categories.has('sans-serif')).toBe(true);
      expect(categories.has('serif')).toBe(true);
      expect(categories.has('display')).toBe(true);
      expect(categories.has('handwritten')).toBe(true);
      expect(categories.has('monospace')).toBe(true);
    });

    it('has at least 2 fonts per category', () => {
      const categories: FontCategory[] = ['sans-serif', 'serif', 'display', 'handwritten', 'monospace'];

      for (const category of categories) {
        const count = FONT_LIBRARY.filter(f => f.category === category).length;
        expect(count).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('required fonts', () => {
    it('includes Inter as first font (default)', () => {
      const inter = FONT_LIBRARY.find(f => f.name === 'Inter');
      expect(inter).toBeDefined();
      expect(FONT_LIBRARY[0].name).toBe('Inter');
    });

    it('includes JetBrains Mono (brand font)', () => {
      const jetbrains = FONT_LIBRARY.find(f => f.name === 'JetBrains Mono');
      expect(jetbrains).toBeDefined();
      expect(jetbrains?.category).toBe('monospace');
    });

    it('includes popular sans-serif fonts', () => {
      const names = FONT_LIBRARY.map(f => f.name);
      expect(names).toContain('Roboto');
      expect(names).toContain('Open Sans');
      expect(names).toContain('Poppins');
    });

    it('includes popular serif fonts', () => {
      const names = FONT_LIBRARY.map(f => f.name);
      expect(names).toContain('Playfair Display');
      expect(names).toContain('Merriweather');
    });

    it('includes popular display fonts', () => {
      const names = FONT_LIBRARY.map(f => f.name);
      expect(names).toContain('Bebas Neue');
      expect(names).toContain('Montserrat');
    });

    it('includes popular handwritten fonts', () => {
      const names = FONT_LIBRARY.map(f => f.name);
      expect(names).toContain('Caveat');
      expect(names).toContain('Dancing Script');
    });
  });

  describe('font definitions structure', () => {
    it('all fonts have required properties', () => {
      for (const font of FONT_LIBRARY) {
        expect(font.name).toBeDefined();
        expect(typeof font.name).toBe('string');
        expect(font.name.length).toBeGreaterThan(0);

        expect(font.family).toBeDefined();
        expect(typeof font.family).toBe('string');
        expect(font.family.length).toBeGreaterThan(0);

        expect(font.category).toBeDefined();
        expect(['sans-serif', 'serif', 'display', 'handwritten', 'monospace']).toContain(font.category);

        expect(font.weights).toBeDefined();
        expect(Array.isArray(font.weights)).toBe(true);
        expect(font.weights.length).toBeGreaterThan(0);

        expect(typeof font.hasItalic).toBe('boolean');
      }
    });

    it('all fonts have at least regular weight (400)', () => {
      for (const font of FONT_LIBRARY) {
        expect(font.weights).toContain(400);
      }
    });

    it('font families include fallback', () => {
      for (const font of FONT_LIBRARY) {
        // Should have a generic family fallback
        expect(font.family).toMatch(/(sans-serif|serif|cursive|monospace|system-ui)/);
      }
    });
  });

  describe('DEFAULT_FONT', () => {
    it('is Inter (professional, clean default)', () => {
      expect(DEFAULT_FONT.name).toBe('Inter');
    });

    it('is the first font in the library', () => {
      expect(DEFAULT_FONT).toBe(FONT_LIBRARY[0]);
    });

    it('is a sans-serif font', () => {
      expect(DEFAULT_FONT.category).toBe('sans-serif');
    });
  });

  describe('CATEGORY_LABELS', () => {
    it('has human-readable labels for all categories', () => {
      expect(CATEGORY_LABELS['sans-serif']).toBe('Sans Serif');
      expect(CATEGORY_LABELS['serif']).toBe('Serif');
      expect(CATEGORY_LABELS['display']).toBe('Display');
      expect(CATEGORY_LABELS['handwritten']).toBe('Handwritten');
      expect(CATEGORY_LABELS['monospace']).toBe('Monospace');
    });
  });

  describe('getFontsByCategory', () => {
    it('returns a map of categories to fonts', () => {
      const grouped = getFontsByCategory();
      expect(grouped).toBeInstanceOf(Map);
    });

    it('groups fonts correctly', () => {
      const grouped = getFontsByCategory();

      // Check sans-serif group contains expected fonts
      const sansSerif = grouped.get('sans-serif');
      expect(sansSerif).toBeDefined();
      expect(sansSerif?.some(f => f.name === 'Inter')).toBe(true);

      // Check monospace group contains expected fonts
      const monospace = grouped.get('monospace');
      expect(monospace).toBeDefined();
      expect(monospace?.some(f => f.name === 'JetBrains Mono')).toBe(true);
    });

    it('includes all fonts from library', () => {
      const grouped = getFontsByCategory();
      let totalFonts = 0;

      grouped.forEach((fonts) => {
        totalFonts += fonts.length;
      });

      expect(totalFonts).toBe(FONT_LIBRARY.length);
    });
  });

  describe('findFontByFamily', () => {
    it('finds font by exact family string', () => {
      const inter = findFontByFamily('Inter, system-ui, sans-serif');
      expect(inter).toBeDefined();
      expect(inter?.name).toBe('Inter');
    });

    it('returns undefined for unknown family', () => {
      const unknown = findFontByFamily('Unknown Font, sans-serif');
      expect(unknown).toBeUndefined();
    });
  });

  describe('findFontByName', () => {
    it('finds font by exact name', () => {
      const roboto = findFontByName('Roboto');
      expect(roboto).toBeDefined();
      expect(roboto?.name).toBe('Roboto');
    });

    it('finds font by name case-insensitively', () => {
      const inter = findFontByName('inter');
      expect(inter).toBeDefined();
      expect(inter?.name).toBe('Inter');

      const jetbrains = findFontByName('JETBRAINS MONO');
      expect(jetbrains).toBeDefined();
      expect(jetbrains?.name).toBe('JetBrains Mono');
    });

    it('returns undefined for unknown name', () => {
      const unknown = findFontByName('Comic Sans');
      expect(unknown).toBeUndefined();
    });
  });
});
