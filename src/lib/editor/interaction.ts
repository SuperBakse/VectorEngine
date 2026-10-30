import { mat3, type Point2D } from '../math/mat3';
import type { Bounds, Transform } from '../shapes/types';
import { Shape } from '../shapes/Shape';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface EditableShape extends Shape {
  getControlPoints(): Point2D[];
  setControlPoint(index: number, localPoint: Point2D): void;
}

export function isEditableShape(shape: Shape): shape is EditableShape {
  const candidate = shape as Shape & Partial<EditableShape>;
  return (
    typeof candidate.getControlPoints === 'function' &&
    typeof candidate.setControlPoint === 'function'
  );
}

export function findTopmostShapeAt(
  shapes: readonly Shape[],
  point: Point2D,
  tolerance = 8
): Shape | null {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    const shape = shapes[index];
    if (shape.hitTest(point.x, point.y, tolerance)) return shape;
  }
  return null;
}

export function getResizeHandleLocalPoint(
  bounds: Bounds,
  handle: ResizeHandle
): Point2D {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const x = handle.includes('w')
    ? bounds.minX
    : handle.includes('e')
      ? bounds.maxX
      : centerX;
  const y = handle.includes('n')
    ? bounds.minY
    : handle.includes('s')
      ? bounds.maxY
      : centerY;
  return { x, y };
}

export function getRotationHandleLocalPoint(bounds: Bounds, offset = 28): Point2D {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: bounds.minY - offset,
  };
}

export function pointToLocal(
  transform: Transform,
  point: Point2D
): Point2D | null {
  const inverse = mat3.invert(
    mat3.fromTransform(
      transform.x,
      transform.y,
      transform.rotation,
      transform.scaleX,
      transform.scaleY
    )
  );
  return inverse ? mat3.transformPoint(inverse, point.x, point.y) : null;
}

export function moveShapeFromStart(
  shape: Shape,
  initialTransform: Transform,
  startPointer: Point2D,
  currentPointer: Point2D
): void {
  shape.transform.x =
    initialTransform.x + currentPointer.x - startPointer.x;
  shape.transform.y =
    initialTransform.y + currentPointer.y - startPointer.y;
}

export function rotateShapeFromStart(
  shape: Shape,
  initialTransform: Transform,
  startPointer: Point2D,
  currentPointer: Point2D
): void {
  const startAngle = Math.atan2(
    startPointer.y - initialTransform.y,
    startPointer.x - initialTransform.x
  );
  const currentAngle = Math.atan2(
    currentPointer.y - initialTransform.y,
    currentPointer.x - initialTransform.x
  );
  shape.transform.x = initialTransform.x;
  shape.transform.y = initialTransform.y;
  shape.transform.rotation =
    initialTransform.rotation + currentAngle - startAngle;
  shape.transform.scaleX = initialTransform.scaleX;
  shape.transform.scaleY = initialTransform.scaleY;
}

export function resizeShapeFromStart(
  shape: Shape,
  initialTransform: Transform,
  localBounds: Bounds,
  handle: ResizeHandle,
  currentPointer: Point2D,
  minSize = 16
): void {
  const localPointer = pointToLocal(initialTransform, currentPointer);
  if (!localPointer) return;

  const dirX = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const dirY = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  const centerX = (localBounds.minX + localBounds.maxX) / 2;
  const centerY = (localBounds.minY + localBounds.maxY) / 2;

  const anchor = {
    x: dirX > 0 ? localBounds.minX : dirX < 0 ? localBounds.maxX : centerX,
    y: dirY > 0 ? localBounds.minY : dirY < 0 ? localBounds.maxY : centerY,
  };
  const movingPoint = {
    x: dirX > 0 ? localBounds.maxX : dirX < 0 ? localBounds.minX : centerX,
    y: dirY > 0 ? localBounds.maxY : dirY < 0 ? localBounds.minY : centerY,
  };

  const width = Math.abs(localBounds.maxX - localBounds.minX);
  const height = Math.abs(localBounds.maxY - localBounds.minY);
  let scaleRatioX = 1;
  let scaleRatioY = 1;

  if (dirX !== 0 && width > 1e-8) {
    const denominator = movingPoint.x - anchor.x;
    const rawRatio = (localPointer.x - anchor.x) / denominator;
    const minimumRatio = minSize / Math.max(1e-8, Math.abs(initialTransform.scaleX) * width);
    const sign = rawRatio < 0 ? -1 : 1;
    scaleRatioX = sign * Math.max(Math.abs(rawRatio), minimumRatio);
  }

  if (dirY !== 0 && height > 1e-8) {
    const denominator = movingPoint.y - anchor.y;
    const rawRatio = (localPointer.y - anchor.y) / denominator;
    const minimumRatio = minSize / Math.max(1e-8, Math.abs(initialTransform.scaleY) * height);
    const sign = rawRatio < 0 ? -1 : 1;
    scaleRatioY = sign * Math.max(Math.abs(rawRatio), minimumRatio);
  }

  const nextScaleX = initialTransform.scaleX * scaleRatioX;
  const nextScaleY = initialTransform.scaleY * scaleRatioY;
  const initialMatrix = mat3.fromTransform(
    initialTransform.x,
    initialTransform.y,
    initialTransform.rotation,
    initialTransform.scaleX,
    initialTransform.scaleY
  );
  const fixedAnchor = mat3.transformPoint(initialMatrix, anchor.x, anchor.y);
  const nextLinearMatrix = mat3.fromTransform(
    0,
    0,
    initialTransform.rotation,
    nextScaleX,
    nextScaleY
  );
  const movedAnchor = mat3.transformPoint(nextLinearMatrix, anchor.x, anchor.y);

  shape.transform.x = fixedAnchor.x - movedAnchor.x;
  shape.transform.y = fixedAnchor.y - movedAnchor.y;
  shape.transform.rotation = initialTransform.rotation;
  shape.transform.scaleX = nextScaleX;
  shape.transform.scaleY = nextScaleY;
}