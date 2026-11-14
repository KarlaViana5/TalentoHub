
const express = require('express');
const router = express.Router();

// Importar las rutas de cada módulo
const generalRoutes = require('./general.routes');
const busquedaRoutes = require('./busqueda.routes');
const candidatoRoutes = require('./candidato.routes');
const empresarialRoutes = require('./empresarial.routes');
const recursosRoutes = require('./recursos.routes');
const forosRoutes = require('./foros.routes');
const administrativoRoutes = require('./administrativo.routes');

// Registrar las rutas de los módulos
router.use('/', generalRoutes);
router.use('/busqueda', busquedaRoutes);
router.use('/candidato', candidatoRoutes);
router.use('/empresarial', empresarialRoutes);
router.use('/recursos', recursosRoutes);
router.use('/foros', forosRoutes);
router.use('/administrativo', administrativoRoutes);

module.exports = router;
