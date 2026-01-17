import { useEffect } from 'react';
import { Toolbar, TopBar, PropertiesPanel, Canvas, StatusBar } from './components/layout';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useCanvasStore } from './stores/canvasStore';
import './App.css';

function App() {
  // Set up global keyboard shortcuts for tool switching
  useKeyboardShortcuts();

  const addObject = useCanvasStore((state) => state.addObject);

  // Add test objects for development
  useEffect(() => {
    addObject({
      id: 'test-rect-1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 150,
      height: 100,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      fill: '#4a90d9',
    });
    addObject({
      id: 'test-rect-2',
      type: 'rectangle',
      x: 300,
      y: 150,
      width: 120,
      height: 80,
      rotation: 15,
      opacity: 1,
      zIndex: 1,
      fill: '#d94a4a',
    });
    addObject({
      id: 'test-ellipse-1',
      type: 'ellipse',
      x: 500,
      y: 100,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      zIndex: 2,
      fill: '#4ad97a',
    });
  }, [addObject]);

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
