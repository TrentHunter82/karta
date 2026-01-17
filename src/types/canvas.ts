// Canvas object types for Karta

export type ObjectType = 'rectangle' | 'ellipse' | 'text' | 'frame' | 'path' | 'image' | 'video';

export type ToolType = 'select' | 'hand' | 'rectangle' | 'text' | 'frame' | 'pen';

export interface BaseObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface RectangleObject extends BaseObject {
  type: 'rectangle';
}

export interface EllipseObject extends BaseObject {
  type: 'ellipse';
}

export interface TextObject extends BaseObject {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
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

export type CanvasObject =
  | RectangleObject
  | EllipseObject
  | TextObject
  | FrameObject
  | PathObject
  | ImageObject
  | VideoObject;

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}
