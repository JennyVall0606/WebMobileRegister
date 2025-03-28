const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Ruta de prueba weighing funcionando' });
});

module.exports = router;