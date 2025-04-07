const db = require('../db');

const Usuario = {
  buscarPorCorreo: async (correo) => {
    const [result] = await db.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    return result[0]; // 👈 esto es lo importante: accedemos al primer usuario
  }
};

module.exports = Usuario;
