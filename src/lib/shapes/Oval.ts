// src/lib/shapes/Oval.ts
import type { Point2D } from '../math/mat3';
import { EPS } from '../math/mat3';
import { Shape } from './Shape';
import type { Bounds, RasterTarget, ShapeStyle } from './types';

export class Oval extends Shape {
  readonly type = 'oval';
  rx: number;
  ry: number;

  /** x, y — центр эллипса */
  constructor(x: number, y: number, rx: number, ry: number, style: Partial<ShapeStyle> = {}) {
    super(x, y, style);
    this.rx = rx;
    this.ry = ry;
  }

  /** Точки контура по параметрическому уравнению x = rx*cos(t), y = ry*sin(t) */
  private devicePoints(segments: number): Point2D[] {
    const pts: Point2D[] = [];
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      pts.push(this.transformPointToDevice(this.rx * Math.cos(t), this.ry * Math.sin(t)));
    }
    return pts;
  }

  drawRaster(r: RasterTarget): void {
    const b = this.getBounds();
    const rDev = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2;
    const segments = Math.min(256, Math.max(32, Math.ceil(rDev / 2)));
    this.paintPolygon(r, this.devicePoints(segments));
  }

  hitTest(px: number, py: number): boolean {
    if (Math.abs(this.rx) < EPS || Math.abs(this.ry) < EPS) return false;
    const p = this.transformPointToLocal(px, py);
    if (!p) return false;
    const nx = p.x / this.rx;
    const ny = p.y / this.ry;
    return nx * nx + ny * ny <= 1;
  }

  /** Точные границы эллипса под аффинным преобразованием (без выборки точек) */
  getBounds(): Bounds {
    const m = this.getLocalToDeviceMatrix();
    const c = this.transformPointToDevice(0, 0);
    const hx = Math.hypot(m[0] * this.rx, m[1] * this.ry);
    const hy = Math.hypot(m[3] * this.rx, m[4] * this.ry);
    return { minX: c.x - hx, minY: c.y - hy, maxX: c.x + hx, maxY: c.y + hy };
  }

  getLocalBounds(): Bounds {
    return { minX: -this.rx, minY: -this.ry, maxX: this.rx, maxY: this.ry };
  }

  protected geometryJSON(): Record<string, number> {
    return { rx: this.rx, ry: this.ry };
  }

  protected cloneGeometry(): Shape {
    return new Oval(0, 0, this.rx, this.ry);
  }
}