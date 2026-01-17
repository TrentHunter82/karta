import { useCanvasStore } from '../../stores/canvasStore';
import './StatusBar.css';

export function StatusBar() {
  const cursorPosition = useCanvasStore((state) => state.cursorPosition);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const viewport = useCanvasStore((state) => state.viewport);
  const setViewport = useCanvasStore((state) => state.setViewport);

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

  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <span className="statusbar-item">POS X:{posX} Y:{posY}</span>
      </div>
      <div className="statusbar-center">
        <span className="statusbar-item">SEL {selectionText}</span>
      </div>
      <div className="statusbar-right">
        <div className="zoom-controls">
          <button
            className="zoom-button"
            onClick={handleZoomOut}
            title="Zoom Out (Ctrl+-)"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="5" width="8" height="2" rx="1" />
            </svg>
          </button>
          <span className="zoom-percentage">{zoomPercentage}%</span>
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
        </div>
      </div>
    </footer>
  );
}
