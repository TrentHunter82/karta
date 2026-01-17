import { useState, useRef, useCallback } from 'react';
import './TopBar.css';

export function TopBar() {
  const [sessionName, setSessionName] = useState('Untitled Session');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const originalValueRef = useRef('');

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
          <svg
            className="topbar-logo"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="20" height="20" rx="4" fill="#0066ff" />
            <path
              d="M5 6L10 14L15 6"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="topbar-app-name">KARTA</span>
          <span className="topbar-version">V1.0.0</span>
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
        <div className="connection-status connected" title="Connected">
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
        <div className="user-avatar" title="User">
          <span>U</span>
        </div>
      </div>
    </header>
  );
}
