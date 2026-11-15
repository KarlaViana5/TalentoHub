const express = require('express');
const router = express.Router();

const empresarialController = require('../controllers/empresarial.controller');

router.get('/', empresarialController.mostrarInicio);

// empresas
router.get('/empresas', empresarialController.mostrarEmpresas);
router.post('/empresas', empresarialController.crearEmpresa);
router.post('/empresas/:id', empresarialController.actualizarEmpresa);
router.post('/empresas/:id/estado', empresarialController.cambiarEstadoEmpresa);

// vacantes
router.get('/vacantes', empresarialController.mostrarVacantes);
router.get('/publicar', empresarialController.mostrarPublicar);
router.post('/publicar', empresarialController.publicarVacante);
router.post('/vacantes/:id', empresarialController.actualizarVacante);
router.post('/vacantes/:id/estado', empresarialController.cambiarEstadoVacante);
router.post('/vacantes/:id/eliminar', empresarialController.eliminarVacante);

// postulaciones
router.get('/postulaciones', empresarialController.mostrarPostulaciones);
router.get('/postulaciones/exportar', empresarialController.exportarPostulaciones);
router.post('/postulaciones/estado', empresarialController.cambiarEstadoMasivo);
router.post('/postulaciones/:id/estado', empresarialController.cambiarEstadoPostulacion);

module.exports = router;
