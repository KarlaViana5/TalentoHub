const foros = require('../services/foros.service');
const { identificador } = require('../services/modulo4-db.service');

async function mostrar(req, res, titulo, pagina, datos = {}) {
    const contexto = await foros.contextoPublico(res.locals.usuario?.rol);
    res.render('foros/index', { titulo, pagina, ...contexto, ...datos });
}

async function mostrarInicio(req, res) {
    await mostrar(req, res, 'Foros', 'lista', { foros: await foros.listarForos() });
}

async function mostrarForo(req, res) {
    const resultado = await foros.obtenerForo(req.params.slug);
    await mostrar(req, res, resultado.foro.nombre, 'foro', resultado);
}

async function mostrarHilo(req, res) {
    const resultado = await foros.obtenerHilo(identificador(req.params.id));
    await mostrar(req, res, resultado.hilo.titulo, 'hilo', { ...resultado, reportado: req.query.reportado === '1' });
}

async function crearHilo(req, res) {
    const hilo = await foros.crearHilo(req.params.slug, res.locals.usuario.id, req.body || {});
    res.redirect(303, `/foros/hilos/${hilo.id}`);
}

async function crearComentario(req, res) {
    const id = identificador(req.params.id);
    await foros.crearComentario(id, res.locals.usuario.id, req.body || {});
    res.redirect(303, `/foros/hilos/${id}#comentarios`);
}

async function denunciar(req, res) {
    const id = identificador(req.params.id);
    await foros.denunciar(id, res.locals.usuario.id, req.body || {});
    res.redirect(303, `/foros/hilos/${id}?reportado=1`);
}

function mostrarIngreso(req, res) {
    res.render('foros/ingresar', { titulo: 'Ingresar a TalentoHub' });
}

function mostrarError(error, req, res, next) {
    if (res.headersSent) return next(error);
    const estado = Number.isInteger(error.status) ? error.status : 500;
    if (estado >= 500) console.error('Error en Foros y Administración:', error);
    res.status(estado).render('foros/error', {
        titulo: `Error ${estado}`,
        mensaje: estado >= 500 ? 'Ocurrió un error al procesar tu solicitud.' : error.message
    });
}

module.exports = {
    mostrarInicio, mostrarForo, mostrarHilo, crearHilo, crearComentario, denunciar, mostrarIngreso, mostrarError
};
