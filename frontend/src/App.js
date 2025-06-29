import React, { useState } from "react";
import { parseDuration, humanizeDuration } from "./utils/timeUtils";

function App() {
  const [tasks, setTasks] = useState([]);
  const [desc, setDesc] = useState("");
  const [duration, setDuration] = useState("");
  const [period, setPeriod] = useState("");
  const [error, setError] = useState("");

  const handleAddTask = (e) => {
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

    setTasks([
      ...tasks,
      { desc, duration: durationMinutes, period: periodMinutes },
    ]);
    setDesc("");
    setDuration("");
    setPeriod("");
    setError("");
  };

  return (
    <div style={{ maxWidth: 600, margin: "2em auto", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "1em", background: "#eef", padding: "1em", borderRadius: "8px" }}>
        <strong>¡Bienvenido!</strong> <br />
        Puedes introducir <b>duración</b> y <b>periodicidad</b> usando estos formatos:<br />
        <ul>
          <li><b>m</b> para minutos (ej: <code>30m</code>)</li>
          <li><b>h</b> para horas (ej: <code>2h</code>)</li>
          <li><b>d</b> para días (ej: <code>1d</code>)</li>
          <li><b>w</b> para semanas (ej: <code>1w</code>)</li>
        </ul>
      </div>

      <form onSubmit={handleAddTask} style={{ marginBottom: "2em", background: "#f8f9fa", padding: "1em", borderRadius: "8px" }}>
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
        {error && <div style={{ color: "red", marginTop: "0.5em" }}>{error}</div>}
        <button type="submit" style={{ marginTop: "1em" }}>Añadir tarea</button>
      </form>

      <h2>Tareas</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#ddd" }}>
            <th style={{ padding: "0.5em", border: "1px solid #bbb" }}>Descripción</th>
            <th style={{ padding: "0.5em", border: "1px solid #bbb" }}>Duración</th>
            <th style={{ padding: "0.5em", border: "1px solid #bbb" }}>Periodicidad</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: "center", color: "#888" }}>No hay tareas aún</td>
            </tr>
          )}
          {tasks.map((task, idx) => (
            <tr key={idx}>
              <td style={{ padding: "0.5em", border: "1px solid #ccc" }}>{task.desc}</td>
              <td style={{ padding: "0.5em", border: "1px solid #ccc" }}>{humanizeDuration(task.duration)}</td>
              <td style={{ padding: "0.5em", border: "1px solid #ccc" }}>{humanizeDuration(task.period)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;