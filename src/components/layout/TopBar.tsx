import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useCollaborationStore, type UserPresence } from '../../stores/collaborationStore';
import './TopBar.css';

// Maximum number of avatars to show before displaying "+N" indicator
const MAX_VISIBLE_AVATARS = 4;

// Get initials from a user name (e.g., "Happy Fox" -> "HF")
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '??';
  const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function TopBar() {
  const [sessionName, setSessionName] = useState('Untitled Session');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const originalValueRef = useRef('');

  // Collaboration state
  const connectionStatus = useCollaborationStore((state) => state.connectionStatus);
  const connect = useCollaborationStore((state) => state.connect);
  const roomId = useCollaborationStore((state) => state.roomId);
  const localUser = useCollaborationStore((state) => state.localUser);
  const remoteUsers = useCollaborationStore((state) => state.remoteUsers);

  // Combine local user and remote users for display
  const allUsers = useMemo(() => {
    const users: Array<{ id: string; name: string; color: string; isLocal: boolean }> = [];

    // Add local user first
    users.push({
      id: 'local',
      name: localUser.name,
      color: localUser.color,
      isLocal: true,
    });

    // Add remote users
    remoteUsers.forEach((presence: UserPresence, clientId: number) => {
      users.push({
        id: String(clientId),
        name: presence.user.name,
        color: presence.user.color,
        isLocal: false,
      });
    });

    return users;
  }, [localUser, remoteUsers]);

  // Split into visible and overflow
  const visibleUsers = allUsers.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = Math.max(0, allUsers.length - MAX_VISIBLE_AVATARS);

  // Auto-connect on mount with a default room or from URL
  useEffect(() => {
    // Check for room ID in URL hash
    const urlRoomId = window.location.hash.slice(1) || 'default-room';
    connect(urlRoomId);
  }, [connect]);

  const handleNameClick = useCallback(() => {
    setEditValue(sessionName);
    originalValueRef.current = sessionName;
    setIsEditingName(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [sessionName]);

  const handleNameCommit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed) {
      setSessionName(trimmed);
    }
    setIsEditingName(false);
  }, [editValue]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        handleNameCommit();
      } else if (e.key === 'Escape') {
        setIsEditingName(false);
      }
    },
    [handleNameCommit]
  );

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-branding">
          {/* KARTA wordmark - Bold style with inverted first A */}
          <svg
            className="topbar-wordmark"
            width="52"
            height="10"
            viewBox="0 0 62 12"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* K - bold */}
            <path d="M0,0 L2.5,0 L2.5,4.5 L8,0 L11,0 L5,5 L11.5,12 L8.5,12 L3.5,6.5 L2.5,7.3 L2.5,12 L0,12 Z" />
            {/* A - INVERTED (upside down) - bold */}
            <path d="M13,0 L15.5,0 L18,9 L20.5,0 L23,0 L19.5,12 L16.5,12 Z" />
            <path d="M14.5,3.5 L15.2,5.5 L20.8,5.5 L21.5,3.5 Z" />
            {/* R - bold */}
            <path d="M26,0 L33,0 C35.5,0 37,1.3 37,3.2 C37,4.8 35.8,5.8 33.5,6.2 L37.5,12 L34.5,12 L31,6.5 L28.5,6.5 L28.5,12 L26,12 Z M28.5,2 L28.5,4.5 L32.5,4.5 C33.8,4.5 34.5,4 34.5,3.2 C34.5,2.5 33.8,2 32.5,2 Z" />
            {/* T - bold */}
            <path d="M39,0 L50,0 L50,2 L45.75,2 L45.75,12 L43.25,12 L43.25,2 L39,2 Z" />
            {/* A - normal - bold */}
            <path d="M62,12 L59.3,12 L58,9 L54,9 L52.7,12 L50,12 L55,0 L57,0 Z M54.5,7 L57.5,7 L56,3 Z" fillRule="evenodd" />
          </svg>
          <span className="topbar-version">V1.0</span>
        </div>
      </div>
      <div className="topbar-center">
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            className="session-name-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleNameCommit}
            onKeyDown={handleNameKeyDown}
          />
        ) : (
          <button className="session-name" onClick={handleNameClick}>
            {sessionName}
          </button>
        )}
      </div>
      <div className="topbar-right">
        <div
          className={`connection-status ${connectionStatus}`}
          title={
            connectionStatus === 'connected'
              ? `Connected to room: ${roomId}`
              : connectionStatus === 'connecting'
                ? 'Connecting...'
                : 'Disconnected'
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="8" cy="8" r="3" fill="currentColor" />
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              opacity="0.5"
            />
          </svg>
        </div>
        <div className="user-avatars">
          {visibleUsers.map((user) => (
            <div
              key={user.id}
              className={`user-avatar ${user.isLocal ? 'is-local' : ''}`}
              style={{ backgroundColor: user.color }}
              title={user.isLocal ? `${user.name} (you)` : user.name}
            >
              <span>{getInitials(user.name)}</span>
            </div>
          ))}
          {overflowCount > 0 && (
            <div
              className="user-avatar overflow-indicator"
              title={`${overflowCount} more user${overflowCount > 1 ? 's' : ''}`}
            >
              <span>+{overflowCount}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
