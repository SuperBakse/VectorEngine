import {
  CubicBezier,
  Line,
  QuadraticBezier,
  Oval,
  PathBezier,
  Rect,
  Triangle,
  type Shape,
  type ShapeJSON,
  type ShapeStyle,
} from "./shapes";
import type { Point2D } from "./math/mat3";

export interface Project {
  id: string;
  name: string;
  date: string;
  shapes: ShapeJSON[];
}

const STORAGE_KEY = "vectorengine.projects";

export function getProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value as Project[] : [];
  } catch {
    return [];
  }
}

export function saveProject(project: Project): void {
  const projects = getProjects();
  const index = projects.findIndex((item) => item.id === project.id);
  if (index >= 0) projects[index] = project;
  else projects.unshift(project);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function getProject(id: string): Project | undefined {
  return getProjects().find((project) => project.id === id);
}

export function createProject(id: string, name: string, shapes: ShapeJSON[] = []): Project {
  const project: Project = {
    id,
    name,
    date: new Date().toLocaleDateString("ru-RU"),
    shapes,
  };
  saveProject(project);
  return project;
}

export function restoreShapes(data: ShapeJSON[]): Shape[] {
  return data.map((item) => {
    const g = item.geometry as Record<string, unknown>;
    const style = item.style as Partial<ShapeStyle>;
    const point = (v: unknown): Point2D => v as Point2D;
    let shape: Shape;
    switch (item.type) {
      case "rect":
        shape = new Rect(0, 0, Number(g.w), Number(g.h), style);
        break;
      case "oval":
        shape = new Oval(0, 0, Number(g.rx), Number(g.ry), style);
        break;
      case "line": {
        const line = new Line(0, 0, 0, 0, style);
        line.ax = Number(g.ax);
        line.ay = Number(g.ay);
        line.bx = Number(g.bx);
        line.by = Number(g.by);
        shape = line;
        break;
      }
      case "triangle": {
        const vertices = g.vertices as Point2D[];
        shape = new Triangle(point(vertices[0]), point(vertices[1]), point(vertices[2]), style);
        break;
      }
      case "cubic-bezier": {
        const points = g.controlPoints as Point2D[];
        shape = new CubicBezier(point(points[0]), point(points[1]), point(points[2]), point(points[3]), style);
        break;
      }
      case "quadratic-bezier": {
        const points = g.controlPoints as Point2D[];
        shape = new QuadraticBezier(point(points[0]), point(points[1]), point(points[2]), style);
        break;
      }
      case "path-bezier":
        shape = new PathBezier(
          (g.anchors as Point2D[]).map(point),
          g.mode as "polyline" | "bezier" | "catmull",
          Boolean(g.closed),
          style,
        );
        break;
      default:
        throw new Error(`Неподдерживаемый тип фигуры: ${item.type}`);
    }
    shape.transform = { ...item.transform };
    return shape;
  });
}

