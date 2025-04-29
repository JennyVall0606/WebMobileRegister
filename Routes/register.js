const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDirectory = 'uploads';
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // asegura que la carpeta exista
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.post('/add', upload.single('foto'), async (req, res) => {
  let { chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No se subió una foto' });
  }
  console.log('Archivo recibido:', req.file);

  const fotoPrincipal = req.file.filename;

  // Convertir id_madre y id_padre a null si no están presentes
  id_madre = id_madre || null;
  id_padre = id_padre || null;
  enfermedades = enfermedades || null;
  observaciones = observaciones || null;

  try {
    const [razaResult] = await db.query(`SELECT id_raza FROM registro_ganadero.raza WHERE id_raza = ?`, [raza_id_raza]);

    if (razaResult.length === 0) {
      console.warn('Raza no encontrada, asignando "Otra Raza" (id 25)');
      raza_id_raza = 25;
    }

    const queryInsert = `
      INSERT INTO registro_ganadero.registro_animal 
      (foto, chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

    const values = [fotoPrincipal, chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones];

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

router.put('/update/:chip_animal', upload.single('foto'), async (req, res) => {
  const { chip_animal } = req.params;
  let { peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones } = req.body;

  try {
    const [razaResult] = await db.query(`SELECT id_raza FROM registro_ganadero.raza WHERE id_raza = ?`, [raza_id_raza]);

    if (razaResult.length === 0) {
      console.warn('Raza no encontrada, asignando "Otra Raza" (id 25)');
      raza_id_raza = 25;
    }

    const foto = req.file ? req.file.filename : null;

    // Convertir id_madre y id_padre a null si no están presentes
    id_madre = id_madre || null;
    id_padre = id_padre || null;
    enfermedades = enfermedades || null;
    observaciones = observaciones || null;

    let queryUpdate;
    let values;

    if (foto) {
      queryUpdate = `
        UPDATE registro_ganadero.registro_animal 
        SET foto = ?, chip_animal = ?, peso_nacimiento = ?, raza_id_raza = ?, fecha_nacimiento = ?, id_madre = ?, id_padre = ?, enfermedades = ?, observaciones = ? 
        WHERE chip_animal = ?`;
      values = [foto, chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones, chip_animal];
    } else {
      queryUpdate = `
        UPDATE registro_ganadero.registro_animal 
        SET peso_nacimiento = ?, chip_animal = ?, raza_id_raza = ?, fecha_nacimiento = ?, id_madre = ?, id_padre = ?, enfermedades = ?, observaciones = ? 
        WHERE chip_animal = ?`;
      values = [peso_nacimiento,  chip_animal, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones, chip_animal];
    }

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
