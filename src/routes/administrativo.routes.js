const express = require('express');
const router = express.Router();
const { registrarValidacionParametros } = require('../middleware/input.middleware');
registrarValidacionParametros(router);

const adminController = require('../controllers/administrativo.controller');

// Middleware de protección de rol admin y carga de alertas pendientes (RN-02, RN-ADM-01, RN-ADM-04, RN-ADM-05)
router.use(adminController.verificarAccesoAdmin);

// 1. Dashboard y Estadísticas
router.get(['/', '/dashboard', '/estadisticas', '/statistics'], adminController.mostrarDashboard);
router.get('/estadisticas/exportar.csv', adminController.exportarEstadisticas);

// 2. Consulta de usuarios, cuentas e historial
router.get(['/usuarios', '/users'], adminController.mostrarUsuarios);
router.get(['/usuarios/:rol/:id', '/users/:rol/:id'], adminController.mostrarDetalleUsuario);

// 3. Administración y Aprobación de Empresas
router.get(['/empresas', '/companies'], adminController.mostrarEmpresas);
router.post('/empresas/:id/decision', adminController.decidirEmpresa);

// 4. Biblioteca Digital, Recursos y Artículos
router.get(['/recursos', '/resources', '/articulos', '/articles'], adminController.mostrarRecursos);
router.post(['/recursos', '/resources', '/articulos', '/articles'], adminController.guardarRecurso);
router.post('/recursos/:id/editar', adminController.actualizarRecurso);
router.post('/recursos/:id/estado', adminController.cambiarEstadoRecurso);
router.post('/recursos/:id/destacado', adminController.alternarDestacadoRecurso);
router.post('/recursos/categorias', adminController.crearCategoriaRecurso);

// 5. Cursos, Capacitaciones y Exámenes (LMS)
router.get(['/cursos', '/courses'], adminController.mostrarCursos);
router.post(['/cursos', '/courses'], adminController.crearCurso);
router.get(['/cursos/:id', '/courses/:id'], adminController.mostrarDetalleCurso);
router.post('/cursos/:id/estado', adminController.cambiarEstadoCurso);
router.post('/cursos/:id/modulos', adminController.agregarModulo);
router.post('/cursos/:id/modulos/:idModulo/lecciones', adminController.agregarLeccion);
router.post('/cursos/:id/inscribir', adminController.inscribirCandidato);
router.post('/cursos/:id/inscripciones/:idInscripcion/lecciones/:idLeccion', adminController.completarLeccion);

// 6. Exámenes y Evaluaciones
router.get(['/examenes', '/exams'], adminController.mostrarExamenes);
router.post(['/examenes', '/exams'], adminController.crearExamen);
router.get(['/examenes/:id', '/exams/:id'], adminController.mostrarDetalleExamen);
router.post('/examenes/:id/preguntas', adminController.agregarPreguntaExamen);
router.post('/examenes/:id/presentar', adminController.presentarIntentoExamen);

// 7. Administración de Foros, Solicitudes, Hilos y Comentarios
router.get(['/foros', '/forums', '/comunidad'], adminController.mostrarForosAdmin);
router.post(['/foros', '/forums'], adminController.guardarForoOficial);
router.post('/foros/:id/editar', adminController.actualizarForoOficial);
router.post('/foros/:id/estado', adminController.cambiarEstadoForo);
router.post('/foros/solicitudes/:id/revisar', adminController.revisarSolicitudForo);
router.post('/foros/hilos/:id/moderacion', adminController.moderarHilo);
router.post('/foros/comentarios/:id/moderacion', adminController.moderarComentario);

// 8. Moderación de Opiniones y Centro Centralizado de Denuncias/Reportes
router.get(['/moderacion', '/moderation', '/reportes', '/reports'], adminController.mostrarModeracion);
router.post('/moderacion/valoraciones/:id', adminController.moderarValoracion);
router.post('/moderacion/reportes/:id', adminController.resolverReporte);

// 9. Notificaciones y Configuración General
router.get(['/notificaciones', '/notifications'], adminController.mostrarNotificaciones);
router.post(['/notificaciones', '/notifications'], adminController.crearNotificacion);
router.get(['/configuracion', '/settings'], adminController.mostrarConfiguracion);
router.post(['/configuracion', '/settings'], adminController.guardarConfiguracion);

module.exports = router;
