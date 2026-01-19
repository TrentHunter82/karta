import { useCanvasStore } from '../../../stores/canvasStore';
import { NumberInput } from '../inputs/NumberInput';
import { ColorInput } from '../inputs/ColorInput';
import { SelectInput } from '../inputs/SelectInput';
import { getSharedValue, getSharedNumber } from '../utils';
import { measureTextDimensions } from '../../../utils/textMeasurement';
import type { TextObject } from '../../../types/canvas';

interface TextSectionProps {
  objects: TextObject[];
}

const FONT_FAMILIES = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'SF Mono, Monaco, Consolas, monospace', label: 'SF Mono' },
];

export function TextSection({ objects }: TextSectionProps) {
  const updateObject = useCanvasStore((s) => s.updateObject);
  const updateObjects = useCanvasStore((s) => s.updateObjects);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  const fontFamily = getSharedValue(objects, (o) => o.fontFamily);
  const fontSize = getSharedNumber(objects, (o) => o.fontSize);
  const textAlign = getSharedValue(objects, (o) => o.textAlign);
  const lineHeight = getSharedValue(objects, (o) => o.lineHeight);
  const fill = getSharedValue(objects, (o) => o.fill ?? '#ffffff');

  const handleFontFamilyChange = (value: string | number) => {
    pushHistory();
    updateObjects(objects.map(obj => {
      const dimensions = measureTextDimensions({
        text: obj.text,
        fontSize: obj.fontSize,
        fontFamily: value as string,
        fontWeight: obj.fontWeight,
        fontStyle: obj.fontStyle,
        lineHeight: obj.lineHeight,
      });
      return {
        id: obj.id,
        changes: { fontFamily: value as string, width: dimensions.width, height: dimensions.height }
      };
    }));
  };

  const handleFontSizeChange = (value: number) => {
    updateObjects(objects.map(obj => {
      const dimensions = measureTextDimensions({
        text: obj.text,
        fontSize: value,
        fontFamily: obj.fontFamily,
        fontWeight: obj.fontWeight,
        fontStyle: obj.fontStyle,
        lineHeight: obj.lineHeight,
      });
      return {
        id: obj.id,
        changes: { fontSize: value, width: dimensions.width, height: dimensions.height }
      };
    }));
  };

  const handleFontWeightToggle = () => {
    pushHistory();
    const allBold = objects.every(obj => (obj.fontWeight || 400) >= 700);
    const newWeight = allBold ? 400 : 700;
    updateObjects(objects.map(obj => {
      const dimensions = measureTextDimensions({
        text: obj.text,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        fontWeight: newWeight,
        fontStyle: obj.fontStyle,
        lineHeight: obj.lineHeight,
      });
      return {
        id: obj.id,
        changes: { fontWeight: newWeight, width: dimensions.width, height: dimensions.height }
      };
    }));
  };

  const handleFontStyleToggle = () => {
    pushHistory();
    const allItalic = objects.every(obj => obj.fontStyle === 'italic');
    const newStyle = allItalic ? 'normal' : 'italic';
    updateObjects(objects.map(obj => {
      const dimensions = measureTextDimensions({
        text: obj.text,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        fontWeight: obj.fontWeight,
        fontStyle: newStyle,
        lineHeight: obj.lineHeight,
      });
      return {
        id: obj.id,
        changes: { fontStyle: newStyle, width: dimensions.width, height: dimensions.height }
      };
    }));
  };

  const handleDecorationToggle = (decoration: 'underline' | 'line-through') => {
    pushHistory();
    const allHaveDecoration = objects.every(obj => obj.textDecoration === decoration);
    updateObjects(objects.map(obj => ({
      id: obj.id,
      changes: { textDecoration: allHaveDecoration ? 'none' : decoration }
    })));
  };

  const handleTextAlignChange = (align: 'left' | 'center' | 'right') => {
    pushHistory();
    updateObjects(objects.map(obj => ({
      id: obj.id,
      changes: { textAlign: align }
    })));
  };

  const handleLineHeightChange = (value: number) => {
    updateObjects(objects.map(obj => {
      const dimensions = measureTextDimensions({
        text: obj.text,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        fontWeight: obj.fontWeight,
        fontStyle: obj.fontStyle,
        lineHeight: value,
      });
      return {
        id: obj.id,
        changes: { lineHeight: value, width: dimensions.width, height: dimensions.height }
      };
    }));
  };

  const handleColorChange = (value: string) => {
    objects.forEach((obj) => {
      updateObject(obj.id, { fill: value });
    });
  };

  const allBold = objects.every(obj => (obj.fontWeight || 400) >= 700);
  const allItalic = objects.every(obj => obj.fontStyle === 'italic');
  const allUnderline = objects.every(obj => obj.textDecoration === 'underline');
  const allStrike = objects.every(obj => obj.textDecoration === 'line-through');

  return (
    <section className="properties-section">
      <div className="section-header">
        <span className="section-title">Text</span>
      </div>
      <div className="section-content">
        <SelectInput
          label="Font"
          value={fontFamily}
          options={FONT_FAMILIES}
          onChange={handleFontFamilyChange}
        />

        <NumberInput
          label="Size"
          value={fontSize}
          onChange={handleFontSizeChange}
          onChangeEnd={pushHistory}
          min={1}
          max={1000}
          unit="px"
        />

        <div className="text-style-buttons">
          <button
            className={`text-style-btn ${allBold ? 'active' : ''}`}
            onClick={handleFontWeightToggle}
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            className={`text-style-btn ${allItalic ? 'active' : ''}`}
            onClick={handleFontStyleToggle}
            title="Italic"
          >
            <em>I</em>
          </button>
          <button
            className={`text-style-btn ${allUnderline ? 'active' : ''}`}
            onClick={() => handleDecorationToggle('underline')}
            title="Underline"
          >
            <span style={{ textDecoration: 'underline' }}>U</span>
          </button>
          <button
            className={`text-style-btn ${allStrike ? 'active' : ''}`}
            onClick={() => handleDecorationToggle('line-through')}
            title="Strikethrough"
          >
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </button>
        </div>

        <div className="text-align-buttons">
          <button
            className={`text-align-btn ${textAlign === 'left' || (textAlign === 'mixed' && false) ? 'active' : ''}`}
            onClick={() => handleTextAlignChange('left')}
            title="Align Left"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="1" y="2" width="12" height="1.5" />
              <rect x="1" y="5" width="8" height="1.5" />
              <rect x="1" y="8" width="10" height="1.5" />
              <rect x="1" y="11" width="6" height="1.5" />
            </svg>
          </button>
          <button
            className={`text-align-btn ${textAlign === 'center' ? 'active' : ''}`}
            onClick={() => handleTextAlignChange('center')}
            title="Align Center"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="1" y="2" width="12" height="1.5" />
              <rect x="3" y="5" width="8" height="1.5" />
              <rect x="2" y="8" width="10" height="1.5" />
              <rect x="4" y="11" width="6" height="1.5" />
            </svg>
          </button>
          <button
            className={`text-align-btn ${textAlign === 'right' ? 'active' : ''}`}
            onClick={() => handleTextAlignChange('right')}
            title="Align Right"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="1" y="2" width="12" height="1.5" />
              <rect x="5" y="5" width="8" height="1.5" />
              <rect x="3" y="8" width="10" height="1.5" />
              <rect x="7" y="11" width="6" height="1.5" />
            </svg>
          </button>
        </div>

        <NumberInput
          label="Line H"
          value={typeof lineHeight === 'number' ? lineHeight : (lineHeight === 'mixed' ? 'mixed' : 1.2)}
          onChange={handleLineHeightChange}
          onChangeEnd={pushHistory}
          min={0.5}
          max={3}
          step={0.1}
        />

        <ColorInput
          label="Color"
          value={fill}
          onChange={handleColorChange}
          onChangeEnd={pushHistory}
        />
      </div>
    </section>
  );
}
