// Canvas object types for Karta

export type ObjectType = 'rectangle' | 'ellipse' | 'text' | 'frame' | 'path' | 'image' | 'video' | 'group' | 'line' | 'arrow' | 'polygon' | 'star';

export type ToolType = 'select' | 'hand' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'polygon' | 'star' | 'text' | 'frame' | 'pen';

export interface BaseObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  // Grouping support
  parentId?: string;
  // Layer visibility and locking
  visible?: boolean; // default: true
  locked?: boolean;  // default: false
}

export interface RectangleObject extends BaseObject {
  type: 'rectangle';
  cornerRadius?: number; // default: 0
}

export interface EllipseObject extends BaseObject {
  type: 'ellipse';
}

export interface TextObject extends BaseObject {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;    // 100-900, default 400
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;    // multiplier, default 1.2
}

export interface FrameObject extends BaseObject {
  type: 'frame';
  name: string;
}

export interface PathPoint {
  x: number;
  y: number;
}

export interface PathObject extends BaseObject {
  type: 'path';
  points: PathPoint[];
}

export interface ImageObject extends BaseObject {
  type: 'image';
  src: string;
}

export interface VideoObject extends BaseObject {
  type: 'video';
  src: string;
}

export interface GroupObject extends BaseObject {
  type: 'group';
  children: string[]; // IDs of child objects
}

export interface LineObject extends BaseObject {
  type: 'line';
  x1: number; // Start point relative to object origin
  y1: number;
  x2: number; // End point relative to object origin
  y2: number;
}

export interface ArrowObject extends BaseObject {
  type: 'arrow';
  x1: number; // Start point relative to object origin
  y1: number;
  x2: number; // End point relative to object origin
  y2: number;
  arrowStart: boolean; // Arrowhead at start
  arrowEnd: boolean;   // Arrowhead at end (default: true)
  arrowSize: number;   // Size multiplier (default: 1)
}

export interface PolygonObject extends BaseObject {
  type: 'polygon';
  sides: number; // 3-12, default: 6 (hexagon)
}

export interface StarObject extends BaseObject {
  type: 'star';
  points: number;      // 3-12, default: 5
  innerRadius: number; // 0-1 ratio of outer radius, default: 0.5
}

export type CanvasObject =
  | RectangleObject
  | EllipseObject
  | TextObject
  | FrameObject
  | PathObject
  | ImageObject
  | VideoObject
  | GroupObject
  | LineObject
  | ArrowObject
  | PolygonObject
  | StarObject;

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}
