import { useCanvasStore } from '../../../stores/canvasStore';
import { ColorInput } from '../inputs/ColorInput';
import { getSharedValue } from '../utils';
import { PropertyRow } from '../inputs/PropertyRow';
import type { FrameObject } from '../../../types/canvas';

interface FrameSectionProps {
  objects: FrameObject[];
}

export function FrameSection({ objects }: FrameSectionProps) {
  const updateObject = useCanvasStore((s) => s.updateObject);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  const name = getSharedValue(objects, (o) => o.name ?? 'Frame');
  const fill = getSharedValue(objects, (o) => o.fill ?? '#2a2a2a');
  const stroke = getSharedValue(objects, (o) => o.stroke ?? '#3a3a3a');

  const handleNameChange = (value: string) => {
    objects.forEach((obj) => {
      updateObject(obj.id, { name: value || 'Frame' });
    });
  };

  const handleFillChange = (value: string) => {
    objects.forEach((obj) => {
      updateObject(obj.id, { fill: value === 'none' ? undefined : value });
    });
  };

  const handleStrokeChange = (value: string) => {
    objects.forEach((obj) => {
      updateObject(obj.id, { stroke: value === 'none' ? undefined : value });
    });
  };

  return (
    <section className="properties-section">
      <div className="section-header">
        <span className="section-title">Frame</span>
      </div>
      <div className="section-content">
        <PropertyRow label="Name">
          <input
            type="text"
            className="property-text-input"
            value={name === 'mixed' ? '' : name}
            placeholder={name === 'mixed' ? 'Mixed' : 'Frame'}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={pushHistory}
          />
        </PropertyRow>
        <ColorInput
          label="Background"
          value={fill}
          onChange={handleFillChange}
          onChangeEnd={pushHistory}
          allowNone
        />
        <ColorInput
          label="Border"
          value={stroke}
          onChange={handleStrokeChange}
          onChangeEnd={pushHistory}
          allowNone
        />
      </div>
    </section>
  );
}
