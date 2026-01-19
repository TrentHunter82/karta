import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { useClipboardStore } from '../stores/clipboardStore';
import { useSelectionStore } from '../stores/selectionStore';
import './ContextMenu.css';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  targetObjectId: string | null;
}

type MenuItem = {
  label: string;
  action?: () => void;
  shortcut?: string;
  disabled?: boolean;
  divider?: never;
  submenu?: MenuItemOrDivider[];
} | {
  divider: true;
  label?: never;
  action?: never;
  shortcut?: never;
  disabled?: never;
  submenu?: never;
};

type MenuItemOrDivider = MenuItem;

export function ContextMenu({ x, y, onClose, targetObjectId: _targetObjectId }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  // Store state
  const objects = useCanvasStore((state) => state.objects);
  const copySelection = useCanvasStore((state) => state.copySelection);
  const paste = useCanvasStore((state) => state.paste);
  const duplicate = useCanvasStore((state) => state.duplicate);
  const deleteSelectedObjects = useCanvasStore((state) => state.deleteSelectedObjects);
  const bringToFront = useCanvasStore((state) => state.bringToFront);
  const bringForward = useCanvasStore((state) => state.bringForward);
  const sendBackward = useCanvasStore((state) => state.sendBackward);
  const sendToBack = useCanvasStore((state) => state.sendToBack);
  const selectAll = useCanvasStore((state) => state.selectAll);
  const alignObjects = useCanvasStore((state) => state.alignObjects);
  const distributeObjects = useCanvasStore((state) => state.distributeObjects);
  const groupSelection = useCanvasStore((state) => state.groupSelection);
  const ungroupSelection = useCanvasStore((state) => state.ungroupSelection);

  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const hasClipboard = useClipboardStore((state) => state.hasItems());

  const hasSelection = selectedIds.size > 0;
  const selectedCount = selectedIds.size;

  // Check if any selected object is a group
  const hasGroups = Array.from(selectedIds).some(id => {
    const obj = objects.get(id);
    return obj?.type === 'group';
  });

  // Close on click outside or escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Use setTimeout to prevent immediate closing from the same click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    const padding = 10;

    let adjustedX = x;
    let adjustedY = y;

    if (x + rect.width + padding > window.innerWidth) {
      adjustedX = x - rect.width;
    }

    if (y + rect.height + padding > window.innerHeight) {
      adjustedY = y - rect.height;
    }

    setPosition({
      x: Math.max(padding, adjustedX),
      y: Math.max(padding, adjustedY)
    });
  }, [x, y]);

  const executeAndClose = (action: () => void) => {
    action();
    onClose();
  };

  const handleCut = () => {
    copySelection();
    deleteSelectedObjects();
  };

  // Build menu items
  const menuItems: MenuItemOrDivider[] = [
    {
      label: 'Cut',
      action: handleCut,
      shortcut: 'Ctrl+X',
      disabled: !hasSelection
    },
    {
      label: 'Copy',
      action: copySelection,
      shortcut: 'Ctrl+C',
      disabled: !hasSelection
    },
    {
      label: 'Paste',
      action: paste,
      shortcut: 'Ctrl+V',
      disabled: !hasClipboard
    },
    {
      label: 'Duplicate',
      action: duplicate,
      shortcut: 'Ctrl+D',
      disabled: !hasSelection
    },
    { divider: true },
    {
      label: 'Delete',
      action: deleteSelectedObjects,
      shortcut: 'Delete',
      disabled: !hasSelection
    },
  ];

  // Add alignment submenu when 2+ objects selected
  if (selectedCount >= 2) {
    menuItems.push(
      { divider: true },
      {
        label: 'Align',
        submenu: [
          { label: 'Align Left', action: () => alignObjects('left'), shortcut: 'Ctrl+Shift+L' },
          { label: 'Align Center', action: () => alignObjects('centerH'), shortcut: 'Ctrl+Shift+H' },
          { label: 'Align Right', action: () => alignObjects('right'), shortcut: 'Ctrl+Shift+R' },
          { divider: true },
          { label: 'Align Top', action: () => alignObjects('top'), shortcut: 'Ctrl+Shift+T' },
          { label: 'Align Middle', action: () => alignObjects('centerV'), shortcut: 'Ctrl+Shift+E' },
          { label: 'Align Bottom', action: () => alignObjects('bottom'), shortcut: 'Ctrl+Shift+B' },
        ]
      }
    );
  }

  // Add distribution submenu when 3+ objects selected
  if (selectedCount >= 3) {
    menuItems.push({
      label: 'Distribute',
      submenu: [
        { label: 'Distribute Horizontally', action: () => distributeObjects('horizontal') },
        { label: 'Distribute Vertically', action: () => distributeObjects('vertical') },
      ]
    });
  }

  // Add grouping options
  if (selectedCount >= 2) {
    menuItems.push(
      { divider: true },
      {
        label: 'Group',
        action: groupSelection,
        shortcut: 'Ctrl+G'
      }
    );
  }

  if (hasGroups) {
    menuItems.push({
      label: 'Ungroup',
      action: ungroupSelection,
      shortcut: 'Ctrl+Shift+G'
    });
  }

  // Z-order options
  if (hasSelection) {
    menuItems.push(
      { divider: true },
      {
        label: 'Bring to Front',
        action: bringToFront,
        shortcut: 'Ctrl+]'
      },
      {
        label: 'Bring Forward',
        action: bringForward,
        shortcut: ']'
      },
      {
        label: 'Send Backward',
        action: sendBackward,
        shortcut: '['
      },
      {
        label: 'Send to Back',
        action: sendToBack,
        shortcut: 'Ctrl+['
      }
    );
  }

  // Always show select all
  menuItems.push(
    { divider: true },
    {
      label: 'Select All',
      action: selectAll,
      shortcut: 'Ctrl+A'
    }
  );

  return (
    <div
      className="context-menu"
      ref={menuRef}
      style={{ left: position.x, top: position.y }}
    >
      {menuItems.map((item, index) => {
        if ('divider' in item && item.divider) {
          return <div key={`divider-${index}`} className="context-menu-divider" />;
        }
        const menuItem = item as NonDividerMenuItem;
        return (
          <MenuItemComponent
            key={menuItem.label}
            item={menuItem}
            onExecute={executeAndClose}
          />
        );
      })}
    </div>
  );
}

type NonDividerMenuItem = {
  label: string;
  action?: () => void;
  shortcut?: string;
  disabled?: boolean;
  submenu?: MenuItemOrDivider[];
};

interface MenuItemComponentProps {
  item: NonDividerMenuItem;
  onExecute: (action: () => void) => void;
}

function MenuItemComponent({ item, onExecute }: MenuItemComponentProps) {
  const [showSubmenu, setShowSubmenu] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  if (item.submenu) {
    return (
      <div
        ref={itemRef}
        className="context-menu-item has-submenu"
        onMouseEnter={() => setShowSubmenu(true)}
        onMouseLeave={() => setShowSubmenu(false)}
      >
        <span className="menu-item-label">{item.label}</span>
        <span className="submenu-arrow">▶</span>

        {showSubmenu && (
          <div className="context-submenu">
            {item.submenu.map((subItem, i) => {
              if ('divider' in subItem && subItem.divider) {
                return <div key={`sub-divider-${i}`} className="context-menu-divider" />;
              }
              const menuItem = subItem as NonDividerMenuItem;
              return (
                <button
                  key={menuItem.label}
                  className={`context-menu-item ${menuItem.disabled ? 'disabled' : ''}`}
                  onClick={() => !menuItem.disabled && menuItem.action && onExecute(menuItem.action)}
                  disabled={menuItem.disabled}
                >
                  <span className="menu-item-label">{menuItem.label}</span>
                  {menuItem.shortcut && (
                    <span className="menu-item-shortcut">{menuItem.shortcut}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      className={`context-menu-item ${item.disabled ? 'disabled' : ''}`}
      onClick={() => !item.disabled && item.action && onExecute(item.action)}
      disabled={item.disabled}
    >
      <span className="menu-item-label">{item.label}</span>
      {item.shortcut && (
        <span className="menu-item-shortcut">{item.shortcut}</span>
      )}
    </button>
  );
}
