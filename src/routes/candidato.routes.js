const express = require('express');
const router = express.Router();

const candidatoController = require('../controllers/candidato.controller');

// Consulta principal del módulo
router.get('/', candidatoController.mostrarInicio);

// Perfil del candidato
router.post('/perfil/:id', candidatoController.actualizarPerfil);

// Historial de postulaciones
router.post('/postulaciones/:idPostulacion/cancelar', candidatoController.cancelarPostulacion);

// Alertas de empleo
router.post('/alertas', candidatoController.crearAlerta);
router.post('/alertas/:idAlerta/estado', candidatoController.alternarAlerta);
router.post('/alertas/:idAlerta/eliminar', candidatoController.eliminarAlerta);

// Valoraciones
router.post('/valoraciones', candidatoController.crearValoracion);
router.post('/valoraciones/:idValoracion/actualizar', candidatoController.actualizarValoracion);

module.exports = router;