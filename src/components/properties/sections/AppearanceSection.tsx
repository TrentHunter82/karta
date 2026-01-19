import { useCanvasStore } from '../../../stores/canvasStore';
import { ColorInput } from '../inputs/ColorInput';
import { SliderInput } from '../inputs/SliderInput';
import { NumberInput } from '../inputs/NumberInput';
import { getSharedValue, getSharedNumber } from '../utils';
import type { CanvasObject } from '../../../types/canvas';

interface AppearanceSectionProps {
  objects: CanvasObject[];
}

export function AppearanceSection({ objects }: AppearanceSectionProps) {
  const updateObject = useCanvasStore((s) => s.updateObject);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  // Only show fill for objects that have fill
  const fillableObjects = objects.filter((o) => 'fill' in o && o.fill !== undefined);
  const strokeableObjects = objects.filter((o) => 'stroke' in o);

  const fill = getSharedValue(fillableObjects, (o) => o.fill as string);
  const stroke = getSharedValue(strokeableObjects, (o) => o.stroke as string | undefined);
  const strokeWidth = getSharedNumber(strokeableObjects, (o) => o.strokeWidth ?? 2);
  const opacity = getSharedNumber(objects, (o) => Math.round(o.opacity * 100));

  const handleFillChange = (value: string) => {
    fillableObjects.forEach((obj) => {
      updateObject(obj.id, { fill: value });
    });
  };

  const handleStrokeChange = (value: string) => {
    strokeableObjects.forEach((obj) => {
      updateObject(obj.id, { stroke: value === 'none' ? undefined : value });
    });
  };

  const handleStrokeWidthChange = (value: number) => {
    strokeableObjects.forEach((obj) => {
      updateObject(obj.id, { strokeWidth: value });
    });
  };

  const handleOpacityChange = (value: number) => {
    objects.forEach((obj) => {
      updateObject(obj.id, { opacity: value / 100 });
    });
  };

  return (
    <section className="properties-section">
      <div className="section-header">
        <span className="section-title">Appearance</span>
      </div>
      <div className="section-content">
        {fillableObjects.length > 0 && (
          <ColorInput
            label="Fill"
            value={fill}
            onChange={handleFillChange}
            onChangeEnd={pushHistory}
          />
        )}

        {strokeableObjects.length > 0 && (
          <>
            <ColorInput
              label="Stroke"
              value={stroke ?? 'none'}
              onChange={handleStrokeChange}
              onChangeEnd={pushHistory}
              allowNone
            />
            {stroke !== 'none' && stroke !== 'mixed' && (
              <NumberInput
                label="Width"
                value={strokeWidth}
                onChange={handleStrokeWidthChange}
                onChangeEnd={pushHistory}
                min={1}
                max={100}
                unit="px"
              />
            )}
          </>
        )}

        <SliderInput
          label="Opacity"
          value={opacity}
          onChange={handleOpacityChange}
          onChangeEnd={pushHistory}
          min={0}
          max={100}
          unit="%"
        />
      </div>
    </section>
  );
}
