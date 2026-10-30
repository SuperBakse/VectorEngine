import type { Point2D } from '../math/mat3';
import { Shape, styleColor } from './Shape';
import type { Bounds, RasterTarget, ShapeStyle } from './types';
import {
  boundsOfPoints,
  distanceToPolyline,
  flattenBezier,
} from './curveUtils';

export type PathMode = 'polyline' | 'bezier' | 'catmull';

export class PathBezier extends Shape {
  readonly type = 'path-bezier';

  private anchors: Point2D[];

  mode: PathMode;
  closed: boolean;

  constructor(
    points: Point2D[],
    mode: PathMode = 'polyline',
    closed = false,
    style: Partial<ShapeStyle> = {}
  ) {
    const cx = points.length
      ? points.reduce((sum, p) => sum + p.x, 0) / points.length
      : 0;

    const cy = points.length
      ? points.reduce((sum, p) => sum + p.y, 0) / points.length
      : 0;

    super(cx, cy, style);

    this.anchors = points.map((p) => ({
      x: p.x - cx,
      y: p.y - cy,
    }));

    this.mode = mode;
    this.closed = closed;
  }

  getControlPoints(): Point2D[] {
    return this.anchors.map((p) => ({ ...p }));
  }

  setControlPoint(index: number, localPt: Point2D): void {
    if (index < 0 || index >= this.anchors.length) {
      throw new RangeError('Invalid anchor index');
    }

    this.anchors[index] = { ...localPt };
  }

  addPointLocal(
    localPt: Point2D,
    insertAtIndex?: number
  ): void {
    const point = { ...localPt };

    if (insertAtIndex === undefined) {
      this.anchors.push(point);
      return;
    }

    const index = Math.max(
      0,
      Math.min(this.anchors.length, insertAtIndex)
    );

    this.anchors.splice(index, 0, point);
  }

  removePoint(index: number): boolean {
    if (index < 0 || index >= this.anchors.length) {
      return false;
    }

    this.anchors.splice(index, 1);

    return true;
  }

  /**
   * Преобразование Catmull-Rom в кубические сегменты Безье.
   */
  catmullToBeziers(): Point2D[][] {
    const points = this.anchors;
    const n = points.length;

    if (n < 2) return [];

    const segments: Point2D[][] = [];

    const segmentCount = this.closed ? n : n - 1;

    for (let i = 0; i < segmentCount; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];

      const p0 = this.closed
        ? points[(i - 1 + n) % n]
        : points[Math.max(0, i - 1)];

      const p3 = this.closed
        ? points[(i + 2) % n]
        : points[Math.min(n - 1, i + 2)];

      const c1 = {
        x: p1.x + (p2.x - p0.x) / 6,
        y: p1.y + (p2.y - p0.y) / 6,
      };

      const c2 = {
        x: p2.x - (p3.x - p1.x) / 6,
        y: p2.y - (p3.y - p1.y) / 6,
      };

      segments.push([
        { ...p1 },
        c1,
        c2,
        { ...p2 },
      ]);
    }

    return segments;
  }

  private transformPoints(points: Point2D[]): Point2D[] {
    return points.map((p) =>
      this.transformPointToDevice(p.x, p.y)
    );
  }

  private appendSegment(
    result: Point2D[],
    segment: Point2D[]
  ): void {
    if (segment.length === 0) return;

    if (result.length === 0) {
      result.push(...segment);
      return;
    }

    result.push(...segment.slice(1));
  }

  private closePoints(points: Point2D[]): Point2D[] {
    if (!this.closed || points.length < 3) return points;

    const first = points[0];
    const last = points[points.length - 1];

    if (
      Math.abs(first.x - last.x) > 1e-9 ||
      Math.abs(first.y - last.y) > 1e-9
    ) {
      return [...points, { ...first }];
    }

    return points;
  }

  flattenLocalPoints(flatness = 0.75): Point2D[] {
    if (this.anchors.length === 0) return [];

    if (this.mode === 'polyline') {
      return this.closePoints(
        this.anchors.map((p) => ({ ...p }))
      );
    }

    const segments =
      this.mode === 'catmull'
        ? this.catmullToBeziers()
        : this.getBezierSegments();

    const result: Point2D[] = [];

    for (const segment of segments) {
      this.appendSegment(
        result,
        flattenBezier(segment, flatness)
      );
    }

    if (result.length === 0) {
      result.push(...this.anchors.map((p) => ({ ...p })));
    }

    return this.closePoints(result);
  }

  flattenDevicePoints(flatness = 0.75): Point2D[] {
    if (this.anchors.length === 0) return [];

    if (this.mode === 'polyline') {
      return this.closePoints(
        this.transformPoints(this.anchors)
      );
    }

    const segments =
      this.mode === 'catmull'
        ? this.catmullToBeziers()
        : this.getBezierSegments();

    const result: Point2D[] = [];

    for (const segment of segments) {
      const deviceSegment = this.transformPoints(segment);

      this.appendSegment(
        result,
        flattenBezier(deviceSegment, flatness)
      );
    }

    if (result.length === 0) {
      result.push(...this.transformPoints(this.anchors));
    }

    return this.closePoints(result);
  }

  private getBezierSegments(): Point2D[][] {
    const segments: Point2D[][] = [];

    for (
      let i = 0;
      i + 3 < this.anchors.length;
      i += 3
    ) {
      segments.push([
        { ...this.anchors[i] },
        { ...this.anchors[i + 1] },
        { ...this.anchors[i + 2] },
        { ...this.anchors[i + 3] },
      ]);
    }

    return segments;
  }

  drawRaster(r: RasterTarget): void {
    const points = this.flattenDevicePoints();

    if (points.length < 2) return;

    const stroke = styleColor(
      this.strokeStyle,
      this.strokeOpacity
    );

    if (this.closed) {
      this.paintPolygon(r, points);
      return;
    }

    if (stroke && this.strokeWidth > 0) {
      r.strokePolygon(
        points,
        stroke,
        this.strokeWidth,
        false
      );
    }
  }

  hitTest(
    px: number,
    py: number,
    tolerance?: number
  ): boolean {
    const points = this.flattenDevicePoints();

    const threshold =
      tolerance ?? Math.max(this.strokeWidth / 2, 3);

    return (
      distanceToPolyline({ x: px, y: py }, points) <= threshold
    );
  }

  getBounds(): Bounds {
    return boundsOfPoints(this.flattenDevicePoints());
  }

  getLocalBounds(): Bounds {
    return boundsOfPoints(this.flattenLocalPoints());
  }

  protected geometryJSON(): Record<string, unknown> {
    return {
      anchors: this.getControlPoints(),
      mode: this.mode,
      closed: this.closed,
    };
  }

  protected cloneGeometry(): Shape {
    const clone = new PathBezier(
      [],
      this.mode,
      this.closed
    );

    clone.anchors = this.getControlPoints();

    return clone;
  }
}