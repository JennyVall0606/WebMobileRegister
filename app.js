require('dotenv').config();
const express = require('express');
const db = require('./db');
const cors = require('cors');
const path = require('path');
const redis = require('redis');

const app = express();
app.use(express.json());
app.use(cors());

const { router: authRoutes } = require('./routes/auth');
app.use('/api', authRoutes);

const usersRoutes = require('./routes/user');
app.use('/api/usuarios', usersRoutes);

const registerRoutes = require('./routes/register');
app.use('/register', registerRoutes);

const vaccinesRoutes = require('./routes/vaccines');
app.use('/vaccines', vaccinesRoutes);

const weighingRoutes = require('./routes/weighing');
app.use('/weighing', weighingRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const syncRoutes = require('./routes/sync');
app.use('/api/sync', syncRoutes);

app.get('/test-db', (req, res) => {
  db.query('SELECT 1 + 1 AS result', (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error en la consulta' });
    }
    res.json({ message: 'Conexión exitosa', result: results[0].result });
  });
});

app.get('/', (req, res) => {
  res.json({
    mensaje: "🌾 API AgroGestor - Sistema de Gestión Ganadera",
    version: "2.0.0",
    endpoints: {
      autenticacion: {
        login: "POST /api/login",
        registro: "POST /api/registroUser (Solo Admin)",
        refresh: "POST /api/refresh"
      },
      usuarios: {
        listar: "GET /api/usuarios (Solo Admin)",
        obtener: "GET /api/usuarios/:id (Solo Admin)",
        crear: "POST /api/usuarios (Solo Admin)",
        actualizar: "PUT /api/usuarios/:id (Solo Admin)",
        eliminar: "DELETE /api/usuarios/:id (Solo Admin)"
      },
      animales: {
        listar: "GET /register/all (Todos - filtrado por rol)",
        obtener: "GET /register/animal/:chip (Todos - filtrado por rol)",
        crear: "POST /register/add (Admin, User)",
        actualizar: "PUT /register/update/:chip (Admin, User)",
        eliminar: "DELETE /register/delete/:chip (Admin, User)"
      },
      vacunas: {
        listar: "GET /vaccines/all (Todos - filtrado por rol)",
        historico: "GET /vaccines/historico-vacunas (Todos - filtrado por rol)",
        crear: "POST /vaccines/add (Admin, User)",
        actualizar: "PUT /vaccines/:id (Admin, User)",
        eliminar: "DELETE /vaccines/delete/:chip (Admin, User)"
      },
      pesajes: {
        listar: "GET /weighing/all (Todos - filtrado por rol)",
        historico: "GET /weighing/historico-pesaje (Todos - filtrado por rol)",
        crear: "POST /weighing/add (Admin, User)",
        actualizar: "PUT /weighing/:id (Admin, User)",
        eliminar: "DELETE /weighing/delete/:chip (Admin, User)"
      }
    },
    roles: {
      admin: "CRUD completo de usuarios y animales",
      user: "CRUD completo de animales (solo propios)",
      viewer: "Solo lectura de animales (solo propios)"
    }
  });
});

const PORT = 3000;
app.listen(3000, '0.0.0.0', () => {
  console.log('🚀 Servidor escuchando en https://webmobileregister-production.up.railway.app');
  console.log('🛡️ Sistema de control de roles activado');
});