import { useState } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { NumberInput } from '../inputs/NumberInput';
import { getSharedNumber } from '../utils';
import type { CanvasObject } from '../../../types/canvas';

interface TransformSectionProps {
  objects: CanvasObject[];
}

export function TransformSection({ objects }: TransformSectionProps) {
  const updateObject = useCanvasStore((s) => s.updateObject);
  const updateObjects = useCanvasStore((s) => s.updateObjects);
  const pushHistory = useCanvasStore((s) => s.pushHistory);
  const [constrainProportions, setConstrainProportions] = useState(true);

  const x = getSharedNumber(objects, (o) => o.x);
  const y = getSharedNumber(objects, (o) => o.y);
  const width = getSharedNumber(objects, (o) => o.width);
  const height = getSharedNumber(objects, (o) => o.height);
  const rotation = getSharedNumber(objects, (o) => o.rotation);

  const isMultiSelection = objects.length > 1;

  const handlePositionChange = (prop: 'x' | 'y', value: number) => {
    if (isMultiSelection) {
      const delta = value - objects[0][prop];
      updateObjects(objects.map(obj => ({
        id: obj.id,
        changes: { [prop]: obj[prop] + delta }
      })));
    } else {
      updateObject(objects[0].id, { [prop]: value });
    }
  };

  const handleWidthChange = (value: number) => {
    if (isMultiSelection) {
      if (constrainProportions) {
        updateObjects(objects.map(obj => {
          const aspectRatio = obj.height / obj.width;
          return {
            id: obj.id,
            changes: { width: value, height: Math.round(value * aspectRatio) }
          };
        }));
      } else {
        updateObjects(objects.map(obj => ({ id: obj.id, changes: { width: value } })));
      }
    } else {
      const obj = objects[0];
      if (constrainProportions && obj.width > 0) {
        const aspectRatio = obj.height / obj.width;
        updateObject(obj.id, { width: value, height: Math.round(value * aspectRatio) });
      } else {
        updateObject(obj.id, { width: value });
      }
    }
  };

  const handleHeightChange = (value: number) => {
    if (isMultiSelection) {
      if (constrainProportions) {
        updateObjects(objects.map(obj => {
          const aspectRatio = obj.width / obj.height;
          return {
            id: obj.id,
            changes: { height: value, width: Math.round(value * aspectRatio) }
          };
        }));
      } else {
        updateObjects(objects.map(obj => ({ id: obj.id, changes: { height: value } })));
      }
    } else {
      const obj = objects[0];
      if (constrainProportions && obj.height > 0) {
        const aspectRatio = obj.width / obj.height;
        updateObject(obj.id, { height: value, width: Math.round(value * aspectRatio) });
      } else {
        updateObject(obj.id, { height: value });
      }
    }
  };

  const handleRotationChange = (value: number) => {
    objects.forEach((obj) => {
      updateObject(obj.id, { rotation: value });
    });
  };

  return (
    <section className="properties-section">
      <div className="section-header">
        <span className="section-title">Transform</span>
      </div>
      <div className="section-content">
        <div className="property-grid">
          <NumberInput
            label="X"
            value={x}
            onChange={(v) => handlePositionChange('x', v)}
            onChangeEnd={pushHistory}
          />
          <NumberInput
            label="Y"
            value={y}
            onChange={(v) => handlePositionChange('y', v)}
            onChangeEnd={pushHistory}
          />
        </div>
        <div className="size-row">
          <div className="property-grid">
            <NumberInput
              label="W"
              value={width}
              onChange={handleWidthChange}
              onChangeEnd={pushHistory}
              min={1}
            />
            <NumberInput
              label="H"
              value={height}
              onChange={handleHeightChange}
              onChangeEnd={pushHistory}
              min={1}
            />
          </div>
          <button
            className={`constrain-toggle ${constrainProportions ? 'active' : ''}`}
            onClick={() => setConstrainProportions(!constrainProportions)}
            title={constrainProportions ? 'Constrain proportions: ON' : 'Constrain proportions: OFF'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              {constrainProportions ? (
                <>
                  <path d="M3 4V2.5C3 1.67 3.67 1 4.5 1h3C8.33 1 9 1.67 9 2.5V4" />
                  <path d="M3 8v1.5c0 .83.67 1.5 1.5 1.5h3c.83 0 1.5-.67 1.5-1.5V8" />
                  <path d="M6 4v4" />
                </>
              ) : (
                <>
                  <path d="M3 4V2.5C3 1.67 3.67 1 4.5 1h3C8.33 1 9 1.67 9 2.5V4" />
                  <path d="M3 8v1.5c0 .83.67 1.5 1.5 1.5h3c.83 0 1.5-.67 1.5-1.5V8" />
                </>
              )}
            </svg>
          </button>
        </div>
        <NumberInput
          label="↻"
          value={rotation}
          onChange={handleRotationChange}
          onChangeEnd={pushHistory}
          min={0}
          max={360}
          unit="°"
        />
      </div>
    </section>
  );
}
