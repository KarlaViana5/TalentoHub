const express = require('express');
const router = express.Router();
const { registrarValidacionParametros } = require('../middleware/input.middleware');
registrarValidacionParametros(router);

const empresarialController = require('../controllers/empresarial.controller');
const servicio = require('../services/empresarial.service');
const { exigirRol } = require('../middleware/auth.middleware');

// Separación de módulos por Rol: solo Empresa
router.use(exigirRol('empresa'));

// Cargar contexto de la empresa autenticada en sesión
router.use(async (req, res, next) => {
    try {
        await servicio.conContextoEmpresa(req.usuario, async () => {
            res.locals.empresaActual = await servicio.obtenerEmpresa(req.usuario.empresaId);
            if (!res.locals.empresaActual) return res.status(403).send('No existe una empresa vinculada a tu cuenta.');
            next();
        });
    } catch (error) { next(error); }
});

router.get('/', empresarialController.mostrarInicio);

// perfil empresa (crear/activar = admin)
router.get('/perfil', empresarialController.mostrarPerfilEmpresa);
router.post('/perfil', empresarialController.actualizarPerfilEmpresa);
router.get('/empresas', (req, res) => res.redirect(301, '/empresarial/perfil'));

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

// perfil candidato
router.get('/candidatos/:id', empresarialController.mostrarPerfil);
router.get('/candidatos/:id/cv', empresarialController.verCv);
router.get('/candidatos/:id/cv/descargar', empresarialController.descargarCv);
router.post('/candidatos/:id/estado', empresarialController.cambiarEstadoPerfil);
router.post('/candidatos/:id/notas', empresarialController.agregarNota);

module.exports = router;
