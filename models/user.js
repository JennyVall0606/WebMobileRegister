const db = require('../db');

const Usuario = {
  buscarPorCorreo: async (correo) => {
    const [result] = await db.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    return result[0];
  },

  obtenerTodos: async () => {
    const [result] = await db.query('SELECT * FROM usuarios');
    return result;
  },

  actualizarContraseña: async (id, nuevaContraseña) => {
    await db.query('UPDATE usuarios SET contraseña = ? WHERE id = ?', [nuevaContraseña, id]);
  },

  // Método para crear un nuevo usuario
  crear: async ({ correo, contraseña, rol }) => {
    const query = 'INSERT INTO usuarios (correo, contraseña, rol) VALUES (?, ?, ?)';
    try {
      const [result] = await db.query(query, [correo, contraseña, rol]);
      return { id: result.insertId, correo, rol };  // Retorna el nuevo usuario con su id
    } catch (error) {
      throw new Error('Error al crear el usuario: ' + error.message);
    }
  }
};

module.exports = Usuario;
