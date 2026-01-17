import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useCollaborationStore, type UserPresence } from '../../stores/collaborationStore';
import { useCanvasStore } from '../../stores/canvasStore';
import './CursorPresence.css';

// Throttle cursor updates to ~30fps (33ms)
const CURSOR_UPDATE_INTERVAL = 33;
// Fade out cursors after 5 seconds of inactivity
const CURSOR_FADE_TIMEOUT = 5000;

// Store timestamps outside of React to avoid effect state issues
const userActivityTimestamps = new Map<number, { x: number; y: number; time: number }>();

export function CursorPresence() {
  const viewport = useCanvasStore((state) => state.viewport);
  const remoteUsers = useCollaborationStore((state) => state.remoteUsers);
  const setLocalCursor = useCollaborationStore((state) => state.setLocalCursor);
  const clearLocalCursor = useCollaborationStore((state) => state.clearLocalCursor);
  const connectionStatus = useCollaborationStore((state) => state.connectionStatus);

  // Track last update time to throttle
  const lastUpdateTimeRef = useRef(0);
  // Current timestamp for fade calculations (updated periodically)
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Convert canvas coordinates to screen coordinates for display
  const canvasToScreen = useCallback(
    (x: number, y: number) => ({
      x: (x + viewport.x) * viewport.zoom,
      y: (y + viewport.y) * viewport.zoom,
    }),
    [viewport]
  );

  // Convert screen coordinates to canvas coordinates for broadcasting
  const screenToCanvas = useCallback(
    (x: number, y: number) => ({
      x: x / viewport.zoom - viewport.x,
      y: y / viewport.zoom - viewport.y,
    }),
    [viewport]
  );

  // Throttled cursor update function
  const updateCursor = useCallback(
    (screenX: number, screenY: number) => {
      if (connectionStatus !== 'connected') return;

      const now = Date.now();
      if (now - lastUpdateTimeRef.current < CURSOR_UPDATE_INTERVAL) return;

      lastUpdateTimeRef.current = now;
      const canvasPos = screenToCanvas(screenX, screenY);
      setLocalCursor(canvasPos.x, canvasPos.y);
    },
    [connectionStatus, screenToCanvas, setLocalCursor]
  );

  // Handle mouse move on the canvas area
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Get canvas container position
      const canvasContainer = document.querySelector('.canvas-container');
      if (!canvasContainer) return;

      const rect = canvasContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Only update if within canvas bounds
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        updateCursor(x, y);
      }
    };

    const handleMouseLeave = () => {
      clearLocalCursor();
    };

    // Attach to the canvas container
    const canvasContainer = document.querySelector('.canvas-container');
    if (canvasContainer) {
      canvasContainer.addEventListener('mousemove', handleMouseMove as EventListener);
      canvasContainer.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      // Query again in cleanup to ensure we remove from the current element
      const container = document.querySelector('.canvas-container');
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove as EventListener);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [updateCursor, clearLocalCursor]);

  // Periodic update to handle fade effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate cursors to render with opacity based on activity
  const cursorsToRender = useMemo(() => {
    const result: (UserPresence & { opacity: number; screenPos: { x: number; y: number } })[] = [];

    remoteUsers.forEach((user) => {
      if (!user.cursor) return;

      // Update activity timestamp if cursor position changed
      const existingEntry = userActivityTimestamps.get(user.clientId);
      const hasCursorChanged = !existingEntry ||
        existingEntry.x !== user.cursor.x ||
        existingEntry.y !== user.cursor.y;

      // Use currentTime for timestamp updates to avoid impure Date.now() calls
      const lastActiveTime = hasCursorChanged ? currentTime : (existingEntry?.time || currentTime);

      if (hasCursorChanged) {
        userActivityTimestamps.set(user.clientId, {
          x: user.cursor.x,
          y: user.cursor.y,
          time: lastActiveTime,
        });
      }

      // Calculate opacity based on last activity
      const elapsed = currentTime - lastActiveTime;
      let opacity = 1;

      if (elapsed >= CURSOR_FADE_TIMEOUT) {
        // Fade out over 1 second after the timeout
        const fadeProgress = Math.min((elapsed - CURSOR_FADE_TIMEOUT) / 1000, 1);
        opacity = Math.max(0, 1 - fadeProgress);
      }

      if (opacity <= 0) return;

      const screenPos = canvasToScreen(user.cursor.x, user.cursor.y);
      result.push({ ...user, opacity, screenPos });
    });

    // Clean up timestamps for users who have disconnected
    userActivityTimestamps.forEach((_, clientId) => {
      if (!remoteUsers.has(clientId)) {
        userActivityTimestamps.delete(clientId);
      }
    });

    return result;
  }, [remoteUsers, currentTime, canvasToScreen]);

  if (cursorsToRender.length === 0) return null;

  return (
    <div className="cursor-presence-layer">
      {cursorsToRender.map((user) => (
        <div
          key={user.clientId}
          className="remote-cursor"
          style={{
            left: user.screenPos.x,
            top: user.screenPos.y,
            opacity: user.opacity,
          }}
        >
          {/* Cursor pointer SVG */}
          <svg
            className="cursor-pointer"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill={user.user.color}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 0L16 6L9 8L6 16L0 0Z"
              stroke="white"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
          {/* User name label */}
          <div
            className="cursor-label"
            style={{ backgroundColor: user.user.color }}
          >
            {user.user.name}
          </div>
        </div>
      ))}
    </div>
  );
}
