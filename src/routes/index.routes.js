const express = require('express');
const router = express.Router();

// Importar las rutas de cada módulo
const authRoutes = require('./auth.routes');
const generalRoutes = require('./general.routes');
const busquedaRoutes = require('./busqueda.routes');
const candidatoRoutes = require('./candidato.routes');
const empresarialRoutes = require('./empresarial.routes');
const recursosRoutes = require('./recursos.routes');
const forosRoutes = require('./foros.routes');
const administrativoRoutes = require('./administrativo.routes');

// Rutas de autenticación (/auth/login, /auth/registro, /auth/logout y atajos directos)
router.use('/auth', authRoutes);
router.get('/login', (req, res) => res.redirect('/auth/login'));
router.get('/registro', (req, res) => res.redirect('/auth/registro'));
router.get('/logout', (req, res) => res.redirect('/auth/logout'));

// Registrar las rutas de los módulos
router.use('/', generalRoutes);
router.use('/busqueda', busquedaRoutes);
router.use('/candidato', candidatoRoutes);
router.use('/empresarial', empresarialRoutes);
router.use('/recursos', recursosRoutes);
router.use('/foros', forosRoutes);
router.use('/administrativo', administrativoRoutes);

module.exports = router;
