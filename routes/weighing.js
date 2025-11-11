const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken } = require('./auth');
const { adminOUser, cualquierUsuario, bloquearViewer } = require('../middlewares/authorization');

// ============================================
// POST /weighing/add - Crear nuevo pesaje
// Admin y User pueden crear
// ⭐ Viewer NO puede crear (bloqueado)
// ⭐ Admin puede trabajar sin finca_id asignado
// ============================================
router.post('/add', verificarToken, bloquearViewer, async (req, res) => {
    const rolUsuario = req.usuario?.rol;
    const finca_id = req.usuario?.finca_id;

    // ⭐ Admin puede trabajar sin finca_id asignado
    if (!finca_id && rolUsuario !== 'admin') {
        return res.status(400).json({ 
            error: "Usuario sin finca asignada",
            detalle: "El usuario debe tener una finca asignada"
        });
    }

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

    console.log("📥 Datos recibidos:", { chip_animal, fecha_pesaje, peso_kg });
    console.log("👤 Usuario registrando:", req.usuario.correo, "- Rol:", rolUsuario, "- Finca:", finca_id);

    if (!chip_animal || !fecha_pesaje || !peso_kg) {
        return res.status(400).json({ error: "Los campos chip_animal, fecha_pesaje y peso_kg son obligatorios" });
    }

    try {
        // ⭐ Buscar el animal (admin puede ver de cualquier finca)
        let checkQuery = `SELECT id, finca_id FROM registro_animal WHERE chip_animal = ?`;
        let checkParams = [chip_animal];

        if (rolUsuario !== 'admin' && finca_id) {
            checkQuery += ` AND finca_id = ?`;
            checkParams.push(finca_id);
        }

        const [checkResult] = await db.query(checkQuery, checkParams);

        if (checkResult.length === 0) {
            return res.status(404).json({ 
                error: rolUsuario === 'admin' 
                    ? "El chip_animal no está registrado" 
                    : "El chip_animal no está registrado en tu finca" 
            });
        }

        const registro_animal_id = checkResult[0].id;

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

        console.log("✅ Pesaje registrado con ID:", insertResult.insertId);

        res.status(201).json({ 
            message: "Pesaje agregado correctamente", 
            id: insertResult.insertId,
            chip_animal: chip_animal,
            registrado_por: req.usuario.correo
        });

    } catch (err) {
        console.error("❌ Error al agregar el pesaje:", err);
        res.status(500).json({ 
            error: "Error al agregar el pesaje",
            details: err.message
        });
    }
});

// ============================================
// GET /weighing/compra/:chip_animal - Obtener datos de compra
// ⭐ Admin puede ver de cualquier animal
// ============================================
router.get('/compra/:chip_animal', verificarToken, cualquierUsuario, async (req, res) => {
    const { chip_animal } = req.params;
    const finca_id = req.usuario.finca_id;
    const rolUsuario = req.usuario.rol;

    if (!finca_id && rolUsuario !== 'admin') {
        return res.status(400).json({ 
            error: "Usuario sin finca asignada" 
        });
    }

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
        `;

        let queryParams = [chip_animal];

        if (rolUsuario !== 'admin' && finca_id) {
            query += ` AND ra.finca_id = ?`;
            queryParams.push(finca_id);
        }

        query += ` AND hp.tipo_seguimiento = 'compra' ORDER BY hp.fecha_pesaje DESC LIMIT 1`;

        let [results] = await db.query(query, queryParams);

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
            `;

            queryParams = [chip_animal];

            if (rolUsuario !== 'admin' && finca_id) {
                query += ` AND ra.finca_id = ?`;
                queryParams.push(finca_id);
            }

            query += ` AND hp.costo_compra IS NOT NULL ORDER BY hp.fecha_pesaje ASC LIMIT 1`;

            [results] = await db.query(query, queryParams);
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "No se encontró un registro de compra para este animal" });
        }

        res.json(results[0]);

    } catch (err) {
        console.error("❌ Error al obtener datos de compra:", err);
        res.status(500).json({ error: "Error al obtener datos de compra" });
    }
});

// ============================================
// DELETE /weighing/delete/:chip_animal - Eliminar pesajes
// ⭐ Admin puede eliminar de cualquier finca
// ============================================
router.delete('/delete/:chip_animal', verificarToken, bloquearViewer, async (req, res) => {
    const { chip_animal } = req.params;
    const finca_id = req.usuario.finca_id;
    const rolUsuario = req.usuario.rol;

    console.log("🗑️ Intentando eliminar pesajes del chip:", chip_animal, "- Rol:", rolUsuario, "- Finca:", finca_id);

    try {
        // ⭐ Admin puede eliminar de cualquier finca
        let checkQuery = `SELECT finca_id FROM registro_animal WHERE chip_animal = ?`;
        let checkParams = [chip_animal];

        if (rolUsuario !== 'admin' && finca_id) {
            checkQuery += ` AND finca_id = ?`;
            checkParams.push(finca_id);
        }

        const [checkAnimal] = await db.query(checkQuery, checkParams);

        if (checkAnimal.length === 0) {
            return res.status(404).json({ error: "Animal no encontrado" });
        }

        const [checkResult] = await db.query(
            `SELECT * FROM historico_pesaje WHERE chip_animal = ?`, 
            [chip_animal]
        );

        if (checkResult.length === 0) {
            return res.status(404).json({ error: "Pesaje no encontrado" });
        }

        await db.query(`DELETE FROM historico_pesaje WHERE chip_animal = ?`, [chip_animal]);

        console.log("✅ Pesajes eliminados exitosamente");

        res.json({ 
            message: "Pesaje(s) eliminado(s) correctamente",
            eliminados: checkResult.length
        });

    } catch (err) {
        console.error("❌ Error al eliminar el pesaje:", err);
        res.status(500).json({ error: "Error al eliminar el pesaje" });
    }
});

// ============================================
// GET /weighing/all - Listar todos los pesajes
// ⭐ Admin ve todos, otros ven solo de su finca
// ============================================
router.get('/all', verificarToken, cualquierUsuario, async (req, res) => {
    const finca_id = req.usuario.finca_id;
    const rolUsuario = req.usuario.rol;

    console.log("📋 Listando pesajes - Usuario:", req.usuario.correo, "- Rol:", rolUsuario, "- Finca:", finca_id);

    if (!finca_id && rolUsuario !== 'admin') {
        return res.status(400).json({ 
            error: "Usuario sin finca asignada" 
        });
    }

    try {
        let query = `
            SELECT hp.* 
            FROM historico_pesaje hp
            JOIN registro_animal ra ON hp.chip_animal = ra.chip_animal
        `;

        let queryParams = [];

        if (rolUsuario !== 'admin' && finca_id) {
            query += ` WHERE ra.finca_id = ?`;
            queryParams.push(finca_id);
        }

        query += ` ORDER BY hp.fecha_pesaje DESC`;

        const [results] = await db.query(query, queryParams);

        console.log(`✅ ${results.length} pesajes encontrados`);

        res.json({
            total: results.length,
            finca_id: finca_id,
            pesajes: results
        });
    } catch (err) {
        console.error("❌ Error al obtener los pesajes:", err);
        res.status(500).json({ error: "Error al obtener los pesajes" });
    }
});

// ============================================
// GET /weighing/historico-pesaje - Histórico detallado
// ⭐ Admin ve todos, otros ven solo de su finca
// ============================================
router.get('/historico-pesaje', verificarToken, cualquierUsuario, async (req, res) => {
    const finca_id = req.usuario.finca_id;
    const rolUsuario = req.usuario.rol;

    // ⭐ Admin puede ver todos los historicos
    if (!finca_id && rolUsuario !== 'admin') {
        return res.status(400).json({ 
            error: "Usuario sin finca asignada" 
        });
    }

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
        `;

        let queryParams = [];

        // ⭐ Si no es admin, filtrar por finca
        if (rolUsuario !== 'admin' && finca_id) {
            query += ` WHERE ra.finca_id = ?`;
            queryParams.push(finca_id);
        }

        query += ` ORDER BY hp.fecha_pesaje DESC`;
        
        const [rows] = await db.query(query, queryParams);
        
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
        console.error('❌ Error al obtener histórico:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// ============================================
// GET /weighing/:chip_animal - Pesajes de un animal específico
// ⭐ Admin puede ver de cualquier animal
// ============================================
router.get('/:chip_animal', verificarToken, cualquierUsuario, async (req, res) => {
    const { chip_animal } = req.params;
    const finca_id = req.usuario.finca_id;
    const rolUsuario = req.usuario.rol;

    // ⭐ Admin puede ver cualquier animal
    if (!finca_id && rolUsuario !== 'admin') {
        return res.status(400).json({ 
            error: "Usuario sin finca asignada" 
        });
    }

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
        `;

        let queryParams = [chip_animal];

        // ⭐ Si no es admin, filtrar por finca
        if (rolUsuario !== 'admin' && finca_id) {
            query += ` AND ra.finca_id = ?`;
            queryParams.push(finca_id);
        }

        query += ` ORDER BY hp.fecha_pesaje DESC`;

        const [results] = await db.query(query, queryParams);

        if (results.length === 0) {
            return res.status(404).json({ error: "No se encontraron pesajes para este chip_animal" });
        }

        res.json(results);

    } catch (err) {
        console.error("❌ Error al obtener el pesaje:", err);
        res.status(500).json({ error: "Error al obtener el pesaje" });
    }
});

// ============================================
// PUT /weighing/:id - Actualizar pesaje por ID
// ⭐ Admin puede actualizar de cualquier finca
// ============================================
router.put('/:id', verificarToken, bloquearViewer, async (req, res) => {
    const { id } = req.params;
    const finca_id = req.usuario.finca_id;
    const rolUsuario = req.usuario.rol;

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
        // ⭐ Admin puede actualizar de cualquier finca
        let checkQuery = `
            SELECT hp.*, ra.finca_id 
            FROM historico_pesaje hp
            JOIN registro_animal ra ON hp.chip_animal = ra.chip_animal
            WHERE hp.id = ?
        `;
        let checkParams = [id];

        if (rolUsuario !== 'admin' && finca_id) {
            checkQuery += ` AND ra.finca_id = ?`;
            checkParams.push(finca_id);
        }

        const [pesajeResult] = await db.query(checkQuery, checkParams);

        if (pesajeResult.length === 0) {
            return res.status(404).json({ error: "Pesaje no encontrado" });
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

        console.log("✅ Pesaje actualizado exitosamente");

        res.json({ message: "Pesaje actualizado correctamente" });

    } catch (err) {
        console.error("❌ Error al actualizar el pesaje:", err);
        res.status(500).json({ error: "Error al actualizar el pesaje" });
    }
});

// ============================================
// PUT /weighing/chip/:chip_animal - Actualizar pesajes por chip
// ⭐ Admin puede actualizar de cualquier finca
// ============================================
router.put('/chip/:chip_animal', verificarToken, bloquearViewer, async (req, res) => {
    const { chip_animal } = req.params;
    const finca_id = req.usuario.finca_id;
    const rolUsuario = req.usuario.rol;

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
        // ⭐ Admin puede actualizar de cualquier finca
        let checkQuery = `SELECT finca_id FROM registro_animal WHERE chip_animal = ?`;
        let checkParams = [chip_animal];

        if (rolUsuario !== 'admin' && finca_id) {
            checkQuery += ` AND finca_id = ?`;
            checkParams.push(finca_id);
        }

        const [animalResult] = await db.query(checkQuery, checkParams);

        if (animalResult.length === 0) {
            return res.status(404).json({ error: "Animal no encontrado" });
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

        console.log("✅ Pesaje actualizado exitosamente");

        res.json({ message: "Pesaje actualizado correctamente" });

    } catch (err) {
        console.error("❌ Error al actualizar el pesaje:", err);
        res.status(500).json({ error: "Error al actualizar el pesaje" });
    }
});

module.exports = router;
