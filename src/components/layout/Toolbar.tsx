import './Toolbar.css';
import { useCanvasStore } from '../../stores/canvasStore';
import type { ToolType } from '../../types/canvas';

interface ToolButton {
  id: ToolType;
  name: string;
  shortcut: string;
  icon: JSX.Element;
}

const tools: ToolButton[] = [
  {
    id: 'select',
    name: 'Select',
    shortcut: 'V',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M4 2L16 10L10 11L8 17L4 2Z" />
      </svg>
    ),
  },
  {
    id: 'hand',
    name: 'Hand',
    shortcut: 'H',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2C9.45 2 9 2.45 9 3V9H7V6C7 5.45 6.55 5 6 5C5.45 5 5 5.45 5 6V11C5 11.55 5.45 12 6 12H7V10H9V13H11V10H13V12H14C14.55 12 15 11.55 15 11V6C15 5.45 14.55 5 14 5C13.45 5 13 5.45 13 6V9H11V3C11 2.45 10.55 2 10 2ZM6 14V18H14V14H6Z" />
      </svg>
    ),
  },
  {
    id: 'rectangle',
    name: 'Rectangle',
    shortcut: 'R',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="14" height="12" rx="1" />
      </svg>
    ),
  },
  {
    id: 'text',
    name: 'Text',
    shortcut: 'T',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M4 4V7H6V6H9V14H7V16H13V14H11V6H14V7H16V4H4Z" />
      </svg>
    ),
  },
  {
    id: 'frame',
    name: 'Frame',
    shortcut: 'F',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="14" height="12" rx="1" />
        <line x1="3" y1="7" x2="17" y2="7" />
      </svg>
    ),
  },
  {
    id: 'pen',
    name: 'Pen',
    shortcut: 'P',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M3 17L4 13L14 3L17 6L7 16L3 17ZM14.5 6.5L13.5 5.5L5 14L6 15L14.5 6.5Z" />
      </svg>
    ),
  },
];

export function Toolbar() {
  const activeTool = useCanvasStore((state) => state.activeTool);
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);

  const handleToolClick = (tool: ToolType) => {
    setActiveTool(tool);
  };

  return (
    <aside className="toolbar">
      <div className="toolbar-content">
        {tools.map((tool, index) => (
          <div key={tool.id}>
            <button
              className={`tool-button ${activeTool === tool.id ? 'active' : ''}`}
              onClick={() => handleToolClick(tool.id)}
              title={`${tool.name} (${tool.shortcut})`}
            >
              {tool.icon}
              <span className="tool-tooltip">
                {tool.name}
                <span className="tool-shortcut">{tool.shortcut}</span>
              </span>
            </button>
            {/* Divider after Text tool (index 3) */}
            {index === 3 && <div className="toolbar-divider" />}
          </div>
        ))}
      </div>
    </aside>
  );
}
