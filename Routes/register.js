const express = require('express');
const router = express.Router();
const db = require('../db');


router.post('/add', async (req, res) => {
  let { chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones } = req.body;

  if (!chip_animal || !peso_nacimiento || !raza_id_raza || !fecha_nacimiento) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const [razaResult] = await db.query(`SELECT id_raza FROM registro_ganadero.raza WHERE id_raza = ?`, [raza_id_raza]);

    if (razaResult.length === 0) {
      console.warn('Raza no encontrada, asignando "Otra Raza" (id 25)');
      raza_id_raza = 25;
    }

    const queryInsert = `
      INSERT INTO registro_ganadero.registro_animal 
      (chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

    const values = [chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones];

    const [result] = await db.query(queryInsert, values);
    res.status(201).json({ message: 'Registro agregado con éxito', id: result.insertId });

  } catch (error) {
    console.error('Error en la base de datos:', error);
    res.status(500).json({ error: 'Error al registrar' });
  }
});


router.delete('/delete/:chip_animal', async (req, res) => {
  const { chip_animal } = req.params;
  const query = `DELETE FROM registro_ganadero.registro_animal WHERE chip_animal = ?`;

  try {
    const [result] = await db.query(query, [chip_animal]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Registro no encontrado' });

    res.status(200).json({ message: 'Registro eliminado con éxito' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el registro' });
  }
});


router.get('/all', async (req, res) => {
  const query = `SELECT * FROM registro_ganadero.registro_animal`;

  try {
    const [results] = await db.query(query);
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los registros' });
  }
});


router.get('/animal/:chip_animal', async (req, res) => {
  const { chip_animal } = req.params;
  const query = `SELECT * FROM registro_ganadero.registro_animal WHERE chip_animal = ?`;

  try {
    const [results] = await db.query(query, [chip_animal]);
    if (results.length === 0) return res.status(404).json({ error: 'Registro no encontrado' });

    res.status(200).json(results[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el registro' });
  }
});


router.put('/update/:chip_animal', async (req, res) => {
  const { chip_animal } = req.params;
  let { peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones } = req.body;

  try {
    const [razaResult] = await db.query(`SELECT id_raza FROM registro_ganadero.raza WHERE id_raza = ?`, [raza_id_raza]);

    if (razaResult.length === 0) {
      console.warn('Raza no encontrada, asignando "Otra Raza" (id 25)');
      raza_id_raza = 25;
    }

    const queryUpdate = `
      UPDATE registro_ganadero.registro_animal 
      SET peso_nacimiento = ?, raza_id_raza = ?, fecha_nacimiento = ?, id_madre = ?, id_padre = ?, enfermedades = ?, observaciones = ?
      WHERE chip_animal = ?`;

    const values = [peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones, chip_animal];

    const [result] = await db.query(queryUpdate, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.status(200).json({ message: 'Registro actualizado con éxito', raza_actualizada: raza_id_raza });

  } catch (err) {
    console.error('Error en la base de datos:', err);
    res.status(500).json({ error: 'Error al actualizar el registro' });
  }
});


router.get('/razas', async (req, res) => {
  const query = `SELECT * FROM registro_ganadero.raza`;

  try {
    const [results] = await db.query(query);
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las razas' });
  }
});


module.exports = router;
