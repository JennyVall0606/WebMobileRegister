const express = require("express");
const router = express.Router();
const Finca = require("../models/finca");
const { verificarToken } = require("./auth");
const { soloAdmin } = require("../middlewares/authorization");

// ============================================
// GET /api/fincas - Listar todas las fincas
// ============================================
router.get("/", verificarToken, soloAdmin, async (req, res) => {
  try {
    const fincas = await Finca.obtenerTodas();
    
    res.json({
      mensaje: "Fincas obtenidas exitosamente",
      total: fincas.length,
      fincas: fincas
    });
  } catch (error) {
    console.error("Error al obtener fincas:", error);
    res.status(500).json({ mensaje: "Error al obtener fincas" });
  }
});

// ============================================
// GET /api/fincas/:id - Obtener una finca específica
// ============================================
router.get("/:id", verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const finca = await Finca.obtenerConDetalles(id);

    if (!finca) {
      return res.status(404).json({ mensaje: "Finca no encontrada" });
    }

    res.json({
      mensaje: "Finca obtenida exitosamente",
      finca: finca
    });
  } catch (error) {
    console.error("Error al obtener finca:", error);
    res.status(500).json({ mensaje: "Error al obtener finca" });
  }
});

// ============================================
// GET /api/fincas/:id/estadisticas - Estadísticas de la finca
// ============================================
router.get("/:id/estadisticas", verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const estadisticas = await Finca.obtenerEstadisticas(id);

    if (!estadisticas) {
      return res.status(404).json({ mensaje: "Finca no encontrada" });
    }

    res.json({
      mensaje: "Estadísticas obtenidas exitosamente",
      estadisticas: estadisticas
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({ mensaje: "Error al obtener estadísticas" });
  }
});

// ============================================
// POST /api/fincas - Crear nueva finca
// ============================================
router.post("/", verificarToken, soloAdmin, async (req, res) => {
  const { nombre, nit, direccion, telefono, correo, activa } = req.body;

  // Validación de campos requeridos
  if (!nombre || !nit) {
    return res.status(400).json({ 
      mensaje: "Los campos 'nombre' y 'nit' son obligatorios",
      camposRequeridos: ["nombre", "nit"],
      camposOpcionales: ["direccion", "telefono", "correo", "activa"]
    });
  }

  try {
    // Verificar si el NIT ya existe
    const fincaExistente = await Finca.buscarPorNit(nit);
    if (fincaExistente) {
      return res.status(409).json({ 
        mensaje: "El NIT ya está registrado" 
      });
    }

    const nuevaFinca = await Finca.crear({
      nombre,
      nit,
      direccion: direccion || null,
      telefono: telefono || null,
      correo: correo || null,
      activa: activa !== undefined ? activa : 1
    });

    res.status(201).json({
      mensaje: "Finca creada exitosamente",
      finca: nuevaFinca
    });
  } catch (error) {
    console.error("Error al crear finca:", error);
    
    if (error.message.includes('NIT ya está registrado')) {
      return res.status(409).json({ mensaje: error.message });
    }
    
    res.status(500).json({ mensaje: "Error al crear finca" });
  }
});

// ============================================
// PUT /api/fincas/:id - Actualizar finca
// ============================================
router.put("/:id", verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre, nit, direccion, telefono, correo, activa } = req.body;

  try {
    // Verificar si la finca existe
    const fincaExistente = await Finca.buscarPorId(id);
    if (!fincaExistente) {
      return res.status(404).json({ mensaje: "Finca no encontrada" });
    }

    // Si se está actualizando el NIT, verificar que no exista en otra finca
    if (nit && nit !== fincaExistente.nit) {
      const fincaConNit = await Finca.buscarPorNit(nit);
      if (fincaConNit && fincaConNit.id !== parseInt(id)) {
        return res.status(409).json({ 
          mensaje: "El NIT ya está registrado en otra finca" 
        });
      }
    }

    let datosActualizar = {};
    
    if (nombre !== undefined) datosActualizar.nombre = nombre;
    if (nit !== undefined) datosActualizar.nit = nit;
    if (direccion !== undefined) datosActualizar.direccion = direccion;
    if (telefono !== undefined) datosActualizar.telefono = telefono;
    if (correo !== undefined) datosActualizar.correo = correo;
    if (activa !== undefined) datosActualizar.activa = activa;

    if (Object.keys(datosActualizar).length === 0) {
      return res.status(400).json({ 
        mensaje: "No se proporcionaron campos para actualizar" 
      });
    }

    await Finca.actualizar(id, datosActualizar);

    // Obtener la finca actualizada
    const fincaActualizada = await Finca.buscarPorId(id);

    res.json({
      mensaje: "Finca actualizada exitosamente",
      finca: fincaActualizada
    });
  } catch (error) {
    console.error("Error al actualizar finca:", error);
    
    if (error.message.includes('NIT ya está registrado')) {
      return res.status(409).json({ mensaje: error.message });
    }
    
    res.status(500).json({ mensaje: "Error al actualizar finca" });
  }
});

// ============================================
// PATCH /api/fincas/:id/estado - Activar/Desactivar finca
// ============================================
router.patch("/:id/estado", verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { activa } = req.body;

  if (activa === undefined) {
    return res.status(400).json({ 
      mensaje: "El campo 'activa' es requerido (true/false o 1/0)" 
    });
  }

  try {
    const fincaExistente = await Finca.buscarPorId(id);
    if (!fincaExistente) {
      return res.status(404).json({ mensaje: "Finca no encontrada" });
    }

    const estadoBooleano = activa === true || activa === 1 || activa === '1';
    
    await Finca.cambiarEstado(id, estadoBooleano ? 1 : 0);

    res.json({
      mensaje: `Finca ${estadoBooleano ? 'activada' : 'desactivada'} exitosamente`,
      finca: {
        id: parseInt(id),
        nombre: fincaExistente.nombre,
        activa: estadoBooleano
      }
    });
  } catch (error) {
    console.error("Error al cambiar estado de finca:", error);
    res.status(500).json({ mensaje: "Error al cambiar estado de finca" });
  }
});

// ============================================
// DELETE /api/fincas/:id - Eliminar finca
// ============================================
router.delete("/:id", verificarToken, soloAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const fincaExistente = await Finca.buscarPorId(id);
    if (!fincaExistente) {
      return res.status(404).json({ mensaje: "Finca no encontrada" });
    }

    // Verificar si tiene usuarios o animales asociados
    const estadisticas = await Finca.obtenerEstadisticas(id);
    
    if (estadisticas.total_usuarios > 0 || estadisticas.total_animales > 0) {
      return res.status(400).json({ 
        mensaje: "No se puede eliminar la finca porque tiene datos asociados",
        detalle: {
          usuarios: estadisticas.total_usuarios,
          animales: estadisticas.total_animales
        },
        sugerencia: "Primero elimina o reasigna los usuarios y animales asociados"
      });
    }

    await Finca.eliminar(id);

    res.json({
      mensaje: "Finca eliminada exitosamente",
      fincaEliminada: {
        id: parseInt(id),
        nombre: fincaExistente.nombre
      }
    });
  } catch (error) {
    console.error("Error al eliminar finca:", error);
    
    if (error.message.includes('tiene usuarios o animales asociados')) {
      return res.status(400).json({ mensaje: error.message });
    }
    
    res.status(500).json({ mensaje: "Error al eliminar finca" });
  }
});

module.exports = router;