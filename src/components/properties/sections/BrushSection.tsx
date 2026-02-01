/**
 * Brush Section - Pen tool settings panel
 *
 * Provides UI controls for pen tool smoothing, stabilization,
 * and pressure simulation settings.
 */
import { usePenToolStore } from '../../../stores/penToolStore';
import { SliderInput } from '../inputs/SliderInput';
import { SelectInput } from '../inputs/SelectInput';
import { ColorInput } from '../inputs/ColorInput';

const smoothingTypeOptions = [
  { value: 'none', label: 'None' },
  { value: 'chaikin', label: 'Smooth (Chaikin)' },
  { value: 'simplify', label: 'Simplify (RDP)' },
];

const stabilizerOptions = [
  { value: 'off', label: 'Off' },
  { value: 'spring', label: 'Spring' },
];

export function BrushSection() {
  const settings = usePenToolStore((s) => s.settings);
  const setSettings = usePenToolStore((s) => s.setSettings);

  return (
    <section className="properties-section">
      <div className="section-header">
        <span className="section-title">Brush Settings</span>
      </div>
      <div className="section-content">
        {/* Stroke Color */}
        <ColorInput
          label="Color"
          value={settings.strokeColor}
          onChange={(value) => setSettings({ strokeColor: value })}
        />

        {/* Stroke Width (when pressure simulation is off) */}
        {!settings.pressureSimulation && (
          <SliderInput
            label="Size"
            value={settings.strokeWidth}
            onChange={(value) => setSettings({ strokeWidth: value })}
            min={1}
            max={50}
            unit="px"
          />
        )}

        {/* Smoothing Type */}
        <SelectInput
          label="Smoothing"
          value={settings.type}
          options={smoothingTypeOptions}
          onChange={(value) => setSettings({ type: value as 'none' | 'chaikin' | 'simplify' })}
        />

        {/* Smoothing Amount */}
        {settings.type !== 'none' && (
          <SliderInput
            label="Amount"
            value={Math.round(settings.amount * 100)}
            onChange={(value) => setSettings({ amount: value / 100 })}
            min={0}
            max={100}
            unit="%"
          />
        )}

        {/* Stabilizer Mode */}
        <SelectInput
          label="Stabilizer"
          value={settings.stabilizerMode}
          options={stabilizerOptions}
          onChange={(value) => setSettings({ stabilizerMode: value as 'off' | 'spring' })}
        />

        {/* Stabilizer Strength */}
        {settings.stabilizerMode !== 'off' && (
          <SliderInput
            label="Strength"
            value={Math.round(settings.stabilizerStrength * 100)}
            onChange={(value) => setSettings({ stabilizerStrength: value / 100 })}
            min={10}
            max={90}
            unit="%"
          />
        )}

        {/* Pressure Simulation Toggle */}
        <div className="property-row checkbox-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.pressureSimulation}
              onChange={(e) => setSettings({ pressureSimulation: e.target.checked })}
            />
            <span>Pressure Simulation</span>
          </label>
        </div>

        {/* Width Range (when pressure simulation enabled) */}
        {settings.pressureSimulation && (
          <>
            <SliderInput
              label="Min Width"
              value={settings.minWidth}
              onChange={(value) => setSettings({ minWidth: value })}
              min={1}
              max={settings.maxWidth - 1}
              unit="px"
            />
            <SliderInput
              label="Max Width"
              value={settings.maxWidth}
              onChange={(value) => setSettings({ maxWidth: value })}
              min={settings.minWidth + 1}
              max={50}
              unit="px"
            />
          </>
        )}
      </div>
    </section>
  );
}
