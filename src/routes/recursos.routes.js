const express = require('express');
const router = express.Router();

const recursosController = require('../controllers/recursos.controller');

router.get('/', recursosController.mostrarInicio);

module.exports = router;