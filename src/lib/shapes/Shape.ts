// src/lib/shapes/Shape.ts
import { EPS, mat3, type Mat3, type Point2D } from '../math/mat3';
import { clampByte, hexToRGBA, type RGBA } from '../raster/RasterRenderer';
import type { Bounds, RasterTarget, ShapeJSON, ShapeStyle, Transform } from './types';

export const DEFAULT_STYLE: ShapeStyle = {
  fillStyle: '#3b82f6',
  fillOpacity: 0.6,
  strokeStyle: '#000000',
  strokeWidth: 2,
  strokeOpacity: 1,
};

let nextShapeId = 1;

/** Цвет стиля + прозрачность -> RGBA; null, если рисовать нечего */
export function styleColor(color: string | null, opacity: number): RGBA | null {
  if (color === null) return null;
  const c = hexToRGBA(color);
  const o = Math.min(1, Math.max(0, opacity));
  const a = clampByte(c.a * o);
  if (a <= 0) return null;
  return { r: c.r, g: c.g, b: c.b, a };
}

export abstract class Shape {
  abstract readonly type: string;

  readonly id: string;
  transform: Transform;
  fillStyle: string | null;
  fillOpacity: number;
  strokeStyle: string | null;
  strokeWidth: number;
  strokeOpacity: number;

  constructor(x = 0, y = 0, style: Partial<ShapeStyle> = {}) {
    const s: ShapeStyle = { ...DEFAULT_STYLE, ...style };
    this.id = `shape_${nextShapeId++}`;
    this.transform = { x, y, rotation: 0, scaleX: 1, scaleY: 1 };
    this.fillStyle = s.fillStyle;
    this.fillOpacity = s.fillOpacity;
    this.strokeStyle = s.strokeStyle;
    this.strokeWidth = s.strokeWidth;
    this.strokeOpacity = s.strokeOpacity;
  }

  // ---------------- что реализует каждая фигура ----------------

  abstract drawRaster(r: RasterTarget): void;
  /** px, py — экранные координаты */
  abstract hitTest(px: number, py: number, tolerance?: number): boolean;
  /** Границы в экранных координатах */
  abstract getBounds(): Bounds;
  /** Границы в локальных координатах */
  abstract getLocalBounds(): Bounds;
  /** Только геометрия (w/h, rx/ry, точки линии) */
  protected abstract geometryJSON(): Record<string, number>;
  /** Новый экземпляр с той же геометрией (transform и стиль копирует clone()) */
  protected abstract cloneGeometry(): Shape;

  // ---------------- матрицы и точки ----------------

  getLocalToDeviceMatrix(): Mat3 {
    const t = this.transform;
    return mat3.fromTransform(t.x, t.y, t.rotation, t.scaleX, t.scaleY);
  }

  /** null, если матрица вырождена (масштаб 0) */
  getDeviceToLocalMatrix(): Mat3 | null {
    return mat3.invert(this.getLocalToDeviceMatrix());
  }

  transformPointToDevice(px: number, py: number): Point2D {
    return mat3.transformPoint(this.getLocalToDeviceMatrix(), px, py);
  }

  transformPointToLocal(px: number, py: number): Point2D | null {
    const inv = this.getDeviceToLocalMatrix();
    return inv ? mat3.transformPoint(inv, px, py) : null;
  }

  getCenter(): Point2D {
    const b = this.getBounds();
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  }

  // ---------------- изменение границ ----------------

  /**
   * Подгоняет фигуру под новый экранный AABB.
   * Точно при повороте, кратном 90°; при произвольном повороте и разных
   * масштабах по осям сдвиг (shear) отбрасывается, левый верхний угол AABB совпадает.
   */
  resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number): void {
    const old = this.getBounds();
    const ow = old.maxX - old.minX;
    const oh = old.maxY - old.minY;
    const kx = ow > EPS ? (maxX - minX) / ow : 1;
    const ky = oh > EPS ? (maxY - minY) / oh : 1;

    const d = mat3.multiply(
      mat3.translate(minX, minY),
      mat3.multiply(mat3.scale(kx, ky), mat3.translate(-old.minX, -old.minY))
    );
    this.applyMatrix(mat3.multiply(d, this.getLocalToDeviceMatrix()));

    const nb = this.getBounds();
    this.transform.x += minX - nb.minX;
    this.transform.y += minY - nb.minY;
  }

  setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.resizeFromDeviceAABB(minX, minY, maxX, maxY);
  }

  /** Разложение аффинной матрицы обратно в Transform (T * R * S) */
  private applyMatrix(m: Mat3): void {
    const sx = Math.hypot(m[0], m[3]);
    const det = m[0] * m[4] - m[1] * m[3];
    const t = this.transform;
    if (sx > EPS) {
      t.rotation = Math.atan2(m[3], m[0]);
      t.scaleX = sx;
      t.scaleY = det / sx;
    } else {
      t.scaleX = 0;
      t.scaleY = Math.hypot(m[1], m[4]);
    }
    t.x = m[2];
    t.y = m[5];
  }

  // ---------------- копирование и сериализация ----------------

  clone(): this {
    const c = this.cloneGeometry() as this;
    c.transform = { ...this.transform };
    c.fillStyle = this.fillStyle;
    c.fillOpacity = this.fillOpacity;
    c.strokeStyle = this.strokeStyle;
    c.strokeWidth = this.strokeWidth;
    c.strokeOpacity = this.strokeOpacity;
    return c;
  }

  getStyle(): ShapeStyle {
    return {
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }

  toJSON(): ShapeJSON {
    return {
      type: this.type,
      id: this.id,
      transform: { ...this.transform },
      style: this.getStyle(),
      geometry: this.geometryJSON(),
    };
  }

  // ---------------- общие помощники ----------------

  protected static boundsOfPoints(points: Point2D[]): Bounds {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  /** Заливка + обводка замкнутого многоугольника из экранных точек */
  protected paintPolygon(r: RasterTarget, pts: Point2D[]): void {
    const fill = styleColor(this.fillStyle, this.fillOpacity);
    if (fill) r.fillPolygon(pts, fill);
    const stroke = styleColor(this.strokeStyle, this.strokeOpacity);
    if (stroke && this.strokeWidth > 0) r.strokePolygon(pts, stroke, this.strokeWidth, true);
  }
}