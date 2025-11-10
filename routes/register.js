const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { verificarToken } = require("./auth");
const { 
  adminOUser, 
  cualquierUsuario, 
  bloquearViewer 
} = require("../middlewares/authorization");

// ============================================
// CONFIGURACIÓN DE MULTER
// ============================================
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

// ============================================
// POST /register/add - Crear nuevo animal
// Admin y User pueden crear
// ⭐ Viewer NO puede crear (bloqueado)
// ============================================
router.post("/add", verificarToken, bloquearViewer, upload.single("foto"), async (req, res) => {
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
  console.log("👤 Usuario creando:", req.usuario.correo, "- Rol:", req.usuario.rol);

  if (!req.file) {
    return res.status(400).json({ error: "No se subió una foto" });
  }

  const fotoPrincipal = req.file.filename;

  if (!chip_animal || !peso_nacimiento || !raza_id_raza || !fecha_nacimiento) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  // Valores por defecto
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

    // Verificar chip duplicado
    const [existingChip] = await connection.query(
      `SELECT * FROM registro_animal WHERE chip_animal = ?`,
      [chip_animal]
    );

    if (existingChip.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: "El chip ya está registrado" });
    }

    // Validar raza
    const [razaResult] = await connection.query(
      `SELECT id_raza FROM raza WHERE id_raza = ?`,
      [raza_id_raza]
    );

    if (razaResult.length === 0) {
      console.warn('Raza no encontrada, asignando "Otra Raza" (id 25)');
      raza_id_raza = 25;
    }

    // ⭐ Insertar animal con el id_usuario del que lo está creando
    const queryInsert = `
      INSERT INTO registro_animal 
      (foto, chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones, id_usuario, procedencia, hierro, categoria, ubicacion, numero_parto, precocidad, tipo_monta, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

    const values = [
      fotoPrincipal, chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento,
      id_madre, id_padre, enfermedades, observaciones, id_usuario, procedencia,
      hierro, categoria, ubicacion, numero_parto, precocidad, tipo_monta,
    ];

    console.log("📤 Insertando animal para usuario ID:", id_usuario);
    const [result] = await connection.query(queryInsert, values);
    const registro_animal_id = result.insertId;
    
    console.log("✅ Animal registrado con ID:", registro_animal_id);

    if (!registro_animal_id || registro_animal_id === 0) {
      throw new Error("No se pudo obtener el ID del animal registrado");
    }

    // Registrar peso inicial
    console.log("📤 Registrando peso inicial...");

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

    const [pesoResult] = await connection.query(queryPeso, valuesPeso);
    console.log("✅ Peso inicial registrado con ID:", pesoResult.insertId);

    await connection.commit();
    connection.release();

    res.status(201).json({ 
      message: "Animal registrado con éxito", 
      id: registro_animal_id,
      peso_inicial_id: pesoResult.insertId,
      propietario: req.usuario.correo
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

// ============================================
// DELETE /register/delete/:chip_animal - Eliminar animal
// Admin puede eliminar cualquiera
// User solo puede eliminar los suyos
// ⭐ Viewer NO puede eliminar (bloqueado)
// ============================================
router.delete("/delete/:chip_animal", verificarToken, bloquearViewer, async (req, res) => {
  const { chip_animal } = req.params;
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  console.log("🗑️ Intentando eliminar chip:", chip_animal, "- Usuario:", req.usuario.correo);

  try {
    // Buscar el animal
    const [animal] = await db.query(
      `SELECT * FROM registro_animal WHERE chip_animal = ?`,
      [chip_animal]
    );

    if (animal.length === 0) {
      return res.status(404).json({ error: "Animal no encontrado" });
    }

    // ⭐ Verificar permisos: Admin puede todo, User solo lo suyo
    if (rolUsuario !== 'admin' && animal[0].id_usuario !== idUsuario) {
      console.log("❌ Permiso denegado - Propietario:", animal[0].id_usuario, "- Solicitante:", idUsuario);
      return res.status(403).json({ 
        error: "No tienes permiso para eliminar este animal",
        detalle: "Solo puedes eliminar tus propios animales"
      });
    }

    // Eliminar animal
    await db.query(
      `DELETE FROM registro_animal WHERE chip_animal = ?`,
      [chip_animal]
    );

    console.log("✅ Animal eliminado exitosamente");

    res.status(200).json({ 
      message: "Animal eliminado con éxito",
      chip: chip_animal
    });
  } catch (err) {
    console.error("❌ Error al eliminar:", err);
    res.status(500).json({ error: "Error al eliminar el animal" });
  }
});

// ============================================
// GET /register/all - Listar todos los animales
// Admin ve TODOS los animales
// User y Viewer solo ven SUS animales
// ============================================
router.get("/all", verificarToken, cualquierUsuario, async (req, res) => {
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  console.log("📋 Listando animales - Usuario:", req.usuario.correo, "- Rol:", rolUsuario);

  try {
    let query;
    let params = [];

    if (rolUsuario === 'admin') {
      // ⭐ Admin ve TODOS los animales
      query = `SELECT * FROM vista_registro_animal ORDER BY id DESC`;
      console.log("🔓 Admin - Mostrando todos los animales");
    } else {
      // ⭐ User y Viewer solo ven SUS animales
      query = `SELECT * FROM vista_registro_animal WHERE id_usuario = ? ORDER BY id DESC`;
      params = [idUsuario];
      console.log("🔒 User/Viewer - Filtrando por usuario ID:", idUsuario);
    }

    const [results] = await db.query(query, params);

    console.log(`✅ ${results.length} animales encontrados`);

    res.status(200).json({
      total: results.length,
      animales: results
    });
  } catch (err) {
    console.error("❌ Error al listar:", err);
    res.status(500).json({ error: "Error al obtener los animales" });
  }
});

// ============================================
// GET /register/animal/:chip_animal - Obtener un animal específico
// Admin puede ver cualquier animal
// User y Viewer solo pueden ver SUS animales
// ============================================
router.get("/animal/:chip_animal", verificarToken, cualquierUsuario, async (req, res) => {
  const { chip_animal } = req.params;
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  console.log("🔍 Buscando animal:", chip_animal, "- Usuario:", req.usuario.correo);

  try {
    let query;
    let params;

    if (rolUsuario === 'admin') {
      // ⭐ Admin puede ver cualquier animal
      query = `SELECT * FROM vista_registro_animal WHERE chip_animal = ?`;
      params = [chip_animal];
    } else {
      // ⭐ User/Viewer solo pueden ver sus propios animales
      query = `SELECT * FROM vista_registro_animal WHERE chip_animal = ? AND id_usuario = ?`;
      params = [chip_animal, idUsuario];
    }

    const [results] = await db.query(query, params);

    if (results.length === 0) {
      return res.status(404).json({ 
        error: "Animal no encontrado o no tienes permiso para verlo" 
      });
    }

    console.log("✅ Animal encontrado");
    res.status(200).json(results[0]);
  } catch (err) {
    console.error("❌ Error al buscar animal:", err);
    res.status(500).json({ error: "Error al obtener el animal" });
  }
});

// ============================================
// PUT /register/update/:chip_animal - Actualizar animal
// Admin puede actualizar cualquier animal
// User solo puede actualizar SUS animales
// ⭐ Viewer NO puede actualizar (bloqueado)
// ============================================
router.put("/update/:chip_animal", verificarToken, bloquearViewer, upload.single("foto"), async (req, res) => {
  const chip_animal_original = req.params.chip_animal;
  const rolUsuario = req.usuario.rol;
  const idUsuario = req.usuario.id;

  console.log("📝 Actualizando animal:", chip_animal_original, "- Usuario:", req.usuario.correo);

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
    // Buscar el animal
    const [existingRecord] = await db.query(
      `SELECT * FROM registro_animal WHERE chip_animal = ?`,
      [chip_animal_original]
    );

    if (existingRecord.length === 0) {
      return res.status(404).json({ error: "Animal no encontrado" });
    }

    // ⭐ Verificar permisos: Admin puede todo, User solo lo suyo
    if (rolUsuario !== 'admin' && existingRecord[0].id_usuario !== idUsuario) {
      console.log("❌ Permiso denegado - Propietario:", existingRecord[0].id_usuario, "- Solicitante:", idUsuario);
      return res.status(403).json({ 
        error: "No tienes permiso para modificar este animal",
        detalle: "Solo puedes modificar tus propios animales"
      });
    }

    const fechaFormateada = fecha_nacimiento ? fecha_nacimiento.split("T")[0] : null;

    // Validar raza
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

    // Construir UPDATE dinámicamente
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

    setClauses.push("updated_at = NOW()");

    const queryUpdate = `
      UPDATE registro_animal 
      SET ${setClauses.join(", ")} 
      WHERE chip_animal = ?`;

    values.push(chip_animal_original);

    const [result] = await db.query(queryUpdate, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Animal no encontrado" });
    }

    // Actualizar peso inicial
    try {
      const [updatePesoResult] = await db.query(
        `UPDATE historico_pesaje SET 
          fecha_pesaje = ?,
          peso_kg = ?,
          chip_animal = ?,
          updated_at = NOW()
        WHERE chip_animal = ? 
        AND tipo_seguimiento = 'nacimiento'`,
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
            tipo_seguimiento,
            created_at
          ) VALUES (?, ?, ?, ?, 'nacimiento', NOW())`,
          [registro_id, chip_animal, fechaFormateada, peso_nacimiento]
        );
        
        console.log("✅ Peso inicial creado");
      }
    } catch (pesoError) {
      console.error("⚠️ Error al actualizar peso inicial:", pesoError);
    }

    console.log("✅ Animal actualizado exitosamente");

    res.status(200).json({
      message: "Animal actualizado con éxito",
      changes: result.changedRows,
      chip: chip_animal
    });
  } catch (err) {
    console.error("❌ Error al actualizar:", err);
    res.status(500).json({
      error: "Error al actualizar el animal",
      details: err.message
    });
  }
});

// ============================================
// GET /register/razas - Obtener catálogo de razas
// ⭐ Ruta pública (no requiere autenticación)
// ============================================
router.get("/razas", async (req, res) => {
  const query = `SELECT * FROM raza ORDER BY nombre_raza`;

  try {
    const [results] = await db.query(query);
    res.status(200).json(results);
  } catch (err) {
    console.error("❌ Error al obtener razas:", err);
    res.status(500).json({ error: "Error al obtener las razas" });
  }
});

module.exports = router;