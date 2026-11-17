const express = require('express');
const path = require('path');

const { cargarSesionGlobal } = require('./middleware/auth.middleware');
const { validarCuerpo } = require('./middleware/input.middleware');
const { csrfProtection } = require('./middleware/csrf.middleware');
const { identificarPeticion, noEncontrado, manejarError } = require('./middleware/error.middleware');
const indexRoutes = require('./routes/index.routes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(identificarPeticion);
app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 1000 }));
app.use(express.json({ limit: '100kb' }));

// Cargar la sesión activa del usuario y su rol en todas las rutas
app.use(csrfProtection);
app.use(validarCuerpo);
app.use(cargarSesionGlobal);

app.use('/', indexRoutes);

app.use(noEncontrado);
app.use(manejarError);

module.exports = app;
