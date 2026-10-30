import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Gallery from "./screens/Gallery";
import Editor from "./screens/Editor";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Routes location={location}>
          <Route path="/" element={<Gallery />} />
          <Route path="/editor/:id" element={<Editor />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 text-white">
        <nav className="h-14 flex items-center gap-4 px-6 border-b border-slate-800">
          <Link to="/" className="font-bold text-lg hover:text-blue-400 transition-colors">
            VectorEngine
          </Link>
          <Link to="/" className="text-slate-400 hover:text-white transition-colors">
            Галерея
          </Link>
        </nav>
        <AnimatedRoutes />
      </div>
    </BrowserRouter>
  );
}