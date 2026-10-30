import type { Point2D } from '../math/mat3';
import { Shape } from './Shape';
import type { Bounds, RasterTarget, ShapeStyle } from './types';

export class Triangle extends Shape {
  readonly type = 'triangle';

  private vertices: Point2D[];

  constructor(
    a: Point2D,
    b: Point2D,
    c: Point2D,
    style: Partial<ShapeStyle> = {}
  ) {
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;

    super(cx, cy, style);

    this.vertices = [
      { x: a.x - cx, y: a.y - cy },
      { x: b.x - cx, y: b.y - cy },
      { x: c.x - cx, y: c.y - cy },
    ];
  }

  getControlPoints(): Point2D[] {
    return this.vertices.map((p) => ({ ...p }));
  }

  setControlPoint(index: number, localPt: Point2D): void {
    if (index < 0 || index >= 3) {
      throw new RangeError('Invalid triangle vertex index');
    }

    this.vertices[index] = { ...localPt };
  }

  private devicePoints(): Point2D[] {
    return this.vertices.map((p) =>
      this.transformPointToDevice(p.x, p.y)
    );
  }

  drawRaster(r: RasterTarget): void {
    this.paintPolygon(r, this.devicePoints());
  }

  hitTest(px: number, py: number): boolean {
    const point = this.transformPointToLocal(px, py);

    if (!point) return false;

    const [a, b, c] = this.vertices;

    const cross = (
      p1: Point2D,
      p2: Point2D,
      p: Point2D
    ) =>
      (p2.x - p1.x) * (p.y - p1.y) -
      (p2.y - p1.y) * (p.x - p1.x);

    const d1 = cross(a, b, point);
    const d2 = cross(b, c, point);
    const d3 = cross(c, a, point);

    const hasNegative = d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9;
    const hasPositive = d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9;

    return !(hasNegative && hasPositive);
  }

  getBounds(): Bounds {
    return Shape.boundsOfPoints(this.devicePoints());
  }

  getLocalBounds(): Bounds {
    return Shape.boundsOfPoints(this.vertices);
  }

  protected geometryJSON(): Record<string, unknown> {
    return {
      vertices: this.getControlPoints(),
    };
  }

  protected cloneGeometry(): Shape {
    const clone = new Triangle(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    );

    clone.vertices = this.getControlPoints();

    return clone;
  }
}