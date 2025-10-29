const express = require("express");
const router = express.Router();
const db = require("../db");
const { verificarToken } = require("./auth");
const { adminOUser, cualquierUsuario } = require("../middlewares/authorization");

router.post("/add", verificarToken, adminOUser, async (req, res) => {
  let {
    fecha_vacuna,
    tipo_vacunas_id_tipo_vacuna,
    chip_animal,
    nombre_vacunas_id_vacuna,
    dosis_administrada,
    observaciones,
  } = req.body;

  if (!fecha_vacuna || !chip_animal || !dosis_administrada) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    const [animal] = await db.query(
      "SELECT id, id_usuario FROM registro_animal WHERE chip_animal = ?",
      [chip_animal]
    );

    if (animal.length === 0) {
      return res.status(404).json({
        error: "El animal con este chip no existe en la base de datos",
      });
    }

    const registro_animal_id = animal[0].id;
    const id_usuario_animal = animal[0].id_usuario;
    const rolUsuario = req.usuario.rol;
    const idUsuario = req.usuario.id;

    if (rolUsuario !== 'admin' && id_usuario_animal !== idUsuario) {
      return res.status(403).json({ 
        error: "No tienes permiso para registrar vacunas en este animal" 
      });
    }

    const [vacuna] = await db.query(
      "SELECT id_vacuna FROM nombre_vacunas WHERE id_vacuna = ?",
      [nombre_vacunas_id_vacuna]
    );
    if (vacuna.length === 0) {
      nombre_vacunas_id_vacuna = 23;
    }

    const [tipoVacuna] = await db.query(
      "SELECT id_tipo_vacuna FROM tipo_vacunas WHERE id_tipo_vacuna = ?",
      [tipo_vacunas_id_tipo_vacuna]
    );
    if (tipoVacuna.length === 0) {
      tipo_vacunas_id_tipo_vacuna = 11;
    }

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

    res.status(201).json({ message: "Vacuna registrada con éxito", id: result.insertId });
  } catch (error) {
    console.error("❌ Error al registrar vacuna:", error);
    res.status(500).json({ error: "Error al registrar la vacuna" });
  }
});

router.delete("/delete/:chip_animal", verificarToken, adminOUser, async (req, res) => {
  const { chip_animal } = req.params;
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  try {
    const [animal] = await db.query(
      "SELECT id, id_usuario FROM registro_animal WHERE chip_animal = ?",
      [chip_animal]
    );

    if (animal.length === 0) {
      return res.status(404).json({
        error: "El animal con este chip no existe en la base de datos",
      });
    }

    const registro_animal_id = animal[0].id;
    const id_usuario_animal = animal[0].id_usuario;

    if (rolUsuario !== 'admin' && id_usuario_animal !== idUsuario) {
      return res.status(403).json({ 
        error: "No tienes permiso para eliminar vacunas de este animal" 
      });
    }

    const [result] = await db.query(
      "DELETE FROM historico_vacuna WHERE registro_animal_id = ?",
      [registro_animal_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "No se encontró el registro de vacuna para el animal" });
    }

    res.json({ message: "Vacuna eliminada con éxito" });
  } catch (error) {
    console.error("❌ Error al eliminar vacuna:", error);
    res.status(500).json({ error: "Error al eliminar la vacuna" });
  }
});

router.get("/all", verificarToken, cualquierUsuario, async (req, res) => {
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  try {
    let query;
    let params = [];

    if (rolUsuario === 'admin') {
      query = "SELECT * FROM historico_vacuna";
    } else {
      query = `
        SELECT hv.* 
        FROM historico_vacuna hv
        JOIN registro_animal ra ON hv.registro_animal_id = ra.id
        WHERE ra.id_usuario = ?
      `;
      params = [idUsuario];
    }

    const [results] = await db.query(query, params);
    res.json(results);
  } catch (error) {
    console.error("❌ Error al obtener vacunas:", error);
    res.status(500).json({ error: "Error al obtener las vacunas" });
  }
});

router.get("/historico-vacunas", verificarToken, cualquierUsuario, async (req, res) => {
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  try {
    let query;
    let params = [];

    if (rolUsuario === 'admin') {
      query = `
        SELECT id, chip_animal, fecha_vacuna, tipo_vacuna, nombre, dosis_administrada, observaciones
        FROM vista_historico_vacuna
        ORDER BY fecha_vacuna DESC
      `;
    } else {
      query = `
        SELECT vhv.id, vhv.chip_animal, vhv.fecha_vacuna, vhv.tipo_vacuna, vhv.nombre, vhv.dosis_administrada, vhv.observaciones
        FROM vista_historico_vacuna vhv
        JOIN registro_animal ra ON vhv.chip_animal = ra.chip_animal
        WHERE ra.id_usuario = ?
        ORDER BY vhv.fecha_vacuna DESC
      `;
      params = [idUsuario];
    }

    const [rows] = await db.query(query, params);

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

router.get("/animal/:chip_animal", verificarToken, cualquierUsuario, async (req, res) => {
  const { chip_animal } = req.params;
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  const query = `
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
    ${rolUsuario !== 'admin' ? 'AND ra.id_usuario = ?' : ''}
  `;

  try {
    const params = rolUsuario === 'admin' ? [chip_animal] : [chip_animal, idUsuario];
    const [results] = await db.query(query, params);

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

router.put("/:id", verificarToken, adminOUser, async (req, res) => {
  const { id } = req.params;
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  const {
    fecha_vacuna,
    tipo_vacunas_id_tipo_vacuna,
    nombre_vacunas_id_vacuna,
    dosis_administrada,
    observaciones,
  } = req.body;

  try {
    const [vacuna] = await db.query(
      `SELECT hv.*, ra.id_usuario 
       FROM historico_vacuna hv
       JOIN registro_animal ra ON hv.registro_animal_id = ra.id
       WHERE hv.id = ?`,
      [id]
    );

    if (vacuna.length === 0) {
      return res.status(404).json({ error: "Vacuna no encontrada" });
    }

    if (rolUsuario !== 'admin' && vacuna[0].id_usuario !== idUsuario) {
      return res.status(403).json({ 
        error: "No tienes permiso para modificar esta vacuna" 
      });
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

    res.json({ message: "Vacuna actualizada con éxito" });
  } catch (error) {
    console.error("❌ Error al actualizar vacuna:", error);
    res.status(500).json({ error: "Error al actualizar la vacuna" });
  }
});

router.put("/chip/:id", verificarToken, adminOUser, async (req, res) => {
  const { id } = req.params;
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  const {
    fecha_vacuna,
    tipo_vacunas_id_tipo_vacuna,
    nombre_vacunas_id_vacuna,
    dosis_administrada,
    observaciones,
  } = req.body;

  try {
    const [vacuna] = await db.query(
      `SELECT hv.*, ra.id_usuario 
       FROM historico_vacuna hv
       JOIN registro_animal ra ON hv.registro_animal_id = ra.id
       WHERE hv.id = ?`,
      [id]
    );

    if (vacuna.length === 0) {
      return res.status(404).json({ error: "Vacuna no encontrada" });
    }

    if (rolUsuario !== 'admin' && vacuna[0].id_usuario !== idUsuario) {
      return res.status(403).json({ 
        error: "No tienes permiso para modificar esta vacuna" 
      });
    }

    const updateQuery = `
      UPDATE historico_vacuna 
      SET fecha_vacuna = ?, tipo_vacunas_id_tipo_vacuna = ?, 
          nombre_vacunas_id_vacuna = ?, dosis_administrada = ?, observaciones = ? 
      WHERE id = ?`;

    const [result] = await db.query(updateQuery, [
      fecha_vacuna,
      tipo_vacunas_id_tipo_vacuna,
      nombre_vacunas_id_vacuna,
      dosis_administrada,
      observaciones,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Vacuna no encontrada para actualizar" });
    }

    res.json({ message: "Vacuna actualizada con éxito" });
  } catch (error) {
    console.error("❌ Error al actualizar vacuna:", error);
    res.status(500).json({ error: "Error al actualizar la vacuna" });
  }
});

router.get("/tipos-vacuna", async (req, res) => {
  try {
    const [tipos] = await db.query(
      "SELECT id_tipo_vacuna AS value, tipo AS label FROM tipo_vacunas"
    );
    res.json(tipos);
  } catch (error) {
    console.error("❌ Error al obtener tipos de vacuna:", error);
    res.status(500).json({ error: "Error al obtener tipos de vacuna" });
  }
});

router.get("/nombres-vacuna", async (req, res) => {
  try {
    const [nombres] = await db.query(
      "SELECT id_vacuna AS value, nombre AS label FROM nombre_vacunas"
    );
    res.json(nombres);
  } catch (error) {
    console.error("❌ Error al obtener nombres de vacuna:", error);
    res.status(500).json({ error: "Error al obtener nombres de vacuna" });
  }
});

module.exports = router;