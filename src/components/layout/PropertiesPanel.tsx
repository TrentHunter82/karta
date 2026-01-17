import { useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import './PropertiesPanel.css';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="section">
      <button
        className="section-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="section-title">{title}</span>
        <span className={`section-toggle ${isOpen ? 'open' : ''}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </span>
      </button>
      {isOpen && <div className="section-content">{children}</div>}
    </div>
  );
}

interface PropertyRowProps {
  label: string;
  value: string;
}

function PropertyRow({ label, value }: PropertyRowProps) {
  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <span className="property-value">{value}</span>
    </div>
  );
}

export function PropertiesPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const objects = useCanvasStore((state) => state.objects);

  const hasSelection = selectedIds.size > 0;
  const selectedObjects = Array.from(selectedIds).map((id) => objects.get(id)).filter(Boolean);
  const singleSelection = selectedObjects.length === 1 ? selectedObjects[0] : null;

  // Get display values - show "---" when nothing selected, or actual values when single selection
  const getDisplayValue = (getter: () => string): string => {
    if (!hasSelection) return '---';
    if (!singleSelection) return '---'; // Multiple selection shows "---" for now
    return getter();
  };

  return (
    <aside className={`properties-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <button
        className="properties-panel-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {isCollapsed ? '◀' : '▶'}
      </button>
      {!isCollapsed && (
        <div className="properties-panel-content">
          {/* Panel Header */}
          <div className="panel-header">
            <span className="panel-title">PROPERTIES</span>
            <button className="settings-button" aria-label="Settings">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0-1a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
                <path d="M13.5 5.5h-1.12a5.5 5.5 0 0 0-.55-1.33l.79-.79a.5.5 0 0 0 0-.71l-.71-.71a.5.5 0 0 0-.71 0l-.79.79a5.5 5.5 0 0 0-1.33-.55V1.08a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5V2.2a5.5 5.5 0 0 0-1.33.55l-.79-.79a.5.5 0 0 0-.71 0l-.71.71a.5.5 0 0 0 0 .71l.79.79A5.5 5.5 0 0 0 2.7 5.5H1.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1.2a5.5 5.5 0 0 0 .55 1.33l-.79.79a.5.5 0 0 0 0 .71l.71.71a.5.5 0 0 0 .71 0l.79-.79a5.5 5.5 0 0 0 1.33.55v1.12a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1.12a5.5 5.5 0 0 0 1.33-.55l.79.79a.5.5 0 0 0 .71 0l.71-.71a.5.5 0 0 0 0-.71l-.79-.79a5.5 5.5 0 0 0 .55-1.33h1.12a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5z" />
              </svg>
            </button>
          </div>

          {/* Transform Section */}
          <CollapsibleSection title="TRANSFORM">
            <PropertyRow
              label="X-POS"
              value={getDisplayValue(() => Math.round(singleSelection!.x).toString())}
            />
            <PropertyRow
              label="Y-POS"
              value={getDisplayValue(() => Math.round(singleSelection!.y).toString())}
            />
            <PropertyRow
              label="WIDTH"
              value={getDisplayValue(() => Math.round(singleSelection!.width).toString())}
            />
            <PropertyRow
              label="HEIGHT"
              value={getDisplayValue(() => Math.round(singleSelection!.height).toString())}
            />
            <PropertyRow
              label="ROTATION"
              value={getDisplayValue(() => `${Math.round(singleSelection!.rotation)}°`)}
            />
          </CollapsibleSection>

          {/* Appearance Section */}
          <CollapsibleSection title="APPEARANCE">
            <PropertyRow
              label="OPACITY"
              value={getDisplayValue(() => `${Math.round((singleSelection!.opacity ?? 1) * 100)}%`)}
            />
            <PropertyRow
              label="FILL"
              value={getDisplayValue(() => singleSelection!.fill ?? '---')}
            />
            <PropertyRow
              label="STROKE"
              value={getDisplayValue(() => singleSelection!.stroke ?? '---')}
            />
          </CollapsibleSection>

          {/* Hierarchy Section */}
          <CollapsibleSection title="HIERARCHY">
            <div className="hierarchy-info">
              {objects.size > 0 ? `${objects.size} Items` : 'Canvas Empty'}
            </div>
            <div className="hierarchy-list">
              {Array.from(objects.values()).map((obj) => (
                <div
                  key={obj.id}
                  className={`hierarchy-item ${selectedIds.has(obj.id) ? 'selected' : ''}`}
                >
                  <span className="hierarchy-icon">
                    {obj.type === 'rectangle' && '▢'}
                    {obj.type === 'ellipse' && '○'}
                    {obj.type === 'text' && 'T'}
                    {obj.type === 'frame' && '⬚'}
                    {obj.type === 'path' && '✎'}
                    {obj.type === 'image' && '🖼'}
                    {obj.type === 'video' && '▶'}
                  </span>
                  <span className="hierarchy-name">
                    {obj.type === 'text' && 'text' in obj
                      ? (obj as { text: string }).text.slice(0, 20) || 'Text'
                      : obj.type === 'frame' && 'name' in obj
                        ? (obj as { name: string }).name
                        : obj.type.charAt(0).toUpperCase() + obj.type.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}
    </aside>
  );
}
