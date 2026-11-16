const express = require('express');
const router = express.Router();

const empresarialController = require('../controllers/empresarial.controller');
const servicio = require('../services/empresarial.service');
const { exigirRol } = require('../middleware/auth.middleware');

// Separación de módulos por Rol: solo Empresa
router.use(exigirRol('empresa'));

// Cargar contexto de la empresa autenticada en sesión
router.use(async (req, res, next) => {
    try {
        if (req.usuario && req.usuario.rol === 'empresa' && req.usuario.empresaId) {
            servicio.empleadorActual.empresaId = Number(req.usuario.empresaId);
            servicio.empleadorActual.nombre = req.usuario.nombre || req.usuario.nombreMostrar;
        }
        res.locals.empresaActual = await servicio.obtenerEmpresa(servicio.empleadorActual.empresaId);
        next();
    } catch (error) {
        next(error);
    }
});

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

// perfil candidato
router.get('/candidatos/:id', empresarialController.mostrarPerfil);
router.get('/candidatos/:id/cv', empresarialController.verCv);
router.get('/candidatos/:id/cv/descargar', empresarialController.descargarCv);
router.post('/candidatos/:id/estado', empresarialController.cambiarEstadoPerfil);
router.post('/candidatos/:id/notas', empresarialController.agregarNota);

module.exports = router;
