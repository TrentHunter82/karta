/**
 * Toast notification store for displaying transient messages.
 */
import { create } from 'zustand';

/**
 * A toast notification displayed to the user.
 */
export interface Toast {
  /** Unique identifier */
  id: string;
  /** Message content */
  message: string;
  /** Visual style/severity */
  type: 'success' | 'error' | 'info' | 'warning';
  /** Auto-dismiss duration in ms (default: 3000) */
  duration?: number;
}

/** Default toast display duration in milliseconds */
const DEFAULT_TOAST_DURATION = 3000;

interface ToastState {
  /** Active toast notifications */
  toasts: Toast[];
  /** Add a new toast (auto-generates ID) */
  addToast: (toast: Omit<Toast, 'id'>) => void;
  /** Remove a toast by ID */
  removeToast: (id: string) => void;
}

/**
 * Zustand store for managing toast notifications.
 *
 * @example
 * ```tsx
 * // Show a success toast
 * useToastStore.getState().addToast({
 *   message: 'Changes saved',
 *   type: 'success'
 * });
 *
 * // Show an error with longer duration
 * useToastStore.getState().addToast({
 *   message: 'Failed to save',
 *   type: 'error',
 *   duration: 5000
 * });
 * ```
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));

    // Auto-remove after duration
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, toast.duration || DEFAULT_TOAST_DURATION);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  }
}));
