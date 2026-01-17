import { useState } from 'react';
import './PropertiesPanel.css';

export function PropertiesPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
          {/* Properties content will be added in US-018 */}
        </div>
      )}
    </aside>
  );
}
