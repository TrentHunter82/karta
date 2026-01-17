import { Toolbar, TopBar, PropertiesPanel, Canvas, StatusBar } from './components/layout';
import './App.css';

function App() {
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
