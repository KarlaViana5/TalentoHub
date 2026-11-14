const express = require('express');
const router = express.Router();

const forosController = require('../controllers/foros.controller');

router.get('/', forosController.mostrarInicio);

module.exports = router;