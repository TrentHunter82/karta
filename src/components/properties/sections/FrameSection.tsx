import { useCanvasStore } from '../../../stores/canvasStore';
import { ColorInput } from '../inputs/ColorInput';
import { getSharedValue } from '../utils';
import type { FrameObject } from '../../../types/canvas';

interface FrameSectionProps {
  objects: FrameObject[];
}

export function FrameSection({ objects }: FrameSectionProps) {
  const updateObject = useCanvasStore((s) => s.updateObject);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  const fill = getSharedValue(objects, (o) => o.fill ?? '#2a2a2a');
  const stroke = getSharedValue(objects, (o) => o.stroke ?? '#3a3a3a');

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
