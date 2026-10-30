import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, MousePointer2, Square, Circle } from "lucide-react";
import CanvasScene from "../components/CanvasScene";
import type { LineAlg } from "../lib/raster/RasterRenderer";

const TOOLS = [
  { id: "select", icon: MousePointer2 },
  { id: "rect", icon: Square },
  { id: "oval", icon: Circle },
];

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tool, setTool] = useState("select");
  const [lineAlg, setLineAlg] = useState<LineAlg>("bresenham");

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-slate-900">
      <header className="h-14 flex items-center justify-between px-4 border-b border-slate-800">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft size={16} /> Назад
        </button>
        <div className="font-semibold">Редактирование проекта №{id}</div>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 transition-colors">
          <Save size={16} /> Сохранить
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-16 border-r border-slate-800 flex flex-col items-center gap-2 py-3">
          {TOOLS.map(({ id: toolId, icon: Icon }) => (
            <button
              key={toolId}
              onClick={() => setTool(toolId)}
              className={`p-3 rounded-lg transition-colors ${
                tool === toolId ? "bg-blue-600" : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              <Icon size={20} />
            </button>
          ))}
        </aside>

        <main className="flex-1 bg-slate-700 flex items-center justify-center p-6 overflow-auto">
          <div className="bg-white shadow-2xl w-full h-full max-w-4xl max-h-[600px]">
            <CanvasScene lineAlg={lineAlg} />
          </div>
        </main>

        <aside className="w-64 border-l border-slate-800 p-4">
          <h2 className="text-slate-400 text-sm uppercase mb-2">Свойства</h2>
          <label className="block text-sm text-slate-400 mb-1">Алгоритм линий</label>
          <select
            value={lineAlg}
            onChange={(e) => setLineAlg(e.target.value as LineAlg)}
            className="w-full bg-slate-800 rounded px-2 py-1.5"
          >
            <option value="bresenham">Брезенхем</option>
            <option value="wu">Ву</option>
          </select>
        </aside>
      </div>
    </div>
  );
}