import type { ReactNode } from 'react';

interface PropertyRowProps {
  label?: string;
  children: ReactNode;
  inline?: boolean;
}

export function PropertyRow({
  label,
  children,
  inline = false,
}: PropertyRowProps) {
  return (
    <div className={`property-row ${inline ? 'inline' : ''}`}>
      {label && <span className="property-row-label">{label}</span>}
      <div className="property-row-content">
        {children}
      </div>
    </div>
  );
}
