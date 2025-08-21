const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { verificarToken } = require("../routes/auth"); // Ajusta la ruta si está en otro lugar

const uploadDirectory = "uploads";
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // asegura que la carpeta exista
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });



router.post("/add", verificarToken, upload.single("foto"), async (req, res) => {
  
  const id_usuario = req.usuario?.id; // Verificar que el ID del usuario esté presente

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
     procedencia,  // Asegúrate de que 'procedencia' esté aquí
  hierro,       // Asegúrate de que 'hierro' esté aquí
  categoria,    // Asegúrate de que 'categoria' esté aquí
  ubicacion   
  } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "No se subió una foto" });
  }

  console.log("Archivo recibido:", req.file);

  const fotoPrincipal = req.file.filename;

  // Verificar que los campos obligatorios estén presentes
  if (!chip_animal || !peso_nacimiento || !raza_id_raza || !fecha_nacimiento) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  // Convertir id_madre y id_padre a null si no están presentes
  id_madre = id_madre || null;
  id_padre = id_padre || null;
  enfermedades = enfermedades || null;
  observaciones = observaciones || null;
procedencia = procedencia || null;  // Asignar null si no se proporciona valor
hierro = hierro || null;
categoria = categoria || null;
ubicacion = ubicacion || null;

  try {

const [existingChip] = await db.query(
      `SELECT * FROM registro_animal WHERE chip_animal = ?`,
      [chip_animal]
    );

    if (existingChip.length > 0) {
      return res.status(400).json({ error: "El chip ya está registrado" });
    }

    const [razaResult] = await db.query(
      `SELECT id_raza FROM raza WHERE id_raza = ?`,
      [raza_id_raza]
    );

    if (razaResult.length === 0) {
      console.warn('Raza no encontrada, asignando "Otra Raza" (id 25)');
      raza_id_raza = 25;
    }

const queryInsert = `
  INSERT INTO registro_animal 
  (foto, chip_animal, peso_nacimiento, raza_id_raza, fecha_nacimiento, id_madre, id_padre, enfermedades, observaciones, id_usuario, procedencia, hierro, categoria, ubicacion,numero_parto, precocidad, tipo_monta, created_at) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

    const values = [
      fotoPrincipal,
      chip_animal,
      peso_nacimiento,
      raza_id_raza,
      fecha_nacimiento,
      id_madre,
      id_padre,
      enfermedades,
      observaciones,
      id_usuario,
       procedencia, 
  hierro,      
  categoria,  
  ubicacion, 
numero_parto,     
  precocidad,  
  tipoMonta, 
    ];

    const [result] = await db.query(queryInsert, values);
    res
      .status(201)
      .json({ message: "Registro agregado con éxito", id: result.insertId });
  } catch (error) {
    console.error("Error en la base de datos:", error);
    res.status(500).json({ error: "Error al registrar el animal" });
  }
});

router.delete("/delete/:chip_animal", async (req, res) => {
  const { chip_animal } = req.params;
  const query = `DELETE FROM registro_animal WHERE chip_animal = ?`;

  try {
    const [result] = await db.query(query, [chip_animal]);
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Registro no encontrado" });

    res.status(200).json({ message: "Registro eliminado con éxito" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar el registro" });
  }
});

router.get("/all", async (req, res) => {
  const query = `SELECT * FROM vista_registro_animal`;

  try {
    const [results] = await db.query(query);
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener los registros" });
  }
});

router.get("/animal/:chip_animal", async (req, res) => {
  const { chip_animal } = req.params;
  const query = `SELECT * FROM vista_registro_animal WHERE chip_animal = ?`;

  try {
    const [results] = await db.query(query, [chip_animal]);
    if (results.length === 0)
      return res.status(404).json({ error: "Registro no encontrado" });

    res.status(200).json(results[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el registro" });
  }
});

router.put(
  "/update/:chip_animal",
  verificarToken,
  upload.single("foto"),
  async (req, res) => {
    const chip_animal_original = req.params.chip_animal;

    // Extraer datos del body (para FormData) o de req.body (para JSON)
    const {
      chip_animal = req.body.chip_animal,
      peso_nacimiento = req.body.peso_nacimiento,
      raza_id_raza = req.body.raza_id_raza,
      fecha_nacimiento = req.body.fecha_nacimiento,
      id_madre = req.body.id_madre,
      id_padre = req.body.id_padre,
      enfermedades = req.body.enfermedades,
      observaciones = req.body.observaciones,
    } = req.body;

    try {
      // Validar y formatear la fecha
      const fechaFormateada = fecha_nacimiento
        ? fecha_nacimiento.split("T")[0]
        : null;

      // Verificar si la raza existe
      const [razaResult] = await db.query(
        `SELECT id_raza FROM raza WHERE id_raza = ?`,
        [raza_id_raza]
      );

      if (razaResult.length === 0) {
        console.warn('Raza no encontrada, asignando "Otra Raza" (id 25)');
        raza_id_raza = 25;
      }

      // Preparar la consulta SQL dinámicamente
      let setClauses = [];
      let values = [];

      // Campos obligatorios
      setClauses.push("chip_animal = ?");
      values.push(chip_animal);

      setClauses.push("peso_nacimiento = ?");
      values.push(peso_nacimiento);

      setClauses.push("raza_id_raza = ?");
      values.push(raza_id_raza);

      setClauses.push("fecha_nacimiento = ?");
      values.push(fechaFormateada);

      // Campos opcionales
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

      // Manejar enfermedades (puede ser string o array)
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

      // Manejar la foto si se subió una nueva
      if (req.file) {
        setClauses.push("foto = ?");
        values.push(req.file.filename);
      }

      // Construir la consulta final
      const queryUpdate = `
      UPDATE registro_animal 
      SET ${setClauses.join(", ")} 
      WHERE chip_animal = ?`;

      values.push(chip_animal_original);

      console.log("Consulta SQL:", queryUpdate);
      console.log("Valores:", values);

      const [result] = await db.query(queryUpdate, values);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Registro no encontrado" });
      }

      res.status(200).json({
        message: "Registro actualizado con éxito",
        changes: result.changedRows,
      });
    } catch (err) {
      console.error("Error en la base de datos:", err);
      res.status(500).json({
        error: "Error al actualizar el registro",
        details: err.message,
        sql: err.sql,
      });
    }
  }
);

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
