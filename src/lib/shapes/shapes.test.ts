import { describe, expect, test, vi } from 'vitest';

import type { Point2D } from '../math/mat3';
import type { RasterTarget } from './types';

import {
  Triangle,
  QuadraticBezier,
  CubicBezier,
  PathBezier,
} from './index';

const style = {
  fillStyle: '#3b82f6',
  fillOpacity: 0.6,
  strokeStyle: '#000000',
  strokeWidth: 2,
  strokeOpacity: 1,
};

describe('Triangle', () => {
  function createTriangle() {
    return new Triangle(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 }
    );
  }

  test('detects point inside triangle', () => {
    const triangle = createTriangle();

    expect(triangle.hitTest(2, 2)).toBe(true);
  });

  test('detects point on triangle boundary', () => {
    const triangle = createTriangle();

    expect(triangle.hitTest(5, 0)).toBe(true);
  });

  test('rejects point outside triangle', () => {
    const triangle = createTriangle();

    expect(triangle.hitTest(9, 9)).toBe(false);
  });

  test('calculates local bounds', () => {
    const triangle = createTriangle();
    const bounds = triangle.getLocalBounds();

    expect(bounds.minX).toBeCloseTo(-10 / 3);
    expect(bounds.minY).toBeCloseTo(-10 / 3);
    expect(bounds.maxX).toBeCloseTo(20 / 3);
    expect(bounds.maxY).toBeCloseTo(20 / 3);
  });

  test('calculates bounds after transformation', () => {
    const triangle = createTriangle();

    triangle.transform.x = 100;
    triangle.transform.y = 50;
    triangle.transform.rotation = Math.PI / 2;

    const points = triangle
      .getControlPoints()
      .map((p) => triangle.transformPointToDevice(p.x, p.y));

    const bounds = triangle.getBounds();

    expect(bounds.minX).toBeCloseTo(
      Math.min(...points.map((p) => p.x))
    );

    expect(bounds.maxX).toBeCloseTo(
      Math.max(...points.map((p) => p.x))
    );

    expect(bounds.minY).toBeCloseTo(
      Math.min(...points.map((p) => p.y))
    );

    expect(bounds.maxY).toBeCloseTo(
      Math.max(...points.map((p) => p.y))
    );
  });

  test('updates control points', () => {
    const triangle = createTriangle();

    triangle.setControlPoint(0, { x: -5, y: -5 });

    expect(triangle.getControlPoints()[0]).toEqual({
      x: -5,
      y: -5,
    });
  });

  test('serializes triangle geometry', () => {
    const triangle = createTriangle();
    const json = triangle.toJSON();

    expect(json.type).toBe('triangle');
    expect(json.geometry.vertices).toHaveLength(3);
    expect(json.transform).toBeDefined();
    expect(json.style).toBeDefined();
  });

  test('draws triangle using raster renderer', () => {
    const triangle = createTriangle();

    const renderer = {
      fillPolygon: vi.fn(),
      strokePolygon: vi.fn(),
      strokeLine: vi.fn(),
    } as unknown as RasterTarget;

    triangle.drawRaster(renderer);

    expect(renderer.fillPolygon).toHaveBeenCalledOnce();
    expect(renderer.strokePolygon).toHaveBeenCalledOnce();
  });
});

describe('QuadraticBezier', () => {
  function createCurve() {
    return new QuadraticBezier(
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 }
    );
  }

  test('starts at p0', () => {
    const curve = createCurve();

    const points = curve.getControlPoints();

    expect(curve.evalLocal(0)).toEqual(points[0]);
  });

  test('ends at p2', () => {
    const curve = createCurve();

    const points = curve.getControlPoints();

    expect(curve.evalLocal(1)).toEqual(points[2]);
  });

  test('calculates middle point correctly', () => {
    const curve = createCurve();

    const point = curve.evalLocal(0.5);

    expect(point.x).toBeCloseTo(
      (curve.getControlPoints()[0].x +
        2 * curve.getControlPoints()[1].x +
        curve.getControlPoints()[2].x) / 4
    );

    expect(point.y).toBeCloseTo(50 - 100 / 3);
  });

  test('produces an approximation', () => {
    const curve = createCurve();

    const points = curve.flattenDevicePoints();

    expect(points.length).toBeGreaterThan(2);

    expect(points[0]).toEqual(
      curve.transformPointToDevice(
        curve.getControlPoints()[0].x,
        curve.getControlPoints()[0].y
      )
    );
  });

  test('smaller flatness produces more segments', () => {
    const curve = createCurve();

    const coarse = curve.flattenDevicePoints(20);
    const detailed = curve.flattenDevicePoints(0.1);

    expect(detailed.length).toBeGreaterThan(coarse.length);
  });

  test('changes after editing control point', () => {
    const curve = createCurve();

    const before = curve.evalLocal(0.5);

    curve.setControlPoint(1, { x: 50, y: 200 });

    const after = curve.evalLocal(0.5);

    expect(after.y).not.toBeCloseTo(before.y);
  });

  test('supports hit testing', () => {
    const curve = createCurve();

    const middle = curve.evalLocal(0.5);

    const device = curve.transformPointToDevice(
      middle.x,
      middle.y
    );

    expect(curve.hitTest(device.x, device.y, 5)).toBe(true);
  });

  test('serializes curve', () => {
    const curve = createCurve();
    const json = curve.toJSON();

    expect(json.type).toBe('quadratic-bezier');
    expect(json.geometry.controlPoints).toHaveLength(3);
  });
});

describe('CubicBezier', () => {
  function createCurve() {
    return new CubicBezier(
      { x: 0, y: 0 },
      { x: 30, y: 100 },
      { x: 70, y: -100 },
      { x: 100, y: 0 }
    );
  }

  test('starts at p0 and ends at p3', () => {
    const curve = createCurve();
    const points = curve.getControlPoints();

    expect(curve.evalLocal(0)).toEqual(points[0]);
    expect(curve.evalLocal(1)).toEqual(points[3]);
  });

  test('calculates point at t = 0.5', () => {
    const curve = createCurve();

    const point = curve.evalLocal(0.5);

    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeCloseTo(0);
  });

  test('supports adaptive approximation', () => {
    const curve = createCurve();

    const coarse = curve.flattenDevicePoints(20);
    const detailed = curve.flattenDevicePoints(0.1);

    expect(detailed.length).toBeGreaterThan(coarse.length);
  });

  test('supports control point editing', () => {
    const curve = createCurve();

    const before = curve.evalLocal(0.5);

    curve.setControlPoint(1, { x: 30, y: 200 });

    const after = curve.evalLocal(0.5);

    expect(after.y).not.toBeCloseTo(before.y);
  });

  test('calculates bounds', () => {
    const curve = createCurve();
    const bounds = curve.getBounds();

    expect(bounds.minX).toBeLessThan(bounds.maxX);
    expect(bounds.minY).toBeLessThan(bounds.maxY);
  });

  test('serializes four control points', () => {
    const curve = createCurve();

    expect(curve.toJSON().type).toBe('cubic-bezier');
    expect(curve.getControlPoints()).toHaveLength(4);
  });
});

describe('PathBezier', () => {
  const anchors: Point2D[] = [
    { x: 0, y: 0 },
    { x: 50, y: 100 },
    { x: 100, y: 0 },
    { x: 150, y: 100 },
  ];

  test('creates polyline path', () => {
    const path = new PathBezier(anchors, 'polyline');

    const points = path.flattenDevicePoints();

    expect(points).toHaveLength(4);
  });

  test('creates bezier path', () => {
    const path = new PathBezier(
      [
        { x: 0, y: 0 },
        { x: 30, y: 100 },
        { x: 70, y: 100 },
        { x: 100, y: 0 },
      ],
      'bezier'
    );

    expect(path.flattenDevicePoints().length).toBeGreaterThan(2);
  });

  test('creates catmull-rom path', () => {
    const path = new PathBezier(anchors, 'catmull');

    const segments = path.catmullToBeziers();

    expect(segments).toHaveLength(3);

    for (const segment of segments) {
      expect(segment).toHaveLength(4);
    }
  });

  test('catmull-rom passes through anchor points', () => {
    const path = new PathBezier(anchors, 'catmull');

    const segments = path.catmullToBeziers();

    expect(segments[0][0]).toEqual(path.getControlPoints()[0]);
    expect(segments[0][3]).toEqual(path.getControlPoints()[1]);
  });

  test('adds point', () => {
    const path = new PathBezier(anchors);

    path.addPointLocal({ x: 200, y: 200 });

    expect(path.getControlPoints()).toHaveLength(5);
  });

  test('inserts point at specified index', () => {
    const path = new PathBezier(anchors);

    path.addPointLocal(
      { x: 25, y: 25 },
      1
    );

    expect(path.getControlPoints()[1]).toEqual({
      x: 25,
      y: 25,
    });
  });

  test('removes point', () => {
    const path = new PathBezier(anchors);

    expect(path.removePoint(1)).toBe(true);
    expect(path.getControlPoints()).toHaveLength(3);
  });

  test('rejects invalid removal', () => {
    const path = new PathBezier(anchors);

    expect(path.removePoint(100)).toBe(false);
  });

  test('updates anchor', () => {
    const path = new PathBezier(anchors);

    path.setControlPoint(0, { x: -20, y: -20 });

    expect(path.getControlPoints()[0]).toEqual({
      x: -20,
      y: -20,
    });
  });

  test('supports closed paths', () => {
    const path = new PathBezier(
      anchors,
      'polyline',
      true
    );

    const points = path.flattenDevicePoints();

    expect(points[0]).toEqual(points[points.length - 1]);
  });

  test('supports hit testing', () => {
    const path = new PathBezier(anchors, 'polyline');

    const points = path.flattenDevicePoints();
    const middle = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };

    expect(path.hitTest(middle.x, middle.y, 5)).toBe(true);
  });

  test('calculates path bounds', () => {
    const path = new PathBezier(anchors, 'catmull');

    const bounds = path.getBounds();

    expect(bounds.minX).toBeLessThan(bounds.maxX);
    expect(bounds.minY).toBeLessThan(bounds.maxY);
  });

  test('serializes path parameters', () => {
    const path = new PathBezier(
      anchors,
      'catmull',
      true
    );

    const json = path.toJSON();

    expect(json.type).toBe('path-bezier');
    expect(json.geometry.mode).toBe('catmull');
    expect(json.geometry.closed).toBe(true);
    expect(json.geometry.anchors).toHaveLength(4);
  });

  test('supports cloning', () => {
    const path = new PathBezier(
      anchors,
      'catmull',
      true
    );

    const clone = path.clone();

    expect(clone.toJSON().geometry).toEqual(
      path.toJSON().geometry
    );

    expect(clone.transform).toEqual(path.transform);
  });
});