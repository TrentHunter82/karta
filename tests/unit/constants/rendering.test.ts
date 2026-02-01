import {
  MAX_IMPORTED_IMAGE_SIZE,
  IMAGE_CACHE_MAX_SIZE,
  VIDEO_CACHE_MAX_SIZE,
  TEMPLATE_PREVIEW_SIZE,
  TEMPLATE_PREVIEW_PADDING,
  EXPORT_PREVIEW_PADDING,
  MIN_TEXT_WIDTH,
  DEFAULT_TOAST_DURATION_MS,
  ERROR_TOAST_DURATION_MS,
  QUADTREE_MAX_ITEMS,
  QUADTREE_MAX_DEPTH,
} from '../../../src/constants/rendering';

describe('rendering constants', () => {
  describe('exports exist', () => {
    it('exports MAX_IMPORTED_IMAGE_SIZE', () => {
      expect(MAX_IMPORTED_IMAGE_SIZE).toBeDefined();
      expect(typeof MAX_IMPORTED_IMAGE_SIZE).toBe('number');
    });

    it('exports IMAGE_CACHE_MAX_SIZE', () => {
      expect(IMAGE_CACHE_MAX_SIZE).toBeDefined();
      expect(typeof IMAGE_CACHE_MAX_SIZE).toBe('number');
    });

    it('exports VIDEO_CACHE_MAX_SIZE', () => {
      expect(VIDEO_CACHE_MAX_SIZE).toBeDefined();
      expect(typeof VIDEO_CACHE_MAX_SIZE).toBe('number');
    });

    it('exports TEMPLATE_PREVIEW_SIZE', () => {
      expect(TEMPLATE_PREVIEW_SIZE).toBeDefined();
      expect(typeof TEMPLATE_PREVIEW_SIZE).toBe('number');
    });

    it('exports TEMPLATE_PREVIEW_PADDING', () => {
      expect(TEMPLATE_PREVIEW_PADDING).toBeDefined();
      expect(typeof TEMPLATE_PREVIEW_PADDING).toBe('number');
    });

    it('exports EXPORT_PREVIEW_PADDING', () => {
      expect(EXPORT_PREVIEW_PADDING).toBeDefined();
      expect(typeof EXPORT_PREVIEW_PADDING).toBe('number');
    });

    it('exports MIN_TEXT_WIDTH', () => {
      expect(MIN_TEXT_WIDTH).toBeDefined();
      expect(typeof MIN_TEXT_WIDTH).toBe('number');
    });

    it('exports DEFAULT_TOAST_DURATION_MS', () => {
      expect(DEFAULT_TOAST_DURATION_MS).toBeDefined();
      expect(typeof DEFAULT_TOAST_DURATION_MS).toBe('number');
    });

    it('exports ERROR_TOAST_DURATION_MS', () => {
      expect(ERROR_TOAST_DURATION_MS).toBeDefined();
      expect(typeof ERROR_TOAST_DURATION_MS).toBe('number');
    });

    it('exports QUADTREE_MAX_ITEMS', () => {
      expect(QUADTREE_MAX_ITEMS).toBeDefined();
      expect(typeof QUADTREE_MAX_ITEMS).toBe('number');
    });

    it('exports QUADTREE_MAX_DEPTH', () => {
      expect(QUADTREE_MAX_DEPTH).toBeDefined();
      expect(typeof QUADTREE_MAX_DEPTH).toBe('number');
    });
  });

  describe('value validation', () => {
    it('MAX_IMPORTED_IMAGE_SIZE is a reasonable size', () => {
      expect(MAX_IMPORTED_IMAGE_SIZE).toBeGreaterThan(100);
      expect(MAX_IMPORTED_IMAGE_SIZE).toBeLessThan(10000);
    });

    it('IMAGE_CACHE_MAX_SIZE is positive', () => {
      expect(IMAGE_CACHE_MAX_SIZE).toBeGreaterThan(0);
    });

    it('VIDEO_CACHE_MAX_SIZE is positive', () => {
      expect(VIDEO_CACHE_MAX_SIZE).toBeGreaterThan(0);
    });

    it('TEMPLATE_PREVIEW_SIZE is positive', () => {
      expect(TEMPLATE_PREVIEW_SIZE).toBeGreaterThan(0);
    });

    it('TEMPLATE_PREVIEW_PADDING is non-negative', () => {
      expect(TEMPLATE_PREVIEW_PADDING).toBeGreaterThanOrEqual(0);
    });

    it('EXPORT_PREVIEW_PADDING is non-negative', () => {
      expect(EXPORT_PREVIEW_PADDING).toBeGreaterThanOrEqual(0);
    });

    it('MIN_TEXT_WIDTH is positive', () => {
      expect(MIN_TEXT_WIDTH).toBeGreaterThan(0);
    });

    it('DEFAULT_TOAST_DURATION_MS is a reasonable duration', () => {
      expect(DEFAULT_TOAST_DURATION_MS).toBeGreaterThan(500);
      expect(DEFAULT_TOAST_DURATION_MS).toBeLessThan(30000);
    });

    it('ERROR_TOAST_DURATION_MS is longer than default', () => {
      expect(ERROR_TOAST_DURATION_MS).toBeGreaterThanOrEqual(DEFAULT_TOAST_DURATION_MS);
    });

    it('QUADTREE_MAX_ITEMS is a reasonable limit', () => {
      expect(QUADTREE_MAX_ITEMS).toBeGreaterThan(0);
      expect(QUADTREE_MAX_ITEMS).toBeLessThan(1000);
    });

    it('QUADTREE_MAX_DEPTH is a reasonable depth', () => {
      expect(QUADTREE_MAX_DEPTH).toBeGreaterThan(0);
      expect(QUADTREE_MAX_DEPTH).toBeLessThan(20);
    });
  });
});
