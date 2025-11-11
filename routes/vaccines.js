const express = require("express");
const router = express.Router();
const db = require("../db");
const { verificarToken } = require("./auth");
const { adminOUser, cualquierUsuario, bloquearViewer } = require("../middlewares/authorization");

// ============================================
// POST /vaccines/add - Crear nueva vacuna
// Admin y User pueden crear
// ⭐ Viewer NO puede crear (bloqueado)
// ⭐ Admin puede trabajar sin finca_id asignado
// ============================================
router.post("/add", verificarToken, bloquearViewer, async (req, res) => {
  const rolUsuario = req.usuario?.rol;
  const finca_id = req.usuario?.finca_id;

  // ⭐ Admin puede trabajar sin finca_id asignado
  if (!finca_id && rolUsuario !== 'admin') {
    return res.status(400).json({ 
      error: "Usuario sin finca asignada",
      detalle: "El usuario debe tener una finca asignada"
    });
  }

  let {
    fecha_vacuna,
    tipo_vacunas_id_tipo_vacuna,
    chip_animal,
    nombre_vacunas_id_vacuna,
    dosis_administrada,
    observaciones,
  } = req.body;

  console.log("📥 Datos recibidos:", { fecha_vacuna, chip_animal, dosis_administrada });
  console.log("👤 Usuario registrando:", req.usuario.correo, "- Rol:", rolUsuario, "- Finca:", finca_id);

  if (!fecha_vacuna || !chip_animal || !dosis_administrada) {
    return res.status(400).json({ error: "Todos los campos son obligatorios (fecha_vacuna, chip_animal, dosis_administrada)" });
  }

  try {
    // ⭐ Buscar el animal (admin puede ver de cualquier finca)
    let animalQuery = "SELECT id, finca_id FROM registro_animal WHERE chip_animal = ?";
    let animalParams = [chip_animal];

    if (rolUsuario !== 'admin' && finca_id) {
      animalQuery += " AND finca_id = ?";
      animalParams.push(finca_id);
    }

    const [animal] = await db.query(animalQuery, animalParams);

    if (animal.length === 0) {
      return res.status(404).json({
        error: rolUsuario === 'admin' 
          ? "El animal con este chip no existe" 
          : "El animal con este chip no existe en tu finca",
      });
    }

    const registro_animal_id = animal[0].id;

    // Validar vacuna (asignar valor por defecto si no existe)
    const [vacuna] = await db.query(
      "SELECT id_vacuna FROM nombre_vacunas WHERE id_vacuna = ?",
      [nombre_vacunas_id_vacuna]
    );
    if (vacuna.length === 0) {
      nombre_vacunas_id_vacuna = 23; // ID por defecto para "Otra vacuna"
    }

    // Validar tipo de vacuna (asignar valor por defecto si no existe)
    const [tipoVacuna] = await db.query(
      "SELECT id_tipo_vacuna FROM tipo_vacunas WHERE id_tipo_vacuna = ?",
      [tipo_vacunas_id_tipo_vacuna]
    );
    if (tipoVacuna.length === 0) {
      tipo_vacunas_id_tipo_vacuna = 11; // ID por defecto para "Otro tipo"
    }

    // Validar formato de dosis
    if (typeof dosis_administrada === "string" && !dosis_administrada.includes(" ")) {
      return res.status(400).json({
        error: 'La dosis administrada debe incluir la cantidad y la unidad (ej. "3 ml")',
      });
    }

    const insertQuery = `
      INSERT INTO historico_vacuna 
      (fecha_vacuna, tipo_vacunas_id_tipo_vacuna, registro_animal_id, nombre_vacunas_id_vacuna, dosis_administrada, observaciones) 
      VALUES (?, ?, ?, ?, ?, ?)`;

    const [result] = await db.query(insertQuery, [
      fecha_vacuna,
      tipo_vacunas_id_tipo_vacuna,
      registro_animal_id,
      nombre_vacunas_id_vacuna,
      dosis_administrada,
      observaciones,
    ]);

    console.log("✅ Vacuna registrada con ID:", result.insertId);

    res.status(201).json({ 
      message: "Vacuna registrada con éxito", 
      id: result.insertId,
      chip_animal: chip_animal,
      registrado_por: req.usuario.correo
    });
  } catch (error) {
    console.error("❌ Error al registrar vacuna:", error);
    res.status(500).json({ 
      error: "Error al registrar la vacuna",
      details: error.message
    });
  }
});

// ============================================
// DELETE /vaccines/delete/:chip_animal - Eliminar vacunas de un animal
// ⭐ Admin puede eliminar de cualquier finca
// ============================================
router.delete("/delete/:chip_animal", verificarToken, bloquearViewer, async (req, res) => {
  const { chip_animal } = req.params;
  const finca_id = req.usuario.finca_id;
  const rolUsuario = req.usuario.rol;

  console.log("🗑️ Intentando eliminar vacunas del chip:", chip_animal, "- Rol:", rolUsuario, "- Finca:", finca_id);

  try {
    // ⭐ Admin puede eliminar de cualquier finca
    let animalQuery = "SELECT id, finca_id FROM registro_animal WHERE chip_animal = ?";
    let animalParams = [chip_animal];

    if (rolUsuario !== 'admin' && finca_id) {
      animalQuery += " AND finca_id = ?";
      animalParams.push(finca_id);
    }

    const [animal] = await db.query(animalQuery, animalParams);

    if (animal.length === 0) {
      return res.status(404).json({
        error: "El animal con este chip no existe",
      });
    }

    const registro_animal_id = animal[0].id;

    const [result] = await db.query(
      "DELETE FROM historico_vacuna WHERE registro_animal_id = ?",
      [registro_animal_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "No se encontró el registro de vacuna para el animal" });
    }

    console.log("✅ Vacunas eliminadas exitosamente");

    res.json({ 
      message: "Vacuna(s) eliminada(s) con éxito",
      eliminados: result.affectedRows
    });
  } catch (error) {
    console.error("❌ Error al eliminar vacuna:", error);
    res.status(500).json({ error: "Error al eliminar la vacuna" });
  }
});

// ============================================
// GET /vaccines/all - Listar todas las vacunas
// ⭐ Admin ve todas, otros ven solo de su finca
// ============================================
router.get("/all", verificarToken, cualquierUsuario, async (req, res) => {
  const finca_id = req.usuario.finca_id;
  const rolUsuario = req.usuario.rol;

  console.log("📋 Listando vacunas - Usuario:", req.usuario.correo, "- Rol:", rolUsuario, "- Finca:", finca_id);

  if (!finca_id && rolUsuario !== 'admin') {
    return res.status(400).json({ 
      error: "Usuario sin finca asignada" 
    });
  }

  try {
    let query = `
      SELECT hv.* 
      FROM historico_vacuna hv
      JOIN registro_animal ra ON hv.registro_animal_id = ra.id
    `;

    let queryParams = [];

    if (rolUsuario !== 'admin' && finca_id) {
      query += ` WHERE ra.finca_id = ?`;
      queryParams.push(finca_id);
    }

    query += ` ORDER BY hv.fecha_vacuna DESC`;

    const [results] = await db.query(query, queryParams);

    console.log(`✅ ${results.length} vacunas encontradas`);

    res.json({
      total: results.length,
      finca_id: finca_id,
      vacunas: results
    });
  } catch (error) {
    console.error("❌ Error al obtener vacunas:", error);
    res.status(500).json({ error: "Error al obtener las vacunas" });
  }
});

// ============================================
// GET /vaccines/historico-vacunas - Histórico detallado
// ⭐ Admin ve todas, otros ven solo de su finca
// ============================================
router.get("/historico-vacunas", verificarToken, cualquierUsuario, async (req, res) => {
  const finca_id = req.usuario.finca_id;
  const rolUsuario = req.usuario.rol;

  if (!finca_id && rolUsuario !== 'admin') {
    return res.status(400).json({ 
      error: "Usuario sin finca asignada" 
    });
  }

  try {
    let query = `
      SELECT 
        hv.id,
        ra.chip_animal,
        hv.fecha_vacuna,
        tv.tipo AS tipo_vacuna,
        nv.nombre,
        hv.dosis_administrada,
        hv.observaciones
      FROM historico_vacuna hv
      JOIN registro_animal ra ON hv.registro_animal_id = ra.id
      LEFT JOIN tipo_vacunas tv ON hv.tipo_vacunas_id_tipo_vacuna = tv.id_tipo_vacuna
      LEFT JOIN nombre_vacunas nv ON hv.nombre_vacunas_id_vacuna = nv.id_vacuna
    `;

    let queryParams = [];

    if (rolUsuario !== 'admin' && finca_id) {
      query += ` WHERE ra.finca_id = ?`;
      queryParams.push(finca_id);
    }

    query += ` ORDER BY hv.fecha_vacuna DESC`;

    const [rows] = await db.query(query, queryParams);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No se encontraron registros de vacunas" });
    }

    const response = rows.map((row) => ({
      id: row.id,
      fecha: row.fecha_vacuna,
      chip: row.chip_animal,
      nombre: row.nombre,
      tipo: row.tipo_vacuna,
      dosis: row.dosis_administrada,
      obs: row.observaciones,
    }));

    res.json(response);
  } catch (error) {
    console.error("Error al obtener histórico de vacunas:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ============================================
// GET /vaccines/animal/:chip_animal - Vacunas de un animal específico
// ⭐ Admin puede ver de cualquier animal
// ============================================
router.get("/animal/:chip_animal", verificarToken, cualquierUsuario, async (req, res) => {
  const { chip_animal } = req.params;
  const finca_id = req.usuario.finca_id;
  const rolUsuario = req.usuario.rol;

  if (!finca_id && rolUsuario !== 'admin') {
    return res.status(400).json({ 
      error: "Usuario sin finca asignada" 
    });
  }

  let query = `
    SELECT 
      hv.fecha_vacuna, 
      nv.nombre AS nombre_vacuna, 
      tv.tipo AS tipo_vacuna, 
      ra.chip_animal, 
      hv.dosis_administrada, 
      hv.observaciones, 
      hv.created_at AS creado, 
      hv.updated_at AS actualizado
    FROM historico_vacuna hv
    JOIN registro_animal ra ON hv.registro_animal_id = ra.id
    LEFT JOIN nombre_vacunas nv ON hv.nombre_vacunas_id_vacuna = nv.id_vacuna
    LEFT JOIN tipo_vacunas tv ON hv.tipo_vacunas_id_tipo_vacuna = tv.id_tipo_vacuna
    WHERE ra.chip_animal = ?
  `;

  let queryParams = [chip_animal];

  if (rolUsuario !== 'admin' && finca_id) {
    query += ` AND ra.finca_id = ?`;
    queryParams.push(finca_id);
  }

  query += ` ORDER BY hv.fecha_vacuna DESC`;

  try {
    const [results] = await db.query(query, queryParams);

    if (results.length === 0) {
      return res.status(404).json({
        error: `No se encontraron registros de vacunas para el chip_animal ${chip_animal}`,
      });
    }

    res.status(200).json(results);
  } catch (err) {
    console.error("❌ Error al obtener las vacunas:", err);
    res.status(500).json({ error: "Error al obtener las vacunas" });
  }
});

// ============================================
// PUT /vaccines/:id - Actualizar vacuna
// ⭐ Admin puede actualizar de cualquier finca
// ============================================
router.put("/:id", verificarToken, bloquearViewer, async (req, res) => {
  const { id } = req.params;
  const finca_id = req.usuario.finca_id;
  const rolUsuario = req.usuario.rol;

  const {
    fecha_vacuna,
    tipo_vacunas_id_tipo_vacuna,
    nombre_vacunas_id_vacuna,
    dosis_administrada,
    observaciones,
  } = req.body;

  try {
    // ⭐ Admin puede actualizar de cualquier finca
    let checkQuery = `
      SELECT hv.*, ra.finca_id 
      FROM historico_vacuna hv
      JOIN registro_animal ra ON hv.registro_animal_id = ra.id
      WHERE hv.id = ?
    `;
    let checkParams = [id];

    if (rolUsuario !== 'admin' && finca_id) {
      checkQuery += ` AND ra.finca_id = ?`;
      checkParams.push(finca_id);
    }

    const [vacuna] = await db.query(checkQuery, checkParams);

    if (vacuna.length === 0) {
      return res.status(404).json({ error: "Vacuna no encontrada" });
    }

    const updateFields = [];
    const values = [];

    if (fecha_vacuna) {
      updateFields.push("fecha_vacuna = ?");
      values.push(fecha_vacuna);
    }
    if (tipo_vacunas_id_tipo_vacuna) {
      updateFields.push("tipo_vacunas_id_tipo_vacuna = ?");
      values.push(tipo_vacunas_id_tipo_vacuna);
    }
    if (nombre_vacunas_id_vacuna) {
      updateFields.push("nombre_vacunas_id_vacuna = ?");
      values.push(nombre_vacunas_id_vacuna);
    }
    if (dosis_administrada) {
      updateFields.push("dosis_administrada = ?");
      values.push(dosis_administrada);
    }
    if (observaciones !== undefined) {
      updateFields.push("observaciones = ?");
      values.push(observaciones);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    values.push(id);

    const updateQuery = `
      UPDATE historico_vacuna
      SET ${updateFields.join(", ")}
      WHERE id = ?
    `;

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Vacuna no encontrada para actualizar" });
    }

    console.log("✅ Vacuna actualizada exitosamente");

    res.json({ message: "Vacuna actualizada con éxito" });
  } catch (error) {
    console.error("❌ Error al actualizar vacuna:", error);
    res.status(500).json({ error: "Error al actualizar la vacuna" });
  }
});

// ============================================
// GET /vaccines/tipos-vacuna - Catálogo de tipos
// ⭐ Ruta pública
// ============================================
router.get("/tipos-vacuna", async (req, res) => {
  try {
    const [tipos] = await db.query(
      "SELECT id_tipo_vacuna AS value, tipo AS label FROM tipo_vacunas ORDER BY tipo"
    );
    res.json(tipos);
  } catch (error) {
    console.error("❌ Error al obtener tipos de vacuna:", error);
    res.status(500).json({ error: "Error al obtener tipos de vacuna" });
  }
});

// ============================================
// GET /vaccines/nombres-vacuna - Catálogo de nombres
// ⭐ Ruta pública
// ============================================
router.get("/nombres-vacuna", async (req, res) => {
  try {
    const [nombres] = await db.query(
      "SELECT id_vacuna AS value, nombre AS label FROM nombre_vacunas ORDER BY nombre"
    );
    res.json(nombres);
  } catch (error) {
    console.error("❌ Error al obtener nombres de vacuna:", error);
    res.status(500).json({ error: "Error al obtener nombres de vacuna" });
  }
});

module.exports = router;
