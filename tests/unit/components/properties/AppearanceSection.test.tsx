import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppearanceSection } from '../../../../src/components/properties/sections/AppearanceSection';
import type { RectangleObject } from '../../../../src/types/canvas';

// Mock the canvas store
vi.mock('../../../../src/stores/canvasStore', () => ({
  useCanvasStore: vi.fn((selector) => {
    const state = {
      updateObject: vi.fn(),
      pushHistory: vi.fn(),
    };
    return selector(state);
  }),
}));

describe('AppearanceSection', () => {
  const createRect = (overrides: Partial<RectangleObject> = {}): RectangleObject => ({
    id: 'rect-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 0.8,
    zIndex: 0,
    fill: '#ff0000',
    stroke: '#0000ff',
    strokeWidth: 2,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders appearance section title', () => {
    const objects = [createRect()];
    render(<AppearanceSection objects={objects} />);

    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('renders fill control for fillable objects', () => {
    const objects = [createRect({ fill: '#ff0000' })];
    render(<AppearanceSection objects={objects} />);

    expect(screen.getByText('Fill')).toBeInTheDocument();
  });

  it('renders stroke control for strokeable objects', () => {
    const objects = [createRect({ stroke: '#0000ff' })];
    render(<AppearanceSection objects={objects} />);

    expect(screen.getByText('Stroke')).toBeInTheDocument();
  });

  it('renders opacity slider', () => {
    const objects = [createRect({ opacity: 0.8 })];
    render(<AppearanceSection objects={objects} />);

    expect(screen.getByText('Opacity')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('shows mixed for multiple objects with different opacities', () => {
    const objects = [
      createRect({ opacity: 0.5 }),
      createRect({ id: 'rect-2', opacity: 0.8 }),
    ];
    render(<AppearanceSection objects={objects} />);

    expect(screen.getByText('Mixed')).toBeInTheDocument();
  });
});
