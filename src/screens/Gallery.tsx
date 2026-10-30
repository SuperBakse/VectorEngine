import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileUp, Plus } from "lucide-react";
import {
  createProject,
  importProjectFile,
  loadProjectIndex,
  type ProjectIndexItem,
} from "../lib/projects";

export default function Gallery() {
  const [projects, setProjects] = useState<ProjectIndexItem[]>([]);
  const [status, setStatus] = useState("");

  const refreshProjects = async () => {
    setProjects(await loadProjectIndex());
  };

  useEffect(() => {
    void refreshProjects().catch(() => setStatus("Не удалось прочитать список проектов"));
  }, []);

  const addProject = async () => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now());
    try {
      await createProject(id, `Проект ${projects.length + 1}`);
      await refreshProjects();
      setStatus("Новый проект создан");
    } catch (error) {
      setStatus(error instanceof Error ? `Ошибка создания: ${error.message}` : "Не удалось создать проект");
    }
  };

  const importJson = async () => {
    try {
      const imported = await importProjectFile();
      if (!imported) return;
      await refreshProjects();
      setStatus(`Импортирован проект «${imported.name}»`);
    } catch (error) {
      setStatus(error instanceof Error ? `Ошибка импорта: ${error.message}` : "Не удалось импортировать JSON");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold">Проекты</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void importJson()}
            className="flex items-center gap-2 px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all"
          >
            <FileUp size={18} /> Импорт JSON
          </button>
          <button
            onClick={() => void addProject()}
            className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all"
          >
            <Plus size={18} /> Создать проект
          </button>
        </div>
      </div>

      {status && <p role="status" className="mb-4 text-sm text-emerald-300">{status}</p>}
      {projects.length === 0 && <p className="text-slate-400">Проектов пока нет. Нажми «Создать проект», чтобы начать.</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link key={project.id} to={`/editor/${project.id}`}>
            <motion.div
              whileHover={{ y: -6, scale: 1.02 }}
              className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-lg p-4 h-40 flex flex-col justify-end"
            >
              <div className="font-semibold">{project.name}</div>
              <div className="text-sm text-slate-400">
                Изменён: {new Date(project.updatedAt).toLocaleString("ru-RU")}
              </div>
              <div className="mt-2 text-xs text-slate-500">Объектов: {project.shapeCount}</div>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}
