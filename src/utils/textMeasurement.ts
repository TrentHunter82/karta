export interface TextMeasurementParams {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  lineHeight: number;
}

export interface TextDimensions {
  width: number;
  height: number;
}

let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
    measureCtx = measureCanvas.getContext('2d');
  }
  return measureCtx!;
}

export function measureTextDimensions(params: TextMeasurementParams): TextDimensions {
  const { text, fontSize, fontFamily, fontWeight, fontStyle, lineHeight } = params;

  const ctx = getMeasureContext();
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

  const lines = text.split('\n');
  const lineHeightPx = fontSize * lineHeight;

  let maxWidth = 0;
  for (const line of lines) {
    const metrics = ctx.measureText(line || ' ');
    maxWidth = Math.max(maxWidth, metrics.width);
  }

  const totalHeight = Math.max(lines.length, 1) * lineHeightPx;

  const MIN_WIDTH = 20;
  const PADDING = 4;

  const result = {
    width: Math.max(maxWidth + PADDING, MIN_WIDTH),
    height: Math.max(totalHeight, lineHeightPx),
  };

  console.log('[measureTextDimensions]', { text, fontSize, fontFamily, result });

  return result;
}
