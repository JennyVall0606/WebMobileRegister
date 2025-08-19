require('dotenv').config();
const express = require('express');
const db = require('./db');
const cors = require('cors');
const path = require('path');
const redis = require('redis');  // Asegúrate de que esta línea esté presente al principio de tu archivo




const app = express();
app.use(express.json());
app.use(cors());


// Importacion de rutas
const { router: authRoutes } = require('./routes/auth');
app.use('/api', authRoutes);

const registerRoutes = require('./routes/register');
app.use('/register', registerRoutes);

const vaccinesRoutes = require('./routes/vaccines');
app.use('/vaccines', vaccinesRoutes);

const weighingRoutes = require('./routes/weighing');
app.use('/weighing', weighingRoutes);
// Servir imágenes estáticas
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



// Ruta de prueba para verificar la conexión a MySQL
app.get('/test-db', (req, res) => {
  db.query('SELECT 1 + 1 AS result', (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error en la consulta' });
    }
    res.json({ message: 'Conexión exitosa', result: results[0].result });
  });
});


const PORT = 3000;
app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor escuchando en https://webmobileregister-production.up.railway.app');
});
