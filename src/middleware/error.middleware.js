const { randomUUID } = require('node:crypto');
const { HttpError, statusOf, messageOf } = require('../utils/http-error');
const { registrarError } = require('../utils/logger');
function identificarPeticion(req, res, next) {
    req.requestId = randomUUID();
    res.set('X-Request-Id', req.requestId);
    next();
}
function noEncontrado(req, res, next) { next(new HttpError(404)); }
function manejarError(error, req, res, next) {
    const status = statusOf(error);
    if (status >= 500) registrarError(error, { scope: 'http', req, status });
    if (res.headersSent) return next(error);
    const mensaje = messageOf(error, status);
    res.set('Cache-Control', 'no-store');
    res.status(status);
    if ((req.get('accept') || '').includes('application/json')) {
        return res.json({ error: { status, mensaje, requestId: req.requestId } });
    }
    const vista = status === 404 ? 'errors/404' : 'errors/http';
    return res.render(vista, { titulo: mensaje, status, mensaje, ruta: req.path, requestId: req.requestId }, (renderError, html) => {
        if (renderError) {
            registrarError(renderError, { scope: 'error-view', req, status });
            return res.type('text/plain').send(mensaje);
        }
        res.send(html);
    });
}
module.exports = { identificarPeticion, noEncontrado, manejarError };
