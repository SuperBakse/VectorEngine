// src/lib/shapes/types.ts
import type { RasterRenderer } from '../raster/RasterRenderer';

/** Положение фигуры: x, y — смещение, rotation — радианы, scaleX/scaleY — масштаб */
export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/** Ограничивающий прямоугольник (AABB) */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ShapeStyle {
  /** '#RGB' | '#RRGGBB' | '#RRGGBBAA'; null — без заливки */
  fillStyle: string | null;
  fillOpacity: number; // 0..1
  /** null — без обводки */
  strokeStyle: string | null;
  strokeWidth: number; // физические пиксели
  strokeOpacity: number; // 0..1
}

/** Часть RasterRenderer, которая нужна фигурам (удобно мокать в тестах) */
export type RasterTarget = Pick<RasterRenderer, 'fillPolygon' | 'strokePolygon' | 'strokeLine'>;

export interface ShapeJSON {
  type: string;
  id: string;
  transform: Transform;
  style: ShapeStyle;
  geometry: Record<string, number>;
}