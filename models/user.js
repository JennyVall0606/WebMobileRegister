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
  }
};

module.exports = Usuario;
