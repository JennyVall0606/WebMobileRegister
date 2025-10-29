const db = require('../db');

const Usuario = {
  buscarPorCorreo: async (correo) => {
    const [result] = await db.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    return result[0];
  },

  buscarPorId: async (id) => {
    const [result] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    return result[0];
  },

  obtenerTodos: async () => {
    const [result] = await db.query('SELECT * FROM usuarios');
    return result;
  },

  crear: async ({ correo, contraseña, rol }) => {
    const query = 'INSERT INTO usuarios (correo, contraseña, rol) VALUES (?, ?, ?)';
    try {
      const [result] = await db.query(query, [correo, contraseña, rol]);
      return { id: result.insertId, correo, rol };
    } catch (error) {
      throw new Error('Error al crear el usuario: ' + error.message);
    }
  },

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

    if (campos.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    valores.push(id);
    const query = `UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`;

    try {
      const [result] = await db.query(query, valores);
      return result;
    } catch (error) {
      throw new Error('Error al actualizar el usuario: ' + error.message);
    }
  },

  actualizarContraseña: async (id, nuevaContraseña) => {
    await db.query('UPDATE usuarios SET contraseña = ? WHERE id = ?', [nuevaContraseña, id]);
  },

  eliminar: async (id) => {
    const query = 'DELETE FROM usuarios WHERE id = ?';
    try {
      const [result] = await db.query(query, [id]);
      return result;
    } catch (error) {
      throw new Error('Error al eliminar el usuario: ' + error.message);
    }
  }
};

module.exports = Usuario;