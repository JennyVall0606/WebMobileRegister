const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/add', (req, res) => {
  let { chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones } = req.body;

  if (!chip_animal || !peso_nacimiento || !raza_id_raza || !fecha_nacimiento) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  console.log('Datos recibidos:', req.body);

  // Consulta para verificar si la raza existe
  const queryCheckRaza = `SELECT id_raza FROM registro_ganadero.raza WHERE id_raza = ?`;

  db.query(queryCheckRaza, [raza_id_raza], (err, results) => {
    if (err) {
      console.error(' Error en la base de datos:', err);
      return res.status(500).json({ error: 'Error al verificar la raza' });
    }

    if (results.length === 0) {
      console.warn(' Raza no encontrada, asignando "Otra Raza" (id 25)');
      raza_id_raza = 25; // Asignar automáticamente "Otra Raza"
    }

   
    const queryInsert = `
      INSERT INTO registro_ganadero.registro_animal 
      (chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

    const values = [chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones];

    db.query(queryInsert, values, (err, result) => {
      if (err) {
        console.error(' Error en la base de datos:', err);
        return res.status(500).json({ error: 'Error al registrar' });
      }
      res.status(201).json({ message: ' Registro agregado con éxito', id: result.insertId });
    });
  });
});

router.delete('/delete/:chip_animal', (req, res) => {
  const { chip_animal } = req.params;
  const query = `DELETE FROM registro_animal WHERE chip_animal = ?`;

  db.query(query, [chip_animal], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Registro no encontrado' });

    res.status(200).json({ message: ' Registro eliminado con éxito' });
  });
});

router.get('/all/', (req, res) => {
  const query = `SELECT * FROM registro_animal`;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener los registros' });
    res.status(200).json(results);
  });
});

router.get('/animal/:chip_animal', (req, res) => {
  const { chip_animal } = req.params;
  const query = `SELECT * FROM registro_animal WHERE chip_animal = ?`;

  db.query(query, [chip_animal], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener el registro' });
    if (results.length === 0) return res.status(404).json({ error: 'Registro no encontrado' });

    res.status(200).json(results[0]);
  });
});

router.put('/update/:chip_animal', (req, res) => {
  const { chip_animal } = req.params;
  let { peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones } = req.body;

  // Verificar si la raza existe
  const queryCheckRaza = `SELECT id_raza FROM registro_ganadero.raza WHERE id_raza = ?`;

  db.query(queryCheckRaza, [raza_id_raza], (err, results) => {
    if (err) {
      console.error(' Error en la base de datos:', err);
      return res.status(500).json({ error: 'Error al verificar la raza' });
    }

    if (results.length === 0) {
      console.warn('Raza no encontrada, asignando "Otra Raza" (id 25)');
      raza_id_raza = 25; // Asignar automáticamente "Otra Raza"
    }

    // Proceder con la actualización
    const queryUpdate = `
      UPDATE registro_ganadero.registro_animal 
      SET peso_nacimiento = ?, raza_id_raza = ?, fecha_nacimiento = ?, id_madre = ?, id_padre = ?, enfermedades = ?, observaciones = ?
      WHERE chip_animal = ?`;

    const values = [peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones, chip_animal];

    db.query(queryUpdate, values, (err, result) => {
      if (err) {
        console.error(' Error al actualizar en la base de datos:', err);
        return res.status(500).json({ error: 'Error al actualizar el registro' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Registro no encontrado' });
      }

      res.status(200).json({ message: ' Registro actualizado con éxito', raza_actualizada: raza_id_raza });
    });
  });
});


module.exports = router;
