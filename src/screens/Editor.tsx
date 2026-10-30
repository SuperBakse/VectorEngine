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
import type { LineAlg } from "../lib/raster/RasterRenderer";
import {
  CubicBezier,
  Oval,
  PathBezier,
  Rect,
  Triangle as TriangleShape,
  type Shape,
} from "../lib/shapes";

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

function createInitialShapes(): Shape[] {
  return [
    new Rect(210, 150, 150, 105, {
      fillStyle: "#60a5fa",
      fillOpacity: 0.28,
      strokeStyle: "#2563eb",
      strokeWidth: 2,
    }),
    new Oval(455, 155, 76, 52, {
      fillStyle: "#a78bfa",
      fillOpacity: 0.3,
      strokeStyle: "#7c3aed",
      strokeWidth: 2,
    }),
    new TriangleShape(
      { x: 145, y: 345 },
      { x: 215, y: 465 },
      { x: 75, y: 465 },
      {
        fillStyle: "#fbbf24",
        fillOpacity: 0.32,
        strokeStyle: "#d97706",
        strokeWidth: 2,
      }
    ),
    new CubicBezier(
      { x: 340, y: 370 },
      { x: 405, y: 250 },
      { x: 500, y: 490 },
      { x: 575, y: 355 },
      {
        fillStyle: null,
        strokeStyle: "#0d9488",
        strokeWidth: 4,
      }
    ),
    new PathBezier(
      [
        { x: 650, y: 365 },
        { x: 715, y: 300 },
        { x: 790, y: 420 },
        { x: 860, y: 340 },
      ],
      "catmull",
      false,
      {
        fillStyle: null,
        strokeStyle: "#e11d48",
        strokeWidth: 4,
      }
    ),
  ];
}

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
  const [shapes, setShapes] = useState<Shape[]>(createInitialShapes);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const exportProject = () => {
    const data = {
      projectId: id,
      shapes: shapes.map((shape) => shape.toJSON()),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vector-engine-${id ?? "project"}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
        <button
          onClick={exportProject}
          className="flex items-center gap-2 rounded bg-blue-600 px-3 py-1.5 transition-colors hover:bg-blue-500"
          title="Экспортировать объекты в JSON"
        >
          <Save size={16} /> Экспорт
          <FileDown size={14} />
        </button>
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