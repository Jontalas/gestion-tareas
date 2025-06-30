import React, { useState, useEffect, useRef } from "react";
import { parseDuration, humanizeDuration } from "./utils/timeUtils";
import "./App.css";

// Simulación de "backend" en localStorage (para demo)
function getUserKey(user) {
  return `tasks_${user?.email || "offline"}`;
}
function saveTasksForUser(user, tasks) {
  localStorage.setItem(getUserKey(user), JSON.stringify(tasks));
}
function loadTasksForUser(user) {
  const stored = localStorage.getItem(getUserKey(user));
  return stored ? JSON.parse(stored) : [];
}
function saveUserSession(user) {
  localStorage.setItem("loggedUser", JSON.stringify(user));
}
function loadUserSession() {
  const data = localStorage.getItem("loggedUser");
  return data ? JSON.parse(data) : null;
}
function clearUserSession() {
  localStorage.removeItem("loggedUser");
}

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

function getMsToNextPending(task) {
  if (!task.lastDone || task.state !== "aldia") return 0;
  const msPeriod = (task.period || 0) * 60 * 1000;
  const msLeft = task.lastDone + msPeriod - Date.now();
  return msLeft;
}
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
  // --- Login state ---
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  useEffect(() => {
    const u = loadUserSession();
    if (u) setUser(u);
  }, []);
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
    // Para demo: guardamos usuarios en localStorage ({"userdb":{email:{email,pass}}})
    const userdb = JSON.parse(localStorage.getItem("userdb") || "{}");
    if (!userdb[loginEmail]) {
      // Nuevo usuario
      userdb[loginEmail] = { email: loginEmail, pass: loginPass };
      localStorage.setItem("userdb", JSON.stringify(userdb));
    } else if (userdb[loginEmail].pass !== loginPass) {
      setLoginError("Contraseña incorrecta.");
      return;
    }
    const u = { email: loginEmail };
    setUser(u);
    saveUserSession(u);
    setLoginEmail("");
    setLoginPass("");
  }
  function handleLogout() {
    clearUserSession();
    setUser(null);
  }

  // --- Tareas ---
  const [tasks, setTasks] = useState([]);
  useEffect(() => {
    if (user) setTasks(loadTasksForUser(user));
  }, [user]);
  useEffect(() => {
    if (user) saveTasksForUser(user, tasks);
  }, [tasks, user]);

  // --- Resto de estados de la app ---
  const [desc, setDesc] = useState("");
  const [duration, setDuration] = useState("");
  const [period, setPeriod] = useState("");
  const [importance, setImportance] = useState("media");
  const [editIdx, setEditIdx] = useState(null);
  const [error, setError] = useState("");
  const [stateFilter, setStateFilter] = useState("pendiente");
  const [, setRefresh] = useState(0);
  const intervalRef = useRef();

  // Autorefresco para tiempos
  useEffect(() => {
    intervalRef.current = setInterval(() => setRefresh(x => x + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Cambio automático a pendiente
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

  // --- RENDER ---
  // Pantalla de login
  if (!user) {
    return (
      <div className="login-bg">
        <form className="login-box" onSubmit={handleLogin}>
          <h2>Iniciar sesión</h2>
          <input
            type="email"
            placeholder="Email"
            value={loginEmail}
            onChange={e => setLoginEmail(e.target.value)}
            autoFocus
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={loginPass}
            onChange={e => setLoginPass(e.target.value)}
            required
          />
          <button type="submit" className="btn main-btn" style={{width:"100%",marginTop:10}}>
            Entrar / Registrarse
          </button>
          {loginError && <div className="error-msg">{loginError}</div>}
          <div className="login-hint">Tus tareas quedarán asociadas a tu cuenta y accesibles desde cualquier dispositivo.</div>
        </form>
      </div>
    );
  }

  return (
    <div className="main-container compact">
      <header className="header-bar">
        <h1 className="logo">
          <span role="img" aria-label="tarea">📋</span> TaskFlow
        </h1>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <span className="user-email">{user.email}</span>
          <button className="btn logout-btn" title="Cerrar sesión" onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <section className="intro-card minimal">
        <strong>¡Bienvenido a TaskFlow!</strong>
        <p>
          Gestiona tus tareas recurrentes fácilmente.<br/>
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
        <div className="tasks-grid compact">
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
                    <button
                      className="actbtn iconbtn"
                      title="Editar"
                      onClick={() => handleEdit(globalIdx)}
                    >
                      <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M2.5 14.81V17.5h2.69l8.09-8.09-2.69-2.69L2.5 14.81zm14.71-8.04a1 1 0 0 0 0-1.42l-2.36-2.36a1 1 0 0 0-1.42 0l-1.83 1.83 3.78 3.78 1.83-1.83z"/></svg>
                    </button>
                    <button
                      className="actbtn iconbtn"
                      title="Eliminar"
                      onClick={() => handleDelete(globalIdx)}
                    >
                      <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M6 8v8m4-8v8m4-8v8M4 6h12M9 2h2a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z"/></svg>
                    </button>
                    <div className="main-actions">
                      {task.state === "pendiente" && (
                        <button className="btn main-btn highlight"
                          onClick={() => handleStateChange(globalIdx, "aldia")}
                        >✅ Marcar al día</button>
                      )}
                      {task.state === "aldia" && (
                        <button className="btn warn-btn highlight"
                          onClick={() => handleStateChange(globalIdx, "pendiente")}
                        >⏪ Marcar pendiente</button>
                      )}
                    </div>
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