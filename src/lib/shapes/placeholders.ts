// src/lib/shapes/placeholders.ts
// Заглушки для части 2 (Triangle, Quadratic/Cubic Bezier).
import { Shape } from './Shape';
import type { Bounds, RasterTarget } from './types';

const notImplemented = (name: string): never => {
  throw new Error(`${name}: not implemented (lab 5, part 2)`);
};

abstract class PlaceholderShape extends Shape {
  drawRaster(_r: RasterTarget): void {
    notImplemented(this.type);
  }
  hitTest(_px: number, _py: number): boolean {
    return notImplemented(this.type);
  }
  getBounds(): Bounds {
    return notImplemented(this.type);
  }
  getLocalBounds(): Bounds {
    return notImplemented(this.type);
  }
  protected geometryJSON(): Record<string, number> {
    return notImplemented(this.type);
  }
  protected cloneGeometry(): Shape {
    return notImplemented(this.type);
  }
}

export class Triangle extends PlaceholderShape {
  readonly type = 'triangle';
}

export class QuadraticBezier extends PlaceholderShape {
  readonly type = 'quadratic-bezier';
}

export class CubicBezier extends PlaceholderShape {
  readonly type = 'cubic-bezier';
}