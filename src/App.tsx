import { Toolbar, TopBar, PropertiesPanel, Canvas, StatusBar } from './components/layout';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './App.css';

function App() {
  // Set up global keyboard shortcuts for tool switching
  useKeyboardShortcuts();

  return (
    <div className="app">
      <TopBar />
      <div className="app-main">
        <Toolbar />
        <Canvas />
        <PropertiesPanel />
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
