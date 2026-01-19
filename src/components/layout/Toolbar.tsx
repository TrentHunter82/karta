import { useRef, type ReactNode } from 'react';
import './Toolbar.css';
import { useCanvasStore } from '../../stores/canvasStore';
import { useToastStore } from '../../stores/toastStore';
import { useTemplateStore } from '../../stores/templateStore';
import type { ToolType, ImageObject, VideoObject } from '../../types/canvas';

interface ToolButton {
  id: ToolType;
  name: string;
  shortcut: string;
  icon: ReactNode;
}

const tools: ToolButton[] = [
  {
    id: 'select',
    name: 'Select',
    shortcut: 'V',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2L16 10L10 11L8 17L4 2Z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'hand',
    name: 'Hand',
    shortcut: 'H',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2v8M7 5v5M13 5v5M5 8v6a2 2 0 002 2h6a2 2 0 002-2V8" />
      </svg>
    ),
  },
  {
    id: 'rectangle',
    name: 'Rectangle',
    shortcut: 'R',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="14" height="12" rx="1" />
      </svg>
    ),
  },
  {
    id: 'ellipse',
    name: 'Ellipse',
    shortcut: 'O',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="10" cy="10" rx="7" ry="5" />
      </svg>
    ),
  },
  {
    id: 'line',
    name: 'Line',
    shortcut: 'L',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="16" x2="16" y2="4" />
      </svg>
    ),
  },
  {
    id: 'arrow',
    name: 'Arrow',
    shortcut: '⇧L',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="16" x2="14" y2="6" />
        <polyline points="9,4 16,4 16,11" />
      </svg>
    ),
  },
  {
    id: 'text',
    name: 'Text',
    shortcut: 'T',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h12M10 5v11M7 16h6" />
      </svg>
    ),
  },
  {
    id: 'frame',
    name: 'Frame',
    shortcut: 'F',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="14" height="12" rx="1" />
        <line x1="3" y1="7" x2="17" y2="7" />
      </svg>
    ),
  },
  {
    id: 'pen',
    name: 'Pen',
    shortcut: 'P',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3l3 3-10 10H4v-3L14 3z" />
      </svg>
    ),
  },
];

const MAX_IMAGE_SIZE = 800; // Max dimension for imported images

export function Toolbar() {
  const activeTool = useCanvasStore((state) => state.activeTool);
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);
  const addObject = useCanvasStore((state) => state.addObject);
  const getNextZIndex = useCanvasStore((state) => state.getNextZIndex);
  const setSelection = useCanvasStore((state) => state.setSelection);
  const viewport = useCanvasStore((state) => state.viewport);
  const selectedCount = useCanvasStore((state) => state.selectedIds.size);
  const alignObjects = useCanvasStore((state) => state.alignObjects);
  const distributeObjects = useCanvasStore((state) => state.distributeObjects);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showTemplatePanel, toggleTemplatePanel } = useTemplateStore();

  const handleToolClick = (tool: ToolType) => {
    setActiveTool(tool);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileType = file.type.toLowerCase();
    const isVideo = fileType === 'video/mp4' || fileType === 'video/webm';

    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;

      if (isVideo) {
        // Handle video file
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          // Calculate dimensions, scaling down if necessary
          let width = video.videoWidth;
          let height = video.videoHeight;

          if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
            const aspectRatio = width / height;
            if (width > height) {
              width = MAX_IMAGE_SIZE;
              height = MAX_IMAGE_SIZE / aspectRatio;
            } else {
              height = MAX_IMAGE_SIZE;
              width = MAX_IMAGE_SIZE * aspectRatio;
            }
          }

          // Calculate canvas center position
          const canvasCenterX = -viewport.x + (window.innerWidth / 2) / viewport.zoom;
          const canvasCenterY = -viewport.y + (window.innerHeight / 2) / viewport.zoom;

          // Position video so its center is at the canvas center
          const x = canvasCenterX - width / 2;
          const y = canvasCenterY - height / 2;

          const newVideo: VideoObject = {
            id: crypto.randomUUID(),
            type: 'video',
            x,
            y,
            width,
            height,
            rotation: 0,
            opacity: 1,
            zIndex: getNextZIndex(),
            src: dataUrl,
          };

          addObject(newVideo);
          setSelection([newVideo.id]);
        };
        video.onerror = () => {
          useToastStore.getState().addToast({
            message: 'Failed to load video. Format may not be supported.',
            type: 'error',
            duration: 5000
          });
        };
        video.src = dataUrl;
      } else {
        // Handle image file
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          // Calculate dimensions, scaling down if necessary
          let width = img.naturalWidth;
          let height = img.naturalHeight;

          if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
            const aspectRatio = width / height;
            if (width > height) {
              width = MAX_IMAGE_SIZE;
              height = MAX_IMAGE_SIZE / aspectRatio;
            } else {
              height = MAX_IMAGE_SIZE;
              width = MAX_IMAGE_SIZE * aspectRatio;
            }
          }

          // Calculate canvas center position
          // The visible canvas center depends on the viewport
          const canvasCenterX = -viewport.x + (window.innerWidth / 2) / viewport.zoom;
          const canvasCenterY = -viewport.y + (window.innerHeight / 2) / viewport.zoom;

          // Position image so its center is at the canvas center
          const x = canvasCenterX - width / 2;
          const y = canvasCenterY - height / 2;

          const newImage: ImageObject = {
            id: crypto.randomUUID(),
            type: 'image',
            x,
            y,
            width,
            height,
            rotation: 0,
            opacity: 1,
            zIndex: getNextZIndex(),
            src: dataUrl,
          };

          addObject(newImage);
          setSelection([newImage.id]);
        };

        img.onerror = () => {
          useToastStore.getState().addToast({
            message: 'Failed to load image. Please try a different file.',
            type: 'error',
            duration: 5000
          });
        };

        img.src = dataUrl;
      }
    };

    reader.onerror = () => {
      useToastStore.getState().addToast({
        message: 'Failed to read file. Please try again.',
        type: 'error'
      });
    };

    reader.readAsDataURL(file);

    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  return (
    <aside className="toolbar">
      <div className="toolbar-content">
        {tools.map((tool, index) => (
          <div key={tool.id}>
            <button
              className={`tool-button ${activeTool === tool.id ? 'active' : ''}`}
              onClick={() => handleToolClick(tool.id)}
              title={`${tool.name} (${tool.shortcut})`}
            >
              {tool.icon}
              <span className="tool-tooltip">
                {tool.name}
                <span className="tool-shortcut">{tool.shortcut}</span>
              </span>
            </button>
            {/* Divider after Arrow tool (index 5) */}
            {index === 5 && <div className="toolbar-divider" />}
          </div>
        ))}
        {/* Divider before import button */}
        <div className="toolbar-divider" />
        {/* Import Media button */}
        <button
          className="tool-button"
          onClick={handleImportClick}
          title="Import Image / Video"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Film frame - industrial media icon */}
            <rect x="2" y="4" width="16" height="12" rx="1" />
            {/* Sprocket holes - film strip aesthetic */}
            <rect x="3" y="5" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
            <rect x="3" y="13" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
            <rect x="15" y="5" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
            <rect x="15" y="13" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
            {/* Play triangle - indicates video capability */}
            <path d="M8 7.5v5l4-2.5-4-2.5z" fill="currentColor" stroke="none" />
          </svg>
          <span className="tool-tooltip">
            Image / Video
          </span>
        </button>
        {/* Templates button */}
        <button
          className={`tool-button ${showTemplatePanel ? 'active' : ''}`}
          onClick={toggleTemplatePanel}
          title="Templates"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Grid layout icon representing templates */}
            <rect x="2" y="2" width="7" height="7" rx="1" />
            <rect x="11" y="2" width="7" height="7" rx="1" />
            <rect x="2" y="11" width="7" height="7" rx="1" />
            <rect x="11" y="11" width="7" height="7" rx="1" />
          </svg>
          <span className="tool-tooltip">
            Templates
          </span>
        </button>

        {/* Alignment buttons - visible when 2+ objects selected */}
        {selectedCount >= 2 && (
          <>
            <div className="toolbar-divider" />
            <button
              className="tool-button alignment-button"
              onClick={() => alignObjects('left')}
              title="Align Left (Ctrl+Shift+L)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="2" x2="3" y2="18" />
                <rect x="6" y="4" width="8" height="4" rx="1" />
                <rect x="6" y="12" width="11" height="4" rx="1" />
              </svg>
              <span className="tool-tooltip">
                Align Left
                <span className="tool-shortcut">Ctrl+Shift+L</span>
              </span>
            </button>
            <button
              className="tool-button alignment-button"
              onClick={() => alignObjects('centerH')}
              title="Align Center Horizontal (Ctrl+Shift+H)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="10" y1="2" x2="10" y2="18" />
                <rect x="4" y="4" width="12" height="4" rx="1" />
                <rect x="6" y="12" width="8" height="4" rx="1" />
              </svg>
              <span className="tool-tooltip">
                Align Center H
                <span className="tool-shortcut">Ctrl+Shift+H</span>
              </span>
            </button>
            <button
              className="tool-button alignment-button"
              onClick={() => alignObjects('right')}
              title="Align Right (Ctrl+Shift+R)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="17" y1="2" x2="17" y2="18" />
                <rect x="6" y="4" width="8" height="4" rx="1" />
                <rect x="3" y="12" width="11" height="4" rx="1" />
              </svg>
              <span className="tool-tooltip">
                Align Right
                <span className="tool-shortcut">Ctrl+Shift+R</span>
              </span>
            </button>
            <button
              className="tool-button alignment-button"
              onClick={() => alignObjects('top')}
              title="Align Top (Ctrl+Shift+T)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="2" y1="3" x2="18" y2="3" />
                <rect x="4" y="6" width="4" height="8" rx="1" />
                <rect x="12" y="6" width="4" height="11" rx="1" />
              </svg>
              <span className="tool-tooltip">
                Align Top
                <span className="tool-shortcut">Ctrl+Shift+T</span>
              </span>
            </button>
            <button
              className="tool-button alignment-button"
              onClick={() => alignObjects('centerV')}
              title="Align Center Vertical (Ctrl+Shift+E)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="2" y1="10" x2="18" y2="10" />
                <rect x="4" y="4" width="4" height="12" rx="1" />
                <rect x="12" y="6" width="4" height="8" rx="1" />
              </svg>
              <span className="tool-tooltip">
                Align Center V
                <span className="tool-shortcut">Ctrl+Shift+E</span>
              </span>
            </button>
            <button
              className="tool-button alignment-button"
              onClick={() => alignObjects('bottom')}
              title="Align Bottom (Ctrl+Shift+B)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="2" y1="17" x2="18" y2="17" />
                <rect x="4" y="6" width="4" height="8" rx="1" />
                <rect x="12" y="3" width="4" height="11" rx="1" />
              </svg>
              <span className="tool-tooltip">
                Align Bottom
                <span className="tool-shortcut">Ctrl+Shift+B</span>
              </span>
            </button>
          </>
        )}

        {/* Distribution buttons - visible when 3+ objects selected */}
        {selectedCount >= 3 && (
          <>
            <div className="toolbar-divider" />
            <button
              className="tool-button alignment-button"
              onClick={() => distributeObjects('horizontal')}
              title="Distribute Horizontally (Ctrl+Alt+H)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="4" height="8" rx="1" />
                <rect x="8" y="6" width="4" height="8" rx="1" />
                <rect x="14" y="6" width="4" height="8" rx="1" />
              </svg>
              <span className="tool-tooltip">
                Distribute H
                <span className="tool-shortcut">Ctrl+Alt+H</span>
              </span>
            </button>
            <button
              className="tool-button alignment-button"
              onClick={() => distributeObjects('vertical')}
              title="Distribute Vertically (Ctrl+Alt+V)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="2" width="8" height="4" rx="1" />
                <rect x="6" y="8" width="8" height="4" rx="1" />
                <rect x="6" y="14" width="8" height="4" rx="1" />
              </svg>
              <span className="tool-tooltip">
                Distribute V
                <span className="tool-shortcut">Ctrl+Alt+V</span>
              </span>
            </button>
          </>
        )}
      </div>
      {/* Hidden file input for image/video import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </aside>
  );
}
