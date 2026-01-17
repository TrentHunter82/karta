import { useRef, type ReactNode } from 'react';
import './Toolbar.css';
import { useCanvasStore } from '../../stores/canvasStore';
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
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M4 2L16 10L10 11L8 17L4 2Z" />
      </svg>
    ),
  },
  {
    id: 'hand',
    name: 'Hand',
    shortcut: 'H',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2C9.45 2 9 2.45 9 3V9H7V6C7 5.45 6.55 5 6 5C5.45 5 5 5.45 5 6V11C5 11.55 5.45 12 6 12H7V10H9V13H11V10H13V12H14C14.55 12 15 11.55 15 11V6C15 5.45 14.55 5 14 5C13.45 5 13 5.45 13 6V9H11V3C11 2.45 10.55 2 10 2ZM6 14V18H14V14H6Z" />
      </svg>
    ),
  },
  {
    id: 'rectangle',
    name: 'Rectangle',
    shortcut: 'R',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="14" height="12" rx="1" />
      </svg>
    ),
  },
  {
    id: 'text',
    name: 'Text',
    shortcut: 'T',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M4 4V7H6V6H9V14H7V16H13V14H11V6H14V7H16V4H4Z" />
      </svg>
    ),
  },
  {
    id: 'frame',
    name: 'Frame',
    shortcut: 'F',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
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
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M3 17L4 13L14 3L17 6L7 16L3 17ZM14.5 6.5L13.5 5.5L5 14L6 15L14.5 6.5Z" />
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        video.src = dataUrl;
      } else {
        // Handle image file
        const img = new Image();

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

        img.src = dataUrl;
      }
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
            {/* Divider after Text tool (index 3) */}
            {index === 3 && <div className="toolbar-divider" />}
          </div>
        ))}
        {/* Divider before import button */}
        <div className="toolbar-divider" />
        {/* Import Media button */}
        <button
          className="tool-button"
          onClick={handleImportClick}
          title="Import Media"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3 4C3 3.45 3.45 3 4 3H16C16.55 3 17 3.45 17 4V16C17 16.55 16.55 17 16 17H4C3.45 17 3 16.55 3 16V4ZM5 5V12.5L7.5 10L10 12.5L13 9L15 12V5H5ZM5 15H15V14L13 11L10 14L7.5 11.5L5 14V15ZM7 8C7.55 8 8 7.55 8 7C8 6.45 7.55 6 7 6C6.45 6 6 6.45 6 7C6 7.55 6.45 8 7 8Z" />
          </svg>
          <span className="tool-tooltip">
            Import Media
          </span>
        </button>
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
