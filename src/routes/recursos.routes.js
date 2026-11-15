
// src/routes/recursos.routes.js

const express = require('express');
const router = express.Router();

const recursosController = require('../controllers/recursos.controller');

// REC-01: Listado de recursos.
router.get('/', recursosController.mostrarInicio);

// REC-02: Detalle de un recurso.
router.get('/:id', recursosController.mostrarDetalle);

module.exports = router;
