const servicio = require('../services/empresarial.service');

const mensajes = {
    creada: 'Empresa creada correctamente.',
    actualizada: 'Cambios guardados correctamente.',
    desactivada: 'Empresa desactivada.',
    activada: 'Empresa activada.'
};

function mostrarInicio(req, res) {
    res.render('empresarial/index', {
        titulo: 'Módulo empresarial',
        descripcion: 'Gestiona tu empresa, publica empleos y administra postulaciones.'
    });
}

// EMP-02
function renderEmpresas(req, res, panel, status = 200) {
    const filtros = {
        q: req.query.q || '',
        sector: req.query.sector || '',
        estado: req.query.estado || ''
    };

    res.status(status).render('empresarial/empresas', {
        titulo: 'Mis empresas',
        filtros,
        empresas: servicio.listarEmpresas(filtros),
        sectores: servicio.SECTORES,
        estados: servicio.ESTADOS_EMPRESA,
        panel,
        mensaje: mensajes[req.query.ok] || ''
    });
}

function datosFormulario(body, id) {
    return {
        id: id ? Number(id) : null,
        nombre: body.nombre || '',
        sector: body.sector || '',
        ubicacion: body.ubicacion || '',
        descripcion: body.descripcion || '',
        estado: body.activa ? 'Activa' : 'Inactiva'
    };
}

function noEncontrado(req, res) {
    res.status(404).render('errors/404', {
        titulo: 'Página no encontrada',
        ruta: req.originalUrl
    });
}

function mostrarEmpresas(req, res) {
    let panel = null;

    if (req.query.nueva) {
        panel = { modo: 'nueva', empresa: datosFormulario({ activa: true }), errores: [] };
    }

    const id = req.query.editar || req.query.ver;
    if (id) {
        const empresa = servicio.obtenerEmpresa(id);
        if (empresa) {
            panel = { modo: req.query.editar ? 'editar' : 'ver', empresa, errores: [] };
        }
    }

    renderEmpresas(req, res, panel);
}

function crearEmpresa(req, res) {
    const errores = servicio.validarEmpresa(req.body);

    if (errores.length > 0) {
        const panel = { modo: 'nueva', empresa: datosFormulario(req.body), errores };
        return renderEmpresas(req, res, panel, 400);
    }

    servicio.crearEmpresa(req.body);
    res.redirect('/empresarial/empresas?ok=creada');
}

function actualizarEmpresa(req, res) {
    if (!servicio.obtenerEmpresa(req.params.id)) return noEncontrado(req, res);

    const errores = servicio.validarEmpresa(req.body);

    if (errores.length > 0) {
        const panel = { modo: 'editar', empresa: datosFormulario(req.body, req.params.id), errores };
        return renderEmpresas(req, res, panel, 400);
    }

    servicio.actualizarEmpresa(req.params.id, req.body);
    res.redirect('/empresarial/empresas?ok=actualizada');
}

function cambiarEstadoEmpresa(req, res) {
    const empresa = servicio.cambiarEstadoEmpresa(req.params.id, req.body.estado);
    if (!empresa) return noEncontrado(req, res);

    const ok = empresa.estado === 'Inactiva' ? 'desactivada' : 'activada';
    res.redirect(`/empresarial/empresas?ok=${ok}`);
}

module.exports = {
    mostrarInicio,
    mostrarEmpresas,
    crearEmpresa,
    actualizarEmpresa,
    cambiarEstadoEmpresa
};
