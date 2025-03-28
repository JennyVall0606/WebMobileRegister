const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Ruta de prueba vaccines funcionando' });
});

module.exports = router;