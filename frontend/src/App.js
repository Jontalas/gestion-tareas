import React, { useEffect, useState } from "react";
import axios from "axios";

// Utility functions for time parsing and formatting
function parseTimeInput(input) {
  if (!input || input.trim() === "") return null;
  
  const str = input.trim().toLowerCase();
  
  // If it's just a number, treat it as minutes for duration or hours for periodicity
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }
  
  // Parse time with suffix (m, h, d, w)
  const match = str.match(/^(\d+(?:\.\d+)?)(m|h|d|w)$/);
  if (!match) {
    // If it doesn't match the pattern, treat as plain number
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }
  
  const [, value, unit] = match;
  const num = parseFloat(value);
  
  switch (unit) {
    case 'm': return num; // minutes
    case 'h': return num * 60; // hours to minutes
    case 'd': return num * 60 * 24; // days to minutes
    case 'w': return num * 60 * 24 * 7; // weeks to minutes
    default: return num;
  }
}

function formatTimeDisplay(minutes) {
  if (!minutes || minutes === 0) return "";
  
  const mins = parseInt(minutes, 10);
  
  if (mins < 60) {
    return `${mins} minuto${mins !== 1 ? 's' : ''}`;
  } else if (mins < 60 * 24) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (remainingMins === 0) {
      return `${hours} hora${hours !== 1 ? 's' : ''}`;
    } else {
      return `${hours}h ${remainingMins}m`;
    }
  } else if (mins < 60 * 24 * 7) {
    const days = Math.floor(mins / (60 * 24));
    const remainingHours = Math.floor((mins % (60 * 24)) / 60);
    if (remainingHours === 0) {
      return `${days} día${days !== 1 ? 's' : ''}`;
    } else {
      return `${days}d ${remainingHours}h`;
    }
  } else {
    const weeks = Math.floor(mins / (60 * 24 * 7));
    const remainingDays = Math.floor((mins % (60 * 24 * 7)) / (60 * 24));
    if (remainingDays === 0) {
      return `${weeks} semana${weeks !== 1 ? 's' : ''}`;
    } else {
      return `${weeks}w ${remainingDays}d`;
    }
  }
}

function convertMinutesToHours(minutes) {
  if (!minutes) return null;
  return minutes / 60;
}

function convertHoursToMinutes(hours) {
  if (!hours) return null;
  return hours * 60;
}

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
    const res = await axios.get("https://gestion-tareas-ta45.onrender.com/tasks");
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
    
    // Parse duration and periodicity values
    const durationInMinutes = parseTimeInput(form.duration);
    const periodicityInMinutes = parseTimeInput(form.periodicity);
    
    // Convert periodicity to hours for backend (backend expects hours for periodicity)
    const periodicityInHours = periodicityInMinutes ? convertMinutesToHours(periodicityInMinutes) : null;
    
    if (form.id) {
      await axios.put(`https://gestion-tareas-ta45.onrender.com/tasks/${form.id}`, {
        name: form.name,
        duration: durationInMinutes,
        periodicity: periodicityInHours,
        importance: form.importance || null,
      });
    } else {
      await axios.post("https://gestion-tareas-ta45.onrender.com/tasks", {
        name: form.name,
        duration: durationInMinutes,
        periodicity: periodicityInHours,
        importance: form.importance || null,
      });
    }
    setForm({ id: null, name: "", duration: "", periodicity: "", importance: "" });
    cargarTareas();
  };

  // Editar tarea
  const handleEdit = (tarea) => {
    // Convert backend values to user-friendly format for editing
    const durationDisplay = tarea.duration ? String(tarea.duration) : "";
    const periodicityInMinutes = tarea.periodicity ? convertHoursToMinutes(tarea.periodicity) : null;
    const periodicityDisplay = periodicityInMinutes ? String(periodicityInMinutes) : "";
    
    setForm({
      id: tarea.id,
      name: tarea.name,
      duration: durationDisplay,
      periodicity: periodicityDisplay,
      importance: tarea.importance || "",
    });
  };

  // Marcar como "al día"
  const marcarAlDia = async (id) => {
    await axios.post(`https://gestion-tareas-ta45.onrender.com/tasks/${id}/up-to-date`);
    cargarTareas();
  };

  // Refrescar estados (marcar tareas vencidas como pendientes)
  const checkStatus = async () => {
    await axios.post("https://gestion-tareas-ta45.onrender.com/tasks/check-status");
    cargarTareas();
  };

  // Dividir tareas
  const pendientes = ordenarTareas(tareas.filter((t) => t.status !== "up-to-date"));
  const aldia = ordenarTareas(tareas.filter((t) => t.status === "up-to-date"));

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Gestión de Tareas Cotidianas</h1>
      <div style={{ 
        backgroundColor: "#f0f8ff", 
        border: "1px solid #cce7ff", 
        borderRadius: "6px", 
        padding: "12px", 
        marginBottom: "20px",
        fontSize: "14px"
      }}>
        <strong>💡 Formatos de tiempo:</strong> Puedes usar sufijos para especificar duración y periodicidad:
        <br />• <strong>m</strong> para minutos (ej: 30m)
        <br />• <strong>h</strong> para horas (ej: 2h) 
        <br />• <strong>d</strong> para días (ej: 1d)
        <br />• <strong>w</strong> para semanas (ej: 1w)
        <br />También puedes usar números simples que se interpretarán como minutos.
      </div>
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
          placeholder="Duración (ej: 30m, 2h, 1d)"
          value={form.duration}
          onChange={handleChange}
          style={{ width: "18%" }}
        />
        <input
          name="periodicity"
          placeholder="Periodicidad (ej: 2h, 1d, 1w)"
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
                {t.duration && <> | Duración: {formatTimeDisplay(t.duration)}</>}
                {t.periodicity && <> | Periodicidad: {formatTimeDisplay(convertHoursToMinutes(t.periodicity))}</>}
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
                {t.duration && <> | Duración: {formatTimeDisplay(t.duration)}</>}
                {t.periodicity && <> | Periodicidad: {formatTimeDisplay(convertHoursToMinutes(t.periodicity))}</>}
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