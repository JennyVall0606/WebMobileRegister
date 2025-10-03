// routes/sync.js - NUEVO ARCHIVO
// Endpoints de sincronización para la aplicación offline-first

const express = require('express');
const router = express.Router();
const { verificarToken } = require('../routes/auth'); // Ajusta la ruta según tu proyecto
const db = require('../db');
const path = require('path');
const fs = require('fs');

const processBase64Image = (base64Data, animalId) => {
  try {
    console.log('📸 === PROCESANDO IMAGEN ===');
    console.log('📸 Tipo de dato recibido:', typeof base64Data);
    console.log('📸 Tamaño de datos:', base64Data?.length || 'Sin datos');
    console.log('📸 Primeros 50 caracteres:', base64Data?.substring(0, 50) || 'Vacío');
    
    if (!base64Data || !base64Data.startsWith('data:image')) {
      console.log('⚠️ No es base64 válido, devolviendo original:', base64Data);
      return base64Data;
    }

    // Extraer el base64 puro
    const matches = base64Data.match(/^data:image\/([a-zA-Z]*);base64,(.+)$/);
    if (!matches) {
      console.log('❌ Formato base64 inválido');
      return 'default.jpg';
    }

    const imageType = matches[1];
    const base64Image = matches[2];
    
    console.log('📸 Tipo de imagen detectado:', imageType);
    console.log('📸 Tamaño del base64 puro:', base64Image.length);
    
    // Crear nombre único para el archivo
    const fileName = `animal_${animalId}_${Date.now()}.${imageType}`;
    const uploadsDir = path.join(__dirname, '../uploads');
    
    console.log('📁 Directorio de destino:', uploadsDir);
    
    // Crear directorio si no existe
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('📁 Directorio uploads creado');
    }
    
    const filePath = path.join(uploadsDir, fileName);
    console.log('📁 Ruta completa del archivo:', filePath);
    
    // Guardar archivo
    fs.writeFileSync(filePath, base64Image, 'base64');
    
    // Verificar que se guardó correctamente
    const stats = fs.statSync(filePath);
    console.log(`✅ Imagen guardada exitosamente: ${fileName}`);
    console.log(`📏 Tamaño del archivo: ${stats.size} bytes`);
    
    return fileName;
    
  } catch (error) {
    console.error('❌ Error procesando imagen base64:', error);
    console.error('❌ Stack trace:', error.stack);
    return 'default.jpg';
  }
};

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
      console.log('🔄 === SINCRONIZANDO ANIMAL ===');
      console.log('🔄 Chip:', data.chip_animal);
      console.log('🔄 Datos de foto:', {
        existe: !!data.foto,
        tipo: typeof data.foto,
        esBase64: data.foto?.startsWith('data:image'),
        tamaño: data.foto?.length
      });
      
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
      
      // Insertar nuevo animal primero
      const [result] = await connection.query(
        `INSERT INTO registro_animal 
        (foto, chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, 
         id_madre, id_padre, enfermedades, observaciones, id_usuario,
         procedencia, hierro, categoria, ubicacion, numero_parto, precocidad, tipo_monta,
         created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          'temp_photo', // Placeholder temporal
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
      
      const animalId = result.insertId;
      console.log('✅ Animal insertado con ID:', animalId);
      
      // Procesar foto base64 si existe
      let photoUrl = 'default.jpg';
      if (data.foto && data.foto !== 'temp_photo') {
        console.log('🔄 Procesando foto para animal:', animalId);
        photoUrl = processBase64Image(data.foto, animalId);
      } else {
        console.log('⚠️ No hay foto para procesar');
      }
      
      // Actualizar con la URL de la foto
      await connection.query(
        'UPDATE registro_animal SET foto = ? WHERE id = ?',
        [photoUrl, animalId]
      );
      
      console.log(`✅ Animal ${animalId} completado con foto: ${photoUrl}`);
      
      return {
        success: true,
        action: 'INSERT',
        table: 'registro_animal',
        serverId: animalId,
        localId: recordId,
        photoUrl: photoUrl
      };
    }
    
    // Resto de acciones...
    
  } catch (error) {
    console.error('❌ Error en syncRegistroAnimal:', error);
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