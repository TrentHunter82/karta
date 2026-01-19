import type { ReactNode } from 'react';

interface IconButtonProps {
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
}

// SVG icons for alignment and distribution
const icons: Record<string, ReactNode> = {
  'align-left': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="1.5" height="12" fill="currentColor"/>
      <rect x="5" y="4" width="8" height="3" fill="currentColor"/>
      <rect x="5" y="9" width="5" height="3" fill="currentColor"/>
    </svg>
  ),
  'align-center-h': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="7.25" y="2" width="1.5" height="12" fill="currentColor"/>
      <rect x="3" y="4" width="10" height="3" fill="currentColor"/>
      <rect x="5" y="9" width="6" height="3" fill="currentColor"/>
    </svg>
  ),
  'align-right': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="12.5" y="2" width="1.5" height="12" fill="currentColor"/>
      <rect x="3" y="4" width="8" height="3" fill="currentColor"/>
      <rect x="6" y="9" width="5" height="3" fill="currentColor"/>
    </svg>
  ),
  'align-top': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="1.5" fill="currentColor"/>
      <rect x="4" y="5" width="3" height="8" fill="currentColor"/>
      <rect x="9" y="5" width="3" height="5" fill="currentColor"/>
    </svg>
  ),
  'align-center-v': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="7.25" width="12" height="1.5" fill="currentColor"/>
      <rect x="4" y="3" width="3" height="10" fill="currentColor"/>
      <rect x="9" y="5" width="3" height="6" fill="currentColor"/>
    </svg>
  ),
  'align-bottom': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="12.5" width="12" height="1.5" fill="currentColor"/>
      <rect x="4" y="3" width="3" height="8" fill="currentColor"/>
      <rect x="9" y="6" width="3" height="5" fill="currentColor"/>
    </svg>
  ),
  'distribute-h': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="4" width="3" height="8" fill="currentColor"/>
      <rect x="6.5" y="5" width="3" height="6" fill="currentColor"/>
      <rect x="11" y="4" width="3" height="8" fill="currentColor"/>
    </svg>
  ),
  'distribute-v': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="4" y="2" width="8" height="3" fill="currentColor"/>
      <rect x="5" y="6.5" width="6" height="3" fill="currentColor"/>
      <rect x="4" y="11" width="8" height="3" fill="currentColor"/>
    </svg>
  ),
};

export function IconButton({
  icon,
  onClick,
  disabled = false,
  title,
  active = false,
}: IconButtonProps) {
  const iconElement = icons[icon] || <span>{icon}</span>;

  return (
    <button
      className={`icon-button ${active ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {iconElement}
    </button>
  );
}
