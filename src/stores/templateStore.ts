import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Template object type - flexible to allow any canvas object properties except id/zIndex
// Using Record to allow all possible properties from different object types
export interface TemplateObject {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  // Rectangle properties
  cornerRadius?: number;
  // Text properties
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  // Line/Arrow properties
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  arrowSize?: number;
  // Polygon properties
  sides?: number;
  // Star properties
  points?: number;
  innerRadius?: number;
  // Allow any additional properties
  [key: string]: unknown;
}

export interface PresetTemplate {
  id: string;
  name: string;
  category: string;
  objects: TemplateObject[];
  isPreset: true;
}

export interface UserTemplate {
  id: string;
  name: string;
  category: string;
  objects: TemplateObject[];
  createdAt: number;
  isPreset?: false;
}

export type Template = PresetTemplate | UserTemplate;

// Built-in preset templates
export const PRESET_TEMPLATES: PresetTemplate[] = [
  // UI Components
  {
    id: 'preset-button',
    name: 'Button',
    category: 'UI Components',
    isPreset: true,
    objects: [
      {
        type: 'rectangle',
        x: 0, y: 0, width: 120, height: 40,
        fill: '#FF5500',
        stroke: undefined,
        strokeWidth: 0,
        cornerRadius: 8,
        rotation: 0,
        opacity: 1
      },
      {
        type: 'text',
        x: 10, y: 10, width: 100, height: 20,
        text: 'Button',
        fontSize: 14,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontStyle: 'normal',
        textDecoration: 'none',
        textAlign: 'center',
        lineHeight: 1.2,
        fill: '#ffffff',
        rotation: 0,
        opacity: 1
      }
    ]
  },
  {
    id: 'preset-card',
    name: 'Card',
    category: 'UI Components',
    isPreset: true,
    objects: [
      {
        type: 'rectangle',
        x: 0, y: 0, width: 200, height: 150,
        fill: '#1a1a1a',
        stroke: '#2a2a2a',
        strokeWidth: 1,
        cornerRadius: 12,
        rotation: 0,
        opacity: 1
      },
      {
        type: 'text',
        x: 16, y: 16, width: 168, height: 24,
        text: 'Card Title',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontStyle: 'normal',
        textDecoration: 'none',
        textAlign: 'left',
        lineHeight: 1.2,
        fill: '#ffffff',
        rotation: 0,
        opacity: 1
      },
      {
        type: 'text',
        x: 16, y: 48, width: 168, height: 80,
        text: 'Card description goes here...',
        fontSize: 12,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 400,
        fontStyle: 'normal',
        textDecoration: 'none',
        textAlign: 'left',
        lineHeight: 1.4,
        fill: '#888888',
        rotation: 0,
        opacity: 1
      }
    ]
  },
  {
    id: 'preset-badge',
    name: 'Badge',
    category: 'UI Components',
    isPreset: true,
    objects: [
      {
        type: 'rectangle',
        x: 0, y: 0, width: 60, height: 24,
        fill: '#22c55e',
        cornerRadius: 12,
        rotation: 0,
        opacity: 1
      },
      {
        type: 'text',
        x: 8, y: 4, width: 44, height: 16,
        text: 'Badge',
        fontSize: 11,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        fontStyle: 'normal',
        textDecoration: 'none',
        textAlign: 'center',
        lineHeight: 1.2,
        fill: '#ffffff',
        rotation: 0,
        opacity: 1
      }
    ]
  },
  {
    id: 'preset-input',
    name: 'Input Field',
    category: 'UI Components',
    isPreset: true,
    objects: [
      {
        type: 'rectangle',
        x: 0, y: 0, width: 200, height: 40,
        fill: '#0a0a0a',
        stroke: '#3a3a3a',
        strokeWidth: 1,
        cornerRadius: 6,
        rotation: 0,
        opacity: 1
      },
      {
        type: 'text',
        x: 12, y: 12, width: 176, height: 16,
        text: 'Placeholder...',
        fontSize: 13,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 400,
        fontStyle: 'normal',
        textDecoration: 'none',
        textAlign: 'left',
        lineHeight: 1.2,
        fill: '#555555',
        rotation: 0,
        opacity: 1
      }
    ]
  },
  {
    id: 'preset-toggle',
    name: 'Toggle Switch',
    category: 'UI Components',
    isPreset: true,
    objects: [
      {
        type: 'rectangle',
        x: 0, y: 0, width: 48, height: 24,
        fill: '#FF5500',
        cornerRadius: 12,
        rotation: 0,
        opacity: 1
      },
      {
        type: 'ellipse',
        x: 26, y: 2, width: 20, height: 20,
        fill: '#ffffff',
        rotation: 0,
        opacity: 1
      }
    ]
  },
  // Shapes
  {
    id: 'preset-circle',
    name: 'Circle',
    category: 'Shapes',
    isPreset: true,
    objects: [
      {
        type: 'ellipse',
        x: 0, y: 0, width: 64, height: 64,
        fill: '#4a4a4a',
        rotation: 0,
        opacity: 1
      }
    ]
  },
  {
    id: 'preset-rounded-rect',
    name: 'Rounded Rectangle',
    category: 'Shapes',
    isPreset: true,
    objects: [
      {
        type: 'rectangle',
        x: 0, y: 0, width: 100, height: 60,
        fill: '#4a4a4a',
        cornerRadius: 16,
        rotation: 0,
        opacity: 1
      }
    ]
  },
  {
    id: 'preset-star',
    name: '5-Point Star',
    category: 'Shapes',
    isPreset: true,
    objects: [
      {
        type: 'star',
        x: 0, y: 0, width: 64, height: 64,
        points: 5,
        innerRadius: 0.5,
        fill: '#fbbf24',
        rotation: 0,
        opacity: 1
      }
    ]
  },
  {
    id: 'preset-hexagon',
    name: 'Hexagon',
    category: 'Shapes',
    isPreset: true,
    objects: [
      {
        type: 'polygon',
        x: 0, y: 0, width: 64, height: 64,
        sides: 6,
        fill: '#6366f1',
        rotation: 0,
        opacity: 1
      }
    ]
  },
  {
    id: 'preset-triangle',
    name: 'Triangle',
    category: 'Shapes',
    isPreset: true,
    objects: [
      {
        type: 'polygon',
        x: 0, y: 0, width: 64, height: 56,
        sides: 3,
        fill: '#14b8a6',
        rotation: 0,
        opacity: 1
      }
    ]
  },
  // Icons
  {
    id: 'preset-avatar',
    name: 'Avatar Circle',
    category: 'Icons',
    isPreset: true,
    objects: [
      {
        type: 'ellipse',
        x: 0, y: 0, width: 48, height: 48,
        fill: '#FF5500',
        rotation: 0,
        opacity: 1
      },
      {
        type: 'text',
        x: 0, y: 14, width: 48, height: 20,
        text: 'AB',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontStyle: 'normal',
        textDecoration: 'none',
        textAlign: 'center',
        lineHeight: 1.2,
        fill: '#ffffff',
        rotation: 0,
        opacity: 1
      }
    ]
  },
  {
    id: 'preset-dot',
    name: 'Status Dot',
    category: 'Icons',
    isPreset: true,
    objects: [
      {
        type: 'ellipse',
        x: 0, y: 0, width: 12, height: 12,
        fill: '#00FF66',
        rotation: 0,
        opacity: 1
      }
    ]
  },
  // Layout
  {
    id: 'preset-divider',
    name: 'Divider Line',
    category: 'Layout',
    isPreset: true,
    objects: [
      {
        type: 'line',
        x: 0, y: 0, width: 200, height: 1,
        x1: 0, y1: 0, x2: 200, y2: 0,
        stroke: '#2a2a2a',
        strokeWidth: 1,
        rotation: 0,
        opacity: 1
      }
    ]
  },
  {
    id: 'preset-arrow-right',
    name: 'Arrow Right',
    category: 'Layout',
    isPreset: true,
    objects: [
      {
        type: 'arrow',
        x: 0, y: 0, width: 100, height: 2,
        x1: 0, y1: 0, x2: 100, y2: 0,
        stroke: '#ffffff',
        strokeWidth: 2,
        arrowStart: false,
        arrowEnd: true,
        arrowSize: 1,
        rotation: 0,
        opacity: 1
      }
    ]
  },
  {
    id: 'preset-connector',
    name: 'Bidirectional Arrow',
    category: 'Layout',
    isPreset: true,
    objects: [
      {
        type: 'arrow',
        x: 0, y: 0, width: 100, height: 2,
        x1: 0, y1: 0, x2: 100, y2: 0,
        stroke: '#888888',
        strokeWidth: 2,
        arrowStart: true,
        arrowEnd: true,
        arrowSize: 1,
        rotation: 0,
        opacity: 1
      }
    ]
  }
];

interface TemplateState {
  userTemplates: UserTemplate[];
  showTemplatePanel: boolean;
  addTemplate: (template: Omit<UserTemplate, 'id' | 'createdAt' | 'isPreset'>) => void;
  removeTemplate: (id: string) => void;
  renameTemplate: (id: string, name: string) => void;
  setShowTemplatePanel: (show: boolean) => void;
  toggleTemplatePanel: () => void;
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set) => ({
      userTemplates: [],
      showTemplatePanel: false,

      addTemplate: (template) => {
        const newTemplate: UserTemplate = {
          ...template,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          isPreset: false
        };

        set((state) => ({
          userTemplates: [...state.userTemplates, newTemplate]
        }));
      },

      removeTemplate: (id) => {
        set((state) => ({
          userTemplates: state.userTemplates.filter(t => t.id !== id)
        }));
      },

      renameTemplate: (id, name) => {
        set((state) => ({
          userTemplates: state.userTemplates.map(t =>
            t.id === id ? { ...t, name } : t
          )
        }));
      },

      setShowTemplatePanel: (show) => set({ showTemplatePanel: show }),

      toggleTemplatePanel: () => set((state) => ({ showTemplatePanel: !state.showTemplatePanel }))
    }),
    {
      name: 'karta-templates',
      partialize: (state) => ({ userTemplates: state.userTemplates })
    }
  )
);
