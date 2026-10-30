// src/lib/raster/RasterRenderer.ts
export type RGBA = { r: number; g: number; b: number; a: number };
export type LineAlg = 'bresenham' | 'wu';
type Pt = { x: number; y: number };

/** Ограничение значения до байта [0..255] */
export function clampByte(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** "#F00" | "#FF0000" | "#FF000080" -> RGBA */
export function hexToRGBA(hex: string, alpha = 255): RGBA {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3 || h.length === 4) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6 && h.length !== 8) {
    throw new Error(`Bad hex color: ${hex}`);
  }
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  const r = n(0), g = n(2), b = n(4);
  const a = h.length === 8 ? n(6) : alpha;
  if ([r, g, b, a].some(Number.isNaN)) throw new Error(`Bad hex color: ${hex}`);
  return { r, g, b, a: clampByte(a) };
}

const ipart = (x: number) => Math.floor(x);
const fpart = (x: number) => x - Math.floor(x);
const rfpart = (x: number) => 1 - fpart(x);

export class RasterRenderer {
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  private buf!: Uint8ClampedArray;

  width = 0;  // физические пиксели
  height = 0; // физические пиксели
  dpr = 1;

  private canvas: HTMLCanvasElement;
  private _onWindowResize: () => void;
  private lineAlg: LineAlg = 'bresenham';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    this.ctx = ctx;
    this._onWindowResize = () => this.resize();
    window.addEventListener('resize', this._onWindowResize);
    this.resize();
  }

  dispose() {
    window.removeEventListener('resize', this._onWindowResize);
  }

  setLineAlgorithm(a: LineAlg) { this.lineAlg = a; }
  getLineAlgorithm(): LineAlg { return this.lineAlg; }

  drawLine(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
    if (this.lineAlg === 'wu') this.drawLineWu(x0, y0, x1, y1, color);
    else this.drawLineBrassenham(x0, y0, x1, y1, color);
  }

  // ---------------- память / пиксели ----------------

  /** I = (y*W + x) * 4 */
  private idx(x: number, y: number): number {
    return (y * this.width + x) * 4;
  }

  setPixel(x: number, y: number, color: RGBA) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = this.idx(x, y);
    this.buf[i] = color.r;
    this.buf[i + 1] = color.g;
    this.buf[i + 2] = color.b;
    this.buf[i + 3] = color.a;
  }

  /** Source-over, straight alpha (ImageData хранит не-premultiplied) */
  private blendPixel(x: number, y: number, color: RGBA, alphaFactor = 1) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const as = (color.a / 255) * alphaFactor;
    if (as <= 0) return;
    const i = this.idx(x, y);
    const b = this.buf;
    const ad = b[i + 3] / 255;
    const ao = as + ad * (1 - as);
    if (ao <= 0) return;
    const k = ad * (1 - as);
    b[i]     = clampByte((color.r * as + b[i] * k) / ao);
    b[i + 1] = clampByte((color.g * as + b[i + 1] * k) / ao);
    b[i + 2] = clampByte((color.b * as + b[i + 2] * k) / ao);
    b[i + 3] = clampByte(ao * 255);
  }

  // ---------------- жизненный цикл кадра ----------------

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = rect.width || this.canvas.clientWidth || 800;
    const cssH = rect.height || this.canvas.clientHeight || 600;
    const w = Math.max(1, Math.round(cssW * this.dpr));
    const h = Math.max(1, Math.round(cssH * this.dpr));
    if (w === this.width && h === this.height && this.imageData) return;

    this.width = w;
    this.height = h;
    this.canvas.width = w;   // физический размер буфера
    this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = false;
    this.imageData = this.ctx.createImageData(w, h);
    this.buf = this.imageData.data;
  }

  beginFrame(clear = true) {
    if (clear) this.buf.fill(0);
  }

  commit() {
    if (this.imageData) this.ctx.putImageData(this.imageData, 0, 0);
  }

  // ---------------- линии ----------------

  drawLineBrassenham(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.setPixel(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  drawLineWu(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
    const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    if (steep) { [x0, y0] = [y0, x0]; [x1, y1] = [y1, x1]; }
    if (x0 > x1) { [x0, x1] = [x1, x0]; [y0, y1] = [y1, y0]; }

    const plot = (x: number, y: number, a: number) =>
      steep ? this.blendPixel(y, x, color, a) : this.blendPixel(x, y, color, a);

    const dx = x1 - x0;
    const dy = y1 - y0;
    const gradient = dx === 0 ? 1 : dy / dx;

    // первый конец
    let xend = Math.round(x0);
    let yend = y0 + gradient * (xend - x0);
    let xgap = rfpart(x0 + 0.5);
    const xpxl1 = xend;
    const ypxl1 = ipart(yend);
    plot(xpxl1, ypxl1, rfpart(yend) * xgap);
    plot(xpxl1, ypxl1 + 1, fpart(yend) * xgap);
    let intery = yend + gradient;

    // второй конец
    xend = Math.round(x1);
    yend = y1 + gradient * (xend - x1);
    xgap = fpart(x1 + 0.5);
    const xpxl2 = xend;
    const ypxl2 = ipart(yend);
    plot(xpxl2, ypxl2, rfpart(yend) * xgap);
    plot(xpxl2, ypxl2 + 1, fpart(yend) * xgap);

    // середина
    for (let x = xpxl1 + 1; x < xpxl2; x++) {
      plot(x, ipart(intery), rfpart(intery));
      plot(x, ipart(intery) + 1, fpart(intery));
      intery += gradient;
    }
  }

  // ---------------- заливка ----------------

  /** Заполняет пиксели y, x0..x1 включительно */
  private drawHSpan(y: number, x0: number, x1: number, color: RGBA) {
    y = Math.floor(y);
    if (y < 0 || y >= this.height) return;
    x0 = Math.floor(x0);
    x1 = Math.floor(x1);
    if (x0 > x1) [x0, x1] = [x1, x0];
    x0 = Math.max(0, x0);
    x1 = Math.min(this.width - 1, x1);
    if (x0 > x1) return;

    if (color.a === 255) {
      let i = this.idx(x0, y);
      for (let x = x0; x <= x1; x++, i += 4) {
        this.buf[i] = color.r;
        this.buf[i + 1] = color.g;
        this.buf[i + 2] = color.b;
        this.buf[i + 3] = 255;
      }
    } else {
      for (let x = x0; x <= x1; x++) this.blendPixel(x, y, color);
    }
  }

  fillPolygon(points: Pt[], color: RGBA) {
    const n = points.length;
    if (n < 3) return;
    let minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const yStart = Math.max(0, Math.floor(minY));
    const yEnd = Math.min(this.height - 1, Math.ceil(maxY));

    const xs: number[] = [];
    for (let y = yStart; y <= yEnd; y++) {
      const sy = y + 0.5; // центр пикселя
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const a = points[i];
        const b = points[(i + 1) % n];
        if ((a.y <= sy && b.y > sy) || (b.y <= sy && a.y > sy)) {
          const t = (sy - a.y) / (b.y - a.y);
          xs.push(a.x + t * (b.x - a.x));
        }
      }
      xs.sort((p, q) => p - q);
      // even-odd: пары (0,1), (2,3), ...
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.ceil(xs[k] - 0.5);
        const xb = Math.ceil(xs[k + 1] - 0.5) - 1;
        if (xa <= xb) this.drawHSpan(y, xa, xb, color);
      }
    }
  }

  fillCircle(cx: number, cy: number, radius: number, color: RGBA) {
    if (radius <= 0) return;
    const yStart = Math.max(0, Math.ceil(cy - radius - 0.5));
    const yEnd = Math.min(this.height - 1, Math.floor(cy + radius - 0.5));
    for (let y = yStart; y <= yEnd; y++) {
      const dy = y + 0.5 - cy;
      const d2 = radius * radius - dy * dy;
      if (d2 < 0) continue;
      const dx = Math.sqrt(d2);
      const xa = Math.ceil(cx - dx - 0.5);
      const xb = Math.floor(cx + dx - 0.5);
      if (xa <= xb) this.drawHSpan(y, xa, xb, color);
    }
  }

  // ---------------- контуры ----------------

  /** Прямоугольник-«тело» толстого отрезка (без шапок) */
  private strokeBody(x0: number, y0: number, x1: number, y1: number, color: RGBA, width: number) {
    const vx = x1 - x0, vy = y1 - y0;
    const L = Math.hypot(vx, vy);
    if (L < 1e-9) return;
    const half = width / 2;
    const nx = (-vy / L) * half;
    const ny = (vx / L) * half;
    this.fillPolygon(
      [
        { x: x0 + nx, y: y0 + ny },
        { x: x1 + nx, y: y1 + ny },
        { x: x1 - nx, y: y1 - ny },
        { x: x0 - nx, y: y0 - ny },
      ],
      color
    );
  }

  strokeLine(x0: number, y0: number, x1: number, y1: number, color: RGBA, width = 1) {
    if (width <= 1) {
      this.drawLine(x0, y0, x1, y1, color);
      return;
    }
    this.strokeBody(x0, y0, x1, y1, color, width);
    this.fillCircle(x0, y0, width / 2, color);
    this.fillCircle(x1, y1, width / 2, color);
  }

  strokePolygon(points: Pt[], color: RGBA, width = 1, closed = true) {
    const n = points.length;
    if (n < 2) return;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      if (width <= 1) this.drawLine(a.x, a.y, b.x, b.y, color);
      else this.strokeBody(a.x, a.y, b.x, b.y, color, width);
    }
    if (width > 1) {
      for (const p of points) this.fillCircle(p.x, p.y, width / 2, color); // круглые стыки
    }
  }
}
