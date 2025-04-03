const express = require('express');
const router = express.Router();
const db = require('../db'); 



router.post('/add', (req, res) => {
    const { chip_animal, fecha_pesaje, peso_kg } = req.body;

    if (!chip_animal || !fecha_pesaje || !peso_kg) {
        return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    // Verificar si el chip_animal existe en registro_animal
    const checkQuery = `SELECT id FROM registro_animal WHERE chip_animal = ?`;

    db.query(checkQuery, [chip_animal], (err, results) => {
        if (err) {
            console.error("Error al verificar el chip_animal:", err);
            return res.status(500).json({ error: "Error al verificar el chip_animal" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "El chip_animal no está registrado" });
        }

        const registro_animal_id = results[0].id;

        // Insertar el pesaje en la tabla correcta
        const insertQuery = `INSERT INTO historico_pesaje (registro_animal_id, chip_animal, fecha_pesaje, peso_kg) VALUES (?, ?, ?, ?)`;

        db.query(insertQuery, [registro_animal_id, chip_animal, fecha_pesaje, peso_kg], (err, results) => {
            if (err) {
                console.error("Error al agregar el pesaje:", err);
                return res.status(500).json({ error: "Error al agregar el pesaje" });
            }
            res.status(201).json({ message: "Pesaje agregado correctamente", id: results.insertId });
        });
    });
});

router.delete('/delete/:id', (req, res) => {
    const { id } = req.params;

    // Verificar si el pesaje existe antes de eliminarlo
    const checkQuery = `SELECT * FROM historico_pesaje WHERE id = ?`;

    db.query(checkQuery, [id], (err, results) => {
        if (err) {
            console.error("Error al verificar el pesaje:", err);
            return res.status(500).json({ error: "Error al verificar el pesaje" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "Pesaje no encontrado" });
        }

        // Si existe, eliminarlo
        const deleteQuery = `DELETE FROM historico_pesaje WHERE id = ?`;

        db.query(deleteQuery, [id], (err, results) => {
            if (err) {
                console.error("Error al eliminar el pesaje:", err);
                return res.status(500).json({ error: "Error al eliminar el pesaje" });
            }

            res.json({ message: "Pesaje eliminado correctamente" });
        });
    });
});

router.get('/all', (req, res) => {
    const query = `SELECT * FROM vista_historico_pesaje`;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error al obtener los pesajes:", err);
            return res.status(500).json({ error: "Error al obtener los pesajes" });
        }

        res.json(results);
    });
});

router.get('/:chip_animal', (req, res) => {
    const { chip_animal } = req.params;

    const query = `SELECT * FROM vista_historico_pesaje WHERE chip_animal = ?`;

    db.query(query, [chip_animal], (err, results) => {
        if (err) {
            console.error("Error al obtener el pesaje:", err);
            return res.status(500).json({ error: "Error al obtener el pesaje" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "No se encontró un pesaje para este chip_animal" });
        }

        res.json(results[0]); // Retorna solo el primer registro encontrado
    });
});

router.put('/:chip_animal', (req, res) => {
    const { chip_animal } = req.params;
    const { fecha_pesaje, peso_kg } = req.body;

    if (!fecha_pesaje || !peso_kg) {
        return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    const query = `UPDATE historico_pesaje SET fecha_pesaje = ?, peso_kg = ? WHERE chip_animal = ?`;

    db.query(query, [fecha_pesaje, peso_kg, chip_animal], (err, results) => {
        if (err) {
            console.error("Error al actualizar el pesaje:", err);
            return res.status(500).json({ error: "Error al actualizar el pesaje" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: "No se encontró un pesaje para este chip_animal" });
        }

        res.json({ message: "Pesaje actualizado correctamente" });
    });
});

module.exports = router;






