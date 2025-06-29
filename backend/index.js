const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

// Crear app de Express
const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Conexión y configuración de SQLite
const db = new sqlite3.Database('./tasks.db', (err) => {
  if (err) {
    console.error("Error abriendo la base de datos:", err.message);
  } else {
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        duration INTEGER,
        periodicity INTEGER,
        importance INTEGER,
        status TEXT DEFAULT 'pending',
        lastCompleted INTEGER
      )
    `);
  }
});

// API: Obtener todas las tareas
app.get('/tasks', (req, res) => {
  db.all('SELECT * FROM tasks', [], (err, rows) => {
    if (err) {
      res.status(500).json({error: err.message});
    } else {
      res.json(rows);
    }
  });
});

// API: Crear nueva tarea
app.post('/tasks', (req, res) => {
  const { name, duration, periodicity, importance } = req.body;
  if (!name) {
    return res.status(400).json({error: 'El nombre es obligatorio'});
  }
  db.run(
    `INSERT INTO tasks (name, duration, periodicity, importance) VALUES (?, ?, ?, ?)`,
    [name, duration, periodicity, importance],
    function(err) {
      if (err) {
        res.status(500).json({error: err.message});
      } else {
        res.json({id: this.lastID, name, duration, periodicity, importance, status: 'pending'});
      }
    }
  );
});

// API: Editar tarea
app.put('/tasks/:id', (req, res) => {
  const { name, duration, periodicity, importance } = req.body;
  const { id } = req.params;
  db.run(
    `UPDATE tasks SET name = ?, duration = ?, periodicity = ?, importance = ? WHERE id = ?`,
    [name, duration, periodicity, importance, id],
    function(err) {
      if (err) {
        res.status(500).json({error: err.message});
      } else {
        res.json({id, name, duration, periodicity, importance});
      }
    }
  );
});

// API: Marcar tarea como "al día"
app.post('/tasks/:id/up-to-date', (req, res) => {
  const { id } = req.params;
  const now = Date.now();
  db.run(
    `UPDATE tasks SET status = 'up-to-date', lastCompleted = ? WHERE id = ?`,
    [now, id],
    function(err) {
      if (err) {
        res.status(500).json({error: err.message});
      } else {
        res.json({id, status: 'up-to-date', lastCompleted: now});
      }
    }
  );
});

// API: Comprobar y actualizar tareas a pendiente si vencieron
app.post('/tasks/check-status', (req, res) => {
  db.all('SELECT * FROM tasks WHERE status = "up-to-date"', [], (err, rows) => {
    if (err) {
      res.status(500).json({error: err.message});
    } else {
      const now = Date.now();
      rows.forEach(task => {
        if (task.periodicity && task.lastCompleted) {
          if (now - task.lastCompleted >= task.periodicity * 60 * 60 * 1000) { // periodicidad en horas
            db.run(`UPDATE tasks SET status = "pending" WHERE id = ?`, [task.id]);
          }
        }
      });
      res.json({message: 'Status actualizado'});
    }
  });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Backend escuchando en http://localhost:${port}`);
});