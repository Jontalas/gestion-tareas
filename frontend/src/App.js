import React, { useEffect, useState } from "react";
import axios from "axios";

function ordenarTareas(tareas) {
  // Ordena por importancia desc, duración desc, periodicidad desc, nombre asc
  return tareas.sort((a, b) => {
    if ((b.importance || 0) !== (a.importance || 0))
      return (b.importance || 0) - (a.importance || 0);
    if ((b.duration || 0) !== (a.duration || 0))
      return (b.duration || 0) - (a.duration || 0);
    if ((b.periodicity || 0) !== (a.periodicity || 0))
      return (b.periodicity || 0) - (a.periodicity || 0);
    return (a.name || "").localeCompare(b.name || "");
  });
}

function App() {
  const [tareas, setTareas] = useState([]);
  const [form, setForm] = useState({
    id: null,
    name: "",
    duration: "",
    periodicity: "",
    importance: "",
  });

  // Cargar tareas al iniciar
  const cargarTareas = async () => {
    const res = await axios.get("http://localhost:3001/tasks");
    setTareas(res.data);
  };

  useEffect(() => {
    cargarTareas();
  }, []);

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Crear o actualizar tarea
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (form.id) {
      await axios.put(`http://localhost:3001/tasks/${form.id}`, {
        name: form.name,
        duration: form.duration || null,
        periodicity: form.periodicity || null,
        importance: form.importance || null,
      });
    } else {
      await axios.post("http://localhost:3001/tasks", {
        name: form.name,
        duration: form.duration || null,
        periodicity: form.periodicity || null,
        importance: form.importance || null,
      });
    }
    setForm({ id: null, name: "", duration: "", periodicity: "", importance: "" });
    cargarTareas();
  };

  // Editar tarea
  const handleEdit = (tarea) => {
    setForm({
      id: tarea.id,
      name: tarea.name,
      duration: tarea.duration || "",
      periodicity: tarea.periodicity || "",
      importance: tarea.importance || "",
    });
  };

  // Marcar como "al día"
  const marcarAlDia = async (id) => {
    await axios.post(`http://localhost:3001/tasks/${id}/up-to-date`);
    cargarTareas();
  };

  // Refrescar estados (marcar tareas vencidas como pendientes)
  const checkStatus = async () => {
    await axios.post("http://localhost:3001/tasks/check-status");
    cargarTareas();
  };

  // Dividir tareas
  const pendientes = ordenarTareas(tareas.filter((t) => t.status !== "up-to-date"));
  const aldia = ordenarTareas(tareas.filter((t) => t.status === "up-to-date"));

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Gestión de Tareas Cotidianas</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <input
          name="name"
          placeholder="Nombre*"
          value={form.name}
          onChange={handleChange}
          required
          style={{ width: "40%" }}
        />
        <input
          name="duration"
          placeholder="Duración (minutos)"
          value={form.duration}
          onChange={handleChange}
          style={{ width: "18%" }}
        />
        <input
          name="periodicity"
          placeholder="Periodicidad (horas)"
          value={form.periodicity}
          onChange={handleChange}
          style={{ width: "18%" }}
        />
        <input
          name="importance"
          placeholder="Importancia (1-10)"
          value={form.importance}
          onChange={handleChange}
          style={{ width: "14%" }}
        />
        <button type="submit">{form.id ? "Actualizar" : "Agregar"}</button>
        {form.id && (
          <button type="button" onClick={() => setForm({ id: null, name: "", duration: "", periodicity: "", importance: "" })}>
            Cancelar
          </button>
        )}
      </form>

      <button onClick={checkStatus} style={{ marginBottom: 20 }}>
        Refrescar estados de tareas
      </button>

      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ flex: 1 }}>
          <h2>Pendientes</h2>
          <ul>
            {pendientes.map((t) => (
              <li key={t.id} style={{ marginBottom: 10 }}>
                <b>{t.name}</b>
                {t.importance && <> | Importancia: {t.importance}</>}
                {t.duration && <> | Duración: {t.duration} min</>}
                {t.periodicity && <> | Periodicidad: {t.periodicity} h</>}
                <button style={{ marginLeft: 10 }} onClick={() => marcarAlDia(t.id)}>Marcar al día</button>
                <button style={{ marginLeft: 5 }} onClick={() => handleEdit(t)}>Editar</button>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ flex: 1 }}>
          <h2>Al día</h2>
          <ul>
            {aldia.map((t) => (
              <li key={t.id} style={{ marginBottom: 10 }}>
                <b>{t.name}</b>
                {t.importance && <> | Importancia: {t.importance}</>}
                {t.duration && <> | Duración: {t.duration} min</>}
                {t.periodicity && <> | Periodicidad: {t.periodicity} h</>}
                <button style={{ marginLeft: 5 }} onClick={() => handleEdit(t)}>Editar</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;