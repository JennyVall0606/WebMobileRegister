const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Usuario = require("../models/user");
const db = require("../db");
const { verificarToken } = require("./auth");
const { soloAdmin } = require("../middlewares/authorization");

router.get("/", verificarToken, soloAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.obtenerTodos();
    
    const usuariosSeguros = usuarios.map(u => ({
      id: u.id,
      correo: u.correo,
      rol: u.rol,
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
      creado_en: usuario.creado_en
    };

    res.json(usuarioSeguro);
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    res.status(500).json({ mensaje: "Error al obtener usuario" });
  }
});

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

router.post("/", verificarToken, soloAdmin, async (req, res) => {
  const { correo, contraseña, rol } = req.body;

  if (!correo || !contraseña || !rol) {
    return res.status(400).json({ 
      mensaje: "Todos los campos son obligatorios",
      camposRequeridos: ["correo", "contraseña", "rol"]
    });
  }

  const rolesValidos = ['admin', 'user', 'viewer'];
  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({ 
      mensaje: "Rol inválido",
      rolesPermitidos: rolesValidos
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const usuarioExistente = await Usuario.buscarPorCorreo(correo);
    if (usuarioExistente) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({ 
        mensaje: "El correo ya está registrado" 
      });
    }

    const contraseñaCifrada = await bcrypt.hash(contraseña, 10);

    const nuevoUsuario = await Usuario.crear({
      correo,
      contraseña: contraseñaCifrada,
      rol
    });

    await connection.query(
      `INSERT INTO contraseñas_temporales (usuario_id, contraseña_temporal, activa) 
       VALUES (?, ?, TRUE)`,
      [nuevoUsuario.id, contraseña]
    );

    await connection.commit();
    connection.release();

    res.status(201).json({
      mensaje: "Usuario creado exitosamente",
      usuario: {
        id: nuevoUsuario.id,
        correo: nuevoUsuario.correo,
        rol: nuevoUsuario.rol
      },
      contraseña_asignada: contraseña
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Error al crear usuario:", error);
    res.status(500).json({ mensaje: "Error al crear usuario" });
  }
});

router.put("/:id", verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { correo, contraseña, rol } = req.body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const usuarioExistente = await Usuario.buscarPorId(id);
    if (!usuarioExistente) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    if (rol) {
      const rolesValidos = ['admin', 'user', 'viewer'];
      if (!rolesValidos.includes(rol)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          mensaje: "Rol inválido",
          rolesPermitidos: rolesValidos
        });
      }
    }

    let datosActualizar = {};
    
    if (correo) datosActualizar.correo = correo;
    if (rol) datosActualizar.rol = rol;
    
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

    const respuesta = {
      mensaje: "Usuario actualizado exitosamente",
      usuario: {
        id: parseInt(id),
        ...datosActualizar,
        contraseña: undefined
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