import type { Point2D } from '../math/mat3';
import { BezierBase } from './BezierBase';
import { Shape } from './Shape';
import type { ShapeStyle } from './types';

export class CubicBezier extends BezierBase {
  readonly type = 'cubic-bezier';

  constructor(
    p0: Point2D,
    p1: Point2D,
    p2: Point2D,
    p3: Point2D,
    style: Partial<ShapeStyle> = {}
  ) {
    super([p0, p1, p2, p3], style);
  }

  evalLocal(t: number): Point2D {
    const [p0, p1, p2, p3] = this.controlPoints;

    const u = Math.max(0, Math.min(1, t));
    const v = 1 - u;

    return {
      x:
        v ** 3 * p0.x +
        3 * v * v * u * p1.x +
        3 * v * u * u * p2.x +
        u ** 3 * p3.x,

      y:
        v ** 3 * p0.y +
        3 * v * v * u * p1.y +
        3 * v * u * u * p2.y +
        u ** 3 * p3.y,
    };
  }

  protected cloneGeometry(): Shape {
    const points = this.getControlPoints();

    const clone = new CubicBezier(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    );

    clone.controlPoints = points;

    return clone;
  }
}