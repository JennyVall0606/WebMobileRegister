const express = require('express');
const router = express.Router();
const db = require('../db'); 

router.post('/add', async (req, res) => {
    const { 
        chip_animal, 
        fecha_pesaje, 
        peso_kg, 
        costo_compra, 
        costo_venta, 
        precio_kg_compra, 
        precio_kg_venta,
        tipo_seguimiento,
        ganancia_peso,
        ganancia_valor,
        tiempo_meses
    } = req.body;

    if (!chip_animal || !fecha_pesaje || !peso_kg || !tipo_seguimiento) {
        return res.status(400).json({ error: "Los campos chip_animal, fecha_pesaje, peso_kg y tipo_seguimiento son obligatorios" });
    }

    try {
        const [checkResult] = await db.query(`SELECT id FROM registro_animal WHERE chip_animal = ?`, [chip_animal]);

        if (checkResult.length === 0) {
            return res.status(404).json({ error: "El chip_animal no está registrado" });
        }

        const registro_animal_id = checkResult[0].id;

        const [insertResult] = await db.query(
            `INSERT INTO historico_pesaje (
                registro_animal_id, 
                chip_animal, 
                fecha_pesaje, 
                peso_kg, 
                costo_compra, 
                costo_venta, 
                precio_kg_compra, 
                precio_kg_venta,
                tipo_seguimiento,
                ganancia_peso,
                ganancia_valor,
                tiempo_meses
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                registro_animal_id, 
                chip_animal, 
                fecha_pesaje, 
                peso_kg, 
                costo_compra || null, 
                costo_venta || null, 
                precio_kg_compra || null, 
                precio_kg_venta || null,
                tipo_seguimiento,
                ganancia_peso || null,
                ganancia_valor || null,
                tiempo_meses || null
            ]
        );

        res.status(201).json({ message: "Pesaje agregado correctamente", id: insertResult.insertId });

    } catch (err) {
        console.error("Error al agregar el pesaje:", err);
        res.status(500).json({ error: "Error al agregar el pesaje" });
    }
});

// NUEVO ENDPOINT: Obtener datos de compra para calcular ganancias
router.get('/compra/:chip_animal', async (req, res) => {
    const { chip_animal } = req.params;

    try {
        const [results] = await db.query(
            `SELECT 
                id, 
                fecha_pesaje, 
                chip_animal, 
                peso_kg, 
                costo_compra, 
                precio_kg_compra,
                tipo_seguimiento
            FROM historico_pesaje 
            WHERE chip_animal = ? 
            AND tipo_seguimiento = 'compra' 
            ORDER BY fecha_pesaje DESC 
            LIMIT 1`, 
            [chip_animal]
        );

        if (results.length === 0) {
            return res.status(404).json({ error: "No se encontró un registro de compra para este animal" });
        }

        res.json(results[0]);

    } catch (err) {
        console.error("Error al obtener datos de compra:", err);
        res.status(500).json({ error: "Error al obtener datos de compra" });
    }
});

router.delete('/delete/:chip_animal', async (req, res) => {
    const { chip_animal } = req.params;

    try {
        const [checkResult] = await db.query(`SELECT * FROM historico_pesaje WHERE chip_animal = ?`, [chip_animal]);

        if (checkResult.length === 0) {
            return res.status(404).json({ error: "Pesaje no encontrado" });
        }

        await db.query(`DELETE FROM historico_pesaje WHERE chip_animal = ?`, [chip_animal]);

        res.json({ message: "Pesaje eliminado correctamente" });

    } catch (err) {
        console.error("Error al eliminar el pesaje:", err);
        res.status(500).json({ error: "Error al eliminar el pesaje" });
    }
});

router.get('/all', async (req, res) => {
    try {
        const [results] = await db.query(`SELECT * FROM vista_historico_pesaje`);
        res.json(results);
    } catch (err) {
        console.error("Error al obtener los pesajes:", err);
        res.status(500).json({ error: "Error al obtener los pesajes" });
    }
});

router.get('/historico-pesaje', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                id, 
                fecha_pesaje, 
                chip_animal, 
                peso_kg, 
                costo_compra, 
                costo_venta, 
                precio_kg_compra, 
                precio_kg_venta,
                tipo_seguimiento,
                ganancia_peso,
                ganancia_valor,
                tiempo_meses
            FROM historico_pesaje
            ORDER BY fecha_pesaje DESC
        `);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron registros de pesaje' });
        }
  
        const response = rows.map(row => ({
            id: row.id,
            fecha: row.fecha_pesaje,
            chip: row.chip_animal,
            peso: row.peso_kg,
            costo_compra: row.costo_compra,
            costo_venta: row.costo_venta,
            precio_kg_compra: row.precio_kg_compra,
            precio_kg_venta: row.precio_kg_venta,
            tipo_seguimiento: row.tipo_seguimiento,
            ganancia_peso: row.ganancia_peso,
            ganancia_valor: row.ganancia_valor,
            tiempo_meses: row.tiempo_meses
        }));
  
        res.json(response);
    } catch (error) {
        console.error('Error al obtener histórico:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

router.get('/:chip_animal', async (req, res) => {
    const { chip_animal } = req.params;

    try {
        const [results] = await db.query(
            `SELECT 
                id, 
                fecha_pesaje, 
                chip_animal, 
                peso_kg, 
                costo_compra, 
                costo_venta, 
                precio_kg_compra, 
                precio_kg_venta,
                tipo_seguimiento,
                ganancia_peso,
                ganancia_valor,
                tiempo_meses
            FROM historico_pesaje 
            WHERE chip_animal = ?
            ORDER BY fecha_pesaje DESC`, 
            [chip_animal]
        );

        if (results.length === 0) {
            return res.status(404).json({ error: "No se encontraron pesajes para este chip_animal" });
        }

        res.json(results);

    } catch (err) {
        console.error("Error al obtener el pesaje:", err);
        res.status(500).json({ error: "Error al obtener el pesaje" });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;  
    const { 
        fecha_pesaje, 
        peso_kg, 
        costo_compra, 
        costo_venta, 
        precio_kg_compra, 
        precio_kg_venta,
        tipo_seguimiento,
        ganancia_peso,
        ganancia_valor,
        tiempo_meses
    } = req.body;

    if (!fecha_pesaje || !peso_kg) {
        return res.status(400).json({ error: "Los campos fecha_pesaje y peso_kg son obligatorios" });
    }

    try {
        const [pesajeResult] = await db.query(
            `SELECT * FROM historico_pesaje WHERE id = ?`, [id]
        );

        if (pesajeResult.length === 0) {
            return res.status(404).json({ error: "Pesaje no encontrado con el ID proporcionado" });
        }

        const [updateResult] = await db.query(
            `UPDATE historico_pesaje SET 
                fecha_pesaje = ?, 
                peso_kg = ?, 
                costo_compra = ?, 
                costo_venta = ?, 
                precio_kg_compra = ?, 
                precio_kg_venta = ?,
                tipo_seguimiento = ?,
                ganancia_peso = ?,
                ganancia_valor = ?,
                tiempo_meses = ?
            WHERE id = ?`,
            [
                fecha_pesaje, 
                peso_kg, 
                costo_compra || null,
                costo_venta || null,
                precio_kg_compra || null,
                precio_kg_venta || null,
                tipo_seguimiento || null,
                ganancia_peso || null,
                ganancia_valor || null,
                tiempo_meses || null,
                id
            ]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: "No se pudo actualizar el pesaje" });
        }

        res.json({ message: "Pesaje actualizado correctamente" });

    } catch (err) {
        console.error("Error al actualizar el pesaje:", err);
        res.status(500).json({ error: "Error al actualizar el pesaje" });
    }
});

router.put('/chip/:chip_animal', async (req, res) => {
    const { chip_animal } = req.params;
    const { 
        fecha_pesaje, 
        peso_kg, 
        costo_compra, 
        costo_venta, 
        precio_kg_compra, 
        precio_kg_venta,
        tipo_seguimiento,
        ganancia_peso,
        ganancia_valor,
        tiempo_meses
    } = req.body;

    if (!fecha_pesaje || !peso_kg) {
        return res.status(400).json({ error: "Los campos fecha_pesaje y peso_kg son obligatorios" });
    }

    try {
        const [pesajeResult] = await db.query(
            `SELECT * FROM historico_pesaje WHERE chip_animal = ?`, [chip_animal]
        );

        if (pesajeResult.length === 0) {
            return res.status(404).json({ error: "No se encontró un pesaje para este chip_animal" });
        }

        const [updateResult] = await db.query(
            `UPDATE historico_pesaje SET 
                fecha_pesaje = ?, 
                peso_kg = ?, 
                costo_compra = ?, 
                costo_venta = ?, 
                precio_kg_compra = ?, 
                precio_kg_venta = ?,
                tipo_seguimiento = ?,
                ganancia_peso = ?,
                ganancia_valor = ?,
                tiempo_meses = ?
            WHERE chip_animal = ?`,
            [
                fecha_pesaje, 
                peso_kg, 
                costo_compra || null,
                costo_venta || null,
                precio_kg_compra || null,
                precio_kg_venta || null,
                tipo_seguimiento || null,
                ganancia_peso || null,
                ganancia_valor || null,
                tiempo_meses || null,
                chip_animal
            ]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: "No se pudo actualizar el pesaje" });
        }

        res.json({ message: "Pesaje actualizado correctamente" });

    } catch (err) {
        console.error("Error al actualizar el pesaje:", err);
        res.status(500).json({ error: "Error al actualizar el pesaje" });
    }
});

module.exports = router;