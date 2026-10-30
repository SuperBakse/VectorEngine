import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Circle,
  FileDown,
  MousePointer2,
  Minus,
  PenLine,
  RotateCw,
  Save,
  Square,
  Trash2,
  Triangle,
} from "lucide-react";
import CanvasScene, { type EditorTool } from "../components/CanvasScene";
import { exportProjectFile, loadProject, restoreShapes, saveProject, type Project } from "../lib/projects";
import type { LineAlg } from "../lib/raster/RasterRenderer";
import type { Shape } from "../lib/shapes";

const TOOLS: {
  id: EditorTool;
  label: string;
  icon: typeof MousePointer2;
}[] = [
  { id: "select", label: "Выбор и перемещение", icon: MousePointer2 },
  { id: "rect", label: "Прямоугольник", icon: Square },
  { id: "oval", label: "Эллипс", icon: Circle },
  { id: "line", label: "Линия", icon: Minus },
  { id: "triangle", label: "Треугольник", icon: Triangle },
  { id: "path", label: "Кривая Безье", icon: PenLine },
];

function shapeLabel(shape: Shape): string {
  switch (shape.type) {
    case "rect":
      return "Прямоугольник";
    case "oval":
      return "Эллипс";
    case "line":
      return "Линия";
    case "triangle":
      return "Треугольник";
    case "quadratic-bezier":
      return "Квадратичная кривая";
    case "cubic-bezier":
      return "Кубическая кривая";
    case "path-bezier":
      return "Кривая / путь";
    default:
      return shape.type;
  }
}

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tool, setTool] = useState<EditorTool>("select");
  const [lineAlg, setLineAlg] = useState<LineAlg>("bresenham");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id) {
        setShapes([]);
        return;
      }
      try {
        const project = await loadProject(id);
        if (cancelled) return;
        if (!project) {
          setShapes([]);
          setLineAlg("bresenham");
          return;
        }
        setShapes(restoreShapes(project.shapes));
        setLineAlg(project.lineAlg ?? "bresenham");
      } catch {
        if (!cancelled) {
          setShapes([]);
          setSaveMessage("Не удалось загрузить проект");
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [id]);

  const selectedShape = shapes.find((shape) => shape.id === selectedId) ?? null;

  const updateSelected = (update: (shape: Shape) => void) => {
    if (!selectedId) return;
    setShapes((current) => {
      const shape = current.find((item) => item.id === selectedId);
      if (!shape) return current;
      update(shape);
      return [...current];
    });
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setShapes((current) => current.filter((shape) => shape.id !== selectedId));
    setSelectedId(null);
  };

  const moveLayer = (direction: -1 | 1) => {
    if (!selectedId) return;
    setShapes((current) => {
      const from = current.findIndex((shape) => shape.id === selectedId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  const saveToGallery = async () => {
    if (!id) return;
    try {
      const existing = await loadProject(id);
      const now = new Date().toISOString();
      await saveProject({
        id,
        name: existing?.name ?? `Проект ${id}`,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lineAlg,
        shapes: shapes.map((shape) => shape.toJSON()),
      });
      setSaveMessage("Проект сохранён в файл");
    } catch (error) {
      setSaveMessage(error instanceof Error ? `Ошибка сохранения: ${error.message}` : "Ошибка сохранения проекта");
    }
    window.setTimeout(() => setSaveMessage(""), 3500);
  };

  const exportProject = async () => {
    const now = new Date().toISOString();
    try {
      const existing = id ? await loadProject(id) : undefined;
      const project: Project = {
        id: id ?? String(Date.now()),
        name: existing?.name ?? `Проект ${id ?? ""}`,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lineAlg,
        shapes: shapes.map((shape) => shape.toJSON()),
      };
      const exported = await exportProjectFile(project);
      setSaveMessage(exported ? "JSON-файл экспортирован" : "Экспорт отменён");
    } catch (error) {
      setSaveMessage(error instanceof Error ? `Ошибка экспорта: ${error.message}` : "Ошибка экспорта JSON");
    }
    window.setTimeout(() => setSaveMessage(""), 3500);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        removeSelected();
      }
      if (event.key === "Escape") {
        setSelectedId(null);
        setTool("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId]);

  const selectedIndex = selectedId
    ? shapes.findIndex((shape) => shape.id === selectedId)
    : -1;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-slate-900">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 rounded bg-slate-800 px-3 py-1.5 transition-colors hover:bg-slate-700"
        >
          <ArrowLeft size={16} /> Назад
        </button>
        <div className="font-semibold">Редактор проекта №{id}</div>
        <div className="flex items-center gap-2">
          {saveMessage && <span role="status" className="text-xs text-emerald-300">{saveMessage}</span>}
          <button
            type="button"
            onClick={saveToGallery}
            className="flex items-center gap-2 rounded bg-emerald-700 px-3 py-1.5 transition-colors hover:bg-emerald-600"
            title="Сохранить проект в галерею"
          >
            <Save size={16} /> Сохранить
          </button>
          <button
            type="button"
            onClick={exportProject}
            className="flex items-center gap-2 rounded bg-blue-600 px-3 py-1.5 transition-colors hover:bg-blue-500"
            title="Экспортировать проект в JSON"
          >
            <FileDown size={16} /> Экспорт
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-slate-800 py-3">
          {TOOLS.map(({ id: toolId, icon: Icon, label }) => (
            <button
              key={toolId}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={tool === toolId}
              onClick={() => setTool(toolId)}
              className={`rounded-lg p-3 transition-colors ${
                tool === toolId
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Icon size={20} />
            </button>
          ))}
          <div className="mt-2 border-t border-slate-800 pt-3 text-center text-[10px] leading-4 text-slate-500">
            {tool === "select" ? "Выбор" : "Щёлкни по холсту"}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-slate-700 p-4">
          <div className="h-full w-full bg-white shadow-2xl">
            <CanvasScene
              lineAlg={lineAlg}
              shapes={shapes}
              setShapes={setShapes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              tool={tool}
              onToolChange={setTool}
            />
          </div>
        </main>

        <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-800 p-4">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Свойства
              </h2>
              {selectedShape && (
                <button
                  type="button"
                  onClick={removeSelected}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                  title="Удалить выбранный объект (Delete)"
                >
                  <Trash2 size={14} /> Удалить
                </button>
              )}
            </div>
            {selectedShape ? (
              <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                <div className="text-sm font-medium text-white">
                  {shapeLabel(selectedShape)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-400">
                    X
                    <input
                      type="number"
                      value={Number(selectedShape.transform.x.toFixed(1))}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) {
                          updateSelected((shape) => { shape.transform.x = value; });
                        }
                      }}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Y
                    <input
                      type="number"
                      value={Number(selectedShape.transform.y.toFixed(1))}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) {
                          updateSelected((shape) => { shape.transform.y = value; });
                        }
                      }}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
                    />
                  </label>
                </div>
                <label className="block text-xs text-slate-400">
                  Поворот, °
                  <div className="mt-1 flex items-center gap-2">
                    <RotateCw size={15} />
                    <input
                      type="number"
                      value={Number((selectedShape.transform.rotation * 180 / Math.PI).toFixed(1))}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) {
                          updateSelected((shape) => {
                            shape.transform.rotation = value * Math.PI / 180;
                          });
                        }
                      }}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
                    />
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => moveLayer(1)}
                    disabled={selectedIndex === shapes.length - 1}
                    className="flex items-center justify-center gap-1 rounded bg-slate-700 px-2 py-1.5 text-xs hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    title="На один слой выше"
                  >
                    <ChevronUp size={14} /> Выше
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLayer(-1)}
                    disabled={selectedIndex <= 0}
                    className="flex items-center justify-center gap-1 rounded bg-slate-700 px-2 py-1.5 text-xs hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    title="На один слой ниже"
                  >
                    <ChevronDown size={14} /> Ниже
                  </button>
                </div>
                <p className="text-[11px] leading-4 text-slate-500">
                  Перетаскивай тело для перемещения, круглые маркеры — для размера,
                  верхнюю ручку — для поворота. Узлы кривых можно перетаскивать отдельно.
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-700 p-3 text-xs leading-5 text-slate-500">
                Выбери объект на холсте или инструмент слева, затем щёлкни по холсту,
                чтобы создать фигуру.
              </p>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Слои · сверху вниз
            </h2>
            {shapes.length === 0 ? (
              <p className="text-xs text-slate-500">Сцена пуста</p>
            ) : (
              <ol className="space-y-1">
                {[...shapes].reverse().map((shape, reverseIndex) => {
                  const layerIndex = shapes.length - reverseIndex;
                  const isSelected = shape.id === selectedId;
                  return (
                    <li key={shape.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(shape.id)}
                        className={`flex w-full items-center justify-between rounded px-2 py-2 text-left text-xs transition-colors ${
                          isSelected
                            ? "bg-blue-600/20 text-blue-200 ring-1 ring-blue-500/60"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        <span className="min-w-0 truncate">
                          <span className="mr-2 text-slate-500">#{layerIndex}</span>
                          {shapeLabel(shape)}
                        </span>
                        {isSelected && <span className="ml-2 text-[10px]">Выбран</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Верхний элемент списка рисуется поверх остальных.
            </p>
          </section>

          <section className="border-t border-slate-800 pt-3">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Рендеринг
            </h2>
            <label className="block text-xs text-slate-400">
              Алгоритм линий
              <select
                value={lineAlg}
                onChange={(event) => setLineAlg(event.target.value as LineAlg)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-white"
              >
                <option value="bresenham">Брезенхем</option>
                <option value="wu">Ву</option>
              </select>
            </label>
          </section>

          <div className="mt-auto text-[11px] leading-4 text-slate-500">
            Объектов: {shapes.length}
            <br />
            {selectedShape
              ? `Выбран слой ${selectedIndex + 1} из ${shapes.length}`
              : "Нет выбранного объекта"}
          </div>
        </aside>
      </div>
    </div>
  );
}