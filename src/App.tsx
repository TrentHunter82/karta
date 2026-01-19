import { useEffect } from 'react';
import { Toolbar, TopBar, PropertiesPanel, Canvas, StatusBar } from './components/layout';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useCanvasStore } from './stores/canvasStore';
import { useCollaborationStore } from './stores/collaborationStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import './App.css';

function App() {
  // Set up global keyboard shortcuts for tool switching
  useKeyboardShortcuts();

  const initializeYjsSync = useCanvasStore((state) => state.initializeYjsSync);
  const isInitialized = useCanvasStore((state) => state.isInitialized);
  const connect = useCollaborationStore((state) => state.connect);
  const connectionStatus = useCollaborationStore((state) => state.connectionStatus);

  // Initialize collaboration and Yjs sync
  useEffect(() => {
    // Get room ID from URL hash, or generate a random one
    let roomId = window.location.hash.slice(1);
    if (!roomId) {
      roomId = Math.random().toString(36).substring(2, 10);
      window.location.hash = roomId;
    }

    // Connect to collaboration server
    connect(roomId);
  }, [connect]);

  // Initialize Yjs sync once connected
  useEffect(() => {
    if (connectionStatus === 'connected' && !isInitialized) {
      initializeYjsSync();
    }
  }, [connectionStatus, isInitialized, initializeYjsSync]);

  return (
    <div className="app">
      <TopBar />
      <div className="app-main">
        <Toolbar />
        <ErrorBoundary>
          <Canvas />
        </ErrorBoundary>
        <ErrorBoundary>
          <PropertiesPanel />
        </ErrorBoundary>
      </div>
      <StatusBar />
      <ToastContainer />
    </div>
  );
}

export default App;
