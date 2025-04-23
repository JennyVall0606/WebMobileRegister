const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Usuario = require('../models/user'); // Asegúrate de tener bien exportado tu modelo
const db = require('../db');

// 🔐 Función para generar el token
const generarToken = (usuario) => {
  return jwt.sign(
    { correo: usuario.correo, rol: usuario.rol },
    process.env.JWT_SECRET || 'clave_secreta',
    { expiresIn: '1h' }
  );
};

// 🔒 Middleware para verificar token JWT
const verificarToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).json({ mensaje: 'Token no proporcionado' });
  }

  try {
    const tokenLimpio = token.replace('Bearer ', '');
    const decodificado = jwt.verify(tokenLimpio, process.env.JWT_SECRET || 'clave_secreta');
    req.usuario = decodificado;
    next();
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido' });
  }
};

// ✅ Ruta de login
router.post('/login', async (req, res) => {
  const { correo, contraseña } = req.body;

  try {
    const usuario = await Usuario.buscarPorCorreo(correo);

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const esCorrecta = await bcrypt.compare(contraseña, usuario.contraseña);

    if (!esCorrecta) {
      return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    }
   


    // if (contraseña !== usuario.contraseña) {
    //   return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    // }
    

    const token = generarToken(usuario);
    
    return res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
});

// ✅ Ruta protegida con JWT
router.get('/protegida', verificarToken, (req, res) => {
  res.json({
    mensaje: 'Accediste a la ruta protegida',
    usuario: req.usuario
  });
});

module.exports = router;
