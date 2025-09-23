const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Usuario = require("../models/user");
const db = require("../db");

const generarRefreshToken = (usuario) => {
  return jwt.sign(
    {
      id: usuario.id || usuario.id_usuario,
      correo: usuario.correo,
      rol: usuario.rol,
    },
    process.env.JWT_SECRET || "clave_secreta",
    { expiresIn: "30d" } // El refresh token puede durar más tiempo
  );
};


// 🔐 Generar token
const generarToken = (usuario) => {
  return jwt.sign(
    {
      id: usuario.id || usuario.id_usuario,
      correo: usuario.correo,
      rol: usuario.rol
    },
    process.env.JWT_SECRET || 'clave_secreta',
    { expiresIn: '1h' }
  );
};


// 🔒 Middleware de autenticación
const verificarToken = (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(403).json({ mensaje: "Token no proporcionado" });
  }

  try {
    const tokenLimpio = token.replace("Bearer ", "");
    console.log("Token recibido:", tokenLimpio); // Verifica el token recibido
    const decodificado = jwt.verify(
      tokenLimpio,
      process.env.JWT_SECRET || "clave_secreta"
    );
    console.log("Token decodificado:", decodificado); // Verifica el contenido del token decodificado
    req.usuario = decodificado;
    next();
  } catch (error) {
    console.error("Error al verificar el token:", error); // Verifica cualquier error de verificación
    return res.status(401).json({ mensaje: "Token inválido" });
  }
};


router.post("/registroUser", async (req, res) => {
  const { correo, contraseña, rol } = req.body;

  // Validar que los campos requeridos estén presentes
  if (!correo || !contraseña || !rol) {
    return res.status(400).json({ mensaje: "Todos los campos son obligatorios" });
  }

  try {
    // Verificar si el correo ya existe en la base de datos
    const usuarioExistente = await Usuario.buscarPorCorreo(correo);
    if (usuarioExistente) {
      return res.status(409).json({ mensaje: "El correo ya está registrado" });
    }

    // Cifrar la contraseña antes de guardarla
    const contraseñaCifrada = await bcrypt.hash(contraseña, 10);

    // Crear el nuevo usuario en la base de datos
    const nuevoUsuario = await Usuario.crear({
      correo,
      contraseña: contraseñaCifrada,
      rol,
    });

    // Si se crea el usuario con éxito, responder con un mensaje
    return res.status(201).json({
      mensaje: "Usuario creado con éxito",
      usuario: {
        correo: nuevoUsuario.correo,
        rol: nuevoUsuario.rol,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ mensaje: "Error del servidor al crear el usuario" });
  }
});



router.post("/login", async (req, res) => {
  const { correo, contraseña } = req.body;

  try {
    const usuario = await Usuario.buscarPorCorreo(correo);

    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    const esCorrecta = await bcrypt.compare(contraseña, usuario.contraseña);

    if (!esCorrecta) {
      return res.status(401).json({ mensaje: "Contraseña errada" });
    }

    console.log("Usuario encontrado:", usuario);

    const accessToken = generarToken(usuario);
    const refreshToken = generarRefreshToken(usuario);

    return res.json({ accessToken, refreshToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error del servidor" });
  }
});

// ✅ Ruta para renovar el token
router.post("/renovar-token", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(403).json({ mensaje: "Refresh token no proporcionado" });
  }

  try {
    const decodificado = jwt.verify(refreshToken, process.env.JWT_SECRET || "clave_secreta");

    // Si el refresh token es válido, generamos un nuevo access token
    const usuario = await Usuario.buscarPorCorreo(decodificado.correo);
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    const newAccessToken = generarToken(usuario);
    return res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error("Error al renovar token:", error);
    return res.status(403).json({ mensaje: "Refresh token inválido" });
  }
});


// ✅ Ruta protegida de prueba
router.get("/protegida", verificarToken, (req, res) => {
  res.json({
    mensaje: "Accediste a la ruta protegida",
    usuario: req.usuario,
  });
});

// ✅ Ruta para obtener animales del usuario autenticado
router.get("/mis-animales", verificarToken, async (req, res) => {
  const correo = req.usuario.correo;

  try {
    const [usuario] = await db.query(
      "SELECT id FROM usuarios WHERE correo = ?",
      [correo]
    );

    if (!usuario.length) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    const idUsuario = usuario[0].id;

    const [animales] = await db.query(
      "SELECT * FROM vista_registro_animal WHERE id_usuario = ?",
      [idUsuario]
    );

    res.json(animales);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener animales" });
  }
});

module.exports = {
  router,
  verificarToken,
};