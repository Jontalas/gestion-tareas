import React, { useState, useEffect } from "react";
import { parseDuration, humanizeDuration } from "./utils/timeUtils";

// Para importancia, 3 niveles: Alta, Media, Baja
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

function App() {
  const [tasks, setTasks] = useState([]);
  const [desc, setDesc] = useState("");
  const [duration, setDuration] = useState("");
  const [period, setPeriod] = useState("");
  const [importance, setImportance] = useState("media");
  const [editIdx, setEditIdx] = useState(null);
  const [error, setError] = useState("");
  const [stateFilter, setStateFilter] = useState("pendiente");

  // Cargar tareas desde localStorage al inicio
  useEffect(() => {
    const stored = localStorage.getItem("tasks");
    if (stored) setTasks(JSON.parse(stored));
  }, []);

  // Guardar tareas en localStorage cuando cambian
  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);

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
    };

    if (editIdx !== null) {
      // Modificar tarea existente
      const newTasks = tasks.slice();
      newTasks[editIdx] = { ...newTasks[editIdx], ...taskObj };
      setTasks(newTasks);
    } else {
      // Añadir nueva tarea
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
      i === idx ? { ...t, state: newState } : t
    ));
  }

  // Orden por estado, luego importancia, después periodicidad y duración
  function getSortedTasks(filteredState) {
    const importanceOrder = { alta: 0, media: 1, baja: 2 };
    return tasks
      .filter(t => t.state === filteredState)
      .sort((a, b) => {
        // Importancia
        if (importanceOrder[a.importance] !== importanceOrder[b.importance])
          return importanceOrder[a.importance] - importanceOrder[b.importance];
        // Periodicidad
        if (a.period !== b.period)
          return a.period - b.period;
        // Duración
        if (a.duration !== b.duration)
          return a.duration - b.duration;
        return a.desc.localeCompare(b.desc);
      });
  }

  // Convierte minutos a string tipo "30m", "2h", etc. para el formulario de edición
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
    <div style={{ maxWidth: 800, margin: "2em auto", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "1em", background: "#eef", padding: "1em", borderRadius: "8px" }}>
        <strong>¡Bienvenido!</strong> <br />
        Puedes introducir <b>duración</b> y <b>periodicidad</b> usando estos formatos:
        <ul>
          <li><b>m</b> para minutos (ej: <code>30m</code>)</li>
          <li><b>h</b> para horas (ej: <code>2h</code>)</li>
          <li><b>d</b> para días (ej: <code>1d</code>)</li>
          <li><b>w</b> para semanas (ej: <code>1w</code>)</li>
        </ul>
      </div>

      <form onSubmit={handleAddOrEditTask} style={{ marginBottom: "2em", background: "#f8f9fa", padding: "1em", borderRadius: "8px" }}>
        <div>
          <label>Descripción:{" "}
            <input
              type="text"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              required
              style={{ width: "60%" }}
            />
          </label>
        </div>
        <div>
          <label>Duración:{" "}
            <input
              type="text"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="ej: 30m, 2h, 1d, 1w"
              required
              style={{ width: "120px" }}
            />
          </label>
        </div>
        <div>
          <label>Periodicidad:{" "}
            <input
              type="text"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              placeholder="ej: 30m, 2h, 1d, 1w"
              required
              style={{ width: "120px" }}
            />
          </label>
        </div>
        <div>
          <label>Importancia:{" "}
            <select
              value={importance}
              onChange={e => setImportance(e.target.value)}
              required
            >
              {IMPORTANCE_LEVELS.map(opt =>
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              )}
            </select>
          </label>
        </div>
        {error && <div style={{ color: "red", marginTop: "0.5em" }}>{error}</div>}
        <button type="submit" style={{ marginTop: "1em" }}>
          {editIdx !== null ? "Guardar cambios" : "Añadir tarea"}
        </button>
        {editIdx !== null && (
          <button
            type="button"
            style={{ marginLeft: "1em" }}
            onClick={resetForm}
          >Cancelar</button>
        )}
      </form>

      <div>
        <b>Ver tareas:</b>{" "}
        {STATES.map(s =>
          <button
            key={s.value}
            style={{
              margin: "0 .5em",
              background: stateFilter === s.value ? "#cde" : "#eee"
            }}
            onClick={() => setStateFilter(s.value)}
          >{s.label}</button>
        )}
      </div>

      <h2 style={{ marginTop: "1.5em" }}>
        {STATES.find(s => s.value === stateFilter)?.label ?? ""}
      </h2>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1em" }}>
        <thead>
          <tr style={{ background: "#ddd" }}>
            <th style={{ padding: ".5em", border: "1px solid #bbb" }}>Descripción</th>
            <th style={{ padding: ".5em", border: "1px solid #bbb" }}>Duración</th>
            <th style={{ padding: ".5em", border: "1px solid #bbb" }}>Periodicidad</th>
            <th style={{ padding: ".5em", border: "1px solid #bbb" }}>Importancia</th>
            <th style={{ padding: ".5em", border: "1px solid #bbb" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {getSortedTasks(stateFilter).length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", color: "#888" }}>
                No hay tareas en este estado
              </td>
            </tr>
          )}
          {getSortedTasks(stateFilter).map((task, idx) => {
            // idx local puede diferir del idx global
            const globalIdx = tasks.findIndex(t =>
              t.desc === task.desc &&
              t.duration === task.duration &&
              t.period === task.period &&
              t.importance === task.importance &&
              t.state === task.state
            );
            return (
              <tr key={globalIdx}>
                <td style={{ padding: ".5em", border: "1px solid #ccc" }}>{task.desc}</td>
                <td style={{ padding: ".5em", border: "1px solid #ccc" }}>{humanizeDuration(task.duration)}</td>
                <td style={{ padding: ".5em", border: "1px solid #ccc" }}>{humanizeDuration(task.period)}</td>
                <td style={{ padding: ".5em", border: "1px solid #ccc", textTransform: "capitalize" }}>{task.importance}</td>
                <td style={{ padding: ".5em", border: "1px solid #ccc" }}>
                  <button onClick={() => handleEdit(globalIdx)}>Editar</button>
                  <button style={{ marginLeft: "0.5em" }} onClick={() => handleDelete(globalIdx)}>Eliminar</button>
                  {task.state === "pendiente" && (
                    <button style={{ marginLeft: "0.5em" }}
                      onClick={() => handleStateChange(globalIdx, "aldia")}
                    >Marcar al día</button>
                  )}
                  {task.state === "aldia" && (
                    <button style={{ marginLeft: "0.5em" }}
                      onClick={() => handleStateChange(globalIdx, "pendiente")}
                    >Marcar pendiente</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default App;