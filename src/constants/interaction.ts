// Interaction constants for user input handling

/** Zoom sensitivity for scroll wheel (lower = slower zoom) */
export const ZOOM_SENSITIVITY = 0.001;

/** Zoom factor for keyboard shortcuts (25% change) */
export const ZOOM_KEYBOARD_FACTOR = 1.25;

/** Double-click detection threshold in milliseconds */
export const DOUBLE_CLICK_THRESHOLD_MS = 300;

/** Snap threshold in pixels for alignment guides */
export const SNAP_THRESHOLD_PX = 8;

/** Selection handle size in pixels */
export const HANDLE_SIZE_PX = 8;

/** Distance from object to rotation handle in pixels (legacy - kept for compatibility) */
export const ROTATION_HANDLE_OFFSET_PX = 20;

/** Inner boundary of rotation zone - starts after resize handle hit area */
export const ROTATION_ZONE_INNER_PX = 12;

/** Outer boundary of rotation zone from corner */
export const ROTATION_ZONE_OUTER_PX = 28;

/** Offset increment for stacking dropped files */
export const FILE_DROP_OFFSET_INCREMENT = 20;

/** Fade size for name labels at canvas edges */
export const EDGE_FADE_SIZE_PX = 80;

/** Duration for selection animation in milliseconds */
export const SELECTION_ANIMATION_DURATION_MS = 200;

/** Minimum epsilon for floating point path calculations */
export const PATH_SCALE_EPSILON = 0.001;
