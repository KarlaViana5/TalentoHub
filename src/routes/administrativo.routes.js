const router = require('express').Router();
const admin = require('../controllers/administrativo.controller');
const { mostrarError } = require('../controllers/foros.controller');
const { cargarSesion, exigirSesion, exigirAdmin, verificarFormulario } = require('../middleware/modulo4-auth');

router.use(cargarSesion, exigirSesion, exigirAdmin, verificarFormulario);
router.get(['/', '/estadisticas'], admin.mostrarInicio);
router.get('/estadisticas/exportar.csv', admin.exportar);
router.get('/configuracion', admin.mostrarConfiguracion);
router.post('/configuracion', admin.configurar);
router.post('/avisos', admin.publicarAviso);
router.post('/foros', admin.guardarForo);
router.post('/foros/:id/editar', admin.guardarForo);
router.post('/usuarios/:id/editar', admin.editarUsuario);
router.post('/empresas/:id/editar', admin.editarEmpresa);
router.get('/:seccion', admin.listar);
router.post('/:seccion/:id/moderar', admin.moderar);
router.use(mostrarError);

module.exports = router;
