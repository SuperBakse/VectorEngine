import { documentDir, join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { LineAlg } from "./raster/RasterRenderer";
import {
  CubicBezier,
  Line,
  Oval,
  PathBezier,
  QuadraticBezier,
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
  createdAt: string;
  updatedAt: string;
  lineAlg: LineAlg;
  shapes: ShapeJSON[];
}

export interface ProjectIndexItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lineAlg: LineAlg;
  shapeCount: number;
  fileName: string;
}

interface ExportedProject extends Partial<Project> {
  projectId?: string;
  exportedAt?: string;
}

const ROOT_FOLDER = "VectorEngine";
const PROJECTS_FOLDER = "projects";
const INDEX_FILE = "index.json";

async function projectsDirectory(): Promise<string> {
  return join(await documentDir(), ROOT_FOLDER, PROJECTS_FOLDER);
}

async function ensureProjectsDirectory(): Promise<string> {
  const directory = await projectsDirectory();
  await mkdir(directory, { recursive: true });
  return directory;
}

function safeFileName(id: string): string {
  return `project-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
}

async function readIndex(): Promise<ProjectIndexItem[]> {
  try {
    const directory = await projectsDirectory();
    const parsed: unknown = JSON.parse(await readTextFile(await join(directory, INDEX_FILE)));
    if (Array.isArray(parsed)) return parsed as ProjectIndexItem[];
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { projects?: unknown }).projects)) {
      return (parsed as { projects: ProjectIndexItem[] }).projects;
    }
    return [];
  } catch {
    return [];
  }
}

export async function loadProjectIndex(): Promise<ProjectIndexItem[]> {
  return (await readIndex()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const index = await readIndex();
  const entry = index.find((item) => item.id === id);
  const directory = await projectsDirectory();
  const fileName = entry?.fileName ?? safeFileName(id);
  try {
    const parsed: unknown = JSON.parse(await readTextFile(await join(directory, fileName)));
    if (!parsed || typeof parsed !== "object") return undefined;
    const project = parsed as Project;
    if (project.id !== id || !Array.isArray(project.shapes)) return undefined;
    return {
      ...project,
      lineAlg: project.lineAlg === "wu" ? "wu" : "bresenham",
      createdAt: project.createdAt ?? project.updatedAt ?? new Date().toISOString(),
      updatedAt: project.updatedAt ?? project.createdAt ?? new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

export async function saveProject(project: Project): Promise<Project> {
  const directory = await ensureProjectsDirectory();
  const now = new Date().toISOString();
  const existing = await loadProject(project.id);
  const saved: Project = {
    ...project,
    name: project.name.trim() || `Проект ${project.id}`,
    createdAt: project.createdAt || existing?.createdAt || now,
    updatedAt: now,
    lineAlg: project.lineAlg === "wu" ? "wu" : "bresenham",
    shapes: project.shapes,
  };
  const fileName = safeFileName(saved.id);
  await writeTextFile(await join(directory, fileName), JSON.stringify(saved, null, 2));

  const index = await readIndex();
  const item: ProjectIndexItem = {
    id: saved.id,
    name: saved.name,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
    lineAlg: saved.lineAlg,
    shapeCount: saved.shapes.length,
    fileName,
  };
  const next = [item, ...index.filter((entry) => entry.id !== saved.id)];
  await writeTextFile(await join(directory, INDEX_FILE), JSON.stringify({ projects: next }, null, 2));
  return saved;
}

export async function createProject(
  id: string,
  name: string,
  shapes: ShapeJSON[] = [],
): Promise<Project> {
  const now = new Date().toISOString();
  return saveProject({
    id,
    name,
    createdAt: now,
    updatedAt: now,
    lineAlg: "bresenham",
    shapes,
  });
}

export async function exportProjectFile(project: Project): Promise<boolean> {
  const directory = await ensureProjectsDirectory();
  const path = await save({
    title: "Экспорт проекта",
    defaultPath: await join(directory, `${project.name.replace(/[\\/:*?"<>|]/g, "_") || "project"}.json`),
    filters: [{ name: "JSON project", extensions: ["json"] }],
  });
  if (!path) return false;
  const exportData = { ...project, exportedAt: new Date().toISOString() };
  await writeTextFile(path, JSON.stringify(exportData, null, 2));
  return true;
}

export async function importProjectFile(): Promise<Project | undefined> {
  const selected = await open({
    title: "Импорт проекта из JSON",
    defaultPath: await projectsDirectory(),
    multiple: false,
    filters: [{ name: "JSON project", extensions: ["json"] }],
  });
  if (typeof selected !== "string") return undefined;

  const parsed: unknown = JSON.parse(await readTextFile(selected));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Файл не содержит корректный JSON-проект");
  }
  const raw = parsed as ExportedProject;
  if (!Array.isArray(raw.shapes)) {
    throw new Error("В JSON отсутствует массив фигур проекта");
  }
  const now = new Date().toISOString();
  const id = typeof raw.id === "string" && raw.id ? raw.id
    : typeof raw.projectId === "string" && raw.projectId ? raw.projectId
      : String(Date.now());
  return saveProject({
    id: `${id}-${Date.now()}`,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : `Импортированный проект ${id}`,
    createdAt: raw.createdAt ?? raw.exportedAt ?? now,
    updatedAt: now,
    lineAlg: raw.lineAlg === "wu" ? "wu" : "bresenham",
    shapes: raw.shapes as ShapeJSON[],
  });
}

export function restoreShapes(data: ShapeJSON[]): Shape[] {
  return data.map((item) => {
    const geometry = item.geometry as Record<string, unknown>;
    const style = item.style as Partial<ShapeStyle>;
    const point = (value: unknown): Point2D => {
      const candidate = value as Point2D;
      if (!candidate || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) {
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
        if (!Array.isArray(vertices) || vertices.length !== 3) throw new Error("Некорректные вершины треугольника");
        const triangle = new Triangle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, style);
        vertices.forEach((vertex, index) => triangle.setControlPoint(index, point(vertex)));
        shape = triangle;
        break;
      }
      case "cubic-bezier": {
        const points = geometry.controlPoints as Point2D[];
        if (!Array.isArray(points) || points.length !== 4) throw new Error("Некорректные контрольные точки кубической кривой");
        const curve = new CubicBezier({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, style);
        points.forEach((controlPoint, index) => curve.setControlPoint(index, point(controlPoint)));
        shape = curve;
        break;
      }
      case "quadratic-bezier": {
        const points = geometry.controlPoints as Point2D[];
        if (!Array.isArray(points) || points.length !== 3) throw new Error("Некорректные контрольные точки квадратичной кривой");
        const curve = new QuadraticBezier({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, style);
        points.forEach((controlPoint, index) => curve.setControlPoint(index, point(controlPoint)));
        shape = curve;
        break;
      }
      case "path-bezier": {
        const anchors = geometry.anchors as Point2D[];
        if (!Array.isArray(anchors)) throw new Error("Некорректные узлы кривой");
        const mode = geometry.mode;
        const path = new PathBezier([], mode === "bezier" || mode === "catmull" ? mode : "polyline", Boolean(geometry.closed), style);
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