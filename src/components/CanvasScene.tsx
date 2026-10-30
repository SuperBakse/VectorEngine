import { useEffect, useRef } from 'react';
import type { Dispatch, PointerEvent, SetStateAction } from 'react';

import {
  RasterRenderer,
  type LineAlg,
  type RGBA,
} from '../lib/raster/RasterRenderer';
import {
  Line,
  Oval,
  PathBezier,
  Rect,
  Triangle,
  type Shape,
} from '../lib/shapes';
import type { Point2D } from '../lib/math/mat3';
import type { Bounds, Transform } from '../lib/shapes/types';
import {
  findTopmostShapeAt,
  getResizeHandleLocalPoint,
  getRotationHandleLocalPoint,
  isEditableShape,
  moveShapeFromStart,
  pointToLocal,
  resizeShapeFromStart,
  rotateShapeFromStart,
  type ResizeHandle,
} from '../lib/editor/interaction';

export type EditorTool =
  | 'select'
  | 'rect'
  | 'oval'
  | 'line'
  | 'triangle'
  | 'path';

interface CanvasSceneProps {
  lineAlg: LineAlg;
  shapes: Shape[];
  setShapes: Dispatch<SetStateAction<Shape[]>>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
}

type Gesture =
  | {
      kind: 'move' | 'rotate';
      pointerId: number;
      shapeId: string;
      startPoint: Point2D;
      initialTransform: Transform;
    }
  | {
      kind: 'resize';
      pointerId: number;
      shapeId: string;
      initialTransform: Transform;
      localBounds: Bounds;
      handle: ResizeHandle;
    }
  | {
      kind: 'control';
      pointerId: number;
      shapeId: string;
      initialTransform: Transform;
      pointIndex: number;
    };

const BLUE: RGBA = { r: 37, g: 99, b: 235, a: 255 };
const BLUE_LIGHT: RGBA = { r: 147, g: 197, b: 253, a: 255 };
const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 255 };
const DARK: RGBA = { r: 30, g: 41, b: 59, a: 255 };

const RESIZE_HANDLES: ResizeHandle[] = [
  'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w',
];

const HANDLE_HIT_RADIUS = 10;

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createShape(tool: EditorTool, point: Point2D): Shape | null {
  const x = point.x;
  const y = point.y;

  switch (tool) {
    case 'rect':
      return new Rect(x, y, 150, 100, {
        fillStyle: '#60a5fa',
        fillOpacity: 0.28,
        strokeStyle: '#2563eb',
        strokeWidth: 2,
      });
    case 'oval':
      return new Oval(x, y, 76, 52, {
        fillStyle: '#a78bfa',
        fillOpacity: 0.3,
        strokeStyle: '#7c3aed',
        strokeWidth: 2,
      });
    case 'line':
      return new Line(x - 75, y - 25, x + 75, y + 25, {
        fillStyle: null,
        strokeStyle: '#16a34a',
        strokeWidth: 4,
      });
    case 'triangle':
      return new Triangle(
        { x, y: y - 65 },
        { x: x + 70, y: y + 55 },
        { x: x - 70, y: y + 55 },
        {
          fillStyle: '#fbbf24',
          fillOpacity: 0.32,
          strokeStyle: '#d97706',
          strokeWidth: 2,
        }
      );
    case 'path':
      return new PathBezier(
        [
          { x: x - 100, y: y + 15 },
          { x: x - 35, y: y - 65 },
          { x: x + 35, y: y + 65 },
          { x: x + 100, y: y - 15 },
        ],
        'catmull',
        false,
        {
          fillStyle: null,
          strokeStyle: '#0d9488',
          strokeWidth: 4,
        }
      );
    default:
      return null;
  }
}

function localBoundsCorners(bounds: Bounds): Point2D[] {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
}

function drawMarker(
  renderer: RasterRenderer,
  point: Point2D,
  dpr: number,
  active = false
): void {
  renderer.fillCircle(
    point.x * dpr,
    point.y * dpr,
    (active ? 6 : 5) * dpr,
    BLUE
  );
  renderer.fillCircle(
    point.x * dpr,
    point.y * dpr,
    2.6 * dpr,
    WHITE
  );
}

export default function CanvasScene({
  lineAlg,
  shapes,
  setShapes,
  selectedId,
  onSelect,
  tool,
  onToolChange,
}: CanvasSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RasterRenderer | null>(null);
  const shapesRef = useRef(shapes);
  const selectedIdRef = useRef(selectedId);
  const gestureRef = useRef<Gesture | null>(null);
  const pendingPointRef = useRef<Point2D | null>(null);
  const gestureRafRef = useRef(0);

  shapesRef.current = shapes;
  selectedIdRef.current = selectedId;

  useEffect(() => {
    rendererRef.current?.setLineAlgorithm(lineAlg);
  }, [lineAlg]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new RasterRenderer(canvas);
    renderer.setLineAlgorithm(lineAlg);
    rendererRef.current = renderer;

    const resizeObserver = new ResizeObserver(() => renderer.resize());
    resizeObserver.observe(containerRef.current ?? canvas);

    let frameId = 0;
    const drawFrame = () => {
      renderer.resize();
      renderer.beginFrame(true);
      const dpr = renderer.dpr;

      for (const shape of shapesRef.current) {
        const transform = { ...shape.transform };
        const strokeWidth = shape.strokeWidth;
        try {
          shape.transform = {
            ...transform,
            x: transform.x * dpr,
            y: transform.y * dpr,
            scaleX: transform.scaleX * dpr,
            scaleY: transform.scaleY * dpr,
          };
          shape.strokeWidth = strokeWidth * dpr;
          shape.drawRaster(renderer);
        } finally {
          shape.transform = transform;
          shape.strokeWidth = strokeWidth;
        }
      }

      const selected = shapesRef.current.find(
        (shape) => shape.id === selectedIdRef.current
      );

      if (selected) {
        const bounds = selected.getLocalBounds();
        const outline = localBoundsCorners(bounds).map((point) => {
          const scenePoint = selected.transformPointToDevice(point.x, point.y);
          return { x: scenePoint.x * dpr, y: scenePoint.y * dpr };
        });
        renderer.strokePolygon(outline, BLUE, 1.5 * dpr, true);

        const controlPointShape = isEditableShape(selected) ? selected : null;
        if (controlPointShape) {
          const controls = controlPointShape.getControlPoints().map((point) =>
            selected.transformPointToDevice(point.x, point.y)
          );
          if (controls.length > 1) {
            renderer.strokePolygon(
              controls.map((point) => ({ x: point.x * dpr, y: point.y * dpr })),
              BLUE_LIGHT,
              dpr,
              false
            );
          }
          controls.forEach((point) => drawMarker(renderer, point, dpr));
        }

        for (const handle of RESIZE_HANDLES) {
          const localPoint = getResizeHandleLocalPoint(bounds, handle);
          const scenePoint = selected.transformPointToDevice(localPoint.x, localPoint.y);
          drawMarker(renderer, scenePoint, dpr);
        }

        const rotationLocal = getRotationHandleLocalPoint(bounds);
        const rotationPoint = selected.transformPointToDevice(
          rotationLocal.x,
          rotationLocal.y
        );
        const topLocal = getResizeHandleLocalPoint(bounds, 'n');
        const topPoint = selected.transformPointToDevice(topLocal.x, topLocal.y);
        renderer.strokeLine(
          topPoint.x * dpr,
          topPoint.y * dpr,
          rotationPoint.x * dpr,
          rotationPoint.y * dpr,
          BLUE,
          1.5 * dpr
        );
        renderer.fillCircle(rotationPoint.x * dpr, rotationPoint.y * dpr, 8 * dpr, DARK);
        renderer.fillCircle(rotationPoint.x * dpr, rotationPoint.y * dpr, 5 * dpr, WHITE);
      }

      renderer.commit();
      frameId = requestAnimationFrame(drawFrame);
    };

    frameId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(frameId);
      cancelAnimationFrame(gestureRafRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  const toScenePoint = (event: PointerEvent<HTMLCanvasElement>): Point2D => {
    const rect = event.currentTarget.getBoundingClientRect();
    // Модель хранится в CSS-пикселях; DPR применяется только при растеризации.
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const applyGesture = (point: Point2D) => {
    const gesture = gestureRef.current;
    if (!gesture) return;

    setShapes((current) => {
      const target = current.find((shape) => shape.id === gesture.shapeId);
      if (!target) return current;

      if (gesture.kind === 'move') {
        moveShapeFromStart(
          target,
          gesture.initialTransform,
          gesture.startPoint,
          point
        );
      } else if (gesture.kind === 'rotate') {
        rotateShapeFromStart(
          target,
          gesture.initialTransform,
          gesture.startPoint,
          point
        );
      } else if (gesture.kind === 'resize') {
        resizeShapeFromStart(
          target,
          gesture.initialTransform,
          gesture.localBounds,
          gesture.handle,
          point
        );
      } else {
        const localPoint = pointToLocal(gesture.initialTransform, point);
        if (localPoint && isEditableShape(target)) {
          target.setControlPoint(gesture.pointIndex, localPoint);
        }
      }

      return [...current];
    });
  };

  const queueGesturePoint = (point: Point2D) => {
    pendingPointRef.current = point;
    if (gestureRafRef.current !== 0) return;

    gestureRafRef.current = requestAnimationFrame(() => {
      gestureRafRef.current = 0;
      const pendingPoint = pendingPointRef.current;
      pendingPointRef.current = null;
      if (pendingPoint) applyGesture(pendingPoint);
    });
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const point = toScenePoint(event);

    if (tool !== 'select') {
      const created = createShape(tool, point);
      if (created) {
        setShapes((current) => [...current, created]);
        onSelect(created.id);
        onToolChange('select');
      }
      return;
    }

    const selected = shapesRef.current.find(
      (shape) => shape.id === selectedIdRef.current
    );

    if (selected) {
      const bounds = selected.getLocalBounds();

      if (isEditableShape(selected)) {
        const controls = selected.getControlPoints();
        const controlIndex = controls.findIndex((control) => {
          const devicePoint = selected.transformPointToDevice(control.x, control.y);
          return distance(devicePoint, point) <= HANDLE_HIT_RADIUS;
        });

        if (controlIndex >= 0) {
          gestureRef.current = {
            kind: 'control',
            pointerId: event.pointerId,
            shapeId: selected.id,
            initialTransform: { ...selected.transform },
            pointIndex: controlIndex,
          };
        }
      }

      if (!gestureRef.current) {
        const rotationLocal = getRotationHandleLocalPoint(bounds);
        const rotationPoint = selected.transformPointToDevice(
          rotationLocal.x,
          rotationLocal.y
        );
        if (distance(rotationPoint, point) <= HANDLE_HIT_RADIUS) {
          gestureRef.current = {
            kind: 'rotate',
            pointerId: event.pointerId,
            shapeId: selected.id,
            startPoint: point,
            initialTransform: { ...selected.transform },
          };
        }
      }

      if (!gestureRef.current) {
        const resizeHandle = RESIZE_HANDLES.find((handle) => {
          const localPoint = getResizeHandleLocalPoint(bounds, handle);
          const devicePoint = selected.transformPointToDevice(
            localPoint.x,
            localPoint.y
          );
          return distance(devicePoint, point) <= HANDLE_HIT_RADIUS;
        });

        if (resizeHandle) {
          gestureRef.current = {
            kind: 'resize',
            pointerId: event.pointerId,
            shapeId: selected.id,
            initialTransform: { ...selected.transform },
            localBounds: bounds,
            handle: resizeHandle,
          };
        }
      }
    }

    if (gestureRef.current) {
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const hit = findTopmostShapeAt(shapesRef.current, point, 8);
    onSelect(hit?.id ?? null);
    if (hit) {
      gestureRef.current = {
        kind: 'move',
        pointerId: event.pointerId,
        shapeId: hit.id,
        startPoint: point,
        initialTransform: { ...hit.transform },
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    queueGesturePoint(toScenePoint(event));
  };

  const finishGesture = (
    event: PointerEvent<HTMLCanvasElement>,
    applyFinalPoint: boolean
  ) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    if (applyFinalPoint) {
      const finalPoint = toScenePoint(event);
      pendingPointRef.current = finalPoint;
      if (gestureRafRef.current !== 0) {
        cancelAnimationFrame(gestureRafRef.current);
        gestureRafRef.current = 0;
      }
      pendingPointRef.current = null;
      applyGesture(finalPoint);
    } else {
      cancelAnimationFrame(gestureRafRef.current);
      gestureRafRef.current = 0;
      pendingPointRef.current = null;
    }

    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={containerRef}
      className='h-full w-full overflow-hidden bg-white'
    >
      <canvas
        ref={canvasRef}
        className='block h-full w-full touch-none'
        style={{
          cursor: tool === 'select' ? 'default' : 'crosshair',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishGesture(event, true)}
        onPointerCancel={(event) => finishGesture(event, false)}
        onLostPointerCapture={() => {
          gestureRef.current = null;
          pendingPointRef.current = null;
          cancelAnimationFrame(gestureRafRef.current);
          gestureRafRef.current = 0;
        }}
        aria-label='Холст редактора векторных объектов'
      />
    </div>
  );
}
