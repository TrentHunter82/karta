import { useCanvasStore } from '../../stores/canvasStore';
import './StatusBar.css';

export function StatusBar() {
  const cursorPosition = useCanvasStore((state) => state.cursorPosition);
  const selectedIds = useCanvasStore((state) => state.selectedIds);

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

  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <span className="statusbar-item">POS X:{posX} Y:{posY}</span>
      </div>
      <div className="statusbar-right">
        <span className="statusbar-item">SEL {selectionText}</span>
      </div>
    </footer>
  );
}
