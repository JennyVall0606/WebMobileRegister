const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Usuario = require("../models/user");
const db = require("../db");

// ============================================
// 🔐 Generar ambos tokens (acceso + refresh)
// ============================================
const generarTokens = (usuario) => {
  const accessToken = jwt.sign(
    {
      id: usuario.id || usuario.id_usuario,
      correo: usuario.correo,
      rol: usuario.rol  // ⭐ IMPORTANTE: Incluir el rol
    },
    process.env.JWT_SECRET || 'clave_secreta',
    { expiresIn: '1h' }  // Token de acceso: 1 hora
  );

  const refreshToken = jwt.sign(
    {
      id: usuario.id || usuario.id_usuario,
      correo: usuario.correo,
      rol: usuario.rol,  // ⭐ IMPORTANTE: Incluir el rol también aquí
      tipo: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET || 'clave_secreta_refresh',
    { expiresIn: '30d' }  // Token de refresco: 30 días
  );

  return { accessToken, refreshToken };
};

// ============================================
// 🔒 Middleware de autenticación
// ============================================
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

    console.log("🔍 Verificando token...");

    const decodificado = jwt.verify(
      token,
      process.env.JWT_SECRET || "clave_secreta"
    );
    
    // ⭐ IMPORTANTE: Asegurar que el usuario tenga todos los datos necesarios
    req.usuario = {
      id: decodificado.id,
      correo: decodificado.correo,
      rol: decodificado.rol  // ⭐ El rol debe estar aquí
    };

    console.log("✅ Token válido - Usuario:", req.usuario.correo, "- Rol:", req.usuario.rol);
    next();
    
  } catch (error) {
    console.error("❌ Error al verificar el token:", error.message);
    return res.status(401).json({ mensaje: "Token inválido o expirado" });
  }
};

// ============================================
// 📝 Registro de usuario (Solo Admin debería usar esto)
// ============================================
router.post("/registroUser", async (req, res) => {
  const { correo, contraseña, rol } = req.body;

  if (!correo || !contraseña || !rol) {
    return res.status(400).json({ mensaje: "Todos los campos son obligatorios" });
  }

  // ⭐ Validar roles permitidos
  const rolesPermitidos = ['admin', 'user', 'viewer'];
  if (!rolesPermitidos.includes(rol.toLowerCase())) {
    return res.status(400).json({ 
      mensaje: "Rol inválido",
      rolesPermitidos: rolesPermitidos
    });
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
      rol: rol.toLowerCase(),
    });

    return res.status(201).json({
      mensaje: "Usuario creado con éxito",
      usuario: {
        id: nuevoUsuario.id,
        correo: nuevoUsuario.correo,
        rol: nuevoUsuario.rol,
      },
    });
  } catch (error) {
    console.error("❌ Error al crear usuario:", error);
    return res.status(500).json({ mensaje: "Error del servidor al crear el usuario" });
  }
});

// ============================================
// 🔑 Login - Autenticación de usuario
// ============================================
router.post("/login", async (req, res) => {
  const { correo, contraseña } = req.body;

  if (!correo || !contraseña) {
    return res.status(400).json({ mensaje: "Correo y contraseña son obligatorios" });
  }

  try {
    console.log("🔍 Intentando login para:", correo);

    const usuario = await Usuario.buscarPorCorreo(correo);

    if (!usuario) {
      console.log("❌ Usuario no encontrado");
      return res.status(404).json({ mensaje: "Credenciales incorrectas" });
    }

    const esCorrecta = await bcrypt.compare(contraseña, usuario.contraseña);

    if (!esCorrecta) {
      console.log("❌ Contraseña incorrecta");
      return res.status(401).json({ mensaje: "Credenciales incorrectas" });
    }

    console.log("✅ Login exitoso - Usuario:", usuario.correo, "- Rol:", usuario.rol);

    // 🔥 Generar ambos tokens
    const { accessToken, refreshToken } = generarTokens(usuario);
    
    return res.json({ 
      token: accessToken,           // Token principal (1 hora)
      refreshToken: refreshToken,   // Token de refresco (30 días)
      usuario: {
        id: usuario.id || usuario.id_usuario,
        correo: usuario.correo,
        rol: usuario.rol  // ⭐ Incluir el rol en la respuesta
      }
    });
  } catch (error) {
    console.error("❌ Error en login:", error);
    res.status(500).json({ mensaje: "Error del servidor" });
  }
});

// ============================================
// 🔄 Refresh token - Renovar token de acceso
// ============================================
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

    // Buscar usuario actualizado en la BD (por si cambió el rol)
    const usuario = await Usuario.buscarPorCorreo(decoded.correo);
    
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    // Generar nuevos tokens con el rol actualizado
    const { accessToken, refreshToken: newRefreshToken } = generarTokens(usuario);

    console.log("✅ Nuevos tokens generados para:", usuario.correo, "- Rol:", usuario.rol);

    return res.json({ 
      token: accessToken,
      refreshToken: newRefreshToken,
      usuario: {
        id: usuario.id,
        correo: usuario.correo,
        rol: usuario.rol  // ⭐ Devolver el rol actualizado
      }
    });

  } catch (error) {
    console.error("❌ Error al refrescar token:", error.message);
    return res.status(401).json({ mensaje: "Refresh token inválido o expirado" });
  }
});

// ============================================
// ✅ Ruta protegida de prueba
// ============================================
router.get("/protegida", verificarToken, (req, res) => {
  res.json({
    mensaje: "✅ Accediste a la ruta protegida",
    usuario: req.usuario,
  });
});

// ============================================
// ✅ Obtener animales del usuario autenticado
// ============================================
router.get("/mis-animales", verificarToken, async (req, res) => {
  const finca_id = req.usuario.finca_id;
  const rolUsuario = req.usuario.rol;

  try {
    let query;
    let params = [];

    // ⭐ Query con JOINs para obtener nombre de raza y finca
    const baseQuery = `
      SELECT 
        registro_animal.*,
        razas.nombre_raza as raza,
        fincas.nombre as finca_nombre
      FROM registro_animal
      LEFT JOIN razas ON registro_animal.raza_id_raza = razas.id_raza
      LEFT JOIN fincas ON registro_animal.finca_id = fincas.id
    `;

    // Admin ve todos los animales o solo los de su finca
    if (rolUsuario === 'admin') {
      if (finca_id) {
        query = baseQuery + " WHERE registro_animal.finca_id = ?";
        params = [finca_id];
      } else {
        query = baseQuery; // Admin sin finca ve todos
      }
    } else {
      // Usuarios normales solo ven animales de su finca
      query = baseQuery + " WHERE registro_animal.finca_id = ?";
      params = [finca_id];
    }

    console.log('📊 Ejecutando query para rol:', rolUsuario, '- Finca:', finca_id);

    const [animales] = await db.query(query, params);

    console.log('✅ Animales obtenidos:', animales.length);
    if (animales.length > 0) {
      console.log('📊 Primer animal:', {
        chip: animales[0].chip_animal,
        raza: animales[0].raza,
        finca: animales[0].finca_nombre
      });
    }

    res.json(animales); // ⭐ Devolver array directamente

  } catch (error) {
    console.error("❌ Error al obtener animales:", error);
    console.error("❌ SQL:", error.sql);
    res.status(500).json({ 
      mensaje: "Error al obtener animales",
      error: error.message 
    });
  }
});



// ============================================
// 📊 NUEVA RUTA: Obtener perfil del usuario actual
// ============================================
router.get("/perfil", verificarToken, async (req, res) => {
  try {
    const usuario = await Usuario.buscarPorId(req.usuario.id);
    
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    res.json({
      id: usuario.id,
      correo: usuario.correo,
      rol: usuario.rol,
      creado_en: usuario.creado_en
    });
  } catch (error) {
    console.error("❌ Error al obtener perfil:", error);
    res.status(500).json({ mensaje: "Error al obtener perfil" });
  }
});

module.exports = {
  router,
  verificarToken,
};