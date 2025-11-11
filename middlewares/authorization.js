const db = require("../db");

// Middleware principal para verificar roles
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ 
        mensaje: "No autenticado. Por favor inicia sesión." 
      });
    }

    const rolUsuario = req.usuario.rol;

    if (!rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).json({ 
        mensaje: "Acceso denegado. No tienes permisos para realizar esta acción.",
        rolRequerido: rolesPermitidos,
        tuRol: rolUsuario
      });
    }

    next();
  };
};

// Solo administradores
const soloAdmin = (req, res, next) => {
  return verificarRol('admin')(req, res, next);
};

// Administradores y usuarios (pueden modificar)
const adminOUser = (req, res, next) => {
  return verificarRol('admin', 'user')(req, res, next);
};

// Cualquier usuario autenticado (admin, user, viewer)
const cualquierUsuario = (req, res, next) => {
  return verificarRol('admin', 'user', 'viewer')(req, res, next);
};

// Verificar que el usuario es propietario del recurso
// ⭐ MEJORADO: Ahora verifica en la base de datos
const verificarPropietario = (tabla, campoId = 'chip') => {
  return async (req, res, next) => {
    const usuarioAutenticado = req.usuario.id;
    const rolUsuario = req.usuario.rol;

    // Admin tiene acceso a todo
    if (rolUsuario === 'admin') {
      req.esPropietario = true;
      return next();
    }

    // Obtener el ID del recurso desde los params
    const recursoId = req.params[campoId] || req.params.id;

    if (!recursoId) {
      return res.status(400).json({ 
        mensaje: "ID del recurso no proporcionado" 
      });
    }

    try {
      // Verificar en la base de datos si el usuario es propietario
      const [resultado] = await db.query(
        `SELECT usuario_id FROM ${tabla} WHERE ${campoId} = ?`,
        [recursoId]
      );

      if (resultado.length === 0) {
        return res.status(404).json({ 
          mensaje: "Recurso no encontrado" 
        });
      }

      // Verificar si es el propietario
      if (resultado[0].usuario_id !== usuarioAutenticado) {
        return res.status(403).json({ 
          mensaje: "No tienes permiso para acceder a este recurso",
          detalle: "Solo puedes gestionar tus propios registros"
        });
      }

      req.esPropietario = true;
      next();
    } catch (error) {
      console.error("Error al verificar propietario:", error);
      return res.status(500).json({ 
        mensaje: "Error al verificar permisos" 
      });
    }
  };
};

// Bloquear acciones de escritura para viewers
const bloquearViewer = (req, res, next) => {
  console.log('🔒 bloquearViewer ejecutado');
  console.log('👤 req.usuario:', req.usuario);
  console.log('👤 Rol:', req.usuario?.rol);

  if (!req.usuario) {
    return res.status(401).json({ 
      mensaje: "No autenticado. Token no válido o expirado." 
    });
  }

  if (req.usuario.rol === 'viewer') {
    return res.status(403).json({ 
      mensaje: "Los usuarios con rol 'viewer' solo pueden consultar información.",
      accion: "Solo lectura permitida"
    });
  }
  
  console.log('✅ bloquearViewer - Usuario permitido (admin/user)');
  next();
};


// ⭐ NUEVO: Alias más semánticos
const puedeModificar = adminOUser;
const soloLectura = cualquierUsuario;

module.exports = {
  verificarRol,
  soloAdmin,
  adminOUser,
  cualquierUsuario,
  verificarPropietario,
  bloquearViewer,
  puedeModificar,    // Alias
  soloLectura        // Alias
};