import { useEffect } from 'react';
import './ShortcutsModal.css';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  {
    category: 'Tools',
    items: [
      { keys: 'V', action: 'Select tool' },
      { keys: 'H', action: 'Hand tool (pan)' },
      { keys: 'R', action: 'Rectangle tool' },
      { keys: 'O', action: 'Ellipse tool' },
      { keys: 'T', action: 'Text tool' },
      { keys: 'F', action: 'Frame tool' },
      { keys: 'P', action: 'Pen tool' },
      { keys: 'L', action: 'Line tool' },
      { keys: '⇧L', action: 'Arrow tool' },
    ]
  },
  {
    category: 'Selection',
    items: [
      { keys: 'Ctrl+A', action: 'Select all' },
      { keys: 'Escape', action: 'Deselect all' },
      { keys: 'Tab', action: 'Select next object' },
      { keys: '⇧Tab', action: 'Select previous object' },
    ]
  },
  {
    category: 'Edit',
    items: [
      { keys: 'Ctrl+C', action: 'Copy' },
      { keys: 'Ctrl+V', action: 'Paste' },
      { keys: 'Ctrl+D', action: 'Duplicate' },
      { keys: 'Delete', action: 'Delete selected' },
      { keys: 'Ctrl+Z', action: 'Undo' },
      { keys: 'Ctrl+⇧Z', action: 'Redo' },
    ]
  },
  {
    category: 'Transform',
    items: [
      { keys: '↑↓←→', action: 'Nudge 1px' },
      { keys: '⇧+↑↓←→', action: 'Nudge 10px' },
      { keys: ']', action: 'Bring forward' },
      { keys: '[', action: 'Send backward' },
      { keys: 'Ctrl+]', action: 'Bring to front' },
      { keys: 'Ctrl+[', action: 'Send to back' },
    ]
  },
  {
    category: 'View',
    items: [
      { keys: 'Ctrl+=', action: 'Zoom in' },
      { keys: 'Ctrl+-', action: 'Zoom out' },
      { keys: 'Ctrl+0', action: 'Fit all' },
      { keys: 'Ctrl+1', action: 'Zoom to 100%' },
      { keys: 'Ctrl+⇧2', action: 'Fit selection' },
      { keys: 'Space+drag', action: 'Pan canvas' },
      { keys: 'M', action: 'Toggle minimap' },
    ]
  },
  {
    category: 'Alignment',
    items: [
      { keys: 'Ctrl+⇧L', action: 'Align left' },
      { keys: 'Ctrl+⇧R', action: 'Align right' },
      { keys: 'Ctrl+⇧T', action: 'Align top' },
      { keys: 'Ctrl+⇧B', action: 'Align bottom' },
      { keys: 'Ctrl+⇧H', action: 'Align center horizontal' },
      { keys: 'Ctrl+⇧E', action: 'Align center vertical' },
    ]
  },
  {
    category: 'Grouping',
    items: [
      { keys: 'Ctrl+G', action: 'Group selection' },
      { keys: 'Ctrl+⇧G', action: 'Ungroup selection' },
    ]
  },
  {
    category: 'Text',
    items: [
      { keys: 'Ctrl+B', action: 'Toggle bold' },
      { keys: 'Ctrl+I', action: 'Toggle italic' },
      { keys: 'Ctrl+U', action: 'Toggle underline' },
    ]
  }
];

export const ShortcutsModal = ({ isOpen, onClose }: ShortcutsModalProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="shortcuts-modal-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="shortcuts-modal-content">
          {shortcuts.map(section => (
            <div key={section.category} className="shortcuts-section">
              <h3>{section.category}</h3>
              <div className="shortcuts-list">
                {section.items.map(item => (
                  <div key={item.keys} className="shortcut-item">
                    <kbd>{item.keys}</kbd>
                    <span>{item.action}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcuts-modal-footer">
          Press <kbd>?</kbd> to open this dialog
        </div>
      </div>
    </div>
  );
};
