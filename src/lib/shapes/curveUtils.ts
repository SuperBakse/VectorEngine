import type { Point2D } from '../math/mat3';
import type { Bounds } from './types';

export function distanceToSegment(
  p: Point2D,
  a: Point2D,
  b: Point2D
): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;

  const lengthSquared = vx * vx + vy * vy;

  if (lengthSquared < 1e-12) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * vx + (p.y - a.y) * vy) /
        lengthSquared
    )
  );

  return Math.hypot(
    p.x - (a.x + t * vx),
    p.y - (a.y + t * vy)
  );
}

export function distanceToPolyline(
  point: Point2D,
  points: Point2D[]
): number {
  if (points.length === 0) return Infinity;

  if (points.length === 1) {
    return Math.hypot(
      point.x - points[0].x,
      point.y - points[0].y
    );
  }

  let minDistance = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    minDistance = Math.min(
      minDistance,
      distanceToSegment(point, points[i], points[i + 1])
    );
  }

  return minDistance;
}

export function boundsOfPoints(points: Point2D[]): Bounds {
  if (points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

function splitBezier(
  points: Point2D[]
): [Point2D[], Point2D[]] {
  const levels: Point2D[][] = [
    points.map((p) => ({ ...p })),
  ];

  while (levels[levels.length - 1].length > 1) {
    const previous = levels[levels.length - 1];
    const next: Point2D[] = [];

    for (let i = 0; i < previous.length - 1; i++) {
      next.push({
        x: (previous[i].x + previous[i + 1].x) / 2,
        y: (previous[i].y + previous[i + 1].y) / 2,
      });
    }

    levels.push(next);
  }

  const left = levels.map((level) => level[0]);
  const right = levels.map((level) => level[level.length - 1]).reverse();

  return [left, right];
}

/**
 * Адаптивная аппроксимация кривой Безье.
 * flatness задаётся в координатах переданной системы.
 */
export function flattenBezier(
  points: Point2D[],
  flatness = 0.75
): Point2D[] {
  if (points.length < 2) {
    return points.map((p) => ({ ...p }));
  }

  const tolerance = Number.isFinite(flatness)
    ? Math.max(0.01, flatness)
    : 0.75;

  const result: Point2D[] = [{ ...points[0] }];

  const subdivide = (
    controlPoints: Point2D[],
    depth: number
  ): void => {
    const start = controlPoints[0];
    const end = controlPoints[controlPoints.length - 1];

    let maxDeviation = 0;

    for (let i = 1; i < controlPoints.length - 1; i++) {
      maxDeviation = Math.max(
        maxDeviation,
        distanceToSegment(controlPoints[i], start, end)
      );
    }

    if (maxDeviation <= tolerance || depth >= 12) {
      result.push({ ...end });
      return;
    }

    const [left, right] = splitBezier(controlPoints);

    subdivide(left, depth + 1);
    subdivide(right, depth + 1);
  };

  subdivide(points, 0);

  return result;
}