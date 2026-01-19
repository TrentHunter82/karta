import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import './StatusBar.css';

const ZOOM_PRESETS = [
  { label: '50%', value: 0.5 },
  { label: '100%', value: 1 },
  { label: '200%', value: 2 },
  { label: '400%', value: 4 },
];

export function StatusBar() {
  const cursorPosition = useCanvasStore((state) => state.cursorPosition);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const viewport = useCanvasStore((state) => state.viewport);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const zoomToFit = useCanvasStore((state) => state.zoomToFit);
  const zoomToSelection = useCanvasStore((state) => state.zoomToSelection);
  const setZoomPreset = useCanvasStore((state) => state.setZoomPreset);
  const gridSettings = useCanvasStore((state) => state.gridSettings);
  const setGridVisible = useCanvasStore((state) => state.setGridVisible);
  const setSnapEnabled = useCanvasStore((state) => state.setSnapEnabled);
  const setSnapToObjects = useCanvasStore((state) => state.setSnapToObjects);

  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Format cursor position (round to nearest integer)
  const posX = cursorPosition ? Math.round(cursorPosition.x) : '---';
  const posY = cursorPosition ? Math.round(cursorPosition.y) : '---';

  // Format selection count
  const selectionCount = selectedIds.size;
  const selectionText = selectionCount === 0
    ? 'NONE'
    : selectionCount === 1
      ? '1 object'
      : `${selectionCount} objects`;

  // Zoom controls - change by 25%
  const handleZoomIn = () => {
    const newZoom = Math.min(5, viewport.zoom * 1.25);
    setViewport({ zoom: newZoom });
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, viewport.zoom / 1.25);
    setViewport({ zoom: newZoom });
  };

  // Format zoom percentage
  const zoomPercentage = Math.round(viewport.zoom * 100);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowZoomMenu(false);
      }
    };

    if (showZoomMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showZoomMenu]);

  const handleZoomToFit = () => {
    zoomToFit();
    setShowZoomMenu(false);
  };

  const handleZoomToSelection = () => {
    zoomToSelection();
    setShowZoomMenu(false);
  };

  const handlePresetClick = (value: number) => {
    setZoomPreset(value);
    setShowZoomMenu(false);
  };

  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <span className="statusbar-item">POS X:{posX} Y:{posY}</span>
      </div>
      <div className="statusbar-center">
        <span className="statusbar-item">SEL {selectionText}</span>
        <div className="statusbar-divider" />
        <div className="grid-controls">
          <button
            className={`grid-toggle ${gridSettings.visible ? 'active' : ''}`}
            onClick={() => setGridVisible(!gridSettings.visible)}
            title="Toggle Grid (G)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="1" y="1" width="4" height="4" rx="0.5" opacity="0.6" />
              <rect x="5" y="1" width="4" height="4" rx="0.5" opacity="0.6" />
              <rect x="9" y="1" width="4" height="4" rx="0.5" opacity="0.6" />
              <rect x="1" y="5" width="4" height="4" rx="0.5" opacity="0.6" />
              <rect x="5" y="5" width="4" height="4" rx="0.5" opacity="0.6" />
              <rect x="9" y="5" width="4" height="4" rx="0.5" opacity="0.6" />
              <rect x="1" y="9" width="4" height="4" rx="0.5" opacity="0.6" />
              <rect x="5" y="9" width="4" height="4" rx="0.5" opacity="0.6" />
              <rect x="9" y="9" width="4" height="4" rx="0.5" opacity="0.6" />
            </svg>
          </button>
          <button
            className={`snap-toggle ${gridSettings.snapEnabled ? 'active' : ''}`}
            onClick={() => setSnapEnabled(!gridSettings.snapEnabled)}
            title="Snap to Grid (Shift+G)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M1 3h2v2H1V3zm10 0h2v2h-2V3zM1 9h2v2H1V9zm10 0h2v2h-2V9z" />
              <path d="M6 1h2v12H6V1z" opacity="0.6" />
              <path d="M1 6h12v2H1V6z" opacity="0.6" />
            </svg>
          </button>
          <button
            className={`snap-toggle ${gridSettings.snapToObjects ? 'active' : ''}`}
            onClick={() => setSnapToObjects(!gridSettings.snapToObjects)}
            title="Snap to Objects"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="1" y="1" width="5" height="5" rx="0.5" />
              <rect x="8" y="8" width="5" height="5" rx="0.5" />
              <path d="M4 5v4h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
            </svg>
          </button>
        </div>
      </div>
      <div className="statusbar-right">
        <div className="zoom-controls" ref={menuRef}>
          <button
            className="zoom-button"
            onClick={handleZoomOut}
            title="Zoom Out (Ctrl+-)"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="5" width="8" height="2" rx="1" />
            </svg>
          </button>
          <button
            className="zoom-display"
            onClick={() => setShowZoomMenu(!showZoomMenu)}
            title="Zoom presets"
          >
            {zoomPercentage}%
          </button>
          <button
            className="zoom-button"
            onClick={handleZoomIn}
            title="Zoom In (Ctrl+=)"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="5" width="8" height="2" rx="1" />
              <rect x="5" y="2" width="2" height="8" rx="1" />
            </svg>
          </button>

          {showZoomMenu && (
            <div className="zoom-menu">
              <button onClick={handleZoomToFit}>
                <span>Fit All</span>
                <span className="zoom-menu-shortcut">Ctrl+0</span>
              </button>
              <button onClick={handleZoomToSelection}>
                <span>Fit Selection</span>
                <span className="zoom-menu-shortcut">Ctrl+Shift+2</span>
              </button>
              <div className="zoom-menu-divider" />
              {ZOOM_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetClick(preset.value)}
                  className={Math.abs(viewport.zoom - preset.value) < 0.01 ? 'active' : ''}
                >
                  <span>{preset.label}</span>
                  {preset.value === 1 && <span className="zoom-menu-shortcut">Ctrl+1</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
