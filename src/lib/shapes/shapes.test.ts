// src/lib/shapes/shapes.test.ts
import { describe, expect, it, vi } from 'vitest';
import { Rect, Line, Oval, Triangle, CubicBezier, QuadraticBezier, Shape } from './index';
import type { RasterTarget } from './types';

function mockTarget() {
  return { fillPolygon: vi.fn(), strokePolygon: vi.fn(), strokeLine: vi.fn() };
}
const asTarget = (t: ReturnType<typeof mockTarget>) => t as unknown as RasterTarget;

describe('Shape: общая логика', () => {
  it('прямое и обратное преобразование координат согласованы', () => {
    const s = new Rect(30, 40, 10, 10);
    s.transform.rotation = 0.7;
    s.transform.scaleX = 2;
    s.transform.scaleY = 3;
    const d = s.transformPointToDevice(5, -2);
    const l = s.transformPointToLocal(d.x, d.y)!;
    expect(l.x).toBeCloseTo(5, 9);
    expect(l.y).toBeCloseTo(-2, 9);
  });

  it('вырожденная матрица: hitTest не падает и возвращает false', () => {
    const s = new Rect(0, 0, 10, 10);
    s.transform.scaleX = 0;
    expect(s.transformPointToLocal(1, 1)).toBeNull();
    expect(s.hitTest(0, 0)).toBe(false);
  });

  it('getCenter: центр повернутого прямоугольника = его позиция', () => {
    const s = new Rect(100, 50, 80, 40);
    s.transform.rotation = 1.1;
    const c = s.getCenter();
    expect(c.x).toBeCloseTo(100, 9);
    expect(c.y).toBeCloseTo(50, 9);
  });

  it('setBounds для Rect без поворота', () => {
    const s = new Rect(0, 0, 80, 40);
    s.setBounds(20, 10, 120, 90);
    const b = s.getBounds();
    expect(b.minX).toBeCloseTo(20, 9);
    expect(b.minY).toBeCloseTo(10, 9);
    expect(b.maxX).toBeCloseTo(120, 9);
    expect(b.maxY).toBeCloseTo(90, 9);
    const c = s.getCenter();
    expect(c.x).toBeCloseTo(70, 9);
    expect(c.y).toBeCloseTo(50, 9);
  });

  it('setBounds для Rect, повернутого на 90°', () => {
    const s = new Rect(0, 0, 80, 40);
    s.transform.rotation = Math.PI / 2;
    s.setBounds(20, 10, 120, 90);
    const b = s.getBounds();
    expect(b.minX).toBeCloseTo(20, 6);
    expect(b.minY).toBeCloseTo(10, 6);
    expect(b.maxX).toBeCloseTo(120, 6);
    expect(b.maxY).toBeCloseTo(90, 6);
  });

  it('setBounds для Oval и горизонтальной Line (нулевая высота)', () => {
    const o = new Oval(0, 0, 50, 25);
    o.setBounds(0, 0, 200, 100);
    const ob = o.getBounds();
    expect(ob.maxX - ob.minX).toBeCloseTo(200, 6);
    expect(ob.maxY - ob.minY).toBeCloseTo(100, 6);
    expect(ob.minX).toBeCloseTo(0, 6);

    const l = new Line(0, 0, 100, 0);
    l.setBounds(10, 10, 60, 10);
    const lb = l.getBounds();
    expect(lb.minX).toBeCloseTo(10, 6);
    expect(lb.maxX).toBeCloseTo(60, 6);
    expect(lb.minY).toBeCloseTo(10, 6);
    expect(lb.maxY).toBeCloseTo(10, 6);
  });

  it('clone: независимая копия с новым id', () => {
    const s = new Rect(10, 20, 30, 40, { fillStyle: '#ff0000' });
    s.transform.rotation = 0.5;
    const c = s.clone();
    expect(c).toBeInstanceOf(Rect);
    expect(c.id).not.toBe(s.id);
    expect(c.transform).toEqual(s.transform);
    expect(c.fillStyle).toBe('#ff0000');
    c.transform.x = 999;
    c.w = 1;
    expect(s.transform.x).toBe(10);
    expect(s.w).toBe(30);
    expect(c.getBounds()).not.toEqual(s.getBounds());
  });

  it('clone для Line и Oval сохраняет геометрию', () => {
    const l = new Line(10, 20, 30, 60);
    const lc = l.clone();
    expect(lc.getBounds()).toEqual(l.getBounds());
    const o = new Oval(200, 100, 60, 30);
    expect(o.clone().getBounds()).toEqual(o.getBounds());
  });

  it('toJSON и уникальность id', () => {
    const a = new Rect(0, 0, 80, 40);
    const b = new Rect(0, 0, 80, 40);
    expect(a.id).not.toBe(b.id);
    const j = a.toJSON();
    expect(j.type).toBe('rect');
    expect(j.geometry).toEqual({ w: 80, h: 40 });
    expect(j.transform).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
  });
});

describe('Rect', () => {
  it('hitTest: пример 80×40, точка (10, -5) внутри', () => {
    const r = new Rect(0, 0, 80, 40);
    expect(r.hitTest(10, -5)).toBe(true);
    expect(r.hitTest(41, 0)).toBe(false);
    expect(r.hitTest(0, 21)).toBe(false);
    expect(r.hitTest(40, 20)).toBe(true); // граница
  });

  it('hitTest с масштабом и смещением', () => {
    const r = new Rect(100, 50, 80, 40);
    r.transform.scaleX = 2;
    r.transform.scaleY = 1.5;
    expect(r.hitTest(179, 50)).toBe(true);
    expect(r.hitTest(181, 50)).toBe(false);
    expect(r.hitTest(100, 79)).toBe(true);
    expect(r.hitTest(100, 81)).toBe(false);
  });

  it('hitTest с поворотом на 90°', () => {
    const r = new Rect(0, 0, 80, 40);
    r.transform.rotation = Math.PI / 2;
    expect(r.hitTest(0, 30)).toBe(true); // теперь длинная сторона вдоль Y
    expect(r.hitTest(30, 0)).toBe(false);
  });

  it('getBounds: пример из лабораторной (20,10)-(120,90)', () => {
    const b = new Rect(70, 50, 100, 80).getBounds();
    expect(b).toEqual({ minX: 20, minY: 10, maxX: 120, maxY: 90 });
  });

  it('getBounds при повороте на 45° и 90°', () => {
    const a = new Rect(0, 0, 100, 100);
    a.transform.rotation = Math.PI / 4;
    const ba = a.getBounds();
    expect(ba.maxX).toBeCloseTo(50 * Math.SQRT2, 9);
    expect(ba.minY).toBeCloseTo(-50 * Math.SQRT2, 9);

    const b = new Rect(0, 0, 80, 40);
    b.transform.rotation = Math.PI / 2;
    const bb = b.getBounds();
    expect(bb.minX).toBeCloseTo(-20, 9);
    expect(bb.maxX).toBeCloseTo(20, 9);
    expect(bb.minY).toBeCloseTo(-40, 9);
    expect(bb.maxY).toBeCloseTo(40, 9);
  });

  it('getLocalBounds', () => {
    expect(new Rect(5, 5, 80, 40).getLocalBounds()).toEqual({ minX: -40, minY: -20, maxX: 40, maxY: 20 });
  });

  it('drawRaster: заливка и обводка в экранных координатах', () => {
    const t = mockTarget();
    new Rect(100, 50, 80, 40, { fillStyle: '#ff0000', fillOpacity: 0.5, strokeWidth: 2 }).drawRaster(asTarget(t));
    expect(t.fillPolygon).toHaveBeenCalledTimes(1);
    const [pts, color] = t.fillPolygon.mock.calls[0];
    expect(pts).toHaveLength(4);
    expect(pts[0].x).toBeCloseTo(60, 9);
    expect(pts[0].y).toBeCloseTo(30, 9);
    expect(pts[2].x).toBeCloseTo(140, 9);
    expect(pts[2].y).toBeCloseTo(70, 9);
    expect(color).toEqual({ r: 255, g: 0, b: 0, a: 128 });
    expect(t.strokePolygon).toHaveBeenCalledTimes(1);
    expect(t.strokePolygon.mock.calls[0][2]).toBe(2);
  });

  it('drawRaster: без заливки/обводки ничего лишнего не рисуется', () => {
    const t = mockTarget();
    new Rect(0, 0, 10, 10, { fillStyle: null, strokeStyle: null }).drawRaster(asTarget(t));
    expect(t.fillPolygon).not.toHaveBeenCalled();
    expect(t.strokePolygon).not.toHaveBeenCalled();
  });
});

describe('Line', () => {
  it('хранится относительно середины', () => {
    const l = new Line(0, 0, 100, 0);
    expect(l.transform.x).toBe(50);
    expect(l.transform.y).toBe(0);
    expect(l.getLocalBounds()).toEqual({ minX: -50, minY: 0, maxX: 50, maxY: 0 });
    expect(l.getCenter()).toEqual({ x: 50, y: 0 });
  });

  it('hitTest: пример из лабораторной', () => {
    const l = new Line(0, 0, 100, 0);
    expect(l.hitTest(50, 2)).toBe(true);
    expect(l.hitTest(50, 20)).toBe(false);
    expect(l.hitTest(0, 0)).toBe(true);
    expect(l.hitTest(-10, 0)).toBe(false); // за концом отрезка
    expect(l.hitTest(110, 0)).toBe(false);
  });

  it('hitTest: порог зависит от толщины и tolerance', () => {
    const thick = new Line(0, 0, 100, 0, { strokeWidth: 20 });
    expect(thick.hitTest(50, 8)).toBe(true);
    expect(thick.hitTest(50, 12)).toBe(false);
    const l = new Line(0, 0, 100, 0);
    expect(l.hitTest(50, 10, 12)).toBe(true);
  });

  it('hitTest и bounds для повернутой линии', () => {
    const l = new Line(0, 0, 100, 0);
    l.transform.rotation = Math.PI / 2; // вокруг середины (50, 0) -> вертикальная
    expect(l.hitTest(52, 0)).toBe(true);
    expect(l.hitTest(0, 0)).toBe(false);
    const b = l.getBounds();
    expect(b.minX).toBeCloseTo(50, 9);
    expect(b.maxX).toBeCloseTo(50, 9);
    expect(b.minY).toBeCloseTo(-50, 9);
    expect(b.maxY).toBeCloseTo(50, 9);
  });

  it('getBounds по двум концам', () => {
    const b = new Line(10, 20, 30, 60).getBounds();
    expect(b.minX).toBeCloseTo(10, 9);
    expect(b.minY).toBeCloseTo(20, 9);
    expect(b.maxX).toBeCloseTo(30, 9);
    expect(b.maxY).toBeCloseTo(60, 9);
  });

  it('drawRaster вызывает strokeLine с экранными концами', () => {
    const t = mockTarget();
    new Line(0, 0, 100, 0).drawRaster(asTarget(t));
    expect(t.strokeLine).toHaveBeenCalledTimes(1);
    const [x0, y0, x1, y1, color, width] = t.strokeLine.mock.calls[0];
    expect(x0).toBeCloseTo(0, 9);
    expect(y0).toBeCloseTo(0, 9);
    expect(x1).toBeCloseTo(100, 9);
    expect(y1).toBeCloseTo(0, 9);
    expect(color).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    expect(width).toBe(2);
  });
});

describe('Oval', () => {
  it('hitTest: примеры из лабораторной (rx=100, ry=50)', () => {
    const o = new Oval(0, 0, 100, 50);
    expect(o.hitTest(50, 25)).toBe(true); // 0.5 <= 1
    expect(o.hitTest(120, 60)).toBe(false); // 2.88 > 1
    expect(o.hitTest(100, 0)).toBe(true); // граница
    expect(o.hitTest(0, 50)).toBe(true);
    expect(o.hitTest(0, 51)).toBe(false);
  });

  it('hitTest с масштабом, смещением и поворотом', () => {
    const s = new Oval(0, 0, 50, 25);
    s.transform.scaleX = 2;
    expect(s.hitTest(99, 0)).toBe(true);
    expect(s.hitTest(101, 0)).toBe(false);

    const r = new Oval(0, 0, 60, 30);
    r.transform.rotation = Math.PI / 2;
    expect(r.hitTest(0, 55)).toBe(true);
    expect(r.hitTest(55, 0)).toBe(false);
  });

  it('вырожденный радиус: попадания нет', () => {
    expect(new Oval(0, 0, 0, 10).hitTest(0, 0)).toBe(false);
  });

  it('getBounds: Oval(200, 100, 60, 30) -> (140,70)-(260,130)', () => {
    const b = new Oval(200, 100, 60, 30).getBounds();
    expect(b.minX).toBeCloseTo(140, 9);
    expect(b.maxX).toBeCloseTo(260, 9);
    expect(b.minY).toBeCloseTo(70, 9);
    expect(b.maxY).toBeCloseTo(130, 9);
  });

  it('getBounds при повороте на 90° и 45° (круг)', () => {
    const a = new Oval(0, 0, 60, 30);
    a.transform.rotation = Math.PI / 2;
    const ba = a.getBounds();
    expect(ba.maxX).toBeCloseTo(30, 9);
    expect(ba.maxY).toBeCloseTo(60, 9);

    const c = new Oval(0, 0, 50, 50);
    c.transform.rotation = Math.PI / 4;
    expect(c.getBounds().maxX).toBeCloseTo(50, 9);
  });

  it('точки контура лежат на эллипсе и покрывают границы', () => {
    const t = mockTarget();
    new Oval(200, 100, 60, 30).drawRaster(asTarget(t));
    const pts = t.fillPolygon.mock.calls[0][0] as { x: number; y: number }[];
    expect(pts.length).toBeGreaterThanOrEqual(32);
    for (const p of pts) {
      const v = ((p.x - 200) / 60) ** 2 + ((p.y - 100) / 30) ** 2;
      expect(v).toBeCloseTo(1, 9);
    }
    const xs = pts.map((p) => p.x);
    expect(Math.max(...xs)).toBeCloseTo(260, 6);
    expect(Math.min(...xs)).toBeCloseTo(140, 6);
  });
});

describe('Заглушки части 2', () => {
  it('Triangle / Bezier — наследники Shape и пока не реализованы', () => {
    for (const s of [new Triangle(), new QuadraticBezier(), new CubicBezier()]) {
      expect(s).toBeInstanceOf(Shape);
      expect(() => s.getBounds()).toThrow(/not implemented/);
    }
  });
});