import React, { useState, useEffect, useRef } from "react";
import { parseDuration, humanizeDuration } from "./utils/timeUtils";

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
    intervalRef.current = setInterval(() => setRefresh(x => x + 1), 1000); // actualiza cada segundo
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
          // Pasa a pendiente
          return { ...task, state: "pendiente", lastDone: undefined };
        }
        return task;
      })
    );
    // Se ejecuta cada segundo por el setRefresh arriba
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
      // Modificar tarea existente
      const newTasks = tasks.slice();
      // Mantener lastDone solo si sigue "al día"
      if (newTasks[editIdx].state === "aldia") {
        taskObj.state = "aldia";
        taskObj.lastDone = newTasks[editIdx].lastDone;
      }
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
      i === idx
        ? {
            ...t,
            state: newState,
            lastDone: newState === "aldia" ? Date.now() : undefined,
          }
        : t
    ));
  }

  // Orden por importancia (mayor a menor), duración (mayor a menor), periodicidad (mayor a menor), descripción (A-Z)
  function getSortedTasks(filteredState) {
    const importanceOrder = { alta: 2, media: 1, baja: 0 };
    return tasks
      .filter(t => t.state === filteredState)
      .sort((a, b) => {
        // 1. Importancia (mayor a menor)
        if (importanceOrder[b.importance] !== importanceOrder[a.importance])
          return importanceOrder[b.importance] - importanceOrder[a.importance];
        // 2. Duración (mayor a menor)
        if (b.duration !== a.duration)
          return b.duration - a.duration;
        // 3. Periodicidad (mayor a menor)
        if (b.period !== a.period)
          return b.period - a.period;
        // 4. Nombre (alfabético ascendente)
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
            {stateFilter === "aldia" && (
              <th style={{ padding: ".5em", border: "1px solid #bbb" }}>Tiempo restante</th>
            )}
            <th style={{ padding: ".5em", border: "1px solid #bbb" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {getSortedTasks(stateFilter).length === 0 && (
            <tr>
              <td colSpan={stateFilter === "aldia" ? 6 : 5} style={{ textAlign: "center", color: "#888" }}>
                No hay tareas en este estado
              </td>
            </tr>
          )}
          {getSortedTasks(stateFilter).map((task, idx) => {
            const globalIdx = tasks.findIndex(t =>
              t.desc === task.desc &&
              t.duration === task.duration &&
              t.period === task.period &&
              t.importance === task.importance &&
              t.state === task.state &&
              (t.lastDone ?? 0) === (task.lastDone ?? 0)
            );
            return (
              <tr key={globalIdx}>
                <td style={{ padding: ".5em", border: "1px solid #ccc" }}>{task.desc}</td>
                <td style={{ padding: ".5em", border: "1px solid #ccc" }}>{humanizeDuration(task.duration)}</td>
                <td style={{ padding: ".5em", border: "1px solid #ccc" }}>{humanizeDuration(task.period)}</td>
                <td style={{ padding: ".5em", border: "1px solid #ccc", textTransform: "capitalize" }}>{task.importance}</td>
                {stateFilter === "aldia" && (
                  <td style={{ padding: ".5em", border: "1px solid #ccc" }}>
                    {getHumanTimeLeft(getMsToNextPending(task))}
                  </td>
                )}
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