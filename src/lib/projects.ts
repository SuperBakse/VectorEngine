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
    const geometry = item.geometry as Record<string, unknown>;
    const style = item.style as Partial<ShapeStyle>;
    const point = (value: unknown): Point2D => {
      const candidate = value as Point2D;
      if (
        !candidate ||
        !Number.isFinite(candidate.x) ||
        !Number.isFinite(candidate.y)
      ) {
        throw new Error("Некорректные координаты фигуры");
      }
      return { x: candidate.x, y: candidate.y };
    };

    let shape: Shape;
    switch (item.type) {
      case "rect":
        shape = new Rect(0, 0, Number(geometry.w), Number(geometry.h), style);
        break;
      case "oval":
        shape = new Oval(0, 0, Number(geometry.rx), Number(geometry.ry), style);
        break;
      case "line": {
        const line = new Line(0, 0, 0, 0, style);
        line.ax = Number(geometry.ax);
        line.ay = Number(geometry.ay);
        line.bx = Number(geometry.bx);
        line.by = Number(geometry.by);
        shape = line;
        break;
      }
      case "triangle": {
        const vertices = geometry.vertices as Point2D[];
        if (!Array.isArray(vertices) || vertices.length !== 3) {
          throw new Error("Некорректные вершины треугольника");
        }
        const triangle = new Triangle(
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          style,
        );
        vertices.forEach((vertex, index) => triangle.setControlPoint(index, point(vertex)));
        shape = triangle;
        break;
      }
      case "cubic-bezier": {
        const points = geometry.controlPoints as Point2D[];
        if (!Array.isArray(points) || points.length !== 4) {
          throw new Error("Некорректные контрольные точки кубической кривой");
        }
        const curve = new CubicBezier(
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          style,
        );
        points.forEach((controlPoint, index) => curve.setControlPoint(index, point(controlPoint)));
        shape = curve;
        break;
      }
      case "quadratic-bezier": {
        const points = geometry.controlPoints as Point2D[];
        if (!Array.isArray(points) || points.length !== 3) {
          throw new Error("Некорректные контрольные точки квадратичной кривой");
        }
        const curve = new QuadraticBezier(
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          style,
        );
        points.forEach((controlPoint, index) => curve.setControlPoint(index, point(controlPoint)));
        shape = curve;
        break;
      }
      case "path-bezier": {
        const anchors = geometry.anchors as Point2D[];
        if (!Array.isArray(anchors)) {
          throw new Error("Некорректные узлы кривой");
        }
        const path = new PathBezier(
          [],
          geometry.mode as "polyline" | "bezier" | "catmull",
          Boolean(geometry.closed),
          style,
        );
        anchors.forEach((anchor) => path.addPointLocal(point(anchor)));
        shape = path;
        break;
      }
      default:
        throw new Error(`Неподдерживаемый тип фигуры: ${item.type}`);
    }

    shape.transform = { ...item.transform };
    return shape;
  });
}
