/**
 * Pen Tool Settings Store
 *
 * Manages reactive state for pen tool smoothing and stabilization settings.
 * Separated from canvasStore for clean separation of concerns.
 */
import { create } from 'zustand';

/**
 * Smoothing algorithm types
 */
export type SmoothingType = 'none' | 'chaikin' | 'simplify';

/**
 * Stabilizer mode types
 */
export type StabilizerMode = 'off' | 'spring';

/**
 * PenTool smoothing settings
 */
export interface PenToolSettings {
  /** Stroke color */
  strokeColor: string;
  /** Fixed stroke width (when pressure simulation is off) */
  strokeWidth: number;
  /** Smoothing algorithm to use */
  type: SmoothingType;
  /** Smoothing amount (0-1). Higher = smoother but less accurate */
  amount: number;
  /** Stabilizer mode for real-time input */
  stabilizerMode: StabilizerMode;
  /** Stabilizer strength (0-1). Higher = more stable but more lag */
  stabilizerStrength: number;
  /** Enable velocity-based stroke width */
  pressureSimulation: boolean;
  /** Minimum stroke width when pressure simulation enabled */
  minWidth: number;
  /** Maximum stroke width when pressure simulation enabled */
  maxWidth: number;
}

interface PenToolState {
  settings: PenToolSettings;
  setSettings: (settings: Partial<PenToolSettings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: PenToolSettings = {
  strokeColor: '#ffffff',
  strokeWidth: 2,
  type: 'chaikin',
  amount: 0.5,
  stabilizerMode: 'off',
  stabilizerStrength: 0.3,
  pressureSimulation: false,
  minWidth: 1,
  maxWidth: 8,
};

export const usePenToolStore = create<PenToolState>((set) => ({
  settings: { ...DEFAULT_SETTINGS },

  setSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),

  resetSettings: () =>
    set({ settings: { ...DEFAULT_SETTINGS } }),
}));
