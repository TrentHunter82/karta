import { measureTextDimensions, type TextMeasurementParams } from '../../../src/utils/textMeasurement';

// Mock canvas context for text measurement
const mockMeasureText = vi.fn();
const mockContext = {
  font: '',
  measureText: mockMeasureText,
};

vi.stubGlobal('document', {
  createElement: vi.fn(() => ({
    getContext: vi.fn(() => mockContext),
  })),
});

describe('measureTextDimensions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMeasureText.mockReturnValue({ width: 100 });
  });

  const defaultParams: TextMeasurementParams = {
    text: 'Hello World',
    fontSize: 16,
    fontFamily: 'Arial',
    fontWeight: 400,
    fontStyle: 'normal',
    lineHeight: 1.2,
  };

  it('sets correct font on context', () => {
    measureTextDimensions(defaultParams);
    expect(mockContext.font).toBe('normal 400 16px Arial');
  });

  it('sets italic font style correctly', () => {
    measureTextDimensions({ ...defaultParams, fontStyle: 'italic' });
    expect(mockContext.font).toBe('italic 400 16px Arial');
  });

  it('handles bold font weight', () => {
    measureTextDimensions({ ...defaultParams, fontWeight: 700 });
    expect(mockContext.font).toBe('normal 700 16px Arial');
  });

  it('measures single line text', () => {
    mockMeasureText.mockReturnValue({ width: 80 });
    const result = measureTextDimensions(defaultParams);
    // width = max(80 + 4 padding, 20 MIN_WIDTH) = 84
    expect(result.width).toBe(84);
    // height = max(1 line * 16 * 1.2, 16 * 1.2) = 19.2
    expect(result.height).toBe(19.2);
  });

  it('measures multi-line text', () => {
    mockMeasureText.mockReturnValue({ width: 50 });
    const result = measureTextDimensions({
      ...defaultParams,
      text: 'Line 1\nLine 2\nLine 3',
    });
    // 3 lines * 16 * 1.2 = 57.6
    expect(result.height).toBeCloseTo(57.6, 5);
  });

  it('returns max width across multiple lines', () => {
    mockMeasureText
      .mockReturnValueOnce({ width: 50 })
      .mockReturnValueOnce({ width: 100 })
      .mockReturnValueOnce({ width: 75 });

    const result = measureTextDimensions({
      ...defaultParams,
      text: 'Short\nLongest line here\nMedium',
    });
    // width = max(100 + 4, 20) = 104
    expect(result.width).toBe(104);
  });

  it('enforces minimum width', () => {
    mockMeasureText.mockReturnValue({ width: 5 });
    const result = measureTextDimensions({
      ...defaultParams,
      text: 'a',
    });
    // MIN_WIDTH is 20
    expect(result.width).toBe(20);
  });

  it('handles empty text', () => {
    mockMeasureText.mockReturnValue({ width: 5 });
    const result = measureTextDimensions({
      ...defaultParams,
      text: '',
    });
    // Should still return valid dimensions
    expect(result.width).toBeGreaterThanOrEqual(20);
    expect(result.height).toBeGreaterThan(0);
  });

  it('measures empty lines with space character', () => {
    const params = { ...defaultParams, text: 'Line\n\nAnother' };
    measureTextDimensions(params);
    // The empty line should be measured as ' ' (space)
    expect(mockMeasureText).toHaveBeenCalledWith(' ');
  });

  it('calculates height based on lineHeight multiplier', () => {
    mockMeasureText.mockReturnValue({ width: 50 });
    const result = measureTextDimensions({
      ...defaultParams,
      fontSize: 20,
      lineHeight: 1.5,
      text: 'Single line',
    });
    // 1 line * 20 * 1.5 = 30
    expect(result.height).toBe(30);
  });

  it('handles different font families', () => {
    measureTextDimensions({
      ...defaultParams,
      fontFamily: '"JetBrains Mono", monospace',
    });
    expect(mockContext.font).toBe('normal 400 16px "JetBrains Mono", monospace');
  });
});
