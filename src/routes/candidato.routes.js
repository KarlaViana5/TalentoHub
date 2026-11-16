const express = require('express');
const router = express.Router();

const candidatoController = require('../controllers/candidato.controller');
const { exigirRol } = require('../middleware/auth.middleware');

// Separación de módulos por Rol: solo Aplicante (candidato)
router.use(exigirRol('candidato'));

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

// Inscripción a Cursos (LMS conectado con Administración)
router.post('/cursos/:idCurso/inscribir', candidatoController.inscribirCurso);

module.exports = router;
