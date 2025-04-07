const mysql = require('mysql2/promise'); // 👈 importante: con /promise

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '360complemento',
  database: 'registro_ganadero',
});


module.exports = db; // ✅ Exportamos db

