import React, { useState, useEffect, useRef } from "react";
import { parseDuration, humanizeDuration } from "./utils/timeUtils";
import "./App.css";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, remove, update } from "firebase/database";

// --- Firebase Realtime DB ---
// Crea tu proyecto en https://console.firebase.google.com/
// Sustituye la siguiente config por la tuya:
const firebaseConfig = {
  apiKey: "AIzaSyAGX-rO0HtCo8a2_xWfVlbIN6wgkw0ItVQ",
  authDomain: "gestion-tareas-5687f.firebaseapp.com",
  databaseURL: "https://gestion-tareas-5687f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gestion-tareas-5687f",
  storageBucket: "gestion-tareas-5687f.firebasestorage.app",
  messagingSenderId: "571206795697",
  appId: "1:571206795697:web:cad2b97a38ab0fb875fd90"
};

let app, db;
if (!window._firebaseInit) {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  window._firebaseInit = true;
} else {
  db = getDatabase();
}

// --- Utilidades ---
const IMPORTANCE_LEVELS = [
  { value: "alta", label: "Alta", color: "#e74c3c" },
  { value: "media", label: "Media", color: "#f1c40f" },
  { value: "baja", label: "Baja", color: "#2ecc71" },
];
const defaultState = "pendiente";
const STATES = [
  { value: "pendiente", label: "Pendiente" },
  { value: "aldia", label: "Al día" }
];

function getMsToNextPending(task) {
  if (!task.lastDone || task.state !== "aldia") return 0;
  const msPeriod = (task.period || 0) * 60 * 1000;
  return task.lastDone + msPeriod - Date.now();
}
function getHumanTimeLeft(msLeft) {
  if (msLeft <= 0) return "¡Pendiente!";
  const totalSec = Math.floor(msLeft / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${totalSec % 60}s`;
}
function getImportanceObj(val) {
  return IMPORTANCE_LEVELS.find(l => l.value === val) || IMPORTANCE_LEVELS[1];
}

// --- LOGIN ---
function getUserDbKey(email) {
  return email.replace(/\./g, "_");
}

function App() {
  const [stateFilter, setStateFilter] = useState("pendiente");
  // --- Tema claro/oscuro
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("themeMode") === "dark" ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
  useEffect(() => {
    localStorage.setItem("themeMode", darkMode ? "dark" : "light");
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // --- Login
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    if (!loginEmail.match(/^[^@]+@[^@]+\.[^@]+$/)) {
      setLoginError("Introduce un email válido.");
      return;
    }
    if (!loginPass || loginPass.length < 3) {
      setLoginError("Contraseña demasiado corta.");
      return;
    }
    // Para demo, sin autenticar en Firebase: "login" local
    setUser({ email: loginEmail, pass: loginPass });
    localStorage.setItem("loggedUser", JSON.stringify({ email: loginEmail, pass: loginPass }));
  }
  function handleLogout() {
    setUser(null);
    localStorage.removeItem("loggedUser");
  }
  useEffect(() => {
    const u = localStorage.getItem("loggedUser");
    if (u) setUser(JSON.parse(u));
  }, []);

  // --- Tareas sincronizadas ---
  const [tasks, setTasks] = useState([]);
  const tasksRef = useRef();
  useEffect(() => {
    if (!user) return;
    const key = getUserDbKey(user.email);
    const r = ref(db, "tasks/" + key);
    tasksRef.current && tasksRef.current();
    const unsub = onValue(r, snap => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, t]) => ({ ...t, id }));
      setTasks(arr);
    });
    tasksRef.current = unsub;
    return () => tasksRef.current && tasksRef.current();
  }, [user]);

  // --- Autorefresco para tiempos ---
  const [, setRefresh] = useState(0);
  useEffect(() => {
    const intv = setInterval(() => setRefresh(x => x + 1), 1000);
    return () => clearInterval(intv);
  }, []);

  // --- Cambio automático a pendiente ---
  useEffect(() => {
    if (!user) return;
    // Si alguna tarea en "aldia" ha vencido, la cambiamos
    tasks.forEach(task => {
      if (
        task.state === "aldia" &&
        task.lastDone &&
        Date.now() >= task.lastDone + (task.period || 0) * 60 * 1000
      ) {
        // update en Firebase
        const key = getUserDbKey(user.email);
        update(ref(db, `tasks/${key}/${task.id}`), { state: "pendiente", lastDone: null });
      }
    });
  }, [tasks, user]);

  // --- Formulario tareas ---
  const [desc, setDesc] = useState("");
  const [duration, setDuration] = useState("");
  const [period, setPeriod] = useState("");
  const [importance, setImportance] = useState("media");
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  function resetForm() {
    setDesc(""); setDuration(""); setPeriod(""); setImportance("media"); setEditId(null); setError("");
  }
  function handleAddOrEditTask(e) {
    e.preventDefault();
    const durationMinutes = parseDuration(duration);
    const periodMinutes = parseDuration(period);
    if (!desc.trim()) return setError("La descripción es obligatoria.");
    if (!durationMinutes) return setError("Duración no válida.");
    if (!periodMinutes) return setError("Periodicidad no válida.");
    if (!IMPORTANCE_LEVELS.some(opt => opt.value === importance)) return setError("Importancia no válida.");
    const key = getUserDbKey(user.email);
    const base = { desc, duration: durationMinutes, period: periodMinutes, importance, state: defaultState, lastDone: null };
    if (editId) {
      update(ref(db, `tasks/${key}/${editId}`), base);
    } else {
      push(ref(db, `tasks/${key}`), base);
    }
    resetForm();
  }
  function handleEdit(id) {
    const t = tasks.find(t => t.id === id);
    setDesc(t.desc);
    setDuration(reverseParseDuration(t.duration));
    setPeriod(reverseParseDuration(t.period));
    setImportance(t.importance);
    setEditId(id);
    setError("");
  }
  function handleDelete(id) {
    const key = getUserDbKey(user.email);
    remove(ref(db, `tasks/${key}/${id}`));
    resetForm();
  }
  function handleStateChange(id, newState) {
    const key = getUserDbKey(user.email);
    update(ref(db, `tasks/${key}/${id}`), { state: newState, lastDone: newState === "aldia" ? Date.now() : null });
  }
  function reverseParseDuration(minutes) {
    if (minutes % (60 * 24 * 7) === 0) return `${minutes / (60 * 24 * 7)}w`;
    if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)}d`;
    if (minutes % 60 === 0) return `${minutes / 60}h`;
    return `${minutes}m`;
  }

  // Orden por prioridad
  function getSortedTasks(filteredState) {
    const importanceOrder = { alta: 2, media: 1, baja: 0 };
    return tasks
      .filter(t => t.state === filteredState)
      .sort((a, b) => {
        if (importanceOrder[b.importance] !== importanceOrder[a.importance])
          return importanceOrder[b.importance] - importanceOrder[a.importance];
        if (b.duration !== a.duration) return b.duration - a.duration;
        if (b.period !== a.period) return b.period - a.period;
        return a.desc.localeCompare(b.desc);
      });
  }

  // --- RENDER ---
  if (!user) {
    return (
      <div className="login-bg">
        <form className="login-box" onSubmit={handleLogin}>
          <h2>Iniciar sesión</h2>
          <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoFocus required />
          <input type="password" placeholder="Contraseña" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
          <button type="submit" className="btn main-btn" style={{ width: "100%", marginTop: 10 }}>Entrar / Registrarse</button>
          {loginError && <div className="error-msg">{loginError}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className={`main-container list-mode ${darkMode ? "dark" : "light"}`}>
      <header className="header-bar">
        <h1 className="logo">
          <span role="img" aria-label="tarea">📋</span> TaskFlow
        </h1>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <button
            className="mode-toggle"
            onClick={() => setDarkMode(m => !m)}
            aria-label="Cambiar modo claro/oscuro"
            title={darkMode ? "Modo claro" : "Modo oscuro"}
          >{darkMode ? "🌙" : "🌞"}</button>
          <span className="user-email">{user.email}</span>
          <button className="btn logout-btn" title="Cerrar sesión" onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <section className="intro-card minimal">
        <strong>¡Bienvenido a TaskFlow!</strong>
        <p>Gestiona tus tareas recurrentes fácilmente.<br/>
          <span className="intro-user">Accedes como <b>{user.email}</b></span>
        </p>
      </section>

      <form onSubmit={handleAddOrEditTask} className="task-form dense" autoComplete="off">
        <input
          type="text"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          required
          placeholder="¿Qué tienes que hacer?"
          className="input"
          autoFocus
        />
        <div className="form-row">
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
        </div>
        <div className="form-row">
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
              {editId ? "Guardar" : "Añadir"}
            </button>
            {editId && (
              <button type="button" className="btn" onClick={resetForm}>Cancelar</button>
            )}
          </div>
        </div>
        {error && <div className="error-msg">{error}</div>}
      </form>

      <nav className="state-nav">
        {STATES.map(s =>
          <button
            key={s.value}
            className={`state-btn${stateFilter === s.value ? " active" : ""}`}
            onClick={() => setStateFilter(s.value)}
          >{s.label}</button>
        )}
      </nav>

      <section className="task-list">
        <h2 className="section-title">{STATES.find(s => s.value === stateFilter)?.label ?? ""}</h2>
        <ul className="task-ul">
          {getSortedTasks(stateFilter).length === 0 ? (
            <li className="empty-state">No hay tareas en este estado</li>
          ) : (
            getSortedTasks(stateFilter).map(task => {
              const importanceObj = getImportanceObj(task.importance);
              return (
                <li className={`task-li imp-${task.importance}`} key={task.id}
                  style={{ borderLeftColor: importanceObj.color, background: `var(--bg-imp-${task.importance})` }}>
                  <div className="li-main">
                    <span className="li-imp-dot" style={{ background: importanceObj.color }} title={`Importancia: ${importanceObj.label}`}></span>
                    <span className="li-title">{task.desc}</span>
                  </div>
                  <div className="li-details">
                    <span className="li-attr">{humanizeDuration(task.duration)}</span>
                    <span className="li-attr">{humanizeDuration(task.period)}</span>
                    <span className="li-attr">{importanceObj.label}</span>
                    {task.state === "aldia" && (
                      <span className={`li-attr ${getMsToNextPending(task) <= 0 ? "expired" : ""}`}>
                        {getHumanTimeLeft(getMsToNextPending(task))}
                      </span>
                    )}
                  </div>
                  <div className="li-actions">
                    <button className="actbtn iconbtn" title="Editar" onClick={() => handleEdit(task.id)}>
                      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M2.5 14.81V17.5h2.69l8.09-8.09-2.69-2.69L2.5 14.81zm14.71-8.04a1 1 0 0 0 0-1.42l-2.36-2.36a1 1 0 0 0-1.42 0l-1.83 1.83 3.78 3.78 1.83-1.83z"/></svg>
                    </button>
                    <button className="actbtn iconbtn" title="Eliminar" onClick={() => handleDelete(task.id)}>
                      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M6 8v8m4-8v8m4-8v8M4 6h12M9 2h2a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z"/></svg>
                    </button>
                    <button
                      className={`btn li-main-btn ${task.state === "aldia" ? "warn-btn" : "main-btn"}`}
                      onClick={() => handleStateChange(task.id, task.state === "aldia" ? "pendiente" : "aldia")}
                    >
                      {task.state === "aldia" ? "⏪ Pendiente" : "✅ Al día"}
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>
      <footer className="footer">
        <span>Hecho con <span role="img" aria-label="corazón">💜</span> por Jontalas</span>
      </footer>
    </div>
  );
}

export default App;