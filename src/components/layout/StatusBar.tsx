import './StatusBar.css';

export function StatusBar() {
  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <span className="statusbar-item">POS X:--- Y:---</span>
      </div>
      <div className="statusbar-right">
        <span className="statusbar-item">SEL NONE</span>
      </div>
    </footer>
  );
}
