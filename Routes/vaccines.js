const express = require('express');
const router = express.Router();
const db = require('../db'); 

// Método POST para registrar una vacuna
router.post('/add', (req, res) => {
    let { fecha_vacuna, tipo_vacunas_id_tipo_vacuna, chip_animal, nombre_vacunas_id_vacuna, dosis_administrada, observaciones } = req.body;

    if (!fecha_vacuna || !chip_animal || !dosis_administrada) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    // Buscar el ID del animal por el chip
    const queryCheckAnimal = `SELECT id FROM registro_animal WHERE chip_animal = ?`;
    
    db.query(queryCheckAnimal, [chip_animal], (err, results) => {
        if (err) {
            console.error('Error en la base de datos:', err);
            return res.status(500).json({ error: 'Error al verificar el chip del animal' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'El animal con este chip no existe en la base de datos' });
        }

        const registro_animal_id = results[0].id; // Obtener el ID del animal

        // Verificar si nombre_vacunas_id_vacuna existe en la base de datos
        const queryCheckVacuna = `SELECT id_vacuna FROM nombre_vacunas WHERE id_vacuna = ?`;

        db.query(queryCheckVacuna, [nombre_vacunas_id_vacuna], (err, results) => {
            if (err) {
                console.error('Error al verificar la vacuna:', err);
                return res.status(500).json({ error: 'Error al verificar la vacuna' });
            }

            // Si no existe, asignar ID 23
            if (results.length === 0) {
                console.warn(` ID ${nombre_vacunas_id_vacuna} no encontrado. Se asignará el ID 23.`);
                nombre_vacunas_id_vacuna = 23;
            }

            // Verificar si tipo_vacunas_id_tipo_vacuna existe en la base de datos
            const queryCheckTipoVacuna = `SELECT id_tipo_vacuna FROM tipo_vacunas WHERE id_tipo_vacuna = ?`;

            db.query(queryCheckTipoVacuna, [tipo_vacunas_id_tipo_vacuna], (err, results) => {
                if (err) {
                    console.error('Error al verificar el tipo de vacuna:', err);
                    return res.status(500).json({ error: 'Error al verificar el tipo de vacuna' });
                }

                // Si no existe, asignar ID 11
                if (results.length === 0) {
                    console.warn(` ID ${tipo_vacunas_id_tipo_vacuna} no encontrado. Se asignará el ID 11.`);
                    tipo_vacunas_id_tipo_vacuna = 11;
                }

                // Insertar la vacuna con los IDs actualizados
                const queryInsert = `
                    INSERT INTO historico_vacuna (fecha_vacuna, tipo_vacunas_id_tipo_vacuna, registro_animal_id, nombre_vacunas_id_vacuna, dosis_administrada, observaciones) 
                    VALUES (?, ?, ?, ?, ?, ?)`;

                const values = [fecha_vacuna, tipo_vacunas_id_tipo_vacuna, registro_animal_id, nombre_vacunas_id_vacuna, dosis_administrada, observaciones];

                db.query(queryInsert, values, (err, result) => {
                    if (err) {
                        console.error('Error al registrar la vacuna:', err);
                        return res.status(500).json({ error: 'Error al registrar la vacuna' });
                    }

                    res.status(201).json({ message: ' Vacuna registrada con éxito', id: result.insertId });
                });
            });
        });
    });
});

router.delete('/delete/:id', (req, res) => {
    const { id } = req.params;

    // Verificar si la vacuna existe antes de eliminarla
    const queryCheck = `SELECT * FROM historico_vacuna WHERE id = ?`;

    db.query(queryCheck, [id], (err, results) => {
        if (err) {
            console.error('Error al verificar la vacuna:', err);
            return res.status(500).json({ error: 'Error al verificar la vacuna' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: `No se encontró ninguna vacuna con el ID ${id}` });
        }

        // Eliminar la vacuna si existe
        const queryDelete = `DELETE FROM historico_vacuna WHERE id = ?`;

        db.query(queryDelete, [id], (err, result) => {
            if (err) {
                console.error('Error al eliminar la vacuna:', err);
                return res.status(500).json({ error: 'Error al eliminar la vacuna' });
            }

            res.status(200).json({ message: `✅ Vacuna con ID ${id} eliminada correctamente` });
        });
    });
});

router.get('/all', (req, res) => {
    const query = `SELECT * FROM vista_historico_vacuna`;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener las vacunas:', err);
            return res.status(500).json({ error: 'Error al obtener las vacunas' });
        }

        res.status(200).json(results);
    });
});

router.get('/animal/:chip_animal', (req, res) => {
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

    db.query(query, [chip_animal], (err, results) => {
        if (err) {
            console.error('Error al obtener las vacunas:', err);
            return res.status(500).json({ error: 'Error al obtener las vacunas' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: `No se encontraron registros de vacunas para el chip_animal ${chip_animal}` });
        }

        res.status(200).json(results);
    });
});

router.put('/animal/:chip_animal', (req, res) => {
    const { chip_animal } = req.params;
    const { nombre_vacunas_id_vacuna, tipo_vacunas_id_tipo_vacuna, fecha_vacuna, dosis_administrada, observaciones } = req.body;

    const query = `
        UPDATE historico_vacuna hv
        JOIN registro_animal ra ON hv.registro_animal_id = ra.id
        SET hv.nombre_vacunas_id_vacuna = ?, 
            hv.tipo_vacunas_id_tipo_vacuna = ?, 
            hv.fecha_vacuna = ?, 
            hv.dosis_administrada = ?, 
            hv.observaciones = ?
        WHERE ra.chip_animal = ?;
    `;

    db.query(query, [nombre_vacunas_id_vacuna, tipo_vacunas_id_tipo_vacuna, fecha_vacuna, dosis_administrada, observaciones, chip_animal], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error al actualizar la vacuna' });
        }
        res.json({ message: 'Vacuna actualizada correctamente' });
    });
});


       





module.exports = router;
