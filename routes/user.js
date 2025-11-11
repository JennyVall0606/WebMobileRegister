const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Usuario = require("../models/user");
const Finca = require("../models/finca");
const db = require("../db");
const { verificarToken } = require("./auth");
const { soloAdmin } = require("../middlewares/authorization");

// ============================================
// FUNCIÓN HELPER: Normalizar roles
// ============================================
const normalizarRol = (rol) => {
  const mapaRoles = {
    'admin': 'admin',
    'administrador': 'admin',
    'user': 'user',
    'usuario': 'user',
    'viewer': 'viewer',
    'consultor': 'viewer'
  };
  
  return mapaRoles[rol.toLowerCase()] || null;
};

// ============================================
// GET /api/usuarios - Listar todos los usuarios
// ============================================
router.get("/", verificarToken, soloAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.obtenerTodos();
    
    const usuariosSeguros = usuarios.map(u => ({
      id: u.id,
      correo: u.correo,
      rol: u.rol,
      finca_id: u.finca_id,
      finca_nombre: u.finca_nombre || 'Sin finca asignada',
      creado_en: u.creado_en,
      tiene_contraseña_temporal: true
    }));

    res.json({
      mensaje: "Usuarios obtenidos exitosamente",
      total: usuariosSeguros.length,
      usuarios: usuariosSeguros
    });
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ mensaje: "Error al obtener usuarios" });
  }
});

// ============================================
// GET /api/usuarios/:id - Obtener un usuario específico
// ============================================
router.get("/:id", verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await Usuario.buscarPorId(id);

    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    const usuarioSeguro = {
      id: usuario.id,
      correo: usuario.correo,
      rol: usuario.rol,
      finca_id: usuario.finca_id,
      finca_nombre: usuario.finca_nombre || 'Sin finca asignada',
      finca_nit: usuario.finca_nit || null,
      creado_en: usuario.creado_en
    };

    res.json(usuarioSeguro);
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    res.status(500).json({ mensaje: "Error al obtener usuario" });
  }
});

// ============================================
// GET /api/usuarios/:id/contraseña - Ver contraseña temporal
// ============================================
router.get("/:id/contraseña", verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [contraseñaTemp] = await db.query(
      `SELECT contraseña_temporal, fecha_creacion 
       FROM contraseñas_temporales 
       WHERE usuario_id = ? AND activa = TRUE 
       ORDER BY fecha_creacion DESC 
       LIMIT 1`,
      [id]
    );

    if (contraseñaTemp.length === 0) {
      return res.status(404).json({ 
        mensaje: "No hay contraseña temporal disponible para este usuario" 
      });
    }

    res.json({
      contraseña: contraseñaTemp[0].contraseña_temporal,
      fecha_creacion: contraseñaTemp[0].fecha_creacion
    });
  } catch (error) {
    console.error("Error al obtener contraseña:", error);
    res.status(500).json({ mensaje: "Error al obtener contraseña" });
  }
});

// ============================================
// GET /api/usuarios - Listar todos los usuarios
// ⭐ INCLUYE CONTRASEÑAS TEMPORALES
// ============================================
router.get("/", verificarToken, soloAdmin, async (req, res) => {
  try {
    // ⭐ Query con JOIN para obtener contraseñas temporales
    const [usuarios] = await db.query(`
      SELECT 
        u.id,
        u.correo,
        u.rol,
        u.finca_id,
        u.creado_en,
        f.nombre as finca_nombre,
        ct.contraseña_temporal as contraseña
      FROM usuarios u
      LEFT JOIN fincas f ON u.finca_id = f.id
      LEFT JOIN contraseñas_temporales ct ON u.id = ct.usuario_id AND ct.activa = TRUE
      ORDER BY u.creado_en DESC
    `);

    console.log('✅ Usuarios obtenidos con contraseñas:', usuarios.length);

    res.json(usuarios);
  } catch (error) {
    console.error("❌ Error al obtener usuarios:", error);
    res.status(500).json({ mensaje: "Error al obtener usuarios" });
  }
});


// ============================================
// PUT /api/usuarios/:id - Actualizar usuario
// ============================================
router.put("/:id", verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { correo, contraseña, rol, finca_id } = req.body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const usuarioExistente = await Usuario.buscarPorId(id);
    if (!usuarioExistente) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    // ⭐ Si se proporciona finca_id, verificar que exista
    if (finca_id !== undefined) {
      const fincaExiste = await Finca.existe(finca_id);
      if (!fincaExiste) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ 
          mensaje: "La finca especificada no existe" 
        });
      }
    }

    // ⭐ Normalizar el rol si se proporciona
    let rolNormalizado = null;
    if (rol) {
      rolNormalizado = normalizarRol(rol);
      
      if (!rolNormalizado) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          mensaje: "Rol inválido",
          rolesPermitidos: [
            'admin o administrador',
            'user o usuario', 
            'viewer o consultor'
          ]
        });
      }
    }

    let datosActualizar = {};
    
    if (correo) datosActualizar.correo = correo;
    if (rolNormalizado) datosActualizar.rol = rolNormalizado;
    if (finca_id !== undefined) datosActualizar.finca_id = finca_id;
    
    if (contraseña) {
      datosActualizar.contraseña = await bcrypt.hash(contraseña, 10);
      
      await connection.query(
        `UPDATE contraseñas_temporales SET activa = FALSE WHERE usuario_id = ?`,
        [id]
      );
      
      await connection.query(
        `INSERT INTO contraseñas_temporales (usuario_id, contraseña_temporal, activa) 
         VALUES (?, ?, TRUE)`,
        [id, contraseña]
      );
    }

    await Usuario.actualizar(id, datosActualizar);

    await connection.commit();
    connection.release();

    // Obtener usuario actualizado con información de finca
    const usuarioActualizado = await Usuario.buscarPorId(id);

    const respuesta = {
      mensaje: "Usuario actualizado exitosamente",
      usuario: {
        id: parseInt(id),
        correo: usuarioActualizado.correo,
        rol: usuarioActualizado.rol,
        finca_id: usuarioActualizado.finca_id,
        finca_nombre: usuarioActualizado.finca_nombre
      }
    };

    if (contraseña) {
      respuesta.nueva_contraseña = contraseña;
    }

    res.json(respuesta);
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ mensaje: "Error al actualizar usuario" });
  }
});

// ============================================
// DELETE /api/usuarios/:id - Eliminar usuario
// ============================================
router.delete("/:id", verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const adminId = req.usuario.id;

  try {
    if (parseInt(id) === parseInt(adminId)) {
      return res.status(400).json({ 
        mensaje: "No puedes eliminar tu propia cuenta" 
      });
    }

    const usuarioExistente = await Usuario.buscarPorId(id);
    if (!usuarioExistente) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    await Usuario.eliminar(id);

    res.json({
      mensaje: "Usuario eliminado exitosamente",
      idEliminado: parseInt(id)
    });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ mensaje: "Error al eliminar usuario" });
  }
});

module.exports = router;