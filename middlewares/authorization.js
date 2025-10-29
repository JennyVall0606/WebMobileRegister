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

const soloAdmin = (req, res, next) => {
  return verificarRol('admin')(req, res, next);
};

const adminOUser = (req, res, next) => {
  return verificarRol('admin', 'user')(req, res, next);
};

const cualquierUsuario = (req, res, next) => {
  return verificarRol('admin', 'user', 'viewer')(req, res, next);
};

const verificarPropietario = async (req, res, next) => {
  const usuarioAutenticado = req.usuario.id;
  const rolUsuario = req.usuario.rol;

  if (rolUsuario === 'admin') {
    return next();
  }

  req.esPropietario = true;
  next();
};

const bloquearViewer = (req, res, next) => {
  if (req.usuario.rol === 'viewer') {
    return res.status(403).json({ 
      mensaje: "Los usuarios con rol 'viewer' solo pueden consultar información.",
      accion: "Solo lectura permitida"
    });
  }
  next();
};

module.exports = {
  verificarRol,
  soloAdmin,
  adminOUser,
  cualquierUsuario,
  verificarPropietario,
  bloquearViewer
};