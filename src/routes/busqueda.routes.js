
const express = require('express');
const router = express.Router();

const busquedaController = require('../controllers/busqueda.controller');

router.get('/', busquedaController.mostrarResultados);

router.get('/empleo/:id', busquedaController.mostrarDetalle);

module.exports = router;
