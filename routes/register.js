const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { verificarToken } = require("./auth");
const { adminOUser, cualquierUsuario } = require("../middlewares/authorization");

const uploadDirectory = "uploads";
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

router.post("/add", verificarToken, adminOUser, upload.single("foto"), async (req, res) => {
  const id_usuario = req.usuario?.id;

  if (!id_usuario) {
    return res.status(400).json({ error: "Usuario no autenticado" });
  }

  let {
    chip_animal,
    peso_nacimiento,
    raza_id_raza,
    fecha_nacimiento,
    id_madre,
    id_padre,
    enfermedades,
    observaciones,
    procedencia,
    hierro,
    categoria,
    ubicacion,
    numero_parto,
    precocidad,
    tipo_monta,
  } = req.body;

  console.log("📥 Datos recibidos:", { chip_animal, peso_nacimiento, fecha_nacimiento, raza_id_raza });

  if (!req.file) {
    return res.status(400).json({ error: "No se subió una foto" });
  }

  const fotoPrincipal = req.file.filename;

  if (!chip_animal || !peso_nacimiento || !raza_id_raza || !fecha_nacimiento) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  id_madre = id_madre || null;
  id_padre = id_padre || null;
  enfermedades = enfermedades || null;
  observaciones = observaciones || null;
  procedencia = procedencia || null;
  hierro = hierro || null;
  categoria = categoria || null;
  ubicacion = ubicacion || null;

  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const [existingChip] = await connection.query(
      `SELECT * FROM registro_animal WHERE chip_animal = ?`,
      [chip_animal]
    );

    if (existingChip.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: "El chip ya está registrado" });
    }

    const [razaResult] = await connection.query(
      `SELECT id_raza FROM raza WHERE id_raza = ?`,
      [raza_id_raza]
    );

    if (razaResult.length === 0) {
      console.warn('Raza no encontrada, asignando "Otra Raza" (id 25)');
      raza_id_raza = 25;
    }

    const queryInsert = `
      INSERT INTO registro_animal 
      (foto, chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones, id_usuario, procedencia, hierro, categoria, ubicacion, numero_parto, precocidad, tipo_monta, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

    const values = [
      fotoPrincipal, chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento,
      id_madre, id_padre, enfermedades, observaciones, id_usuario, procedencia,
      hierro, categoria, ubicacion, numero_parto, precocidad, tipo_monta,
    ];

    console.log("📤 Insertando animal...");
    const [result] = await connection.query(queryInsert, values);
    const registro_animal_id = result.insertId;
    
    console.log("✅ Animal registrado con ID:", registro_animal_id);

    if (!registro_animal_id || registro_animal_id === 0) {
      throw new Error("No se pudo obtener el ID del animal registrado");
    }

    console.log("📤 Intentando registrar peso inicial...");

    const queryPeso = `
      INSERT INTO historico_pesaje (
        registro_animal_id,
        chip_animal,
        fecha_pesaje,
        peso_kg,
        tipo_seguimiento,
        created_at
      ) VALUES (?, ?, ?, ?, 'nacimiento', NOW())`;

    const valuesPeso = [
      registro_animal_id,
      chip_animal,
      fecha_nacimiento,
      parseFloat(peso_nacimiento)
    ];

    console.log("📤 Valores para peso:", valuesPeso);

    const [pesoResult] = await connection.query(queryPeso, valuesPeso);

    console.log("✅ Peso inicial registrado con ID:", pesoResult.insertId);

    await connection.commit();
    connection.release();

    res.status(201).json({ 
      message: "Registro agregado con éxito", 
      id: registro_animal_id,
      peso_inicial_id: pesoResult.insertId
    });

  } catch (error) {
    console.error("❌ Error completo:", error);
    await connection.rollback();
    connection.release();
    
    res.status(500).json({ 
      error: "Error al registrar el animal",
      details: error.message,
      sqlMessage: error.sqlMessage
    });
  }
});

router.delete("/delete/:chip_animal", verificarToken, adminOUser, async (req, res) => {
  const { chip_animal } = req.params;
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  try {
    const [animal] = await db.query(
      `SELECT * FROM registro_animal WHERE chip_animal = ?`,
      [chip_animal]
    );

    if (animal.length === 0) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    if (rolUsuario !== 'admin' && animal[0].id_usuario !== idUsuario) {
      return res.status(403).json({ 
        error: "No tienes permiso para eliminar este animal" 
      });
    }

    const [result] = await db.query(
      `DELETE FROM registro_animal WHERE chip_animal = ?`,
      [chip_animal]
    );

    res.status(200).json({ message: "Registro eliminado con éxito" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar el registro" });
  }
});

router.get("/all", verificarToken, cualquierUsuario, async (req, res) => {
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  try {
    let query;
    let params = [];

    if (rolUsuario === 'admin') {
      query = `SELECT * FROM vista_registro_animal ORDER BY id DESC`;
    } else {
      query = `SELECT * FROM vista_registro_animal WHERE id_usuario = ? ORDER BY id DESC`;
      params = [idUsuario];
    }

    const [results] = await db.query(query, params);
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener los registros" });
  }
});

router.get("/animal/:chip_animal", verificarToken, cualquierUsuario, async (req, res) => {
  const { chip_animal } = req.params;
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  try {
    let query;
    let params;

    if (rolUsuario === 'admin') {
      query = `SELECT * FROM vista_registro_animal WHERE chip_animal = ?`;
      params = [chip_animal];
    } else {
      query = `SELECT * FROM vista_registro_animal WHERE chip_animal = ? AND id_usuario = ?`;
      params = [chip_animal, idUsuario];
    }

    const [results] = await db.query(query, params);

    if (results.length === 0) {
      return res.status(404).json({ error: "Registro no encontrado o sin permiso" });
    }

    res.status(200).json(results[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el registro" });
  }
});

router.put("/update/:chip_animal", verificarToken, adminOUser, upload.single("foto"), async (req, res) => {
  const chip_animal_original = req.params.chip_animal;
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  const {
    chip_animal = req.body.chip_animal,
    peso_nacimiento = req.body.peso_nacimiento,
    raza_id_raza = req.body.raza_id_raza,
    fecha_nacimiento = req.body.fecha_nacimiento,
    id_madre = req.body.id_madre,
    id_padre = req.body.id_padre,
    enfermedades = req.body.enfermedades,
    observaciones = req.body.observaciones,
    categoria = req.body.categoria,
    procedencia = req.body.procedencia,
    hierro = req.body.hierro,
    ubicacion = req.body.ubicacion,
    numero_parto = req.body.numero_parto,
    precocidad = req.body.precocidad,
    tipo_monta = req.body.tipo_monta,
  } = req.body;

  try {
    const [existingRecord] = await db.query(
      `SELECT * FROM registro_animal WHERE chip_animal = ?`,
      [chip_animal_original]
    );

    if (existingRecord.length === 0) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    if (rolUsuario !== 'admin' && existingRecord[0].id_usuario !== idUsuario) {
      return res.status(403).json({ 
        error: "No tienes permiso para modificar este animal" 
      });
    }

    const fechaFormateada = fecha_nacimiento ? fecha_nacimiento.split("T")[0] : null;

    let razaFinal = raza_id_raza;
    const [razaResult] = await db.query(
      `SELECT id_raza FROM raza WHERE id_raza = ?`,
      [raza_id_raza]
    );

    if (razaResult.length === 0) {
      razaFinal = 25;
    }

    let setClauses = [];
    let values = [];

    setClauses.push("chip_animal = ?");
    values.push(chip_animal);

    setClauses.push("peso_nacimiento = ?");
    values.push(peso_nacimiento);

    setClauses.push("raza_id_raza = ?");
    values.push(razaFinal);

    setClauses.push("fecha_nacimiento = ?");
    values.push(fechaFormateada);

    if (id_madre) {
      setClauses.push("id_madre = ?");
      values.push(id_madre);
    } else {
      setClauses.push("id_madre = NULL");
    }

    if (id_padre) {
      setClauses.push("id_padre = ?");
      values.push(id_padre);
    } else {
      setClauses.push("id_padre = NULL");
    }

    setClauses.push("procedencia = ?");
    values.push(procedencia);

    setClauses.push("hierro = ?");
    values.push(hierro);

    setClauses.push("categoria = ?");
    values.push(categoria);

    setClauses.push("ubicacion = ?");
    values.push(ubicacion);

    const categoriaNormalizada = categoria
      ? categoria.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      : null;

    if (categoriaNormalizada === "cria") {
      setClauses.push("numero_parto = ?");
      values.push(numero_parto || null);
      setClauses.push("precocidad = ?");
      values.push(precocidad || null);
      setClauses.push("tipo_monta = ?");
      values.push(tipo_monta || null);
    } else {
      setClauses.push("numero_parto = NULL");
      setClauses.push("precocidad = NULL");
      setClauses.push("tipo_monta = NULL");
    }

    if (enfermedades) {
      let enfermedadesFormateadas;
      if (Array.isArray(enfermedades)) {
        enfermedadesFormateadas = enfermedades.join(",");
      } else if (typeof enfermedades === "string") {
        enfermedadesFormateadas = enfermedades;
      } else {
        enfermedadesFormateadas = null;
      }
      setClauses.push("enfermedades = ?");
      values.push(enfermedadesFormateadas);
    } else {
      setClauses.push("enfermedades = NULL");
    }

    if (observaciones) {
      setClauses.push("observaciones = ?");
      values.push(observaciones);
    } else {
      setClauses.push("observaciones = NULL");
    }

    if (req.file) {
      setClauses.push("foto = ?");
      values.push(req.file.filename);
    }

    const queryUpdate = `
      UPDATE registro_animal 
      SET ${setClauses.join(", ")} 
      WHERE chip_animal = ?`;

    values.push(chip_animal_original);

    const [result] = await db.query(queryUpdate, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    try {
      const [updatePesoResult] = await db.query(
        `UPDATE historico_pesaje SET 
          fecha_pesaje = ?,
          peso_kg = ?,
          chip_animal = ?,
          updated_at = NOW()
        WHERE chip_animal = ? 
        AND tipo_seguimiento IS NULL`,
        [fechaFormateada, peso_nacimiento, chip_animal, chip_animal_original]
      );

      if (updatePesoResult.affectedRows > 0) {
        console.log("✅ Peso inicial actualizado");
      } else {
        console.log("⚠️ No existe peso inicial, creando...");
        
        const registro_id = existingRecord[0].id;
        await db.query(
          `INSERT INTO historico_pesaje (
            registro_animal_id,
            chip_animal,
            fecha_pesaje,
            peso_kg,
            created_at
          ) VALUES (?, ?, ?, ?, NOW())`,
          [registro_id, chip_animal, fechaFormateada, peso_nacimiento]
        );
        
        console.log("✅ Peso inicial creado");
      }
    } catch (pesoError) {
      console.error("⚠️ Error al actualizar peso inicial:", pesoError);
    }

    res.status(200).json({
      message: "Registro actualizado con éxito",
      changes: result.changedRows
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({
      error: "Error al actualizar el registro",
      details: err.message
    });
  }
});

router.get("/razas", async (req, res) => {
  const query = `SELECT * FROM raza`;

  try {
    const [results] = await db.query(query);
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener las razas" });
  }
});

module.exports = router;