require('dotenv').config();
const express = require('express');
const db = require('./db');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================
const { router: authRoutes } = require('./routes/auth');
app.use('/api', authRoutes);

// ============================================
// RUTAS DE USUARIOS (Solo Admin)
// ============================================
const usersRoutes = require('./routes/user');
app.use('/api/usuarios', usersRoutes);

// ============================================
// ⭐ RUTAS DE FINCAS (Solo Admin)
// ============================================
const fincasRoutes = require('./routes/fincas');
app.use('/api/fincas', fincasRoutes);

// ============================================
// RUTAS DE REGISTRO Y ANIMALES
// ============================================
const registerRoutes = require('./routes/register');
app.use('/register', registerRoutes);

// ============================================
// RUTAS DE VACUNAS
// ============================================
const vaccinesRoutes = require('./routes/vaccines');
app.use('/vaccines', vaccinesRoutes);

// ============================================
// RUTAS DE PESAJES
// ============================================
const weighingRoutes = require('./routes/weighing');
app.use('/weighing', weighingRoutes);

// ============================================
// RUTAS DE SINCRONIZACIÓN
// ============================================
const syncRoutes = require('./routes/sync');
app.use('/api/sync', syncRoutes);

// ============================================
// ARCHIVOS ESTÁTICOS
// ============================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// RUTA DE PRUEBA DE BASE DE DATOS
// ============================================
app.get('/test-db', (req, res) => {
  db.query('SELECT 1 + 1 AS result', (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error en la consulta' });
    }
    res.json({ message: 'Conexión exitosa', result: results[0].result });
  });
});

// ============================================
// RUTA RAÍZ - DOCUMENTACIÓN DE LA API
// ============================================
app.get('/', (req, res) => {
  res.json({
    mensaje: "🌾 API AgroGestor - Sistema de Gestión Ganadera",
    version: "2.1.0",
    endpoints: {
      autenticacion: {
        login: "POST /api/login",
        registro: "POST /api/registroUser (Solo Admin)",
        refresh: "POST /api/refresh"
      },
      usuarios: {
        listar: "GET /api/usuarios (Solo Admin)",
        obtener: "GET /api/usuarios/:id (Solo Admin)",
        crear: "POST /api/usuarios (Solo Admin) - Requiere: correo, contraseña, rol, finca_id",
        actualizar: "PUT /api/usuarios/:id (Solo Admin)",
        eliminar: "DELETE /api/usuarios/:id (Solo Admin)",
        verContraseña: "GET /api/usuarios/:id/contraseña (Solo Admin)"
      },
      fincas: {
        listar: "GET /api/fincas (Solo Admin)",
        obtener: "GET /api/fincas/:id (Solo Admin)",
        estadisticas: "GET /api/fincas/:id/estadisticas (Solo Admin)",
        crear: "POST /api/fincas (Solo Admin) - Requiere: nombre, nit",
        actualizar: "PUT /api/fincas/:id (Solo Admin)",
        cambiarEstado: "PATCH /api/fincas/:id/estado (Solo Admin)",
        eliminar: "DELETE /api/fincas/:id (Solo Admin)"
      },
      animales: {
        listar: "GET /register/all (Todos - filtrado por finca)",
        obtener: "GET /register/animal/:chip (Todos - filtrado por finca)",
        crear: "POST /register/add (Admin, User)",
        actualizar: "PUT /register/update/:chip (Admin, User)",
        eliminar: "DELETE /register/delete/:chip (Admin, User)"
      },
      vacunas: {
        listar: "GET /vaccines/all (Todos - filtrado por finca)",
        historico: "GET /vaccines/historico-vacunas (Todos - filtrado por finca)",
        crear: "POST /vaccines/add (Admin, User)",
        actualizar: "PUT /vaccines/:id (Admin, User)",
        eliminar: "DELETE /vaccines/delete/:chip (Admin, User)"
      },
      pesajes: {
        listar: "GET /weighing/all (Todos - filtrado por finca)",
        historico: "GET /weighing/historico-pesaje (Todos - filtrado por finca)",
        crear: "POST /weighing/add (Admin, User)",
        actualizar: "PUT /weighing/:id (Admin, User)",
        eliminar: "DELETE /weighing/delete/:chip (Admin, User)"
      }
    },
    roles: {
      admin: {
        descripcion: "Acceso total al sistema",
        permisos: [
          "CRUD completo de fincas",
          "CRUD completo de usuarios",
          "CRUD completo de animales de su finca",
          "CRUD completo de vacunas y pesajes de su finca"
        ]
      },
      user: {
        descripcion: "Gestión de animales",
        permisos: [
          "Ver fincas (solo lectura)",
          "Ver usuarios (solo lectura)",
          "CRUD completo de animales de su finca",
          "CRUD completo de vacunas y pesajes de su finca"
        ]
      },
      viewer: {
        descripcion: "Solo consulta",
        permisos: [
          "Ver información de su finca",
          "Ver animales de su finca",
          "Ver historial de vacunas y pesajes"
        ]
      }
    },
    estructuraDeDatos: {
      usuario: {
        correo: "string (unique)",
        contraseña: "string (hash bcrypt)",
        rol: "enum ('admin', 'user', 'viewer')",
        finca_id: "integer (FK a fincas.id)"
      },
      finca: {
        nombre: "string",
        nit: "string (unique)",
        direccion: "string (opcional)",
        telefono: "string (opcional)",
        correo: "string (opcional)",
        activa: "boolean (default true)"
      },
      animal: {
        chip_animal: "string (unique)",
        foto: "string (URL)",
        fecha_nacimiento: "date",
        peso_nacimiento: "decimal",
        finca_id: "integer (FK a fincas.id)",
        "...": "otros campos"
      }
    },
    relacionesImportantes: {
      "Usuario → Finca": "Cada usuario pertenece a UNA finca",
      "Finca → Usuarios": "Una finca puede tener MÚLTIPLES usuarios",
      "Animal → Finca": "Cada animal pertenece a UNA finca",
      "Finca → Animales": "Una finca puede tener MÚLTIPLES animales"
    }
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Servidor escuchando en https://webmobileregister-production.up.railway.app');
  console.log('🛡️ Sistema de control de roles activado');
  console.log('🏢 CRUD de fincas habilitado (Solo Admin)');
  console.log('👥 CRUD de usuarios con asignación de finca habilitado (Solo Admin)');
});