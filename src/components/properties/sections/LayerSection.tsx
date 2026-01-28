import { useState } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasObject } from '../../../types/canvas';
import { isTextObject, isFrameObject, isGroupObject } from '../../../types/canvas';

export function LayerSection() {
  const objects = useCanvasStore((state) => state.objects);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const setSelection = useCanvasStore((state) => state.setSelection);
  const reorderObject = useCanvasStore((state) => state.reorderObject);
  const updateObject = useCanvasStore((state) => state.updateObject);
  const editingGroupId = useCanvasStore((state) => state.editingGroupId);
  const enterGroupEditMode = useCanvasStore((state) => state.enterGroupEditMode);
  const exitGroupEditMode = useCanvasStore((state) => state.exitGroupEditMode);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Sort objects by zIndex (highest first for display - top of list = front)
  // Only show top-level objects (not children of groups)
  const sortedObjects = Array.from(objects.values())
    .filter((obj) => !obj.parentId)
    .sort((a, b) => b.zIndex - a.zIndex);

  const toggleGroupExpanded = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleVisibilityToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const obj = objects.get(id);
    if (obj) {
      updateObject(id, { visible: obj.visible === false ? true : false });
    }
  };

  const handleLockToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const obj = objects.get(id);
    if (obj) {
      updateObject(id, { locked: !obj.locked });
    }
  };

  const handleItemClick = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey && selectedIds.size > 0) {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      setSelection(Array.from(newSelection));
    } else if (e.ctrlKey || e.metaKey) {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      setSelection(Array.from(newSelection));
    } else {
      setSelection([id]);
    }
  };

  const handleItemDoubleClick = (id: string) => {
    const obj = objects.get(id);
    if (obj?.type === 'group') {
      enterGroupEditMode(id);
      setExpandedGroups(new Set([...expandedGroups, id]));
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId === id) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'above' : 'below';

    setDragOverId(id);
    setDragOverPosition(position);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
    setDragOverPosition(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      setDragOverPosition(null);
      return;
    }

    const draggedObj = objects.get(draggedId);
    const targetObj = objects.get(targetId);
    if (!draggedObj || !targetObj) return;

    let newZIndex: number;
    if (dragOverPosition === 'above') {
      newZIndex = targetObj.zIndex + 1;
    } else {
      newZIndex = targetObj.zIndex;
    }

    newZIndex = Math.max(0, Math.min(objects.size - 1, newZIndex));
    reorderObject(draggedId, newZIndex);

    setDraggedId(null);
    setDragOverId(null);
    setDragOverPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    setDragOverPosition(null);
  };

  const getObjectName = (obj: CanvasObject) => {
    if (isTextObject(obj)) {
      return obj.text.slice(0, 20) || 'Text';
    }
    if (isFrameObject(obj)) {
      return obj.name;
    }
    if (isGroupObject(obj)) {
      return `Group (${obj.children.length})`;
    }
    return obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'rectangle': return '▢';
      case 'ellipse': return '○';
      case 'text': return 'T';
      case 'frame': return '⬚';
      case 'path': return '✎';
      case 'image': return '🖼';
      case 'video': return '▶';
      case 'group': return '⊞';
      case 'line': return '⁄';
      case 'arrow': return '→';
      case 'polygon': return '⬡';
      case 'star': return '★';
      default: return '?';
    }
  };

  const getSelectionText = () => {
    if (selectedIds.size === 0) {
      return objects.size > 0 ? `${objects.size} Items` : 'Canvas Empty';
    }
    if (selectedIds.size === objects.size && objects.size > 0) {
      return `All (${objects.size} objects)`;
    }
    return `${selectedIds.size} ${selectedIds.size === 1 ? 'object' : 'objects'} selected`;
  };

  const renderHierarchyItem = (obj: CanvasObject, depth: number = 0) => {
    const isGroup = obj.type === 'group';
    const isExpanded = expandedGroups.has(obj.id);
    const isVisible = obj.visible !== false;
    const isLocked = obj.locked === true;
    const isEditingGroup = editingGroupId === obj.id;

    return (
      <div key={obj.id}>
        <div
          className={`hierarchy-item ${selectedIds.has(obj.id) ? 'selected' : ''} ${draggedId === obj.id ? 'dragging' : ''} ${dragOverId === obj.id ? `drag-over-${dragOverPosition}` : ''} ${isEditingGroup ? 'editing-group' : ''} ${!isVisible ? 'hidden-object' : ''} ${isLocked ? 'locked-object' : ''}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={(e) => handleItemClick(obj.id, e)}
          onDoubleClick={() => handleItemDoubleClick(obj.id)}
          draggable
          onDragStart={(e) => handleDragStart(e, obj.id)}
          onDragOver={(e) => handleDragOver(e, obj.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, obj.id)}
          onDragEnd={handleDragEnd}
        >
          <span className="hierarchy-drag-handle">⋮⋮</span>
          {isGroup && (
            <button
              className={`hierarchy-expand-btn ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleGroupExpanded(obj.id);
              }}
            >
              ▸
            </button>
          )}
          <span className="hierarchy-icon">
            {getTypeIcon(obj.type)}
          </span>
          <span className="hierarchy-name">
            {getObjectName(obj)}
          </span>
          <div className="hierarchy-controls">
            <button
              className={`hierarchy-visibility-btn ${!isVisible ? 'hidden' : ''}`}
              onClick={(e) => handleVisibilityToggle(e, obj.id)}
              title={isVisible ? 'Hide object' : 'Show object'}
            >
              {isVisible ? '👁' : '👁‍🗨'}
            </button>
            <button
              className={`hierarchy-lock-btn ${isLocked ? 'locked' : ''}`}
              onClick={(e) => handleLockToggle(e, obj.id)}
              title={isLocked ? 'Unlock object' : 'Lock object'}
            >
              {isLocked ? '🔒' : '🔓'}
            </button>
          </div>
        </div>
        {isGroup && isExpanded && isGroupObject(obj) && (
          <div className="hierarchy-group-children">
            {obj.children.map((childId) => {
              const childObj = objects.get(childId);
              if (childObj) {
                return renderHierarchyItem(childObj, depth + 1);
              }
              return null;
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="properties-section layer-section">
      <div className="section-header">
        <span className="section-title">Layers</span>
      </div>
      <div className="section-content">
        <div className="hierarchy-info">
          {getSelectionText()}
          {editingGroupId && (
            <button
              className="exit-group-edit-btn"
              onClick={() => exitGroupEditMode()}
              title="Exit group edit mode"
            >
              ← Exit Group
            </button>
          )}
        </div>
        <div className="hierarchy-list">
          {sortedObjects.map((obj) => renderHierarchyItem(obj))}
        </div>
      </div>
    </section>
  );
}
