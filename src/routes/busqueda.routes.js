const express = require('express');
const router = express.Router();
const { registrarValidacionParametros } = require('../middleware/input.middleware');
registrarValidacionParametros(router);

const busquedaController = require('../controllers/busqueda.controller');

router.get('/', busquedaController.mostrarResultados);
router.get('/empleo/:id', busquedaController.mostrarDetalle);
router.post('/empleo/:id/vista', busquedaController.registrarVistaVacante);
router.post('/empleo/:id/postular', busquedaController.postularVacante);
router.post('/empleo/:id/reportar', busquedaController.reportarVacante);

module.exports = router;
