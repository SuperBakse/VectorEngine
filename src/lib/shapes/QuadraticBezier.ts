import type { Point2D } from '../math/mat3';
import { BezierBase } from './BezierBase';
import { Shape } from './Shape';
import type { ShapeStyle } from './types';

export class QuadraticBezier extends BezierBase {
  readonly type = 'quadratic-bezier';

  constructor(
    p0: Point2D,
    p1: Point2D,
    p2: Point2D,
    style: Partial<ShapeStyle> = {}
  ) {
    super([p0, p1, p2], style);
  }

  evalLocal(t: number): Point2D {
    const [p0, p1, p2] = this.controlPoints;

    const u = Math.max(0, Math.min(1, t));
    const v = 1 - u;

    return {
      x:
        v * v * p0.x +
        2 * v * u * p1.x +
        u * u * p2.x,

      y:
        v * v * p0.y +
        2 * v * u * p1.y +
        u * u * p2.y,
    };
  }

  protected cloneGeometry(): Shape {
    const points = this.getControlPoints();

    const clone = new QuadraticBezier(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    );

    clone.controlPoints = points;

    return clone;
  }
}