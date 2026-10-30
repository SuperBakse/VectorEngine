import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

interface Project {
  id: string;
  name: string;
  date: string;
}

export default function Gallery() {
  const [projects, setProjects] = useState<Project[]>([]);

  const addProject = () => {
    const id = String(Date.now());
    const newProject: Project = {
      id,
      name: `Проект ${projects.length + 1}`,
      date: new Date().toLocaleDateString("ru-RU"),
    };
    setProjects([...projects, newProject]);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Проекты</h1>
        <button
          onClick={addProject}
          className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all"
        >
          <Plus size={18} /> Создать проект
        </button>
      </div>

      {projects.length === 0 && <p className="text-slate-400">Проектов пока нет</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map((p) => (
          <Link key={p.id} to={`/editor/${p.id}`}>
            <motion.div
              whileHover={{ y: -6, scale: 1.02 }}
              className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-lg p-4 h-40 flex flex-col justify-end"
            >
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-slate-400">{p.date}</div>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}