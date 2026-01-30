/**
 * Constants Index
 *
 * Central re-export point for all application constants.
 * Import from here for convenient access to all constant values.
 *
 * @example
 * import { MIN_ZOOM, HANDLE_SIZE_PX, IMAGE_CACHE_MAX_SIZE } from '../constants';
 */

// Layout constants: zoom limits, panel sizes, snap angles
export * from './layout';

// Interaction constants: mouse/touch thresholds, animation durations
export * from './interaction';

// Rendering constants: image limits, cache sizes, toast durations
export * from './rendering';
