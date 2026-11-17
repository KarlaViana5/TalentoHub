const express = require('express');
const router = express.Router();
const { registrarValidacionParametros } = require('../middleware/input.middleware');
registrarValidacionParametros(router);
const { limitarLogin } = require('../middleware/login-limit.middleware');
const authController = require('../controllers/auth.controller');

router.get('/login', authController.mostrarLogin);
router.post('/login', limitarLogin, authController.procesarLogin);

router.get('/registro', authController.mostrarRegistro);
router.post('/registro', authController.procesarRegistro);

router.get('/logout', (req, res) => res.render('auth/logout', { titulo: 'Cerrar sesion' }));
router.post('/logout', authController.cerrarSesion);

module.exports = router;
