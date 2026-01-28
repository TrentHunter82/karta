import { create } from 'zustand';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useCanvasStore } from './canvasStore';

// Connection status type
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

// User cursor presence data
export interface UserPresence {
  clientId: number;
  user: {
    name: string;
    color: string;
  };
  cursor: {
    x: number;
    y: number;
  } | null;
  lastActive: number;
}

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

  // User presence
  localUser: { name: string; color: string };
  remoteUsers: Map<number, UserPresence>;

  // Internal state (moved from module scope for better state management)
  awarenessChangeHandler: (() => void) | null;

  // Actions
  connect: (roomId: string, serverUrl?: string) => void;
  disconnect: () => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLocalCursor: (x: number, y: number) => void;
  clearLocalCursor: () => void;
  setLocalUserName: (name: string) => void;
}

// Default WebSocket server URL (y-websocket demo server)
// In production, this should be your own y-websocket server
const DEFAULT_SERVER_URL = 'wss://demos.yjs.dev/ws';

// Track pending disconnection toast timeout
let disconnectionToastTimeout: ReturnType<typeof setTimeout> | null = null;

// Create a shared Yjs document (using let to allow recreation on disconnect)
let ydoc = new Y.Doc();

// Generate a random color for user presence
const generateUserColor = (): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8B500', '#FF6F61', '#6B5B95', '#88B04B', '#F7CAC9',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Generate a random user name
const generateUserName = (): string => {
  const adjectives = ['Happy', 'Swift', 'Bright', 'Calm', 'Bold', 'Keen', 'Noble', 'Witty'];
  const animals = ['Fox', 'Owl', 'Bear', 'Wolf', 'Deer', 'Hawk', 'Lion', 'Swan'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adj} ${animal}`;
};

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  // Initial state
  doc: ydoc,
  provider: null,
  connectionStatus: 'disconnected',
  roomId: '',
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  localUser: {
    name: generateUserName(),
    color: generateUserColor(),
  },
  remoteUsers: new Map(),
  awarenessChangeHandler: null,

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
          // Clear pending disconnection toast if reconnection succeeded within grace period
          if (disconnectionToastTimeout) {
            clearTimeout(disconnectionToastTimeout);
            disconnectionToastTimeout = null;

          }

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
          // Start grace period timer on first disconnect (only show toast if reconnection fails within 5s)
        } else {
          // Clear any pending toast timeout
          if (disconnectionToastTimeout) {
            clearTimeout(disconnectionToastTimeout);
            disconnectionToastTimeout = null;
          }
          set({ connectionStatus: 'disconnected' });
        }
      });

      // Handle connection errors
      provider.on('connection-error', (event: Event) => {
        console.error('[Collaboration] Connection error:', event);
      });

      // Set up awareness for cursor presence
      const awareness = provider.awareness;
      const { localUser } = get();

      // Set initial local state
      awareness.setLocalStateField('user', localUser);
      awareness.setLocalStateField('cursor', null);

      // Handle awareness changes (remote users' cursors)
      const handleAwarenessChange = () => {
        const states = awareness.getStates();
        const newRemoteUsers = new Map<number, UserPresence>();
        const localClientId = awareness.clientID;

        states.forEach((state, clientId) => {
          // Skip our own client
          if (clientId === localClientId) return;

          if (state.user) {
            newRemoteUsers.set(clientId, {
              clientId,
              user: state.user as { name: string; color: string },
              cursor: state.cursor as { x: number; y: number } | null,
              lastActive: Date.now(),
            });
          }
        });

        set({ remoteUsers: newRemoteUsers });
      };

      // Store handler reference for cleanup
      set({ awarenessChangeHandler: handleAwarenessChange });
      awareness.on('change', handleAwarenessChange);
      // Initial update
      handleAwarenessChange();

      set({ provider });

    } catch (error) {
      console.error('[Collaboration] Failed to create WebSocket provider:', error);
      set({ connectionStatus: 'disconnected' });
    }
  },

  disconnect: () => {
    const state = get();

    // Clear any pending disconnection toast timeout
    if (disconnectionToastTimeout) {
      clearTimeout(disconnectionToastTimeout);
      disconnectionToastTimeout = null;
    }

    if (state.provider) {
      // Remove awareness listener before destroying
      if (state.provider.awareness && state.awarenessChangeHandler) {
        state.provider.awareness.off('change', state.awarenessChangeHandler);
        set({ awarenessChangeHandler: null });
      }
      state.provider.disconnect();
      state.provider.destroy();
    }

    // Destroy the old Yjs document to prevent memory leaks
    ydoc.destroy();
    // Create a fresh Yjs document for the next connection
    ydoc = new Y.Doc();

    // Reset the canvas store's Yjs sync state so it reinitializes on next connect
    useCanvasStore.getState().resetYjsSync();

    set({
      doc: ydoc,
      provider: null,
      connectionStatus: 'disconnected',
      roomId: '',
      reconnectAttempts: 0,
      remoteUsers: new Map()
    });

  },

  setConnectionStatus: (status: ConnectionStatus) => {
    set({ connectionStatus: status });
  },

  setLocalCursor: (x: number, y: number) => {
    const { provider } = get();
    if (provider?.awareness) {
      provider.awareness.setLocalStateField('cursor', { x, y });
    }
  },

  clearLocalCursor: () => {
    const { provider } = get();
    if (provider?.awareness) {
      provider.awareness.setLocalStateField('cursor', null);
    }
  },

  setLocalUserName: (name: string) => {
    const { provider, localUser } = get();
    const newLocalUser = { ...localUser, name };
    set({ localUser: newLocalUser });
    if (provider?.awareness) {
      provider.awareness.setLocalStateField('user', newLocalUser);
    }
  },
}));

// Export the shared Yjs document for use in other stores
// Note: Use getYdoc() to always get the current instance after reconnection
export { ydoc };

// Getter to always get the current Yjs document instance (use this for dynamic access)
export const getYdoc = () => ydoc;

// Helper to get Yjs maps for canvas objects
export const getYjsObjects = () => ydoc.getMap<Record<string, unknown>>('objects');
export const getYjsObjectOrder = () => ydoc.getArray<string>('objectOrder');
