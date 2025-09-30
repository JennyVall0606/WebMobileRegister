// routes/sync.js - NUEVO ARCHIVO
// Endpoints de sincronización para la aplicación offline-first

const express = require('express');
const router = express.Router();
const { verificarToken } = require('../routes/auth'); // Ajusta la ruta según tu proyecto
const db = require('../db');
// ============================================
// ENDPOINT PULL: Traer cambios del servidor
// ============================================
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Endpoints de sincronización funcionando',
    timestamp: new Date().toISOString()
  });
});
/**
 * GET /sync/registro_animal?since=2024-01-01T00:00:00.000Z
 * Obtener todos los animales modificados desde una fecha específica
 */
router.get('/registro_animal', verificarToken, async (req, res) => {
  try {
    const id_usuario = req.usuario?.id;
    const { since } = req.query; // Timestamp de última sincronización
    
    if (!id_usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    let query = `
      SELECT 
        r.*,
        rz.nombre_raza
      FROM registro_animal r
      LEFT JOIN raza rz ON r.raza_id_raza = rz.id_raza
      WHERE r.id_usuario = ? AND r.estado = 1
    `;
    
    const params = [id_usuario];
    
    // Si hay timestamp, filtrar solo registros modificados después de esa fecha
    if (since) {
      query += ` AND r.updated_at > ?`;
      params.push(since);
    }
    
    query += ` ORDER BY r.updated_at ASC`;
    
    const [records] = await db.query(query, params);
    
    res.json({
      success: true,
      records: records,
      count: records.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error en sync/registro_animal:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error obteniendo datos de sincronización',
      details: error.message 
    });
  }
});

/**
 * GET /sync/historico_pesaje?since=timestamp
 * Obtener histórico de pesajes
 */
router.get('/historico_pesaje', verificarToken, async (req, res) => {
  try {
    const id_usuario = req.usuario?.id;
    const { since } = req.query;
    
    if (!id_usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    let query = `
      SELECT hp.*
      FROM historico_pesaje hp
      INNER JOIN registro_animal ra ON hp.registro_animal_id = ra.id
      WHERE ra.id_usuario = ?
    `;
    
    const params = [id_usuario];
    
    if (since) {
      query += ` AND hp.updated_at > ?`;
      params.push(since);
    }
    
    query += ` ORDER BY hp.updated_at ASC`;
    
    const [records] = await db.query(query, params);
    
    res.json({
      success: true,
      records: records,
      count: records.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error en sync/historico_pesaje:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error obteniendo pesajes' 
    });
  }
});

/**
 * GET /sync/historico_vacuna?since=timestamp
 * Obtener histórico de vacunas
 */
router.get('/historico_vacuna', verificarToken, async (req, res) => {
  try {
    const id_usuario = req.usuario?.id;
    const { since } = req.query;
    
    if (!id_usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    let query = `
      SELECT hv.*
      FROM historico_vacuna hv
      INNER JOIN registro_animal ra ON hv.registro_animal_id = ra.id
      WHERE ra.id_usuario = ?
    `;
    
    const params = [id_usuario];
    
    if (since) {
      query += ` AND hv.updated_at > ?`;
      params.push(since);
    }
    
    query += ` ORDER BY hv.updated_at ASC`;
    
    const [records] = await db.query(query, params);
    
    res.json({
      success: true,
      records: records,
      count: records.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error en sync/historico_vacuna:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error obteniendo vacunas' 
    });
  }
});

// ============================================
// ENDPOINT PUSH: Sincronización por lotes
// ============================================

/**
 * POST /sync/batch
 * Sincronizar múltiples operaciones en una sola petición
 * Body: {
 *   operations: [
 *     { table: 'registro_animal', action: 'INSERT', data: {...} },
 *     { table: 'registro_animal', action: 'UPDATE', recordId: 1, data: {...} }
 *   ]
 * }
 */
router.post('/batch', verificarToken, async (req, res) => {
  const id_usuario = req.usuario?.id;
  
  if (!id_usuario) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  const { operations } = req.body;
  
  if (!operations || !Array.isArray(operations)) {
    return res.status(400).json({ error: 'Se requiere un array de operaciones' });
  }

  const results = [];
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    for (const operation of operations) {
      try {
        const result = await processSyncOperation(
          connection, 
          operation, 
          id_usuario
        );
        results.push(result);
      } catch (error) {
        console.error('Error en operación:', operation, error);
        results.push({
          success: false,
          operation: operation,
          error: error.message
        });
      }
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      results: results,
      successCount: results.filter(r => r.success).length,
      failCount: results.filter(r => !r.success).length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error en batch sync:', error);
    res.status(500).json({
      success: false,
      error: 'Error procesando sincronización por lotes',
      details: error.message
    });
  } finally {
    connection.release();
  }
});

// ============================================
// FUNCIÓN AUXILIAR: Procesar operación individual
// ============================================

async function processSyncOperation(connection, operation, id_usuario) {
  const { table, action, data, recordId } = operation;
  
  switch (table) {
    case 'registro_animal':
      return await syncRegistroAnimal(connection, action, data, recordId, id_usuario);
    
    case 'historico_pesaje':
      return await syncHistoricoPesaje(connection, action, data, recordId, id_usuario);
    
    case 'historico_vacuna':
      return await syncHistoricoVacuna(connection, action, data, recordId, id_usuario);
    
    default:
      throw new Error(`Tabla no soportada: ${table}`);
  }
}

// ============================================
// SINCRONIZACIÓN: Registro Animal
// ============================================

async function syncRegistroAnimal(connection, action, data, recordId, id_usuario) {
  try {
    if (action === 'INSERT') {
      // Verificar que el chip no exista
      const [existing] = await connection.query(
        'SELECT id FROM registro_animal WHERE chip_animal = ?',
        [data.chip_animal]
      );
      
      if (existing.length > 0) {
        return {
          success: false,
          action: 'INSERT',
          table: 'registro_animal',
          error: 'El chip ya existe',
          existingId: existing[0].id
        };
      }
      
      // Insertar nuevo animal
      const [result] = await connection.query(
        `INSERT INTO registro_animal 
        (foto, chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, 
         id_madre, id_padre, enfermedades, observaciones, id_usuario,
         procedencia, hierro, categoria, ubicacion, numero_parto, precocidad, tipo_monta,
         created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          data.foto || 'default.jpg',
          data.chip_animal,
          data.peso_nacimiento,
          data.raza_id_raza,
          data.fecha_nacimiento,
          data.id_madre || null,
          data.id_padre || null,
          data.enfermedades || null,
          data.observaciones || null,
          id_usuario,
          data.procedencia || null,
          data.hierro || null,
          data.categoria || null,
          data.ubicacion || null,
          data.numero_parto || null,
          data.precocidad || null,
          data.tipo_monta || null
        ]
      );
      
      return {
        success: true,
        action: 'INSERT',
        table: 'registro_animal',
        serverId: result.insertId,
        localId: recordId
      };
    }
    
    if (action === 'UPDATE') {
      // Verificar que el animal pertenece al usuario
      const [animal] = await connection.query(
        'SELECT id FROM registro_animal WHERE chip_animal = ? AND id_usuario = ?',
        [data.chip_animal, id_usuario]
      );
      
      if (animal.length === 0) {
        return {
          success: false,
          action: 'UPDATE',
          table: 'registro_animal',
          error: 'Animal no encontrado o no pertenece al usuario'
        };
      }
      
      // Actualizar animal
      const [result] = await connection.query(
        `UPDATE registro_animal 
        SET peso_nacimiento = ?, raza_id_raza = ?, fecha_nacimiento = ?,
            id_madre = ?, id_padre = ?, enfermedades = ?, observaciones = ?,
            procedencia = ?, hierro = ?, categoria = ?, ubicacion = ?,
            numero_parto = ?, precocidad = ?, tipo_monta = ?,
            updated_at = NOW()
        WHERE chip_animal = ? AND id_usuario = ?`,
        [
          data.peso_nacimiento,
          data.raza_id_raza,
          data.fecha_nacimiento,
          data.id_madre || null,
          data.id_padre || null,
          data.enfermedades || null,
          data.observaciones || null,
          data.procedencia || null,
          data.hierro || null,
          data.categoria || null,
          data.ubicacion || null,
          data.numero_parto || null,
          data.precocidad || null,
          data.tipo_monta || null,
          data.chip_animal,
          id_usuario
        ]
      );
      
      return {
        success: true,
        action: 'UPDATE',
        table: 'registro_animal',
        affectedRows: result.affectedRows
      };
    }
    
    if (action === 'DELETE') {
      // Soft delete
      const [result] = await connection.query(
        'UPDATE registro_animal SET estado = 0, updated_at = NOW() WHERE id = ? AND id_usuario = ?',
        [recordId, id_usuario]
      );
      
      return {
        success: true,
        action: 'DELETE',
        table: 'registro_animal',
        affectedRows: result.affectedRows
      };
    }
    
  } catch (error) {
    throw error;
  }
}

// ============================================
// SINCRONIZACIÓN: Histórico Pesaje
// ============================================

async function syncHistoricoPesaje(connection, action, data, recordId, id_usuario) {
  try {
    if (action === 'INSERT') {
      // Verificar que el animal pertenece al usuario
      const [animal] = await connection.query(
        'SELECT id FROM registro_animal WHERE id = ? AND id_usuario = ?',
        [data.registro_animal_id, id_usuario]
      );
      
      if (animal.length === 0) {
        return {
          success: false,
          action: 'INSERT',
          table: 'historico_pesaje',
          error: 'Animal no encontrado o no pertenece al usuario'
        };
      }
      
      const [result] = await connection.query(
        `INSERT INTO historico_pesaje 
        (registro_animal_id, chip_animal, fecha_pesaje, peso_kg, 
         costo_compra, costo_venta, precio_kg_compra, precio_kg_venta,
         created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          data.registro_animal_id,
          data.chip_animal,
          data.fecha_pesaje,
          data.peso_kg,
          data.costo_compra || null,
          data.costo_venta || null,
          data.precio_kg_compra || null,
          data.precio_kg_venta || null
        ]
      );
      
      return {
        success: true,
        action: 'INSERT',
        table: 'historico_pesaje',
        serverId: result.insertId,
        localId: recordId
      };
    }
    
    if (action === 'UPDATE') {
      const [result] = await connection.query(
        `UPDATE historico_pesaje hp
        INNER JOIN registro_animal ra ON hp.registro_animal_id = ra.id
        SET hp.peso_kg = ?, hp.fecha_pesaje = ?,
            hp.costo_compra = ?, hp.costo_venta = ?,
            hp.precio_kg_compra = ?, hp.precio_kg_venta = ?,
            hp.updated_at = NOW()
        WHERE hp.id = ? AND ra.id_usuario = ?`,
        [
          data.peso_kg,
          data.fecha_pesaje,
          data.costo_compra || null,
          data.costo_venta || null,
          data.precio_kg_compra || null,
          data.precio_kg_venta || null,
          recordId,
          id_usuario
        ]
      );
      
      return {
        success: true,
        action: 'UPDATE',
        table: 'historico_pesaje',
        affectedRows: result.affectedRows
      };
    }
    
  } catch (error) {
    throw error;
  }
}

// ============================================
// SINCRONIZACIÓN: Histórico Vacuna
// ============================================

async function syncHistoricoVacuna(connection, action, data, recordId, id_usuario) {
  try {
    if (action === 'INSERT') {
      // Verificar que el animal pertenece al usuario
      const [animal] = await connection.query(
        'SELECT id FROM registro_animal WHERE id = ? AND id_usuario = ?',
        [data.registro_animal_id, id_usuario]
      );
      
      if (animal.length === 0) {
        return {
          success: false,
          action: 'INSERT',
          table: 'historico_vacuna',
          error: 'Animal no encontrado o no pertenece al usuario'
        };
      }
      
      const [result] = await connection.query(
        `INSERT INTO historico_vacuna 
        (fecha_vacuna, tipo_vacunas_id_tipo_vacuna, registro_animal_id,
         nombre_vacunas_id_vacuna, dosis_administrada, observaciones,
         created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          data.fecha_vacuna,
          data.tipo_vacunas_id_tipo_vacuna,
          data.registro_animal_id,
          data.nombre_vacunas_id_vacuna,
          data.dosis_administrada || null,
          data.observaciones || null
        ]
      );
      
      return {
        success: true,
        action: 'INSERT',
        table: 'historico_vacuna',
        serverId: result.insertId,
        localId: recordId
      };
    }
    
    if (action === 'UPDATE') {
      const [result] = await connection.query(
        `UPDATE historico_vacuna hv
        INNER JOIN registro_animal ra ON hv.registro_animal_id = ra.id
        SET hv.fecha_vacuna = ?, hv.tipo_vacunas_id_tipo_vacuna = ?,
            hv.nombre_vacunas_id_vacuna = ?, hv.dosis_administrada = ?,
            hv.observaciones = ?, hv.updated_at = NOW()
        WHERE hv.id = ? AND ra.id_usuario = ?`,
        [
          data.fecha_vacuna,
          data.tipo_vacunas_id_tipo_vacuna,
          data.nombre_vacunas_id_vacuna,
          data.dosis_administrada || null,
          data.observaciones || null,
          recordId,
          id_usuario
        ]
      );
      
      return {
        success: true,
        action: 'UPDATE',
        table: 'historico_vacuna',
        affectedRows: result.affectedRows
      };
    }
    
  } catch (error) {
    throw error;
  }
}

module.exports = router;