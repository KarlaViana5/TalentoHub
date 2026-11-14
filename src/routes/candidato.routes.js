const express = require('express');
const router = express.Router();

const candidatoController = require('../controllers/candidato.controller');

router.get('/', candidatoController.mostrarInicio);

module.exports = router;