const db = require('../db');

const Finca = {
  // Buscar finca por ID
  buscarPorId: async (id) => {
    try {
      const [result] = await db.query('SELECT * FROM fincas WHERE id = ?', [id]);
      return result[0] || null;
    } catch (error) {
      throw new Error('Error al buscar finca por ID: ' + error.message);
    }
  },

  // Buscar finca por NIT
  buscarPorNit: async (nit) => {
    try {
      const [result] = await db.query('SELECT * FROM fincas WHERE nit = ?', [nit]);
      return result[0] || null;
    } catch (error) {
      throw new Error('Error al buscar finca por NIT: ' + error.message);
    }
  },

  // Obtener todas las fincas
  obtenerTodas: async () => {
    try {
      const [result] = await db.query(`
        SELECT 
          f.id,
          f.nombre,
          f.nit,
          f.direccion,
          f.telefono,
          f.correo,
          f.activa,
          f.created_at,
          f.updated_at,
          COUNT(DISTINCT u.id) as total_usuarios,
          COUNT(DISTINCT ra.id) as total_animales
        FROM fincas f
        LEFT JOIN usuarios u ON u.finca_id = f.id
        LEFT JOIN registro_animal ra ON ra.finca_id = f.id
        GROUP BY f.id
        ORDER BY f.created_at DESC
      `);
      return result;
    } catch (error) {
      throw new Error('Error al obtener fincas: ' + error.message);
    }
  },

  // Obtener finca con detalles completos
  obtenerConDetalles: async (id) => {
    try {
      const [finca] = await db.query(`
        SELECT 
          f.*,
          COUNT(DISTINCT u.id) as total_usuarios,
          COUNT(DISTINCT ra.id) as total_animales
        FROM fincas f
        LEFT JOIN usuarios u ON u.finca_id = f.id
        LEFT JOIN registro_animal ra ON ra.finca_id = f.id
        WHERE f.id = ?
        GROUP BY f.id
      `, [id]);

      if (finca.length === 0) return null;

      // Obtener usuarios de la finca
      const [usuarios] = await db.query(`
        SELECT id, correo, rol, creado_en
        FROM usuarios
        WHERE finca_id = ?
        ORDER BY creado_en DESC
      `, [id]);

      return {
        ...finca[0],
        usuarios: usuarios
      };
    } catch (error) {
      throw new Error('Error al obtener detalles de finca: ' + error.message);
    }
  },

  // Crear nueva finca
  crear: async ({ nombre, nit, direccion, telefono, correo, activa = 1 }) => {
    const query = `
      INSERT INTO fincas (nombre, nit, direccion, telefono, correo, activa) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    try {
      const [result] = await db.query(query, [nombre, nit, direccion, telefono, correo, activa]);
      return { 
        id: result.insertId, 
        nombre, 
        nit, 
        direccion, 
        telefono, 
        correo, 
        activa 
      };
    } catch (error) {
      // Manejar error de NIT duplicado
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('El NIT ya está registrado');
      }
      throw new Error('Error al crear la finca: ' + error.message);
    }
  },

  // Actualizar finca
  actualizar: async (id, datos) => {
    const campos = [];
    const valores = [];

    if (datos.nombre !== undefined) {
      campos.push('nombre = ?');
      valores.push(datos.nombre);
    }
    if (datos.nit !== undefined) {
      campos.push('nit = ?');
      valores.push(datos.nit);
    }
    if (datos.direccion !== undefined) {
      campos.push('direccion = ?');
      valores.push(datos.direccion);
    }
    if (datos.telefono !== undefined) {
      campos.push('telefono = ?');
      valores.push(datos.telefono);
    }
    if (datos.correo !== undefined) {
      campos.push('correo = ?');
      valores.push(datos.correo);
    }
    if (datos.activa !== undefined) {
      campos.push('activa = ?');
      valores.push(datos.activa);
    }

    if (campos.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    valores.push(id);
    const query = `UPDATE fincas SET ${campos.join(', ')} WHERE id = ?`;

    try {
      const [result] = await db.query(query, valores);
      
      if (result.affectedRows === 0) {
        throw new Error('Finca no encontrada');
      }
      
      return result;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('El NIT ya está registrado');
      }
      throw new Error('Error al actualizar la finca: ' + error.message);
    }
  },

  // Activar/Desactivar finca
  cambiarEstado: async (id, activa) => {
    try {
      const [result] = await db.query(
        'UPDATE fincas SET activa = ? WHERE id = ?',
        [activa, id]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('Finca no encontrada');
      }
      
      return result;
    } catch (error) {
      throw new Error('Error al cambiar estado de la finca: ' + error.message);
    }
  },

  // Eliminar finca
  eliminar: async (id) => {
    const query = 'DELETE FROM fincas WHERE id = ?';
    try {
      const [result] = await db.query(query, [id]);
      
      if (result.affectedRows === 0) {
        throw new Error('Finca no encontrada');
      }
      
      return result;
    } catch (error) {
      // Verificar si hay referencias de FK
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        throw new Error('No se puede eliminar la finca porque tiene usuarios o animales asociados');
      }
      throw new Error('Error al eliminar la finca: ' + error.message);
    }
  },

  // Verificar si una finca existe
  existe: async (id) => {
    try {
      const [result] = await db.query('SELECT COUNT(*) as count FROM fincas WHERE id = ?', [id]);
      return result[0].count > 0;
    } catch (error) {
      throw new Error('Error al verificar existencia de la finca: ' + error.message);
    }
  },

  // Obtener estadísticas de una finca
  obtenerEstadisticas: async (id) => {
    try {
      const [stats] = await db.query(`
        SELECT 
          f.id,
          f.nombre,
          COUNT(DISTINCT u.id) as total_usuarios,
          COUNT(DISTINCT ra.id) as total_animales,
          COUNT(DISTINCT CASE WHEN u.rol = 'admin' THEN u.id END) as usuarios_admin,
          COUNT(DISTINCT CASE WHEN u.rol = 'user' THEN u.id END) as usuarios_user,
          COUNT(DISTINCT CASE WHEN u.rol = 'viewer' THEN u.id END) as usuarios_viewer,
          COUNT(DISTINCT hp.id) as total_pesajes,
          COUNT(DISTINCT hv.id) as total_vacunas
        FROM fincas f
        LEFT JOIN usuarios u ON u.finca_id = f.id
        LEFT JOIN registro_animal ra ON ra.finca_id = f.id
        LEFT JOIN historico_pesaje hp ON hp.registro_animal_id = ra.id
        LEFT JOIN historico_vacuna hv ON hv.registro_animal_id = ra.id
        WHERE f.id = ?
        GROUP BY f.id
      `, [id]);

      return stats[0] || null;
    } catch (error) {
      throw new Error('Error al obtener estadísticas de la finca: ' + error.message);
    }
  }
};

module.exports = Finca;