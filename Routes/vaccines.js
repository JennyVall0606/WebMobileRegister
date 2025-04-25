const express = require('express');
const router = express.Router();
const db = require('../db');


router.post('/add', async (req, res) => {
    let { fecha_vacuna, tipo_vacunas_id_tipo_vacuna, chip_animal, nombre_vacunas_id_vacuna, dosis_administrada, observaciones } = req.body;

    if (!fecha_vacuna || !chip_animal || !dosis_administrada) {
        return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    try {
        const [animal] = await db.query('SELECT id FROM registro_animal WHERE chip_animal = ?', [chip_animal]);

        if (animal.length === 0) {
            return res.status(404).json({ error: 'El animal con este chip no existe en la base de datos' });
        }

        const registro_animal_id = animal[0].id;

        const [vacuna] = await db.query('SELECT id_vacuna FROM nombre_vacunas WHERE id_vacuna = ?', [nombre_vacunas_id_vacuna]);
        if (vacuna.length === 0) {
            nombre_vacunas_id_vacuna = 23;
        }

        const [tipoVacuna] = await db.query('SELECT id_tipo_vacuna FROM tipo_vacunas WHERE id_tipo_vacuna = ?', [tipo_vacunas_id_tipo_vacuna]);
        if (tipoVacuna.length === 0) {
            tipo_vacunas_id_tipo_vacuna = 11;
        }

        const insertQuery = `
            INSERT INTO historico_vacuna 
            (fecha_vacuna, tipo_vacunas_id_tipo_vacuna, registro_animal_id, nombre_vacunas_id_vacuna, dosis_administrada, observaciones) 
            VALUES (?, ?, ?, ?, ?, ?)`;

        const [result] = await db.query(insertQuery, [
            fecha_vacuna,
            tipo_vacunas_id_tipo_vacuna,
            registro_animal_id,
            nombre_vacunas_id_vacuna,
            dosis_administrada,
            observaciones
        ]);

        res.status(201).json({ message: 'Vacuna registrada con éxito', id: result.insertId });

    } catch (error) {
        console.error('❌ Error al registrar vacuna:', error);
        res.status(500).json({ error: 'Error al registrar la vacuna' });
    }
});

router.delete('/delete/:chip_animal', async (req, res) => {
    const { chip_animal } = req.params;

    try {
        
        const [animal] = await db.query('SELECT id FROM registro_animal WHERE chip_animal = ?', [chip_animal]);

        if (animal.length === 0) {
            return res.status(404).json({ error: 'El animal con este chip no existe en la base de datos' });
        }

        const registro_animal_id = animal[0].id;

        
        const [result] = await db.query('DELETE FROM historico_vacuna WHERE registro_animal_id = ?', [registro_animal_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'No se encontró el registro de vacuna para el animal' });
        }

        res.json({ message: 'Vacuna eliminada con éxito' });
    } catch (error) {
        console.error('❌ Error al eliminar vacuna:', error);
        res.status(500).json({ error: 'Error al eliminar la vacuna' });
    }
});


router.get('/all', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM historico_vacuna');
        res.json(results);
    } catch (error) {
        console.error('❌ Error al obtener vacunas:', error);
        res.status(500).json({ error: 'Error al obtener las vacunas' });
    }
});
router.get('/historico-vacunas', async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT id, chip_animal, fecha_vacuna, tipo_vacuna, nombre, dosis_administrada, observaciones
        FROM registro_ganadero.vista_historico_vacuna
        ORDER BY fecha_vacuna DESC
      `);
  
      if (rows.length === 0) {
        return res.status(404).json({ error: 'No se encontraron registros de vacunas' });
      }
  
     
      const response = rows.map(row => ({
        id: row.id,
        fecha: row.fecha_vacuna,
        chip: row.chip_animal,
        nombre: row.nombre,
        tipo: row.tipo_vacuna,
        dosis: row.dosis_administrada,
        obs: row.observaciones
      }));
  
      res.json(response);
    } catch (error) {
      console.error('Error al obtener histórico de vacunas:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  

router.get('/animal/:chip_animal', async (req, res) => {
    const { chip_animal } = req.params;

    const query = `
        SELECT 
            hv.fecha_vacuna, 
            nv.nombre AS nombre_vacuna, 
            tv.tipo AS tipo_vacuna, 
            ra.chip_animal, 
            hv.dosis_administrada, 
            hv.observaciones, 
            hv.created_at AS creado, 
            hv.updated_at AS actualizado
        FROM historico_vacuna hv
        JOIN registro_animal ra ON hv.registro_animal_id = ra.id
        LEFT JOIN nombre_vacunas nv ON hv.nombre_vacunas_id_vacuna = nv.id_vacuna
        LEFT JOIN tipo_vacunas tv ON hv.tipo_vacunas_id_tipo_vacuna = tv.id_tipo_vacuna
        WHERE ra.chip_animal = ?;
    `;

    try {
        const [results] = await db.query(query, [chip_animal]);

        if (results.length === 0) {
            return res.status(404).json({ error: `No se encontraron registros de vacunas para el chip_animal ${chip_animal}` });
        }

        res.status(200).json(results);
    } catch (err) {
        console.error('❌ Error al obtener las vacunas:', err);
        res.status(500).json({ error: 'Error al obtener las vacunas' });
    }
});

router.put('/:chip_animal', async (req, res) => {
    const { chip_animal } = req.params;
    const { fecha_vacuna, tipo_vacunas_id_tipo_vacuna, nombre_vacunas_id_vacuna, dosis_administrada, observaciones } = req.body;

    try {
        const updateQuery = `
            UPDATE historico_vacuna 
            SET fecha_vacuna = ?, tipo_vacunas_id_tipo_vacuna = ?, 
                nombre_vacunas_id_vacuna = ?, dosis_administrada = ?, observaciones = ? 
            WHERE id_historico = ?`;

        const [result] = await db.query(updateQuery, [
            fecha_vacuna,
            tipo_vacunas_id_tipo_vacuna,
            nombre_vacunas_id_vacuna,
            dosis_administrada,
            observaciones,
            chip_animal
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Vacuna no encontrada para actualizar' });
        }

        res.json({ message: 'Vacuna actualizada con éxito' });
    } catch (error) {
        console.error('❌ Error al actualizar vacuna:', error);
        res.status(500).json({ error: 'Error al actualizar la vacuna' });
    }
});


router.get('/tipos-vacuna', async (req, res) => {
    try {
        const [tipos] = await db.query('SELECT id_tipo_vacuna AS value, tipo AS label FROM tipo_vacunas');
        res.json(tipos);
    } catch (error) {
        console.error('❌ Error al obtener tipos de vacuna:', error);
        res.status(500).json({ error: 'Error al obtener tipos de vacuna' });
    }
});

router.get('/nombres-vacuna', async (req, res) => {
    try {
        const [nombres] = await db.query('SELECT id_vacuna AS value, nombre AS label FROM nombre_vacunas');
        res.json(nombres);
    } catch (error) {
        console.error('❌ Error al obtener nombres de vacuna:', error);
        res.status(500).json({ error: 'Error al obtener nombres de vacuna' });
    }
});


module.exports = router;
