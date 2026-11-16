const admin = require('../services/administrativo.service');
const { errorHttp, identificador } = require('../services/modulo4-db.service');

function obtenerSeccion(nombre) {
    if (!Object.hasOwn(admin.secciones, nombre)) throw errorHttp(404, 'Sección no encontrada.');
    return admin.secciones[nombre];
}

function renderizar(res, pagina, titulo, datos = {}) {
    res.render('administrativo/index', { pagina, titulo, menu: admin.secciones, ...datos });
}

async function mostrarInicio(req, res) {
    renderizar(res, 'panel', 'Administración', await admin.estadisticas());
}

async function exportar(req, res) {
    const { indicadores, actividad } = await admin.estadisticas();
    const registros = Object.entries(indicadores).map(([clave, total]) => ['indicador', clave, total]);
    for (const fila of actividad) registros.push(['hilos_por_dia', fila.dia, fila.hilos]);
    res.attachment('estadisticas-talentohub.csv').type('text/csv; charset=utf-8')
        .send('\uFEFFtipo,indicador,total\r\n' + registros.map(fila => fila.join(',')).join('\r\n'));
}

async function listar(req, res) {
    const nombre = req.params.seccion;
    const seccion = obtenerSeccion(nombre);
    const filtro = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 150) : '';
    const anteriorA = req.query.antes ? identificador(req.query.antes) : null;
    const resultado = await admin.listar(seccion, filtro, anteriorA);
    const registros = resultado.slice(0, 50);
    const siguiente = resultado.length > 50 ? registros.at(-1).id : null;
    renderizar(res, 'lista', seccion.titulo, { nombre, seccion, filtro, registros, siguiente });
}

async function guardarForo(req, res) {
    const id = req.params.id ? identificador(req.params.id) : null;
    await admin.guardarForo(res.locals.usuario.id, req.body || {}, id);
    res.redirect(303, '/administrativo/foros');
}

async function moderar(req, res) {
    const nombre = req.params.seccion;
    obtenerSeccion(nombre);
    await admin.moderar(res.locals.usuario.id, nombre, identificador(req.params.id), req.body || {});
    res.redirect(303, `/administrativo/${nombre}`);
}

async function editarUsuario(req, res) {
    await admin.editarUsuario(res.locals.usuario.id, identificador(req.params.id), req.body || {});
    res.redirect(303, '/administrativo/usuarios');
}

async function editarEmpresa(req, res) {
    await admin.editarEmpresa(res.locals.usuario.id, identificador(req.params.id), req.body || {});
    res.redirect(303, '/administrativo/empresas');
}

async function mostrarConfiguracion(req, res) {
    renderizar(res, 'configuracion', 'Configuración', await admin.leerConfiguracion());
}

async function configurar(req, res) {
    await admin.configurar(res.locals.usuario.id, req.body || {});
    res.redirect(303, '/administrativo/configuracion');
}

async function publicarAviso(req, res) {
    await admin.publicarAviso(res.locals.usuario.id, req.body || {});
    res.redirect(303, '/administrativo/configuracion');
}

module.exports = { mostrarInicio, exportar, listar, guardarForo, moderar, editarUsuario, editarEmpresa, mostrarConfiguracion, configurar, publicarAviso };
