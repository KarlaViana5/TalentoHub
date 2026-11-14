const express = require('express');
const router = express.Router();

const empresarialController = require('../controllers/empresarial.controller');

router.get('/', empresarialController.mostrarInicio);

module.exports = router;