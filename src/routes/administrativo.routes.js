const express = require('express');
const router = express.Router();

const administrativoController = require('../controllers/administrativo.controller');

router.get('/', administrativoController.mostrarInicio);

module.exports = router;