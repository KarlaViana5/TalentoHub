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

// EMP-03 y mis vacantes
const mensajesVacantes = {
    publicada: 'Vacante publicada correctamente.',
    borrador: 'Borrador guardado. Puedes continuarlo después.',
    actualizada: 'Cambios guardados correctamente.',
    inactiva: 'Vacante inactivada. Ya no recibe postulaciones.',
    activa: 'Vacante reactivada.',
    cancelada: 'Vacante cancelada.',
    eliminada: 'Vacante eliminada.'
};

const opcionesVacante = {
    modalidades: ['Presencial', 'Híbrido', 'Remoto'],
    contratos: ['Tiempo completo', 'Medio tiempo', 'Por proyecto', 'Pasantía'],
    experiencias: ['Sin experiencia', '1-3 años', '3-5 años', 'Más de 5 años'],
    formaciones: ['Bachillerato', 'Técnico', 'Universitaria', 'Maestría'],
    habilidades: ['JavaScript', 'HTML/CSS', 'Node.js', 'React', 'SQL', 'Git', 'Figma', 'UX Research',
        'Design Systems', 'Prototipado', 'Excel', 'Power BI', 'Comunicación', 'Trabajo en equipo']
};

function mostrarVacantes(req, res) {
    const estadoActual = servicio.ESTADOS_VACANTE.includes(req.query.estado) ? req.query.estado : '';

    res.render('empresarial/vacantes', {
        titulo: 'Mis vacantes',
        vacantes: servicio.listarVacantes({ estado: estadoActual }),
        conteo: servicio.contarVacantesPorEstado(),
        estados: servicio.ESTADOS_VACANTE,
        estadoActual,
        mensaje: mensajesVacantes[req.query.ok] || ''
    });
}

function formularioVacante(body) {
    return {
        ...body,
        responsabilidades: [].concat(body.responsabilidades || []),
        habilidades: [].concat(body.habilidades || []),
        beneficios: body.beneficios || ''
    };
}

function vacanteVacia() {
    return {
        empresaId: servicio.empleadorActual.empresaId,
        titulo: '',
        ubicacion: '',
        modalidad: 'Presencial',
        tipoContrato: 'Tiempo completo',
        experiencia: '',
        formacion: 'Universitaria',
        salarioMinimo: '',
        salarioMaximo: '',
        descripcion: '',
        responsabilidades: [],
        habilidades: [],
        beneficios: [],
        contacto: '',
        fechaCierre: ''
    };
}

function renderPublicar(res, vacante, errores = [], status = 200) {
    const modo = vacante.id ? 'editar' : 'nueva';

    res.status(status).render('empresarial/publicar', {
        titulo: modo === 'nueva' ? 'Publicar empleo' : 'Editar empleo',
        modo,
        accion: modo === 'nueva' ? '/empresarial/publicar' : `/empresarial/vacantes/${vacante.id}`,
        vacante: {
            ...vacante,
            beneficios: Array.isArray(vacante.beneficios) ? vacante.beneficios : vacante.beneficios.split(/\r?\n/)
        },
        errores,
        empresas: servicio.listarEmpresas({ estado: 'Activa' }),
        opciones: opcionesVacante,
        reclutador: servicio.empleadorActual.nombre,
        puedeBorrador: modo === 'nueva' || vacante.estado === 'Borrador',
        pasoInicial: 1
    });
}

function mostrarPublicar(req, res) {
    if (!req.query.id) return renderPublicar(res, vacanteVacia());

    const vacante = servicio.obtenerVacante(req.query.id);
    if (!vacante || vacante.estado === 'Cancelada') return noEncontrado(req, res);

    renderPublicar(res, vacante);
}

function validarSegunAccion(body) {
    return body.accion === 'borrador' ? servicio.validarBorrador(body) : servicio.validarVacante(body);
}

function publicarVacante(req, res) {
    const datos = formularioVacante(req.body);
    const errores = validarSegunAccion(datos);

    if (errores.length > 0) return renderPublicar(res, datos, errores, 400);

    const esBorrador = req.body.accion === 'borrador';
    servicio.crearVacante(datos, esBorrador ? 'Borrador' : 'Activa');
    res.redirect(`/empresarial/vacantes?ok=${esBorrador ? 'borrador' : 'publicada'}`);
}

function actualizarVacante(req, res) {
    const vacante = servicio.obtenerVacante(req.params.id);
    if (!vacante || vacante.estado === 'Cancelada') return noEncontrado(req, res);

    const datos = formularioVacante(req.body);
    const errores = validarSegunAccion(datos);

    if (errores.length > 0) {
        return renderPublicar(res, { ...datos, id: vacante.id, estado: vacante.estado }, errores, 400);
    }

    let ok = 'actualizada';
    let estado = vacante.estado;

    if (vacante.estado === 'Borrador') {
        estado = req.body.accion === 'borrador' ? 'Borrador' : 'Activa';
        ok = estado === 'Activa' ? 'publicada' : 'borrador';
    }

    servicio.actualizarVacante(vacante.id, datos, estado);
    res.redirect(`/empresarial/vacantes?ok=${ok}`);
}

function cambiarEstadoVacante(req, res) {
    const vacante = servicio.obtenerVacante(req.params.id);
    if (!vacante) return noEncontrado(req, res);

    const estado = req.body.estado;
    const permitidos = {
        Activa: ['Inactiva', 'Cancelada'],
        Inactiva: ['Activa', 'Cancelada']
    };

    if (!(permitidos[vacante.estado] || []).includes(estado)) {
        return res.redirect('/empresarial/vacantes');
    }

    servicio.cambiarEstadoVacante(vacante.id, estado);
    res.redirect(`/empresarial/vacantes?ok=${estado.toLowerCase()}`);
}

function eliminarVacante(req, res) {
    if (!servicio.eliminarVacante(req.params.id)) return noEncontrado(req, res);
    res.redirect('/empresarial/vacantes?ok=eliminada');
}

module.exports = {
    mostrarInicio,
    mostrarEmpresas,
    crearEmpresa,
    actualizarEmpresa,
    cambiarEstadoEmpresa,
    mostrarVacantes,
    mostrarPublicar,
    publicarVacante,
    actualizarVacante,
    cambiarEstadoVacante,
    eliminarVacante
};
