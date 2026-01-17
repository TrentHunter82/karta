import { create } from 'zustand';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Connection status type
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface CollaborationState {
  // Yjs document and provider
  doc: Y.Doc;
  provider: WebsocketProvider | null;

  // Connection state
  connectionStatus: ConnectionStatus;
  roomId: string;

  // Reconnection state
  reconnectAttempts: number;
  maxReconnectAttempts: number;

  // Actions
  connect: (roomId: string, serverUrl?: string) => void;
  disconnect: () => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

// Default WebSocket server URL (y-websocket demo server)
// In production, this should be your own y-websocket server
const DEFAULT_SERVER_URL = 'wss://demos.yjs.dev/ws';

// Create a shared Yjs document
const ydoc = new Y.Doc();

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  // Initial state
  doc: ydoc,
  provider: null,
  connectionStatus: 'disconnected',
  roomId: '',
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,

  // Actions
  connect: (roomId: string, serverUrl: string = DEFAULT_SERVER_URL) => {
    const state = get();

    // Disconnect existing provider if any
    if (state.provider) {
      state.provider.destroy();
    }

    set({
      connectionStatus: 'connecting',
      roomId,
      reconnectAttempts: 0
    });

    try {
      // Create WebSocket provider
      const provider = new WebsocketProvider(
        serverUrl,
        `karta-${roomId}`, // Prefix room name to avoid conflicts
        ydoc,
        {
          connect: true,
          // Awareness for cursor presence (will be used in US-034)
          params: {},
          // Use internal reconnect mechanism
          resyncInterval: 10000,
          maxBackoffTime: 2500,
          disableBc: false, // Enable broadcast channel for same-origin tabs
        }
      );

      // Handle connection status changes
      provider.on('status', (event: { status: string }) => {
        if (event.status === 'connected') {
          set({
            connectionStatus: 'connected',
            reconnectAttempts: 0
          });
        } else if (event.status === 'disconnected') {
          const currentState = get();
          // Only show disconnected if we're not trying to reconnect
          if (currentState.reconnectAttempts >= currentState.maxReconnectAttempts) {
            set({ connectionStatus: 'disconnected' });
          }
        }
      });

      // Handle sync status
      provider.on('sync', (isSynced: boolean) => {
        if (isSynced) {
          console.log('[Collaboration] Document synced with server');
        }
      });

      // Handle connection close for reconnection logic
      provider.on('connection-close', () => {
        const currentState = get();
        if (currentState.reconnectAttempts < currentState.maxReconnectAttempts) {
          set({
            reconnectAttempts: currentState.reconnectAttempts + 1,
            connectionStatus: 'connecting'
          });
          console.log(`[Collaboration] Connection lost. Reconnecting... (attempt ${currentState.reconnectAttempts + 1}/${currentState.maxReconnectAttempts})`);
        } else {
          set({ connectionStatus: 'disconnected' });
          console.log('[Collaboration] Max reconnection attempts reached. Please try again manually.');
        }
      });

      // Handle connection errors
      provider.on('connection-error', (event: Event) => {
        console.error('[Collaboration] Connection error:', event);
      });

      set({ provider });

    } catch (error) {
      console.error('[Collaboration] Failed to create WebSocket provider:', error);
      set({ connectionStatus: 'disconnected' });
    }
  },

  disconnect: () => {
    const state = get();

    if (state.provider) {
      state.provider.disconnect();
      state.provider.destroy();
    }

    set({
      provider: null,
      connectionStatus: 'disconnected',
      roomId: '',
      reconnectAttempts: 0
    });

    console.log('[Collaboration] Disconnected from room');
  },

  setConnectionStatus: (status: ConnectionStatus) => {
    set({ connectionStatus: status });
  },
}));

// Export the shared Yjs document for use in other stores
export { ydoc };

// Helper to get Yjs maps for canvas objects
export const getYjsObjects = () => ydoc.getMap<Record<string, unknown>>('objects');
export const getYjsObjectOrder = () => ydoc.getArray<string>('objectOrder');
