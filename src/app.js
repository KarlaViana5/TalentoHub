const express = require('express');
const path = require('path');

const indexRoutes = require('./routes/index.routes');

const app = express();

app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use('/', indexRoutes);

app.use((req, res) => {
    res.status(404).render('errors/404', {
        titulo: 'Página no encontrada',
        ruta: req.originalUrl
    });
});
module.exports = app;
