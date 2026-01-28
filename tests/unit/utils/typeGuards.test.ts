import {
  isRectangleObject,
  isEllipseObject,
  isTextObject,
  isFrameObject,
  isPathObject,
  isImageObject,
  isVideoObject,
  isGroupObject,
  isLineObject,
  isArrowObject,
  isPolygonObject,
  isStarObject,
  isLineOrArrow,
} from '../../../src/types/canvas';
import type { CanvasObject } from '../../../src/types/canvas';
import {
  createRectangle,
  createEllipse,
  createText,
  createFrame,
  createLine,
  createArrow,
  createPath,
} from '../tools/testUtils';

// Minimal objects for types not in testUtils
const createGroup = (): CanvasObject => ({
  id: 'g1', type: 'group', x: 0, y: 0, width: 100, height: 100,
  rotation: 0, opacity: 1, zIndex: 1, children: [],
} as CanvasObject);

const createImage = (): CanvasObject => ({
  id: 'img1', type: 'image', x: 0, y: 0, width: 100, height: 100,
  rotation: 0, opacity: 1, zIndex: 1, src: 'test.png',
} as CanvasObject);

const createVideo = (): CanvasObject => ({
  id: 'vid1', type: 'video', x: 0, y: 0, width: 100, height: 100,
  rotation: 0, opacity: 1, zIndex: 1, src: 'test.mp4',
} as CanvasObject);

const createPolygon = (): CanvasObject => ({
  id: 'poly1', type: 'polygon', x: 0, y: 0, width: 100, height: 100,
  rotation: 0, opacity: 1, zIndex: 1, sides: 6, fill: '#000',
} as CanvasObject);

const createStar = (): CanvasObject => ({
  id: 'star1', type: 'star', x: 0, y: 0, width: 100, height: 100,
  rotation: 0, opacity: 1, zIndex: 1, points: 5, innerRadius: 0.5, fill: '#000',
} as CanvasObject);

const allObjects = () => [
  createRectangle('r1'),
  createEllipse('e1'),
  createText('t1'),
  createFrame('f1'),
  createPath('p1'),
  createImage(),
  createVideo(),
  createGroup(),
  createLine('l1'),
  createArrow('a1'),
  createPolygon(),
  createStar(),
];

describe('type guards', () => {
  const objects = allObjects();

  it('isRectangleObject matches only rectangles', () => {
    expect(objects.filter(isRectangleObject)).toHaveLength(1);
    expect(isRectangleObject(createRectangle('r'))).toBe(true);
    expect(isRectangleObject(createText('t'))).toBe(false);
  });

  it('isEllipseObject matches only ellipses', () => {
    expect(objects.filter(isEllipseObject)).toHaveLength(1);
  });

  it('isTextObject matches only text', () => {
    expect(objects.filter(isTextObject)).toHaveLength(1);
  });

  it('isFrameObject matches only frames', () => {
    expect(objects.filter(isFrameObject)).toHaveLength(1);
  });

  it('isPathObject matches only paths', () => {
    expect(objects.filter(isPathObject)).toHaveLength(1);
  });

  it('isImageObject matches only images', () => {
    expect(objects.filter(isImageObject)).toHaveLength(1);
  });

  it('isVideoObject matches only videos', () => {
    expect(objects.filter(isVideoObject)).toHaveLength(1);
  });

  it('isGroupObject matches only groups', () => {
    expect(objects.filter(isGroupObject)).toHaveLength(1);
  });

  it('isLineObject matches only lines', () => {
    expect(objects.filter(isLineObject)).toHaveLength(1);
  });

  it('isArrowObject matches only arrows', () => {
    expect(objects.filter(isArrowObject)).toHaveLength(1);
  });

  it('isPolygonObject matches only polygons', () => {
    expect(objects.filter(isPolygonObject)).toHaveLength(1);
  });

  it('isStarObject matches only stars', () => {
    expect(objects.filter(isStarObject)).toHaveLength(1);
  });

  it('isLineOrArrow matches lines and arrows', () => {
    expect(objects.filter(isLineOrArrow)).toHaveLength(2);
    expect(isLineOrArrow(createLine('l'))).toBe(true);
    expect(isLineOrArrow(createArrow('a'))).toBe(true);
    expect(isLineOrArrow(createRectangle('r'))).toBe(false);
  });
});
