import { useEffect, useRef } from 'react';

import {
  RasterRenderer,
  type LineAlg,
  type RGBA,
} from '../lib/raster/RasterRenderer';

import {
  Line,
  Oval,
  Rect,
  Triangle,
  QuadraticBezier,
  CubicBezier,
  PathBezier,
  type Shape,
} from '../lib/shapes';

interface CanvasSceneProps {
  lineAlg: LineAlg;
}

const RED: RGBA = {
  r: 255,
  g: 0,
  b: 0,
  a: 255,
};

const BLACK: RGBA = {
  r: 0,
  g: 0,
  b: 0,
  a: 255,
};

const BLUE: RGBA = {
  r: 0,
  g: 0,
  b: 255,
  a: 255,
};

const RED_HALF: RGBA = {
  r: 255,
  g: 0,
  b: 0,
  a: 128,
};

const GREEN: RGBA = {
  r: 0,
  g: 150,
  b: 0,
  a: 255,
};

const CanvasScene = ({ lineAlg }: CanvasSceneProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<RasterRenderer | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    rendererRef.current?.setLineAlgorithm(lineAlg);
  }, [lineAlg]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const renderer = new RasterRenderer(canvas);

    renderer.setLineAlgorithm(lineAlg);

    rendererRef.current = renderer;

    const ro = new ResizeObserver(() => renderer.resize());

    ro.observe(containerRef.current ?? canvas);

    // ЛР5: базовые фигуры
    const demoRect = new Rect(
      1250,
      200,
      200,
      120,
      {
        fillStyle: '#ef4444',
        fillOpacity: 0.7,
        strokeWidth: 6,
      }
    );

    demoRect.transform.rotation = Math.PI / 8;

    // ЛР6: новые геометрические фигуры
    const shapes: Shape[] = [
      demoRect,

      new Line(
        1100,
        360,
        1400,
        420,
        {
          strokeStyle: '#16a34a',
          strokeWidth: 8,
        }
      ),

      new Oval(
        1250,
        560,
        140,
        70,
        {
          fillStyle: '#8b5cf6',
          fillOpacity: 0.5,
          strokeStyle: '#1e1b4b',
          strokeWidth: 4,
        }
      ),

      new Triangle(
        { x: 50, y: 220 },
        { x: 170, y: 220 },
        { x: 110, y: 340 },
        {
          fillStyle: '#f59e0b',
          strokeStyle: '#92400e',
          strokeWidth: 3,
        }
      ),

      new QuadraticBezier(
        { x: 220, y: 320 },
        { x: 300, y: 150 },
        { x: 380, y: 320 },
        {
          fillStyle: null,
          strokeStyle: '#2563eb',
          strokeWidth: 4,
        }
      ),

      new CubicBezier(
        { x: 420, y: 300 },
        { x: 470, y: 150 },
        { x: 560, y: 420 },
        { x: 650, y: 260 },
        {
          fillStyle: null,
          strokeStyle: '#dc2626',
          strokeWidth: 4,
        }
      ),

      new PathBezier(
        [
          { x: 100, y: 430 },
          { x: 200, y: 490 },
          { x: 300, y: 420 },
          { x: 400, y: 500 },
          { x: 500, y: 430 },
        ],
        'catmull',
        false,
        {
          fillStyle: null,
          strokeStyle: '#16a34a',
          strokeWidth: 4,
        }
      ),
    ];

    let raf = 0;

    const frame = () => {
      const r = rendererRef.current;

      if (r) {
        r.beginFrame(true);

        // 1. Полигон + толстая обводка
        const tri = [
          { x: 100, y: 100 },
          { x: 600, y: 100 },
          { x: 50, y: 600 },
        ];

        r.fillPolygon(tri, RED);
        r.strokePolygon(tri, BLACK, 12 * r.dpr);

        // 2. Прозрачность
        const sq = [
          { x: 700, y: 100 },
          { x: 1000, y: 100 },
          { x: 1000, y: 400 },
          { x: 700, y: 400 },
        ];

        r.fillPolygon(sq, BLUE);
        r.fillCircle(850, 250, 120, RED_HALF);

        // 3. Толстая ломаная
        r.strokePolygon(
          [
            { x: 700, y: 500 },
            { x: 800, y: 650 },
            { x: 900, y: 520 },
            { x: 1000, y: 700 },
          ],
          GREEN,
          20,
          false
        );

        // 4. Линии Брезенхема / Ву
        for (let i = 0; i < 8; i++) {
          r.drawLine(
            300,
            650,
            600,
            650 + i * 12 - 40,
            BLACK
          );
        }

        // 5. Отрисовка всех фигур ЛР5 и ЛР6
        demoRect.transform.rotation += 0.01;

        for (const shape of shapes) {
          shape.drawRaster(r);
        }

        r.commit();
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};

export default CanvasScene;