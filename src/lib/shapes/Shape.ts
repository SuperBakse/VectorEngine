import { EPS, mat3, type Mat3, type Point2D } from '../math/mat3';
import { clampByte, hexToRGBA, type RGBA } from '../raster/RasterRenderer';
import type {
  Bounds,
  RasterTarget,
  ShapeJSON,
  ShapeStyle,
  Transform,
} from './types';

export const DEFAULT_STYLE: ShapeStyle = {
  fillStyle: '#3b82f6',
  fillOpacity: 0.6,
  strokeStyle: '#000000',
  strokeWidth: 2,
  strokeOpacity: 1,
};

let nextShapeId = 1;

export function styleColor(
  color: string | null,
  opacity: number
): RGBA | null {
  if (color === null) return null;

  const c = hexToRGBA(color);
  const o = Math.min(1, Math.max(0, opacity));
  const a = clampByte(c.a * o);

  if (a <= 0) return null;

  return { r: c.r, g: c.g, b: c.b, a };
}

export abstract class Shape {
  abstract readonly type: string;

  id: string;
  transform: Transform;

  fillStyle: string | null;
  fillOpacity: number;

  strokeStyle: string | null;
  strokeWidth: number;
  strokeOpacity: number;

  constructor(
    x = 0,
    y = 0,
    style: Partial<ShapeStyle> = {}
  ) {
    const s: ShapeStyle = { ...DEFAULT_STYLE, ...style };

    this.id = `shape_${nextShapeId++}`;

    this.transform = {
      x,
      y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };

    this.fillStyle = s.fillStyle;
    this.fillOpacity = s.fillOpacity;
    this.strokeStyle = s.strokeStyle;
    this.strokeWidth = s.strokeWidth;
    this.strokeOpacity = s.strokeOpacity;
  }

  restoreId(id: string): void {
    this.id = id;
    const match = /^shape_(\d+)$/.exec(id);
    if (match) {
      nextShapeId = Math.max(nextShapeId, Number(match[1]) + 1);
    }
  }

  abstract drawRaster(r: RasterTarget): void;

  abstract hitTest(
    px: number,
    py: number,
    tolerance?: number
  ): boolean;

  abstract getBounds(): Bounds;

  abstract getLocalBounds(): Bounds;

  protected abstract geometryJSON(): Record<string, unknown>;

  protected abstract cloneGeometry(): Shape;

  getLocalToDeviceMatrix(): Mat3 {
    const t = this.transform;

    return mat3.fromTransform(
      t.x,
      t.y,
      t.rotation,
      t.scaleX,
      t.scaleY
    );
  }

  getDeviceToLocalMatrix(): Mat3 | null {
    return mat3.invert(this.getLocalToDeviceMatrix());
  }

  transformPointToDevice(
    px: number,
    py: number
  ): Point2D {
    return mat3.transformPoint(
      this.getLocalToDeviceMatrix(),
      px,
      py
    );
  }

  transformPointToLocal(
    px: number,
    py: number
  ): Point2D | null {
    const inv = this.getDeviceToLocalMatrix();

    return inv
      ? mat3.transformPoint(inv, px, py)
      : null;
  }

  getCenter(): Point2D {
    const b = this.getBounds();

    return {
      x: (b.minX + b.maxX) / 2,
      y: (b.minY + b.maxY) / 2,
    };
  }

  resizeFromDeviceAABB(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): void {
    const old = this.getBounds();

    const ow = old.maxX - old.minX;
    const oh = old.maxY - old.minY;

    const kx = ow > EPS
      ? (maxX - minX) / ow
      : 1;

    const ky = oh > EPS
      ? (maxY - minY) / oh
      : 1;

    const d = mat3.multiply(
      mat3.translate(minX, minY),
      mat3.multiply(
        mat3.scale(kx, ky),
        mat3.translate(-old.minX, -old.minY)
      )
    );

    this.applyMatrix(
      mat3.multiply(
        d,
        this.getLocalToDeviceMatrix()
      )
    );

    const nb = this.getBounds();

    this.transform.x += minX - nb.minX;
    this.transform.y += minY - nb.minY;
  }

  setBounds(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): void {
    this.resizeFromDeviceAABB(
      minX,
      minY,
      maxX,
      maxY
    );
  }

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

  protected static boundsOfPoints(
    points: Point2D[]
  ): Bounds {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    if (points.length === 0) {
      return {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
      };
    }

    return { minX, minY, maxX, maxY };
  }

  protected paintPolygon(
    r: RasterTarget,
    pts: Point2D[]
  ): void {
    const fill = styleColor(
      this.fillStyle,
      this.fillOpacity
    );

    if (fill) {
      r.fillPolygon(pts, fill);
    }

    const stroke = styleColor(
      this.strokeStyle,
      this.strokeOpacity
    );

    if (stroke && this.strokeWidth > 0) {
      r.strokePolygon(
        pts,
        stroke,
        this.strokeWidth,
        true
      );
    }
  }
}