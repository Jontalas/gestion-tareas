import React, { useState, useEffect, useRef } from "react";
import { parseDuration, humanizeDuration } from "./utils/timeUtils";
import "./App.css";

const IMPORTANCE_LEVELS = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];

const defaultState = "pendiente";
const STATES = [
  { value: "pendiente", label: "Pendiente" },
  { value: "aldia", label: "Al día" }
];

// Devuelve la diferencia en milisegundos entre ahora y lastDone+period (en minutos)
function getMsToNextPending(task) {
  if (!task.lastDone || task.state !== "aldia") return 0;
  const msPeriod = (task.period || 0) * 60 * 1000;
  const msLeft = task.lastDone + msPeriod - Date.now();
  return msLeft;
}

// Devuelve string tipo "1h 30m" o "¡Pendiente!"
function getHumanTimeLeft(msLeft) {
  if (msLeft <= 0) return "¡Pendiente!";
  const totalSec = Math.floor(msLeft / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  let str = '';
  if (h > 0) str += `${h}h `;
  if (m > 0 || (h > 0 && s > 0)) str += `${m}m `;
  if (h === 0 && m === 0) str += `${s}s`;
  return str.trim();
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [desc, setDesc] = useState("");
  const [duration, setDuration] = useState("");
  const [period, setPeriod] = useState("");
  const [importance, setImportance] = useState("media");
  const [editIdx, setEditIdx] = useState(null);
  const [error, setError] = useState("");
  const [stateFilter, setStateFilter] = useState("pendiente");
  const [, setRefresh] = useState(0); // Para forzar renders periódicos
  const intervalRef = useRef();
  const [darkMode, setDarkMode] = useState(() =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Persistencia modo oscuro/claro
  useEffect(() => {
    const localTheme = localStorage.getItem("themeMode");
    if (localTheme) setDarkMode(localTheme === "dark");
  }, []);

  useEffect(() => {
    localStorage.setItem("themeMode", darkMode ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Cargar tareas desde localStorage al inicio
  useEffect(() => {
    const stored = localStorage.getItem("tasks");
    if (stored) setTasks(JSON.parse(stored));
  }, []);

  // Guardar tareas en localStorage cuando cambian
  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);

  // Intervalo para forzar render y actualizar tiempos
  useEffect(() => {
    intervalRef.current = setInterval(() => setRefresh(x => x + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Efecto para pasar tareas automáticamente a pendiente cuando vencen
  useEffect(() => {
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (
          task.state === "aldia" &&
          task.lastDone &&
          Date.now() >= task.lastDone + (task.period || 0) * 60 * 1000
        ) {
          return { ...task, state: "pendiente", lastDone: undefined };
        }
        return task;
      })
    );
  }, [tasks, setTasks, setRefresh]);

  function resetForm() {
    setDesc("");
    setDuration("");
    setPeriod("");
    setImportance("media");
    setEditIdx(null);
    setError("");
  }

  function handleAddOrEditTask(e) {
    e.preventDefault();
    const durationMinutes = parseDuration(duration);
    const periodMinutes = parseDuration(period);

    if (!desc.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }
    if (!durationMinutes) {
      setError("Duración no válida. Usa 30m, 2h, 1d o 1w.");
      return;
    }
    if (!periodMinutes) {
      setError("Periodicidad no válida. Usa 30m, 2h, 1d o 1w.");
      return;
    }
    if (!IMPORTANCE_LEVELS.some(opt => opt.value === importance)) {
      setError("Importancia no válida.");
      return;
    }

    const taskObj = {
      desc,
      duration: durationMinutes,
      period: periodMinutes,
      importance,
      state: defaultState,
      lastDone: undefined,
    };

    if (editIdx !== null) {
      const newTasks = tasks.slice();
      if (newTasks[editIdx].state === "aldia") {
        taskObj.state = "aldia";
        taskObj.lastDone = newTasks[editIdx].lastDone;
      }
      newTasks[editIdx] = { ...newTasks[editIdx], ...taskObj };
      setTasks(newTasks);
    } else {
      setTasks([...tasks, taskObj]);
    }
    resetForm();
  }

  function handleEdit(idx) {
    const t = tasks[idx];
    setDesc(t.desc);
    setDuration(reverseParseDuration(t.duration));
    setPeriod(reverseParseDuration(t.period));
    setImportance(t.importance);
    setEditIdx(idx);
    setError("");
  }

  function handleDelete(idx) {
    if (!window.confirm("¿Eliminar esta tarea?")) return;
    setTasks(tasks.filter((_, i) => i !== idx));
    resetForm();
  }

  function handleStateChange(idx, newState) {
    setTasks(tasks.map((t, i) =>
      i === idx
        ? {
            ...t,
            state: newState,
            lastDone: newState === "aldia" ? Date.now() : undefined,
          }
        : t
    ));
  }

  function getSortedTasks(filteredState) {
    const importanceOrder = { alta: 2, media: 1, baja: 0 };
    return tasks
      .filter(t => t.state === filteredState)
      .sort((a, b) => {
        if (importanceOrder[b.importance] !== importanceOrder[a.importance])
          return importanceOrder[b.importance] - importanceOrder[a.importance];
        if (b.duration !== a.duration)
          return b.duration - a.duration;
        if (b.period !== a.period)
          return b.period - a.period;
        return a.desc.localeCompare(b.desc);
      });
  }

  function reverseParseDuration(minutes) {
    if (minutes % (60 * 24 * 7) === 0)
      return `${minutes / (60 * 24 * 7)}w`;
    if (minutes % (60 * 24) === 0)
      return `${minutes / (60 * 24)}d`;
    if (minutes % 60 === 0)
      return `${minutes / 60}h`;
    return `${minutes}m`;
  }

  return (
    <div className="main-container">
      <header className="header-bar">
        <h1 className="logo">
          <span role="img" aria-label="tarea">📋</span> TaskFlow
        </h1>
        <button
          className="mode-toggle"
          onClick={() => setDarkMode(m => !m)}
          aria-label="Cambiar modo claro/oscuro"
          title={darkMode ? "Modo claro" : "Modo oscuro"}
        >
          {darkMode ? "🌙" : "🌞"}
        </button>
      </header>

      <section className="intro-card">
        <strong>¡Bienvenido a TaskFlow!</strong>
        <p>
          Gestiona tus tareas recurrentes fácilmente. <br />
          Usa estos formatos para <b>duración</b> y <b>periodicidad</b>:
        </p>
        <ul>
          <li><b>m</b> para minutos (<code>30m</code>)</li>
          <li><b>h</b> para horas (<code>2h</code>)</li>
          <li><b>d</b> para días (<code>1d</code>)</li>
          <li><b>w</b> para semanas (<code>1w</code>)</li>
        </ul>
      </section>

      <form onSubmit={handleAddOrEditTask} className="task-form">
        <input
          type="text"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          required
          placeholder="Descripción de la tarea"
          className="input"
        />
        <input
          type="text"
          value={duration}
          onChange={e => setDuration(e.target.value)}
          placeholder="Duración (ej: 30m, 2h, 1d, 1w)"
          required
          className="input"
        />
        <input
          type="text"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          placeholder="Periodicidad (ej: 30m, 2h, 1d, 1w)"
          required
          className="input"
        />
        <select
          value={importance}
          onChange={e => setImportance(e.target.value)}
          required
          className="input"
        >
          {IMPORTANCE_LEVELS.map(opt =>
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          )}
        </select>
        <div className="form-actions">
          <button type="submit" className="btn main-btn">
            {editIdx !== null ? "Guardar" : "Añadir"}
          </button>
          {editIdx !== null && (
            <button
              type="button"
              className="btn"
              onClick={resetForm}
            >Cancelar</button>
          )}
        </div>
        {error && <div className="error-msg">{error}</div>}
      </form>

      <nav className="state-nav">
        {STATES.map(s =>
          <button
            key={s.value}
            className={`state-btn${stateFilter === s.value ? " active" : ""}`}
            onClick={() => setStateFilter(s.value)}
          >
            {s.label}
          </button>
        )}
      </nav>

      <section className="task-list">
        <h2 className="section-title">{STATES.find(s => s.value === stateFilter)?.label ?? ""}</h2>
        <div className="tasks-grid">
          {getSortedTasks(stateFilter).length === 0 ? (
            <div className="empty-state">No hay tareas en este estado</div>
          ) : (
            getSortedTasks(stateFilter).map((task, idx) => {
              const globalIdx = tasks.findIndex(t =>
                t.desc === task.desc &&
                t.duration === task.duration &&
                t.period === task.period &&
                t.importance === task.importance &&
                t.state === task.state &&
                (t.lastDone ?? 0) === (task.lastDone ?? 0)
              );
              return (
                <article className={`task-card imp-${task.importance}`} key={globalIdx}>
                  <header className="task-card-head">
                    <h3 className="task-desc">{task.desc}</h3>
                  </header>
                  <ul className="task-meta">
                    <li>
                      <span className="meta-label">Duración:</span>
                      <span className="meta-value">{humanizeDuration(task.duration)}</span>
                    </li>
                    <li>
                      <span className="meta-label">Periodicidad:</span>
                      <span className="meta-value">{humanizeDuration(task.period)}</span>
                    </li>
                    <li>
                      <span className="meta-label">Importancia:</span>
                      <span className="meta-value">
                        <span className={`importance-dot imp-${task.importance}`}></span>
                        {IMPORTANCE_LEVELS.find(i => i.value === task.importance)?.label}
                      </span>
                    </li>
                    {task.state === "aldia" && (
                      <li>
                        <span className="meta-label">Tiempo restante:</span>
                        <span className={`meta-value time-left${getMsToNextPending(task) <= 0 ? " expired" : ""}`}>
                          {getHumanTimeLeft(getMsToNextPending(task))}
                        </span>
                      </li>
                    )}
                  </ul>
                  <div className="card-actions">
                    <button className="btn" onClick={() => handleEdit(globalIdx)}>✏️ Editar</button>
                    <button className="btn" onClick={() => handleDelete(globalIdx)}>🗑️ Eliminar</button>
                    {task.state === "pendiente" && (
                      <button className="btn main-btn"
                        onClick={() => handleStateChange(globalIdx, "aldia")}
                      >✅ Marcar al día</button>
                    )}
                    {task.state === "aldia" && (
                      <button className="btn warn-btn"
                        onClick={() => handleStateChange(globalIdx, "pendiente")}
                      >⏪ Marcar pendiente</button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
      <footer className="footer">
        <span>Hecho con <span role="img" aria-label="corazón">💜</span> por Jontalas</span>
      </footer>
    </div>
  );
}

export default App;