const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken } = require('./auth');
const { adminOUser, cualquierUsuario } = require('../middlewares/authorization');

router.post('/add', verificarToken, adminOUser, async (req, res) => {
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
        ganancia_peso_parcial,
        ganancia_valor,
        tiempo_meses
    } = req.body;

    const rolUsuario = req.usuario.rol;
    const idUsuario = req.usuario.id;

    if (!chip_animal || !fecha_pesaje || !peso_kg) {
        return res.status(400).json({ error: "Los campos chip_animal, fecha_pesaje y peso_kg son obligatorios" });
    }

    try {
        const [checkResult] = await db.query(
            `SELECT id, id_usuario FROM registro_animal WHERE chip_animal = ?`, 
            [chip_animal]
        );

        if (checkResult.length === 0) {
            return res.status(404).json({ error: "El chip_animal no está registrado" });
        }

        const registro_animal_id = checkResult[0].id;
        const id_usuario_animal = checkResult[0].id_usuario;

        if (rolUsuario !== 'admin' && id_usuario_animal !== idUsuario) {
            return res.status(403).json({ 
                error: "No tienes permiso para registrar pesajes en este animal" 
            });
        }

        const tipoSeguimientoValido = ['compra', 'venta', 'seguimiento', 'nacimiento'].includes(tipo_seguimiento) 
            ? tipo_seguimiento 
            : 'seguimiento';

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
                ganancia_peso_parcial,
                tiempo_meses
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                registro_animal_id, 
                chip_animal, 
                fecha_pesaje, 
                peso_kg, 
                costo_compra || null, 
                costo_venta || null, 
                precio_kg_compra || null, 
                precio_kg_venta || null,
                tipoSeguimientoValido,
                ganancia_peso || null,
                ganancia_valor || null,
                ganancia_peso_parcial || null,
                tiempo_meses || null
            ]
        );

        res.status(201).json({ message: "Pesaje agregado correctamente", id: insertResult.insertId });

    } catch (err) {
        console.error("Error al agregar el pesaje:", err);
        res.status(500).json({ error: "Error al agregar el pesaje" });
    }
});

router.get('/compra/:chip_animal', verificarToken, cualquierUsuario, async (req, res) => {
    const { chip_animal } = req.params;
    const rolUsuario = req.usuario.rol;
    const idUsuario = req.usuario.id;

    try {
        let query = `
            SELECT 
                hp.id, 
                hp.fecha_pesaje, 
                hp.chip_animal, 
                hp.peso_kg, 
                hp.costo_compra, 
                hp.precio_kg_compra,
                hp.tipo_seguimiento
            FROM historico_pesaje hp
            JOIN registro_animal ra ON hp.chip_animal = ra.chip_animal
            WHERE hp.chip_animal = ? 
            AND hp.tipo_seguimiento = 'compra'
            ${rolUsuario !== 'admin' ? 'AND ra.id_usuario = ?' : ''}
            ORDER BY hp.fecha_pesaje DESC 
            LIMIT 1
        `;

        const params = rolUsuario === 'admin' ? [chip_animal] : [chip_animal, idUsuario];
        let [results] = await db.query(query, params);

        if (results.length === 0) {
            query = `
                SELECT 
                    hp.id, 
                    hp.fecha_pesaje, 
                    hp.chip_animal, 
                    hp.peso_kg, 
                    hp.costo_compra, 
                    hp.precio_kg_compra,
                    hp.tipo_seguimiento
                FROM historico_pesaje hp
                JOIN registro_animal ra ON hp.chip_animal = ra.chip_animal
                WHERE hp.chip_animal = ? 
                AND hp.costo_compra IS NOT NULL
                ${rolUsuario !== 'admin' ? 'AND ra.id_usuario = ?' : ''}
                ORDER BY hp.fecha_pesaje ASC 
                LIMIT 1
            `;

            [results] = await db.query(query, params);
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "No se encontró un registro de compra para este animal" });
        }

        res.json(results[0]);

    } catch (err) {
        console.error("Error al obtener datos de compra:", err);
        res.status(500).json({ error: "Error al obtener datos de compra" });
    }
});

router.delete('/delete/:chip_animal', verificarToken, adminOUser, async (req, res) => {
    const { chip_animal } = req.params;
    const rolUsuario = req.usuario.rol;
    const idUsuario = req.usuario.id;

    try {
        const [checkAnimal] = await db.query(
            `SELECT id_usuario FROM registro_animal WHERE chip_animal = ?`,
            [chip_animal]
        );

        if (checkAnimal.length === 0) {
            return res.status(404).json({ error: "Animal no encontrado" });
        }

        if (rolUsuario !== 'admin' && checkAnimal[0].id_usuario !== idUsuario) {
            return res.status(403).json({ 
                error: "No tienes permiso para eliminar pesajes de este animal" 
            });
        }

        const [checkResult] = await db.query(
            `SELECT * FROM historico_pesaje WHERE chip_animal = ?`, 
            [chip_animal]
        );

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

router.get('/all', verificarToken, cualquierUsuario, async (req, res) => {
    const rolUsuario = req.usuario.rol;
    const idUsuario = req.usuario.id;

    try {
        let query;
        let params = [];

        if (rolUsuario === 'admin') {
            query = `SELECT * FROM vista_historico_pesaje`;
        } else {
            query = `
                SELECT vhp.* 
                FROM vista_historico_pesaje vhp
                JOIN registro_animal ra ON vhp.chip_animal = ra.chip_animal
                WHERE ra.id_usuario = ?
            `;
            params = [idUsuario];
        }

        const [results] = await db.query(query, params);
        res.json(results);
    } catch (err) {
        console.error("Error al obtener los pesajes:", err);
        res.status(500).json({ error: "Error al obtener los pesajes" });
    }
});

router.get('/historico-pesaje', verificarToken, cualquierUsuario, async (req, res) => {
    const rolUsuario = req.usuario.rol;
    const idUsuario = req.usuario.id;

    try {
        let query;
        let params = [];

        if (rolUsuario === 'admin') {
            query = `
                SELECT 
                    id, 
                    fecha_pesaje, 
                    chip_animal, 
                    peso_kg, 
                    costo_compra, 
                    costo_venta, 
                    precio_kg_compra, 
                    precio_kg_venta,
                    CASE 
                        WHEN tipo_seguimiento IS NULL AND costo_compra IS NULL AND costo_venta IS NULL 
                        THEN 'nacimiento'
                        ELSE tipo_seguimiento
                    END as tipo_seguimiento,
                    ganancia_peso,
                    ganancia_valor,
                    tiempo_meses
                FROM historico_pesaje
                ORDER BY fecha_pesaje DESC
            `;
        } else {
            query = `
                SELECT 
                    hp.id, 
                    hp.fecha_pesaje, 
                    hp.chip_animal, 
                    hp.peso_kg, 
                    hp.costo_compra, 
                    hp.costo_venta, 
                    hp.precio_kg_compra, 
                    hp.precio_kg_venta,
                    CASE 
                        WHEN hp.tipo_seguimiento IS NULL AND hp.costo_compra IS NULL AND hp.costo_venta IS NULL 
                        THEN 'nacimiento'
                        ELSE hp.tipo_seguimiento
                    END as tipo_seguimiento,
                    hp.ganancia_peso,
                    hp.ganancia_valor,
                    hp.tiempo_meses
                FROM historico_pesaje hp
                JOIN registro_animal ra ON hp.chip_animal = ra.chip_animal
                WHERE ra.id_usuario = ?
                ORDER BY hp.fecha_pesaje DESC
            `;
            params = [idUsuario];
        }
        
        const [rows] = await db.query(query, params);
        
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

router.get('/:chip_animal', verificarToken, cualquierUsuario, async (req, res) => {
    const { chip_animal } = req.params;
    const rolUsuario = req.usuario.rol;
    const idUsuario = req.usuario.id;

    try {
        let query = `
            SELECT 
                hp.id, 
                hp.fecha_pesaje, 
                hp.chip_animal, 
                hp.peso_kg, 
                hp.costo_compra, 
                hp.costo_venta, 
                hp.precio_kg_compra, 
                hp.precio_kg_venta,
                hp.tipo_seguimiento,
                hp.ganancia_peso,
                hp.ganancia_valor,
                hp.tiempo_meses
            FROM historico_pesaje hp
            JOIN registro_animal ra ON hp.chip_animal = ra.chip_animal
            WHERE hp.chip_animal = ?
            ${rolUsuario !== 'admin' ? 'AND ra.id_usuario = ?' : ''}
            ORDER BY hp.fecha_pesaje DESC
        `;

        const params = rolUsuario === 'admin' ? [chip_animal] : [chip_animal, idUsuario];
        const [results] = await db.query(query, params);

        if (results.length === 0) {
            return res.status(404).json({ error: "No se encontraron pesajes para este chip_animal" });
        }

        res.json(results);

    } catch (err) {
        console.error("Error al obtener el pesaje:", err);
        res.status(500).json({ error: "Error al obtener el pesaje" });
    }
});

router.put('/:id', verificarToken, adminOUser, async (req, res) => {
    const { id } = req.params;
    const rolUsuario = req.usuario.rol;
    const idUsuario = req.usuario.id;

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
            `SELECT hp.*, ra.id_usuario 
             FROM historico_pesaje hp
             JOIN registro_animal ra ON hp.chip_animal = ra.chip_animal
             WHERE hp.id = ?`, 
            [id]
        );

        if (pesajeResult.length === 0) {
            return res.status(404).json({ error: "Pesaje no encontrado con el ID proporcionado" });
        }

        if (rolUsuario !== 'admin' && pesajeResult[0].id_usuario !== idUsuario) {
            return res.status(403).json({ 
                error: "No tienes permiso para modificar este pesaje" 
            });
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

router.put('/chip/:chip_animal', verificarToken, adminOUser, async (req, res) => {
    const { chip_animal } = req.params;
    const rolUsuario = req.usuario.rol;
    const idUsuario = req.usuario.id;

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
        const [animalResult] = await db.query(
            `SELECT id_usuario FROM registro_animal WHERE chip_animal = ?`,
            [chip_animal]
        );

        if (animalResult.length === 0) {
            return res.status(404).json({ error: "Animal no encontrado" });
        }

        if (rolUsuario !== 'admin' && animalResult[0].id_usuario !== idUsuario) {
            return res.status(403).json({ 
                error: "No tienes permiso para modificar pesajes de este animal" 
            });
        }

        const [pesajeResult] = await db.query(
            `SELECT * FROM historico_pesaje WHERE chip_animal = ?`, 
            [chip_animal]
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