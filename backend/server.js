const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// Crear directorios necesarios
const dirs = ['uploads', 'temp', 'data'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Base de datos SQLite
const db = new sqlite3.Database('./data/industrial_cycle_v2.db');

// Inicializar base de datos
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_cycles INTEGER,
    average_cycle_time REAL,
    confidence REAL,
    video_duration REAL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id INTEGER,
    cycle_number INTEGER,
    start_time REAL,
    end_time REAL,
    duration REAL,
    confidence REAL,
    body_keypoints TEXT,
    hand_keypoints TEXT,
    FOREIGN KEY (analysis_id) REFERENCES analyses (id)
  )`);
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend V2 funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/upload', (req, res) => {
  // Para esta demo, simplemente simulamos el procesamiento
  // En una implementación real, aquí procesarías el video
  
  setTimeout(() => {
    res.json({
      success: true,
      message: 'Video procesado correctamente',
      analysisId: `analysis_${Date.now()}`
    });
  }, 2000);
});

app.get('/api/analyses', (req, res) => {
  db.all(`SELECT * FROM analyses ORDER BY timestamp DESC`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/analyses/:id', (req, res) => {
  const analysisId = req.params.id;
  
  db.get(`SELECT * FROM analyses WHERE id = ?`, [analysisId], (err, analysis) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!analysis) {
      res.status(404).json({ error: 'Análisis no encontrado' });
      return;
    }
    
    db.all(`SELECT * FROM cycles WHERE analysis_id = ?`, [analysisId], (err, cycles) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        ...analysis,
        cycles: cycles.map(cycle => ({
          ...cycle,
          body_keypoints: JSON.parse(cycle.body_keypoints || '[]'),
          hand_keypoints: JSON.parse(cycle.hand_keypoints || '[]')
        }))
      });
    });
  });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Backend V2 ejecutándose en puerto ${PORT}`);
  console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
});

module.exports = app;