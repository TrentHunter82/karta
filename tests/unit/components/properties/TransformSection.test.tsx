import { render, screen } from '@testing-library/react';
import { TransformSection } from '../../../../src/components/properties/sections/TransformSection';
import type { RectangleObject } from '../../../../src/types/canvas';

// Mock the canvas store
vi.mock('../../../../src/stores/canvasStore', () => ({
  useCanvasStore: vi.fn((selector) => {
    const state = {
      updateObject: vi.fn(),
      updateObjects: vi.fn(),
      pushHistory: vi.fn(),
    };
    return selector(state);
  }),
}));

describe('TransformSection', () => {
  const createRect = (overrides: Partial<RectangleObject> = {}): RectangleObject => ({
    id: 'rect-1',
    type: 'rectangle',
    x: 100,
    y: 200,
    width: 150,
    height: 100,
    rotation: 45,
    opacity: 1,
    zIndex: 0,
    fill: '#ff0000',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders transform inputs for single object', () => {
    const objects = [createRect()];
    render(<TransformSection objects={objects} />);

    expect(screen.getByText('Transform')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('Y')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('H')).toBeInTheDocument();
  });

  it('displays correct values for single object', () => {
    const objects = [createRect({ x: 100, y: 200, width: 150, height: 80 })];
    render(<TransformSection objects={objects} />);

    // Use getAllByText since values may appear multiple times
    expect(screen.getAllByText('100').length).toBeGreaterThan(0); // X
    expect(screen.getAllByText('200').length).toBeGreaterThan(0); // Y
    expect(screen.getAllByText('150').length).toBeGreaterThan(0); // W
    expect(screen.getAllByText('80').length).toBeGreaterThan(0); // H
  });

  it('shows Mixed for multiple objects with different values', () => {
    const objects = [
      createRect({ x: 100 }),
      createRect({ id: 'rect-2', x: 200 }),
    ];
    render(<TransformSection objects={objects} />);

    // X values differ so should show "Mixed"
    expect(screen.getAllByText('Mixed').length).toBeGreaterThan(0);
  });

  it('shows same value when all objects match', () => {
    const objects = [
      createRect({ x: 100, y: 200 }),
      createRect({ id: 'rect-2', x: 100, y: 200 }),
    ];
    render(<TransformSection objects={objects} />);

    // Both X and Y should show their values since they match
    expect(screen.getAllByText('100').length).toBeGreaterThan(0);
    expect(screen.getAllByText('200').length).toBeGreaterThan(0);
  });

  it('renders constrain proportions toggle', () => {
    const objects = [createRect()];
    render(<TransformSection objects={objects} />);

    const toggleButton = screen.getByTitle(/Constrain proportions/i);
    expect(toggleButton).toBeInTheDocument();
  });

  it('renders rotation input', () => {
    const objects = [createRect({ rotation: 45 })];
    render(<TransformSection objects={objects} />);

    expect(screen.getByText('↻')).toBeInTheDocument();
    expect(screen.getByText('45°')).toBeInTheDocument();
  });
});
