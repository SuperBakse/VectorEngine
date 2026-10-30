import type { RasterRenderer } from '../raster/RasterRenderer';

export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ShapeStyle {
  fillStyle: string | null;
  fillOpacity: number;
  strokeStyle: string | null;
  strokeWidth: number;
  strokeOpacity: number;
}

export type RasterTarget = Pick<
  RasterRenderer,
  'fillPolygon' | 'strokePolygon' | 'strokeLine'
>;

export interface ShapeJSON {
  type: string;
  id: string;
  transform: Transform;
  style: ShapeStyle;
  geometry: Record<string, unknown>;
}