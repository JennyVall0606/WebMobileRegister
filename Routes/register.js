const express = require('express');
const router = express.Router();
const db = require('../db'); // ✅ Importamos db.js directamente

router.post('/add', (req, res) => {
  const { chip_animal, peso_nacimiento, raza_id_raza } = req.body;

  if (!chip_animal || !peso_nacimiento || !raza_id_raza) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const query = `INSERT INTO registro_animal (chip_animal, peso_nacimiento, raza_id_raza, created_at) VALUES (?, ?, ?, NOW())`;
  const values = [chip_animal, peso_nacimiento, raza_id_raza];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('❌ Error en la base de datos:', err);
      return res.status(500).json({ error: 'Error al registrar' });
    }
    res.status(201).json({ message: '🐄 Registro agregado con éxito', id: result.insertId });
  });
});

module.exports = router;
