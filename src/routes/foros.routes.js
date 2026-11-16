const express = require('express');
const router = express.Router();

const forosController = require('../controllers/foros.controller');

// Middleware para resolver el actor actual (Visitante, Candidato, Empresa o Admin) en todas las vistas de foros
router.use(forosController.cargarContextoActor);

// Pantalla 1: Listado público de foros (RF-01)
router.get('/', forosController.mostrarInicio);

// Pantalla 5 y 6: Solicitar nuevo foro y consultar mis solicitudes (RN-FOR-02 a RN-FOR-08)
router.get('/solicitar', forosController.mostrarSolicitarForo);
router.post('/solicitudes', forosController.crearSolicitudForo);
router.get('/mis-solicitudes', forosController.mostrarMisSolicitudes);

// Denunciar hilo o comentario (RN-FOR-12)
router.post('/reportes', forosController.reportarContenido);

// Pantalla 2: Listado de hilos de un foro
router.get('/:foro', forosController.mostrarForo);

// Pantalla 4: Crear nuevo hilo en un foro
router.get('/:foro/nuevo', forosController.mostrarCrearHilo);
router.post('/:foro/hilos', forosController.crearHilo);

// Pantalla 3: Detalle de un hilo y participación mediante comentarios
router.get('/:foro/hilos/:hilo', forosController.mostrarHilo);
router.post('/:foro/hilos/:hilo/editar', forosController.editarHilo);
router.post('/:foro/hilos/:hilo/eliminar', forosController.eliminarHilo);
router.post('/:foro/hilos/:hilo/comentarios', forosController.crearComentario);
router.post('/:foro/hilos/:hilo/comentarios/:comentario/eliminar', forosController.eliminarComentario);

module.exports = router;
