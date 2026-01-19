interface TextAlignInputProps {
  value: 'left' | 'center' | 'right' | 'mixed';
  onChange: (value: 'left' | 'center' | 'right') => void;
  disabled?: boolean;
}

export function TextAlignInput({
  value,
  onChange,
  disabled = false,
}: TextAlignInputProps) {
  return (
    <div className="text-align-input">
      <label className="text-align-input-label">Align</label>
      <div className="text-align-buttons">
        <button
          className={`text-align-btn ${value === 'left' ? 'active' : ''}`}
          onClick={() => onChange('left')}
          disabled={disabled}
          title="Align left"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="1.5" fill="currentColor"/>
            <rect x="1" y="5.5" width="8" height="1.5" fill="currentColor"/>
            <rect x="1" y="9" width="10" height="1.5" fill="currentColor"/>
          </svg>
        </button>
        <button
          className={`text-align-btn ${value === 'center' ? 'active' : ''}`}
          onClick={() => onChange('center')}
          disabled={disabled}
          title="Align center"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="1.5" fill="currentColor"/>
            <rect x="3" y="5.5" width="8" height="1.5" fill="currentColor"/>
            <rect x="2" y="9" width="10" height="1.5" fill="currentColor"/>
          </svg>
        </button>
        <button
          className={`text-align-btn ${value === 'right' ? 'active' : ''}`}
          onClick={() => onChange('right')}
          disabled={disabled}
          title="Align right"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="1.5" fill="currentColor"/>
            <rect x="5" y="5.5" width="8" height="1.5" fill="currentColor"/>
            <rect x="3" y="9" width="10" height="1.5" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
