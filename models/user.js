const db = require('../db');

const Usuario = {
  // Buscar usuario por correo
  buscarPorCorreo: async (correo) => {
    try {
      const [result] = await db.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
      return result[0] || null;
    } catch (error) {
      throw new Error('Error al buscar usuario por correo: ' + error.message);
    }
  },

  // Buscar usuario por ID
  buscarPorId: async (id) => {
    try {
      const [result] = await db.query(`
        SELECT 
          u.*,
          f.nombre as finca_nombre,
          f.nit as finca_nit
        FROM usuarios u
        LEFT JOIN fincas f ON u.finca_id = f.id
        WHERE u.id = ?
      `, [id]);
      return result[0] || null;
    } catch (error) {
      throw new Error('Error al buscar usuario por ID: ' + error.message);
    }
  },

  // Obtener todos los usuarios
  obtenerTodos: async () => {
    try {
      const [result] = await db.query(`
        SELECT 
          u.id, 
          u.correo, 
          u.rol, 
          u.finca_id,
          u.creado_en,
          f.nombre as finca_nombre
        FROM usuarios u
        LEFT JOIN fincas f ON u.finca_id = f.id
        ORDER BY u.creado_en DESC
      `);
      return result;
    } catch (error) {
      throw new Error('Error al obtener usuarios: ' + error.message);
    }
  },

  // Crear nuevo usuario
  crear: async ({ correo, contraseña, rol, finca_id }) => {
    const query = 'INSERT INTO usuarios (correo, contraseña, rol, finca_id) VALUES (?, ?, ?, ?)';
    try {
      const [result] = await db.query(query, [correo, contraseña, rol, finca_id]);
      return { id: result.insertId, correo, rol, finca_id };
    } catch (error) {
      // Manejar error de correo duplicado
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('El correo electrónico ya está registrado');
      }
      throw new Error('Error al crear el usuario: ' + error.message);
    }
  },

  // Actualizar usuario
  actualizar: async (id, datos) => {
    const campos = [];
    const valores = [];

    if (datos.correo) {
      campos.push('correo = ?');
      valores.push(datos.correo);
    }
    if (datos.contraseña) {
      campos.push('contraseña = ?');
      valores.push(datos.contraseña);
    }
    if (datos.rol) {
      campos.push('rol = ?');
      valores.push(datos.rol);
    }
    if (datos.finca_id !== undefined) {
      campos.push('finca_id = ?');
      valores.push(datos.finca_id);
    }

    if (campos.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    valores.push(id);
    const query = `UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`;

    try {
      const [result] = await db.query(query, valores);
      
      if (result.affectedRows === 0) {
        throw new Error('Usuario no encontrado');
      }
      
      return result;
    } catch (error) {
      throw new Error('Error al actualizar el usuario: ' + error.message);
    }
  },

  // Actualizar solo contraseña
  actualizarContraseña: async (id, nuevaContraseña) => {
    try {
      const [result] = await db.query(
        'UPDATE usuarios SET contraseña = ? WHERE id = ?', 
        [nuevaContraseña, id]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('Usuario no encontrado');
      }
      
      return result;
    } catch (error) {
      throw new Error('Error al actualizar contraseña: ' + error.message);
    }
  },

  // Eliminar usuario
  eliminar: async (id) => {
    const query = 'DELETE FROM usuarios WHERE id = ?';
    try {
      const [result] = await db.query(query, [id]);
      
      if (result.affectedRows === 0) {
        throw new Error('Usuario no encontrado');
      }
      
      return result;
    } catch (error) {
      throw new Error('Error al eliminar el usuario: ' + error.message);
    }
  },

  // Verificar si un usuario existe
  existe: async (id) => {
    try {
      const [result] = await db.query('SELECT COUNT(*) as count FROM usuarios WHERE id = ?', [id]);
      return result[0].count > 0;
    } catch (error) {
      throw new Error('Error al verificar existencia del usuario: ' + error.message);
    }
  },

  // Contar usuarios por rol
  contarPorRol: async (rol) => {
    try {
      const [result] = await db.query('SELECT COUNT(*) as count FROM usuarios WHERE rol = ?', [rol]);
      return result[0].count;
    } catch (error) {
      throw new Error('Error al contar usuarios: ' + error.message);
    }
  },

  // ⭐ NUEVO: Obtener usuarios por finca
  obtenerPorFinca: async (finca_id) => {
    try {
      const [result] = await db.query(`
        SELECT id, correo, rol, finca_id, creado_en
        FROM usuarios
        WHERE finca_id = ?
        ORDER BY creado_en DESC
      `, [finca_id]);
      return result;
    } catch (error) {
      throw new Error('Error al obtener usuarios por finca: ' + error.message);
    }
  }
};

module.exports = Usuario;