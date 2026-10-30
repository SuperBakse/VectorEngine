import type { Point2D } from '../math/mat3';
import { Shape, styleColor } from './Shape';
import type { Bounds, RasterTarget, ShapeStyle } from './types';
import {
  boundsOfPoints,
  distanceToPolyline,
  flattenBezier,
} from './curveUtils';

export abstract class BezierBase extends Shape {
  protected controlPoints: Point2D[];

  protected constructor(
    points: Point2D[],
    style: Partial<ShapeStyle> = {}
  ) {
    const cx =
      points.reduce((sum, p) => sum + p.x, 0) /
      points.length;

    const cy =
      points.reduce((sum, p) => sum + p.y, 0) /
      points.length;

    super(
      points.length ? cx : 0,
      points.length ? cy : 0,
      style
    );

    this.controlPoints = points.map((p) => ({
      x: p.x - this.transform.x,
      y: p.y - this.transform.y,
    }));
  }

  abstract evalLocal(t: number): Point2D;

  getControlPoints(): Point2D[] {
    return this.controlPoints.map((p) => ({ ...p }));
  }

  setControlPoint(index: number, localPt: Point2D): void {
    if (index < 0 || index >= this.controlPoints.length) {
      throw new RangeError('Invalid control point index');
    }

    this.controlPoints[index] = { ...localPt };
  }

  flattenLocalPoints(flatness = 0.75): Point2D[] {
    return flattenBezier(this.controlPoints, flatness);
  }

  flattenDevicePoints(flatness = 0.75): Point2D[] {
    const deviceControls = this.controlPoints.map((p) =>
      this.transformPointToDevice(p.x, p.y)
    );

    return flattenBezier(deviceControls, flatness);
  }

  drawRaster(r: RasterTarget): void {
    const stroke = styleColor(
      this.strokeStyle,
      this.strokeOpacity
    );

    if (!stroke || this.strokeWidth <= 0) return;

    const points = this.flattenDevicePoints();

    if (points.length < 2) return;

    r.strokePolygon(
      points,
      stroke,
      this.strokeWidth,
      false
    );
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
      controlPoints: this.getControlPoints(),
    };
  }

  protected abstract cloneGeometry(): Shape;
}