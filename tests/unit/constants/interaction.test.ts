import {
  ZOOM_SENSITIVITY,
  ZOOM_KEYBOARD_FACTOR,
  DOUBLE_CLICK_THRESHOLD_MS,
  SNAP_THRESHOLD_PX,
  HANDLE_SIZE_PX,
  ROTATION_HANDLE_OFFSET_PX,
  FILE_DROP_OFFSET_INCREMENT,
  EDGE_FADE_SIZE_PX,
  SELECTION_ANIMATION_DURATION_MS,
  PATH_SCALE_EPSILON,
} from '../../../src/constants/interaction';

describe('interaction constants', () => {
  describe('exports exist', () => {
    it('exports ZOOM_SENSITIVITY', () => {
      expect(ZOOM_SENSITIVITY).toBeDefined();
      expect(typeof ZOOM_SENSITIVITY).toBe('number');
    });

    it('exports ZOOM_KEYBOARD_FACTOR', () => {
      expect(ZOOM_KEYBOARD_FACTOR).toBeDefined();
      expect(typeof ZOOM_KEYBOARD_FACTOR).toBe('number');
    });

    it('exports DOUBLE_CLICK_THRESHOLD_MS', () => {
      expect(DOUBLE_CLICK_THRESHOLD_MS).toBeDefined();
      expect(typeof DOUBLE_CLICK_THRESHOLD_MS).toBe('number');
    });

    it('exports SNAP_THRESHOLD_PX', () => {
      expect(SNAP_THRESHOLD_PX).toBeDefined();
      expect(typeof SNAP_THRESHOLD_PX).toBe('number');
    });

    it('exports HANDLE_SIZE_PX', () => {
      expect(HANDLE_SIZE_PX).toBeDefined();
      expect(typeof HANDLE_SIZE_PX).toBe('number');
    });

    it('exports ROTATION_HANDLE_OFFSET_PX', () => {
      expect(ROTATION_HANDLE_OFFSET_PX).toBeDefined();
      expect(typeof ROTATION_HANDLE_OFFSET_PX).toBe('number');
    });

    it('exports FILE_DROP_OFFSET_INCREMENT', () => {
      expect(FILE_DROP_OFFSET_INCREMENT).toBeDefined();
      expect(typeof FILE_DROP_OFFSET_INCREMENT).toBe('number');
    });

    it('exports EDGE_FADE_SIZE_PX', () => {
      expect(EDGE_FADE_SIZE_PX).toBeDefined();
      expect(typeof EDGE_FADE_SIZE_PX).toBe('number');
    });

    it('exports SELECTION_ANIMATION_DURATION_MS', () => {
      expect(SELECTION_ANIMATION_DURATION_MS).toBeDefined();
      expect(typeof SELECTION_ANIMATION_DURATION_MS).toBe('number');
    });

    it('exports PATH_SCALE_EPSILON', () => {
      expect(PATH_SCALE_EPSILON).toBeDefined();
      expect(typeof PATH_SCALE_EPSILON).toBe('number');
    });
  });

  describe('value validation', () => {
    it('ZOOM_SENSITIVITY is a small positive number', () => {
      expect(ZOOM_SENSITIVITY).toBeGreaterThan(0);
      expect(ZOOM_SENSITIVITY).toBeLessThan(1);
    });

    it('ZOOM_KEYBOARD_FACTOR is greater than 1', () => {
      expect(ZOOM_KEYBOARD_FACTOR).toBeGreaterThan(1);
    });

    it('DOUBLE_CLICK_THRESHOLD_MS is a reasonable threshold', () => {
      expect(DOUBLE_CLICK_THRESHOLD_MS).toBeGreaterThan(100);
      expect(DOUBLE_CLICK_THRESHOLD_MS).toBeLessThan(1000);
    });

    it('SNAP_THRESHOLD_PX is positive', () => {
      expect(SNAP_THRESHOLD_PX).toBeGreaterThan(0);
    });

    it('HANDLE_SIZE_PX is positive', () => {
      expect(HANDLE_SIZE_PX).toBeGreaterThan(0);
    });

    it('ROTATION_HANDLE_OFFSET_PX is positive', () => {
      expect(ROTATION_HANDLE_OFFSET_PX).toBeGreaterThan(0);
    });

    it('FILE_DROP_OFFSET_INCREMENT is positive', () => {
      expect(FILE_DROP_OFFSET_INCREMENT).toBeGreaterThan(0);
    });

    it('EDGE_FADE_SIZE_PX is positive', () => {
      expect(EDGE_FADE_SIZE_PX).toBeGreaterThan(0);
    });

    it('SELECTION_ANIMATION_DURATION_MS is positive', () => {
      expect(SELECTION_ANIMATION_DURATION_MS).toBeGreaterThan(0);
    });

    it('PATH_SCALE_EPSILON is a small positive number', () => {
      expect(PATH_SCALE_EPSILON).toBeGreaterThan(0);
      expect(PATH_SCALE_EPSILON).toBeLessThan(1);
    });
  });
});
