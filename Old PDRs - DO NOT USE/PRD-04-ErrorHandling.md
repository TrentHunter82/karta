# PRD-04: Error Handling & User Feedback

## Overview
Add proper error handling, error boundaries, and user feedback for operations throughout the application.

**Priority:** MEDIUM
**Estimated Complexity:** Medium
**Files Affected:** New files (`ErrorBoundary.tsx`, `Toast.tsx`, `toastStore.ts`), minor additions to existing files

---

## Background
Currently the application has no error handling - file operations fail silently, there's no feedback for copy/paste/delete operations, and a single component error can crash the entire app.

---

## User Stories

### US-056: Add React Error Boundary
**Goal:** Prevent component errors from crashing the entire application.

**Implementation:**
Create `src/components/ErrorBoundary.tsx`:
```typescript
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Usage in App.tsx:**
```typescript
<ErrorBoundary>
  <Canvas />
</ErrorBoundary>
<ErrorBoundary>
  <PropertiesPanel />
</ErrorBoundary>
```

**Acceptance Criteria:**
- [x] Component error shows error boundary UI instead of white screen
- [x] "Try Again" button recovers the component
- [x] Error is logged to console with stack trace

---

### US-057: Create Toast Notification System
**Goal:** Show transient feedback messages for user actions.

**Create `src/stores/toastStore.ts`:**
```typescript
import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));

    // Auto-remove after duration
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, toast.duration || 3000);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  }
}));
```

**Create `src/components/Toast.tsx`:**
```typescript
import { useToastStore } from '../stores/toastStore';
import './Toast.css';

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button onClick={() => removeToast(toast.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
```

**Acceptance Criteria:**
- [x] Toasts appear in bottom-right corner
- [x] Toasts auto-dismiss after 3 seconds (configurable)
- [x] Success/error/warning/info have distinct colors
- [x] Click X to dismiss immediately

---

### US-058: Add Feedback for Copy/Paste/Delete
**Goal:** Show toast notifications for clipboard and delete operations.

**Implementation:**
```typescript
// In canvasStore.ts
copySelection: () => {
  // ... existing copy logic
  useToastStore.getState().addToast({
    message: `Copied ${selectedObjects.length} object${selectedObjects.length > 1 ? 's' : ''}`,
    type: 'info'
  });
},

paste: () => {
  // ... existing paste logic
  useToastStore.getState().addToast({
    message: `Pasted ${clipboard.length} object${clipboard.length > 1 ? 's' : ''}`,
    type: 'success'
  });
},

deleteSelectedObjects: () => {
  const count = state.selectedIds.size;
  // ... existing delete logic
  useToastStore.getState().addToast({
    message: `Deleted ${count} object${count > 1 ? 's' : ''}`,
    type: 'info'
  });
}
```

**Acceptance Criteria:**
- [x] Copy shows "Copied X objects"
- [x] Paste shows "Pasted X objects"
- [x] Delete shows "Deleted X objects"
- [x] Duplicate shows "Duplicated X objects"

---

### US-059: Add Error Handling for File Operations
**Goal:** Handle and report file loading errors gracefully.

**Image Loading Errors (Toolbar.tsx, Canvas.tsx):**
```typescript
img.onerror = () => {
  useToastStore.getState().addToast({
    message: 'Failed to load image. Please try a different file.',
    type: 'error',
    duration: 5000
  });
};

// FileReader error
reader.onerror = () => {
  useToastStore.getState().addToast({
    message: 'Failed to read file. Please try again.',
    type: 'error'
  });
};
```

**Video Loading Errors:**
```typescript
video.onerror = () => {
  useToastStore.getState().addToast({
    message: 'Failed to load video. Format may not be supported.',
    type: 'error',
    duration: 5000
  });
};
```

**Acceptance Criteria:**
- [x] Invalid image file shows error toast
- [x] Corrupted file shows error toast
- [x] Unsupported video format shows error toast
- [x] Error toasts last 5 seconds (longer than info)

---

### US-060: Add Export Feedback
**Goal:** Show progress and success/failure for PNG export.

**Implementation (PropertiesPanel.tsx):**
```typescript
const handleExport = async () => {
  setIsExporting(true);

  try {
    // ... existing export logic

    useToastStore.getState().addToast({
      message: 'Exported as PNG',
      type: 'success'
    });
  } catch (error) {
    useToastStore.getState().addToast({
      message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'error',
      duration: 5000
    });
  } finally {
    setIsExporting(false);
  }
};
```

**UI Enhancement:**
- Disable export button while exporting
- Show spinner or "Exporting..." text during export

**Acceptance Criteria:**
- [x] Export shows "Exported as PNG" on success
- [x] Export shows error message on failure
- [x] Button shows loading state during export
- [x] CORS error shows helpful message

---

### US-061: Add Connection Status Feedback
**Goal:** Notify users when connection status changes.

**Implementation (collaborationStore.ts):**
```typescript
// In connection status change handler
if (newStatus === 'disconnected' && previousStatus === 'connected') {
  useToastStore.getState().addToast({
    message: 'Disconnected from server. Reconnecting...',
    type: 'warning'
  });
}

if (newStatus === 'connected' && previousStatus !== 'connected') {
  useToastStore.getState().addToast({
    message: 'Connected to collaboration server',
    type: 'success'
  });
}
```

**Acceptance Criteria:**
- [x] Disconnect shows warning toast
- [x] Reconnect shows success toast
- [x] Failed reconnection (after 5 attempts) shows error toast

---

### US-062: Add Undo/Redo Feedback
**Goal:** Show what operation was undone/redone.

**Implementation:**
Track the last operation type and show in toast:
```typescript
// In canvasStore - track last operation
lastOperation: string | null,

setLastOperation: (op: string) => set({ lastOperation: op }),

undo: () => {
  // ... existing logic
  const operation = state.lastOperation || 'changes';
  useToastStore.getState().addToast({
    message: `Undid ${operation}`,
    type: 'info',
    duration: 2000
  });
},

redo: () => {
  // ... existing logic
  useToastStore.getState().addToast({
    message: `Redid ${operation}`,
    type: 'info',
    duration: 2000
  });
}
```

**Examples:**
- "Undid delete"
- "Undid move"
- "Redid resize"

**Acceptance Criteria:**
- [x] Undo shows "Undid [operation]"
- [x] Redo shows "Redid [operation]"
- [x] Undo/redo toasts are shorter duration (2s)

---

## UI Specifications

### Toast Styling
```css
.toast-container {
  position: fixed;
  bottom: 60px; /* Above status bar */
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 6px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.2s ease-out;
  max-width: 300px;
}

.toast-success { border-left: 4px solid #22c55e; }
.toast-error { border-left: 4px solid #ef4444; }
.toast-warning { border-left: 4px solid #f59e0b; }
.toast-info { border-left: 4px solid #3b82f6; }

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

### Error Boundary Styling
```css
.error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--color-text-secondary);
  text-align: center;
}

.error-boundary h2 {
  color: #ef4444;
  margin-bottom: 16px;
}

.error-boundary button {
  margin-top: 16px;
  padding: 8px 16px;
  background: var(--color-accent);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
}
```

---

## Testing Checklist
- [x] Error boundary catches and displays component errors
- [x] Toasts appear and auto-dismiss
- [x] All file operations show appropriate feedback
- [x] Export shows success/failure feedback
- [x] Connection changes trigger toasts
- [x] Copy/paste/delete show feedback
- [x] Undo/redo show feedback
- [x] Multiple toasts stack correctly
- [x] Manual toast dismissal works

## Notes
- This PRD creates new files - no conflicts with other PRDs
- Toast store is independent of canvas/collaboration stores
- Error boundaries wrap existing components non-invasively
- Consider adding toast position preference (corner selection) in future
