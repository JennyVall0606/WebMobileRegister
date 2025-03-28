const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost', // Cambia esto si tu DB está en otro host
    user: 'root',       // Usuario de MySQL
    password: '360complemento',       // Contraseña de MySQL
    database: 'registro_ganadero' // Cambia esto por tu base de datos
});

db.connect((err) => {
    if (err) {
        console.error('❌ Error al conectar con MySQL:', err);
        return;
    }
    console.log('✅ Conectado a la base de datos MySQL');
});

module.exports = db; // ✅ Exportamos db

