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
          {/* KARTA wordmark - Helvetica Light style with inverted first A */}
          <svg
            className="topbar-wordmark"
            width="62"
            height="12"
            viewBox="0 0 62 12"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* K - light weight */}
            <path d="M0,0 L1.5,0 L1.5,5.25 L8,0 L10,0 L4.5,4.9 L10.5,12 L8.5,12 L3.5,6 L1.5,7.7 L1.5,12 L0,12 Z" />
            {/* A - INVERTED (upside down) - light weight */}
            <path d="M13,0 L14.5,0 L18,10 L21.5,0 L23,0 L18.8,12 L17.2,12 Z M14.8,3 L15.3,4 L20.7,4 L21.2,3 Z" fillRule="evenodd" />
            {/* R - light weight */}
            <path d="M26,0 L32,0 C34.5,0 36,1.1 36,3 C36,4.6 34.8,5.6 32.5,5.9 L36.5,12 L34.8,12 L31,6 L27.5,6 L27.5,12 L26,12 Z M27.5,1 L27.5,5 L31.8,5 C33.5,5 34.5,4.3 34.5,3 C34.5,1.7 33.5,1 31.8,1 Z" />
            {/* T - light weight */}
            <path d="M39,0 L49,0 L49,1 L44.75,1 L44.75,12 L43.25,12 L43.25,1 L39,1 Z" />
            {/* A - normal - light weight */}
            <path d="M62,12 L60.3,12 L58.8,9 L53.2,9 L51.7,12 L50,12 L55,0 L57,0 Z M53.7,8 L58.3,8 L56,2.6 Z" fillRule="evenodd" />
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
