// src/lib/shapes/Line.ts
import type { Point2D } from '../math/mat3';
import { Shape, styleColor } from './Shape';
import type { Bounds, RasterTarget, ShapeStyle } from './types';

function distToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

export class Line extends Shape {
  readonly type = 'line';
  /** Концы отрезка относительно середины (локальные координаты) */
  ax: number;
  ay: number;
  bx: number;
  by: number;

  /** (x1,y1)-(x2,y2) — концы в координатах сцены; середина становится transform.x/y */
  constructor(x1: number, y1: number, x2: number, y2: number, style: Partial<ShapeStyle> = {}) {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    super(cx, cy, style);
    this.ax = x1 - cx;
    this.ay = y1 - cy;
    this.bx = x2 - cx;
    this.by = y2 - cy;
  }

  private deviceEnds(): [Point2D, Point2D] {
    return [
      this.transformPointToDevice(this.ax, this.ay),
      this.transformPointToDevice(this.bx, this.by),
    ];
  }

  drawRaster(r: RasterTarget): void {
    const stroke = styleColor(this.strokeStyle, this.strokeOpacity);
    if (!stroke || this.strokeWidth <= 0) return;
    const [a, b] = this.deviceEnds();
    r.strokeLine(a.x, a.y, b.x, b.y, stroke, this.strokeWidth);
  }

  /**
   * Расстояние считается в экранных координатах (при разных scaleX/scaleY
   * в локальных координатах оно искажается). Порог по умолчанию: max(strokeWidth/2, 3) px.
   */
  hitTest(px: number, py: number, tolerance?: number): boolean {
    const [a, b] = this.deviceEnds();
    const thr = tolerance ?? Math.max(this.strokeWidth / 2, 3);
    return distToSegment({ x: px, y: py }, a, b) <= thr;
  }

  getBounds(): Bounds {
    const [a, b] = this.deviceEnds();
    return Shape.boundsOfPoints([a, b]);
  }

  getLocalBounds(): Bounds {
    return {
      minX: Math.min(this.ax, this.bx),
      minY: Math.min(this.ay, this.by),
      maxX: Math.max(this.ax, this.bx),
      maxY: Math.max(this.ay, this.by),
    };
  }

  protected geometryJSON(): Record<string, number> {
    return { ax: this.ax, ay: this.ay, bx: this.bx, by: this.by };
  }

  protected cloneGeometry(): Shape {
    const c = new Line(0, 0, 0, 0);
    c.ax = this.ax;
    c.ay = this.ay;
    c.bx = this.bx;
    c.by = this.by;
    return c;
  }
}