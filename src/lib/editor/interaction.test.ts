import { describe, expect, test } from "vitest";
import { Rect } from "../shapes/Rect";
import {
  findTopmostShapeAt,
  moveShapeFromStart,
  pointToLocal,
  resizeShapeFromStart,
  rotateShapeFromStart,
  type ResizeHandle,
} from "./interaction";

describe("editor interaction helpers", () => {
  test("selects the uppermost shape when objects overlap", () => {
    const lower = new Rect(50, 50, 80, 60);
    const upper = new Rect(50, 50, 40, 30);

    expect(findTopmostShapeAt([lower, upper], { x: 50, y: 50 })).toBe(upper);
  });

  test("moves from the initial transform without accumulating pointer error", () => {
    const shape = new Rect(100, 80, 40, 30);
    const initial = { ...shape.transform };

    moveShapeFromStart(
      shape,
      initial,
      { x: 20, y: 30 },
      { x: 65, y: 12 }
    );
    expect(shape.transform.x).toBe(145);
    expect(shape.transform.y).toBe(62);

    moveShapeFromStart(
      shape,
      initial,
      { x: 20, y: 30 },
      { x: 25, y: 35 }
    );
    expect(shape.transform.x).toBe(105);
    expect(shape.transform.y).toBe(85);
  });

  test("rotates around the shape origin", () => {
    const shape = new Rect(100, 100, 80, 40);
    const initial = { ...shape.transform };

    rotateShapeFromStart(
      shape,
      initial,
      { x: 150, y: 100 },
      { x: 100, y: 150 }
    );

    expect(shape.transform.rotation).toBeCloseTo(Math.PI / 2);
    expect(shape.transform.x).toBe(100);
    expect(shape.transform.y).toBe(100);
  });

  test("resizes a rotated shape and keeps the opposite corner fixed", () => {
    const shape = new Rect(120, 90, 100, 60);
    shape.transform.rotation = Math.PI / 4;
    const initial = { ...shape.transform };
    const bounds = shape.getLocalBounds();
    const anchorLocal = { x: bounds.minX, y: bounds.minY };
    const initialAnchor = shape.transformPointToDevice(
      anchorLocal.x,
      anchorLocal.y
    );
    const pointerLocal = { x: bounds.maxX + 35, y: bounds.maxY + 20 };
    const pointerScene = shape.transformPointToDevice(
      pointerLocal.x,
      pointerLocal.y
    );

    resizeShapeFromStart(
      shape,
      initial,
      bounds,
      "se",
      pointerScene
    );

    const nextAnchor = shape.transformPointToDevice(
      anchorLocal.x,
      anchorLocal.y
    );
    expect(nextAnchor.x).toBeCloseTo(initialAnchor.x);
    expect(nextAnchor.y).toBeCloseTo(initialAnchor.y);
    expect(Math.abs(shape.transform.scaleX)).toBeGreaterThan(
      Math.abs(initial.scaleX)
    );
  });

  test("does not allow a resize handle to shrink an object below the minimum", () => {
    const shape = new Rect(50, 50, 100, 80);
    const initial = { ...shape.transform };
    const bounds = shape.getLocalBounds();
    const almostCollapsed = shape.transformPointToDevice(
      bounds.minX + 0.01,
      bounds.minY + 0.01
    );

    resizeShapeFromStart(
      shape,
      initial,
      bounds,
      "se" as ResizeHandle,
      almostCollapsed,
      18
    );

    expect(Math.abs(shape.transform.scaleX) * 100).toBeGreaterThanOrEqual(18);
    expect(Math.abs(shape.transform.scaleY) * 80).toBeGreaterThanOrEqual(18);
  });

  test("converts scene points to local coordinates with rotation and scale", () => {
    const shape = new Rect(20, 30, 90, 50);
    shape.transform.rotation = 0.4;
    shape.transform.scaleX = 1.5;
    shape.transform.scaleY = 0.75;
    const local = { x: 12, y: -8 };
    const scene = shape.transformPointToDevice(local.x, local.y);

    expect(pointToLocal(shape.transform, scene)).toMatchObject({
      x: expect.closeTo(local.x),
      y: expect.closeTo(local.y),
    });
  });
});
