const router = require('express').Router();
const foros = require('../controllers/foros.controller');
const auth = require('../middleware/modulo4-auth');

router.use(auth.cargarSesion);
router.get('/', foros.mostrarInicio);
router.get('/ingresar', foros.mostrarIngreso);
router.post('/ingresar', auth.verificarOrigen, auth.iniciarSesion);
router.post('/salir', auth.exigirSesion, auth.verificarFormulario, auth.cerrarSesion);
router.get('/hilos/:id', foros.mostrarHilo);
router.post('/hilos/:id/comentarios', auth.exigirSesion, auth.verificarFormulario, foros.crearComentario);
router.post('/hilos/:id/reportar', auth.exigirSesion, auth.verificarFormulario, foros.denunciar);
router.get('/:slug', foros.mostrarForo);
router.post('/:slug/hilos', auth.exigirSesion, auth.verificarFormulario, foros.crearHilo);
router.use(foros.mostrarError);

module.exports = router;
