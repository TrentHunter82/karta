/**
 * Render performance tracking utility for profiling canvas redraws.
 * Tracks FPS, render triggers, and timing to identify unnecessary redraws.
 */

export type RenderTrigger =
  | 'viewport'
  | 'objects'
  | 'selection'
  | 'imageLoad'
  | 'grid'
  | 'snapGuides'
  | 'toolOverlay'
  | 'manual'
  | 'initial';

interface RenderFrame {
  timestamp: number;
  duration: number;
  trigger: RenderTrigger;
  objectCount: number;
  selectedCount: number;
}

interface RenderStats {
  fps: number;
  avgFrameTime: number;
  frameCount: number;
  lastTrigger: RenderTrigger | null;
  triggerCounts: Record<RenderTrigger, number>;
  unnecessaryRedraws: number;
}

const FRAME_HISTORY_SIZE = 60;
const FPS_UPDATE_INTERVAL = 500; // ms

class RenderProfiler {
  private frames: RenderFrame[] = [];
  private lastFpsUpdate = 0;
  private currentFps = 0;
  private enabled = false;
  private lastViewport: string = '';
  private unnecessaryCount = 0;
  private listeners: Set<(stats: RenderStats) => void> = new Set();

  enable() {
    this.enabled = true;
    this.reset();
  }

  disable() {
    this.enabled = false;
  }

  isEnabled() {
    return this.enabled;
  }

  reset() {
    this.frames = [];
    this.lastFpsUpdate = 0;
    this.currentFps = 0;
    this.unnecessaryCount = 0;
    this.lastViewport = '';
  }

  /**
   * Call at the start of a render frame
   */
  startFrame(
    trigger: RenderTrigger,
    viewport: { x: number; y: number; zoom: number },
    objectCount: number,
    selectedCount: number
  ): { endFrame: () => void } {
    if (!this.enabled) {
      return { endFrame: () => {} };
    }

    const startTime = performance.now();
    const viewportHash = `${viewport.x.toFixed(2)},${viewport.y.toFixed(2)},${viewport.zoom.toFixed(4)}`;

    // Check if this might be an unnecessary redraw
    let isUnnecessary = false;
    if (trigger === 'viewport' && viewportHash === this.lastViewport) {
      isUnnecessary = true;
    }

    return {
      endFrame: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;

        const frame: RenderFrame = {
          timestamp: startTime,
          duration,
          trigger,
          objectCount,
          selectedCount,
        };

        this.frames.push(frame);
        if (this.frames.length > FRAME_HISTORY_SIZE) {
          this.frames.shift();
        }

        if (isUnnecessary) {
          this.unnecessaryCount++;
        }

        this.lastViewport = viewportHash;

        // Update FPS calculation
        if (startTime - this.lastFpsUpdate >= FPS_UPDATE_INTERVAL) {
          this.calculateFps();
          this.lastFpsUpdate = startTime;
          this.notifyListeners();
        }
      },
    };
  }

  private calculateFps() {
    if (this.frames.length < 2) {
      this.currentFps = 0;
      return;
    }

    const now = performance.now();
    const recentFrames = this.frames.filter(f => now - f.timestamp < 1000);
    this.currentFps = recentFrames.length;
  }

  getStats(): RenderStats {
    const triggerCounts: Record<RenderTrigger, number> = {
      viewport: 0,
      objects: 0,
      selection: 0,
      imageLoad: 0,
      grid: 0,
      snapGuides: 0,
      toolOverlay: 0,
      manual: 0,
      initial: 0,
    };

    let totalFrameTime = 0;
    for (const frame of this.frames) {
      triggerCounts[frame.trigger]++;
      totalFrameTime += frame.duration;
    }

    return {
      fps: this.currentFps,
      avgFrameTime: this.frames.length > 0 ? totalFrameTime / this.frames.length : 0,
      frameCount: this.frames.length,
      lastTrigger: this.frames.length > 0 ? this.frames[this.frames.length - 1].trigger : null,
      triggerCounts,
      unnecessaryRedraws: this.unnecessaryCount,
    };
  }

  subscribe(listener: (stats: RenderStats) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const stats = this.getStats();
    this.listeners.forEach(listener => listener(stats));
  }
}

// Singleton instance
export const renderProfiler = new RenderProfiler();

// Enable in development mode
if (import.meta.env.DEV) {
  renderProfiler.enable();
}
