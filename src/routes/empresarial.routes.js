const express = require('express');
const router = express.Router();

const empresarialController = require('../controllers/empresarial.controller');

router.get('/', empresarialController.mostrarInicio);

// empresas
router.get('/empresas', empresarialController.mostrarEmpresas);
router.post('/empresas', empresarialController.crearEmpresa);
router.post('/empresas/:id', empresarialController.actualizarEmpresa);
router.post('/empresas/:id/estado', empresarialController.cambiarEstadoEmpresa);

module.exports = router;
