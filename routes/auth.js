const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Usuario = require("../models/user");
const db = require("../db");

// 🔐 Generar ambos tokens (acceso + refresh)
const generarTokens = (usuario) => {
  const accessToken = jwt.sign(
    {
      id: usuario.id || usuario.id_usuario,
      correo: usuario.correo,
      rol: usuario.rol
    },
    process.env.JWT_SECRET || 'clave_secreta',
    { expiresIn: '1h' }  // Token de acceso: 1 hora
  );

  const refreshToken = jwt.sign(
    {
      id: usuario.id || usuario.id_usuario,
      correo: usuario.correo,
      tipo: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET || 'clave_secreta_refresh',
    { expiresIn: '30d' }  // Token de refresco: 30 días
  );

  return { accessToken, refreshToken };
};

// 🔒 Middleware de autenticación
const verificarToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(403).json({ mensaje: "Token no proporcionado" });
  }

  try {
    let token;
    
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else {
      token = authHeader;
    }

    console.log("Header completo:", authHeader);
    console.log("Token extraído:", token.substring(0, 20) + "...");

    const decodificado = jwt.verify(
      token,
      process.env.JWT_SECRET || "clave_secreta"
    );
    
    console.log("Token decodificado exitosamente:", decodificado.id);
    req.usuario = decodificado;
    next();
    
  } catch (error) {
    console.error("Error al verificar el token:", error.message);
    return res.status(401).json({ mensaje: "Token inválido" });
  }
};

router.post("/registroUser", async (req, res) => {
  const { correo, contraseña, rol } = req.body;

  if (!correo || !contraseña || !rol) {
    return res.status(400).json({ mensaje: "Todos los campos son obligatorios" });
  }

  try {
    const usuarioExistente = await Usuario.buscarPorCorreo(correo);
    if (usuarioExistente) {
      return res.status(409).json({ mensaje: "El correo ya está registrado" });
    }

    const contraseñaCifrada = await bcrypt.hash(contraseña, 10);

    const nuevoUsuario = await Usuario.crear({
      correo,
      contraseña: contraseñaCifrada,
      rol,
    });

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

// ✅ Ruta de login - ACTUALIZADA para devolver ambos tokens
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

    // 🔥 Generar ambos tokens
    const { accessToken, refreshToken } = generarTokens(usuario);
    
    return res.json({ 
      token: accessToken,           // Token principal (1 hora)
      refreshToken: refreshToken,   // Token de refresco (30 días)
      usuario: {
        id: usuario.id || usuario.id_usuario,
        correo: usuario.correo,
        rol: usuario.rol
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error del servidor" });
  }
});

// 🔄 NUEVA RUTA: Refresh token
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(403).json({ mensaje: "Refresh token no proporcionado" });
  }

  try {
    console.log("🔄 Intentando refrescar token...");

    // Verificar el refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'clave_secreta_refresh'
    );

    if (decoded.tipo !== 'refresh') {
      return res.status(403).json({ mensaje: "Token inválido" });
    }

    console.log("✅ Refresh token válido para:", decoded.correo);

    // Buscar usuario
    const usuario = await Usuario.buscarPorCorreo(decoded.correo);
    
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    // Generar nuevos tokens
    const { accessToken, refreshToken: newRefreshToken } = generarTokens(usuario);

    console.log("✅ Nuevos tokens generados");

    return res.json({ 
      token: accessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    console.error("❌ Error al refrescar token:", error.message);
    return res.status(401).json({ mensaje: "Refresh token inválido o expirado" });
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