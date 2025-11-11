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
// ⭐ Animal se asigna a la FINCA del usuario autenticado
// ============================================
router.post("/add", verificarToken, bloquearViewer, upload.single("foto"), async (req, res) => {
  const id_usuario = req.usuario?.id;
  const rolUsuario = req.usuario?.rol;
  
  // ⭐ Admin puede especificar finca_id en el body, otros usan la suya
  let finca_id;
  
  if (rolUsuario === 'admin') {
    finca_id = req.body.finca_id || req.usuario?.finca_id;
    console.log('🔧 Admin - Finca body:', req.body.finca_id, '- Finca usuario:', req.usuario?.finca_id);
  } else {
    finca_id = req.usuario?.finca_id;
  }

  if (!id_usuario) {
    return res.status(400).json({ 
      error: "Usuario no autenticado"
    });
  }

  if (!finca_id) {
    return res.status(400).json({ 
      error: "Finca no especificada",
      detalle: rolUsuario === 'admin' 
        ? "Selecciona una finca en el formulario"
        : "Tu usuario debe tener una finca asignada"
    });
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
  console.log("👤 Usuario creando:", req.usuario.correo, "- Rol:", req.usuario.rol, "- Finca:", finca_id);

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

    // Verificar chip duplicado EN LA MISMA FINCA
    const [existingChip] = await connection.query(
      `SELECT * FROM registro_animal WHERE chip_animal = ? AND finca_id = ?`,
      [chip_animal, finca_id]
    );

    if (existingChip.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: "El chip ya está registrado en esta finca" });
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

    // ⭐ Insertar animal con finca_id (sin id_usuario)
    const queryInsert = `
      INSERT INTO registro_animal 
      (foto, chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones, finca_id, procedencia, hierro, categoria, ubicacion, numero_parto, precocidad, tipo_monta, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

    const values = [
      fotoPrincipal, chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento,
      id_madre, id_padre, enfermedades, observaciones, finca_id, procedencia,
      hierro, categoria, ubicacion, numero_parto, precocidad, tipo_monta,
    ];

    console.log("📤 Insertando animal para finca ID:", finca_id);
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
      finca_id: finca_id,
      registrado_por: req.usuario.correo
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
// Admin puede eliminar cualquiera DE SU FINCA
// User solo puede eliminar los de SU FINCA
// ⭐ Viewer NO puede eliminar (bloqueado)
// ============================================
router.delete("/delete/:chip_animal", verificarToken, bloquearViewer, async (req, res) => {
  const { chip_animal } = req.params;
  const rolUsuario = req.usuario.rol;
  const finca_id = req.usuario.finca_id;

  console.log("🗑️ Intentando eliminar chip:", chip_animal, "- Usuario:", req.usuario.correo, "- Finca:", finca_id);

  try {
    // Buscar el animal EN LA FINCA del usuario
    const [animal] = await db.query(
      `SELECT * FROM registro_animal WHERE chip_animal = ? AND finca_id = ?`,
      [chip_animal, finca_id]
    );

    if (animal.length === 0) {
      return res.status(404).json({ 
        error: "Animal no encontrado en tu finca" 
      });
    }

    // Eliminar animal
    await db.query(
      `DELETE FROM registro_animal WHERE chip_animal = ? AND finca_id = ?`,
      [chip_animal, finca_id]
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
// ⭐ Todos los roles ven SOLO los animales de SU FINCA
// ============================================
router.get("/all", verificarToken, cualquierUsuario, async (req, res) => {
  const rolUsuario = req.usuario.rol;
  const finca_id = req.usuario.finca_id;

  console.log("📋 Listando animales - Usuario:", req.usuario.correo, "- Rol:", rolUsuario, "- Finca:", finca_id);

  if (!finca_id) {
    return res.status(400).json({ 
      error: "Usuario sin finca asignada",
      detalle: "Contacta al administrador para que te asigne una finca"
    });
  }

  try {
    // ⭐ TODOS ven solo los animales de SU finca
    const query = `
      SELECT 
        ra.*,
        r.nombre_raza,
        f.nombre as finca_nombre
      FROM registro_animal ra
      LEFT JOIN raza r ON ra.raza_id_raza = r.id_raza
      LEFT JOIN fincas f ON ra.finca_id = f.id
      WHERE ra.finca_id = ?
      ORDER BY ra.id DESC
    `;
    
    const [results] = await db.query(query, [finca_id]);

    console.log(`✅ ${results.length} animales encontrados en finca ${finca_id}`);

    res.status(200).json({
      total: results.length,
      finca_id: finca_id,
      animales: results
    });
  } catch (err) {
    console.error("❌ Error al listar:", err);
    res.status(500).json({ error: "Error al obtener los animales" });
  }
});

// ============================================
// GET /register/animal/:chip_animal - Obtener un animal específico
// ⭐ Solo se puede ver si pertenece a la finca del usuario
// ============================================
router.get("/animal/:chip_animal", verificarToken, cualquierUsuario, async (req, res) => {
  const { chip_animal } = req.params;
  const finca_id = req.usuario.finca_id;
  const rolUsuario = req.usuario.rol;

  console.log("🔍 Buscando animal:", chip_animal, "- Rol:", rolUsuario, "- Finca:", finca_id);

  // ⭐ ADMIN puede ver cualquier animal (aunque no tenga finca_id)
  // User/Viewer necesitan tener finca asignada
  if (!finca_id && rolUsuario !== 'admin') {
    return res.status(400).json({ 
      error: "Usuario sin finca asignada" 
    });
  }

  try {
    // ⭐ Query base con JOIN
    let query = `
      SELECT 
        ra.*,
        r.nombre_raza as raza,
        f.nombre as finca_nombre
      FROM registro_animal ra
      LEFT JOIN raza r ON ra.raza_id_raza = r.id_raza
      LEFT JOIN fincas f ON ra.finca_id = f.id
      WHERE ra.chip_animal = ?
    `;
    
    let params = [chip_animal];

    // ⭐ Si NO es admin, filtrar por finca
    if (rolUsuario !== 'admin' && finca_id) {
      query += " AND ra.finca_id = ?";
      params.push(finca_id);
    }

    console.log("📊 Query:", query);
    console.log("📊 Params:", params);
    
    const [results] = await db.query(query, params);

    if (results.length === 0) {
      return res.status(404).json({ 
        error: "Animal no encontrado" 
      });
    }

    console.log("✅ Animal encontrado:", results[0].chip_animal, "- Raza:", results[0].raza);
    res.status(200).json(results[0]);
  } catch (err) {
    console.error("❌ Error al buscar animal:", err);
    res.status(500).json({ error: "Error al obtener el animal" });
  }
});


// ============================================
// PUT /register/update/:chip_animal - Actualizar animal
// Admin y User pueden actualizar animales de SU FINCA
// ⭐ Viewer NO puede actualizar (bloqueado)
// ============================================
router.put("/update/:chip_animal", verificarToken, bloquearViewer, upload.single("foto"), async (req, res) => {
  const chip_animal_original = req.params.chip_animal;
  const rolUsuario = req.usuario.rol;
  
  // ⭐ Admin puede especificar finca_id, otros usan la suya
  let finca_id;
  if (rolUsuario === 'admin') {
    finca_id = req.body.finca_id || req.usuario.finca_id;
    console.log('🔧 Admin actualizando - Finca body:', req.body.finca_id, '- Finca usuario:', req.usuario.finca_id);
  } else {
    finca_id = req.usuario.finca_id;
  }

  console.log("📝 Actualizando animal:", chip_animal_original, "- Finca:", finca_id, "- Rol:", rolUsuario);

  if (!finca_id) {
    return res.status(400).json({ 
      error: "Finca no especificada",
      detalle: rolUsuario === 'admin' 
        ? "Selecciona una finca en el formulario"
        : "Tu usuario debe tener una finca asignada"
    });
  }


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
    // Buscar el animal EN LA FINCA del usuario
    const [existingRecord] = await db.query(
      `SELECT * FROM registro_animal WHERE chip_animal = ? AND finca_id = ?`,
      [chip_animal_original, finca_id]
    );

    if (existingRecord.length === 0) {
      return res.status(404).json({ 
        error: "Animal no encontrado en tu finca" 
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
      WHERE chip_animal = ? AND finca_id = ?`;

    values.push(chip_animal_original);
    values.push(finca_id); // ⭐ Agregar finca_id al WHERE

    const [result] = await db.query(queryUpdate, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Animal no encontrado en tu finca" });
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
