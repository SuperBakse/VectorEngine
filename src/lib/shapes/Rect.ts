// src/lib/shapes/Rect.ts
import type { Point2D } from '../math/mat3';
import { Shape } from './Shape';
import type { Bounds, RasterTarget, ShapeStyle } from './types';

export class Rect extends Shape {
  readonly type = 'rect';
  w: number;
  h: number;

  /** x, y — центр прямоугольника */
  constructor(x: number, y: number, w: number, h: number, style: Partial<ShapeStyle> = {}) {
    super(x, y, style);
    this.w = w;
    this.h = h;
  }

  private localCorners(): Point2D[] {
    const hw = this.w / 2;
    const hh = this.h / 2;
    return [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ];
  }

  private deviceCorners(): Point2D[] {
    return this.localCorners().map((p) => this.transformPointToDevice(p.x, p.y));
  }

  drawRaster(r: RasterTarget): void {
    this.paintPolygon(r, this.deviceCorners());
  }

  hitTest(px: number, py: number): boolean {
    const p = this.transformPointToLocal(px, py);
    if (!p) return false;
    return Math.abs(p.x) <= this.w / 2 && Math.abs(p.y) <= this.h / 2;
  }

  getBounds(): Bounds {
    return Shape.boundsOfPoints(this.deviceCorners());
  }

  getLocalBounds(): Bounds {
    return { minX: -this.w / 2, minY: -this.h / 2, maxX: this.w / 2, maxY: this.h / 2 };
  }

  protected geometryJSON(): Record<string, number> {
    return { w: this.w, h: this.h };
  }

  protected cloneGeometry(): Shape {
    return new Rect(0, 0, this.w, this.h);
  }
}