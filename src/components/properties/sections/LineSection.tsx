import { useCanvasStore } from '../../../stores/canvasStore';
import { ColorInput } from '../inputs/ColorInput';
import { NumberInput } from '../inputs/NumberInput';
import { getSharedValue, getSharedNumber } from '../utils';
import type { LineObject, ArrowObject, ArrowheadStyle } from '../../../types/canvas';

/** Available arrowhead styles */
const ARROWHEAD_STYLES: { value: ArrowheadStyle; label: string }[] = [
  { value: 'triangle', label: 'Triangle' },
  { value: 'open', label: 'Open' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'circle', label: 'Circle' },
  { value: 'none', label: 'None' },
];

interface LineSectionProps {
  objects: (LineObject | ArrowObject)[];
}

export function LineSection({ objects }: LineSectionProps) {
  const updateObject = useCanvasStore((s) => s.updateObject);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  const stroke = getSharedValue(objects, (o) => o.stroke ?? '#ffffff');
  const strokeWidth = getSharedNumber(objects, (o) => o.strokeWidth ?? 2);

  // Check for arrow objects
  const arrowObjects = objects.filter((o): o is ArrowObject => o.type === 'arrow');
  const hasArrows = arrowObjects.length > 0;

  // Get shared arrowhead styles
  const arrowStartStyle = hasArrows
    ? getSharedValue(arrowObjects, (o) => o.arrowStartStyle ?? 'none')
    : 'none';
  const arrowEndStyle = hasArrows
    ? getSharedValue(arrowObjects, (o) => o.arrowEndStyle ?? 'triangle')
    : 'triangle';

  const handleStrokeChange = (value: string) => {
    objects.forEach((obj) => {
      updateObject(obj.id, { stroke: value });
    });
  };

  const handleStrokeWidthChange = (value: number) => {
    objects.forEach((obj) => {
      updateObject(obj.id, { strokeWidth: value });
    });
  };

  const handleArrowStartToggle = () => {
    pushHistory();
    const allHaveStart = arrowObjects.every(obj => obj.arrowStart);
    arrowObjects.forEach((obj) => {
      updateObject(obj.id, { arrowStart: !allHaveStart });
    });
  };

  const handleArrowEndToggle = () => {
    pushHistory();
    const allHaveEnd = arrowObjects.every(obj => obj.arrowEnd);
    arrowObjects.forEach((obj) => {
      updateObject(obj.id, { arrowEnd: !allHaveEnd });
    });
  };

  const handleArrowStartStyleChange = (style: ArrowheadStyle) => {
    pushHistory();
    arrowObjects.forEach((obj) => {
      updateObject(obj.id, {
        arrowStartStyle: style,
        arrowStart: style !== 'none',
      });
    });
  };

  const handleArrowEndStyleChange = (style: ArrowheadStyle) => {
    pushHistory();
    arrowObjects.forEach((obj) => {
      updateObject(obj.id, {
        arrowEndStyle: style,
        arrowEnd: style !== 'none',
      });
    });
  };

  const handleFlipDirection = () => {
    pushHistory();
    arrowObjects.forEach((obj) => {
      // Swap start and end arrowheads
      updateObject(obj.id, {
        arrowStart: obj.arrowEnd,
        arrowEnd: obj.arrowStart,
        arrowStartStyle: obj.arrowEndStyle ?? 'triangle',
        arrowEndStyle: obj.arrowStartStyle ?? 'none',
      });
    });
  };

  return (
    <section className="properties-section">
      <div className="section-header">
        <span className="section-title">Line</span>
      </div>
      <div className="section-content">
        <ColorInput
          label="Stroke"
          value={stroke}
          onChange={handleStrokeChange}
          onChangeEnd={pushHistory}
        />
        <NumberInput
          label="Width"
          value={strokeWidth}
          onChange={handleStrokeWidthChange}
          onChangeEnd={pushHistory}
          min={1}
          max={100}
          unit="px"
        />

        {hasArrows && (
          <>
            <div className="arrow-toggles">
              <label className="arrow-toggle-label">Arrows</label>
              <div className="arrow-toggle-buttons">
                <button
                  className={`arrow-toggle-btn ${arrowObjects.every(o => o.arrowStart) ? 'active' : ''}`}
                  onClick={handleArrowStartToggle}
                  title="Arrow at start"
                >
                  ←
                </button>
                <button
                  className={`arrow-toggle-btn ${arrowObjects.every(o => o.arrowEnd) ? 'active' : ''}`}
                  onClick={handleArrowEndToggle}
                  title="Arrow at end"
                >
                  →
                </button>
                <button
                  className="arrow-toggle-btn flip-btn"
                  onClick={handleFlipDirection}
                  title="Flip direction"
                >
                  ⇄
                </button>
              </div>
            </div>

            <div className="arrow-style-row">
              <label className="arrow-style-label">Start Style</label>
              <select
                className="arrow-style-select"
                value={arrowStartStyle}
                onChange={(e) => handleArrowStartStyleChange(e.target.value as ArrowheadStyle)}
              >
                {ARROWHEAD_STYLES.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="arrow-style-row">
              <label className="arrow-style-label">End Style</label>
              <select
                className="arrow-style-select"
                value={arrowEndStyle}
                onChange={(e) => handleArrowEndStyleChange(e.target.value as ArrowheadStyle)}
              >
                {ARROWHEAD_STYLES.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
