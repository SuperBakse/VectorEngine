// src/components/CanvasScene.tsx
import { useEffect, useRef } from 'react';
import { RasterRenderer, type LineAlg, type RGBA } from '../lib/raster/RasterRenderer';
import { Line, Oval, Rect, type Shape } from '../lib/shapes';

interface CanvasSceneProps {
  lineAlg: LineAlg;
}

const RED: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 255 };
const BLUE: RGBA = { r: 0, g: 0, b: 255, a: 255 };
const RED_HALF: RGBA = { r: 255, g: 0, b: 0, a: 128 };
const GREEN: RGBA = { r: 0, g: 150, b: 0, a: 255 };

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

    // ЛР5: фигуры, объявленные через классы
    const demoRect = new Rect(1250, 200, 200, 120, { fillStyle: '#ef4444', fillOpacity: 0.7, strokeWidth: 6 });
    demoRect.transform.rotation = Math.PI / 8;
    const shapes: Shape[] = [
      demoRect,
      new Line(1100, 360, 1400, 420, { strokeStyle: '#16a34a', strokeWidth: 8 }),
      new Oval(1250, 560, 140, 70, { fillStyle: '#8b5cf6', fillOpacity: 0.5, strokeStyle: '#1e1b4b', strokeWidth: 4 }),
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

        // 2. Прозрачность: полупрозрачный красный круг на синем квадрате
        const sq = [
          { x: 700, y: 100 }, { x: 1000, y: 100 },
          { x: 1000, y: 400 }, { x: 700, y: 400 },
        ];
        r.fillPolygon(sq, BLUE);
        r.fillCircle(850, 250, 120, RED_HALF);

        // 3. Толстая ломаная (открытая)
        r.strokePolygon(
          [{ x: 700, y: 500 }, { x: 800, y: 650 }, { x: 900, y: 520 }, { x: 1000, y: 700 }],
          GREEN, 20, false
        );

        // 4. Тонкие линии для сравнения Брезенхем/Ву
        for (let i = 0; i < 8; i++) {
          r.drawLine(300, 650, 600, 650 + i * 12 - 40, BLACK);
        }

        // 5. ЛР5: Shape-фигуры (Rect вращается для наглядности transform)
        demoRect.transform.rotation += 0.01;
        for (const s of shapes) s.drawRaster(r);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
};

export default CanvasScene;