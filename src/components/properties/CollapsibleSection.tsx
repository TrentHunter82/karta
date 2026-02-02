import { useState } from 'react';
import type { ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function CollapsibleSection({
  title,
  children,
  defaultExpanded = true
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <section className="properties-section collapsible-section">
      <button
        className="section-header section-header-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="section-title">{title}</span>
        <span className={`section-chevron ${isExpanded ? 'expanded' : ''}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2.5 3.5L5 6L7.5 3.5" />
          </svg>
        </span>
      </button>
      <div
        className={`section-content-animated ${isExpanded ? 'expanded' : 'collapsed'}`}
      >
        <div className="section-content">
          {children}
        </div>
      </div>
    </section>
  );
}
