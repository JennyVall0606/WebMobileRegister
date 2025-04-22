require('dotenv').config();
const express = require('express');
const db = require('./db');

const app = express();
app.use(express.json());

const cors = require('cors');
app.use(cors());


// Importar rutas
const authRoutes = require('./routes/auth'); // 👈 AÑADIDO
app.use('/api', authRoutes);


const registerRoutes = require('./routes/register');
app.use('/register', registerRoutes);

const vaccinesRoutes = require('./routes/vaccines');
app.use('/vaccines', vaccinesRoutes);

const weighingRoutes = require('./routes/weighing');
app.use('/weighing', weighingRoutes);



// Ruta de prueba para verificar la conexión a MySQL
app.get('/test-db', (req, res) => {
  db.query('SELECT 1 + 1 AS result', (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error en la consulta' });
    }
    res.json({ message: 'Conexión exitosa', result: results[0].result });
  });
});

// Iniciar servidor
const PORT = 3000;
app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor escuchando en http://192.168.1.4:3000');
});
