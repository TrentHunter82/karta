import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => `test-${Math.random().toString(36).substring(2, 15)}`,
  },
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock canvas context
const mockCanvasContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  ellipse: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  setLineDash: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 100 }),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
  putImageData: vi.fn(),
  createLinearGradient: vi.fn().mockReturnValue({
    addColorStop: vi.fn(),
  }),
  createRadialGradient: vi.fn().mockReturnValue({
    addColorStop: vi.fn(),
  }),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  isPointInPath: vi.fn().mockReturnValue(false),
  canvas: { width: 1920, height: 1080 },
};

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCanvasContext);

// Mock Yjs to avoid WebSocket connections during tests
vi.mock('yjs', () => {
  const mockYMap = () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    forEach: vi.fn(),
    observe: vi.fn(),
    observeDeep: vi.fn(),
    keys: vi.fn().mockReturnValue([]),
  });

  const mockYArray = () => ({
    push: vi.fn(),
    delete: vi.fn(),
    toArray: vi.fn().mockReturnValue([]),
    observe: vi.fn(),
  });

  class MockDoc {
    private maps = new Map();
    private arrays = new Map();
    
    getMap(name: string) {
      if (!this.maps.has(name)) {
        this.maps.set(name, mockYMap());
      }
      return this.maps.get(name);
    }
    
    getArray(name: string) {
      if (!this.arrays.has(name)) {
        this.arrays.set(name, mockYArray());
      }
      return this.arrays.get(name);
    }
    
    transact(fn: () => void) {
      fn();
    }
    
    on = vi.fn();
    off = vi.fn();
  }

  class MockYMap {
    private data = new Map();
    
    get(key: string) {
      return this.data.get(key);
    }
    
    set(key: string, value: unknown) {
      this.data.set(key, value);
    }
    
    delete(key: string) {
      this.data.delete(key);
    }
    
    forEach(fn: (value: unknown, key: string) => void) {
      this.data.forEach(fn);
    }
    
    observe = vi.fn();
    observeDeep = vi.fn();
    keys() {
      return this.data.keys();
    }
  }

  return {
    Doc: MockDoc,
    Map: MockYMap,
    Array: vi.fn().mockImplementation(mockYArray),
  };
});

vi.mock('y-websocket', () => ({
  WebsocketProvider: vi.fn().mockImplementation(() => ({
    awareness: {
      setLocalStateField: vi.fn(),
      getStates: vi.fn().mockReturnValue(new Map()),
      on: vi.fn(),
      off: vi.fn(),
    },
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    destroy: vi.fn(),
  })),
}));

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
