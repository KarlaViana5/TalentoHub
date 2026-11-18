const servicio = require('../services/empresarial.service');

const mensajes = {
    actualizada: 'Perfil de la empresa actualizado.'
};

// EMP-01
function saludo(hora = new Date().getHours()) {
    if (hora < 12) return 'Buenos días';
    if (hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
}

function formatoFecha(fecha) {
    if (!fecha) return '-';
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function mostrarInicio(req, res) {
    const panel = await servicio.obtenerPanel(req.query.rango);

    res.render('empresarial/index', {
        titulo: 'Panel de empresa',
        saludo: `${saludo()}, ${servicio.obtenerContexto().nombre.split(' ')[0]}`,
        ...panel,
        haceCuanto,
        formatoFecha
    });
}

// perfil de empresa (antes EMP-02)
function noEncontrado(req, res) {
    res.status(404).render('errors/404', {
        titulo: 'Página no encontrada',
        ruta: req.originalUrl
    });
}

async function renderPerfilEmpresa(req, res, { valores = null, errores = [], status = 200 } = {}) {
    const empresa = await servicio.obtenerPerfilEmpresa();
    if (!empresa) return noEncontrado(req, res);

    res.status(status).render('empresarial/perfil', {
        titulo: 'Perfil de empresa',
        empresa,
        valores: valores || empresa,
        errores,
        sectores: servicio.SECTORES,
        mensaje: mensajes[req.query.ok] || ''
    });
}

async function mostrarPerfilEmpresa(req, res) {
    await renderPerfilEmpresa(req, res);
}

async function actualizarPerfilEmpresa(req, res) {
    const valores = {
        nombre: req.body.nombre || '',
        sector: req.body.sector || '',
        ubicacion: req.body.ubicacion || '',
        descripcion: req.body.descripcion || '',
        telefono: req.body.telefono || ''
    };
    const errores = servicio.validarPerfilEmpresa(valores);
    if (errores.length > 0) return renderPerfilEmpresa(req, res, { valores, errores, status: 400 });

    await servicio.actualizarPerfilEmpresa(valores);
    res.redirect('/empresarial/perfil?ok=actualizada');
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

async function mostrarVacantes(req, res) {
    const estadoActual = servicio.ESTADOS_VACANTE.includes(req.query.estado) ? req.query.estado : '';

    res.render('empresarial/vacantes', {
        titulo: 'Mis vacantes',
        vacantes: await servicio.listarVacantes({ estado: estadoActual }),
        conteo: await servicio.contarVacantesPorEstado(),
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
        empresaId: servicio.obtenerContexto().empresaId,
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

async function renderPublicar(res, vacante, errores = [], status = 200) {
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
        empresas: await servicio.listarEmpresas({ estado: 'Activa' }),
        opciones: opcionesVacante,
        reclutador: servicio.obtenerContexto().nombre,
        puedeBorrador: modo === 'nueva' || vacante.estado === 'Borrador',
        pasoInicial: 1
    });
}

async function mostrarPublicar(req, res) {
    if (!req.query.id) return renderPublicar(res, vacanteVacia());

    const vacante = await servicio.obtenerVacante(req.query.id);
    if (!vacante || vacante.estado === 'Cancelada') return noEncontrado(req, res);

    await renderPublicar(res, vacante);
}

async function validarSegunAccion(body) {
    return body.accion === 'borrador' ? await servicio.validarBorrador(body) : await servicio.validarVacante(body);
}

async function publicarVacante(req, res) {
    const datos = formularioVacante(req.body);
    const errores = await validarSegunAccion(datos);

    if (errores.length > 0) return renderPublicar(res, datos, errores, 400);

    const esBorrador = req.body.accion === 'borrador';
    await servicio.crearVacante(datos, esBorrador ? 'Borrador' : 'Activa');
    res.redirect(`/empresarial/vacantes?ok=${esBorrador ? 'borrador' : 'publicada'}`);
}

async function actualizarVacante(req, res) {
    const vacante = await servicio.obtenerVacante(req.params.id);
    if (!vacante || vacante.estado === 'Cancelada') return noEncontrado(req, res);

    const datos = formularioVacante(req.body);
    const errores = await validarSegunAccion(datos);

    if (errores.length > 0) {
        return renderPublicar(res, { ...datos, id: vacante.id, estado: vacante.estado }, errores, 400);
    }

    let ok = 'actualizada';
    let estado = vacante.estado;

    if (vacante.estado === 'Borrador') {
        estado = req.body.accion === 'borrador' ? 'Borrador' : 'Activa';
        ok = estado === 'Activa' ? 'publicada' : 'borrador';
    }

    await servicio.actualizarVacante(vacante.id, datos, estado);
    res.redirect(`/empresarial/vacantes?ok=${ok}`);
}

async function cambiarEstadoVacante(req, res) {
    const vacante = await servicio.obtenerVacante(req.params.id);
    if (!vacante) return noEncontrado(req, res);

    const estado = req.body.estado;
    const permitidos = {
        Activa: ['Inactiva', 'Cancelada'],
        Inactiva: ['Activa', 'Cancelada']
    };

    if (!(permitidos[vacante.estado] || []).includes(estado)) {
        return res.redirect('/empresarial/vacantes');
    }

    await servicio.cambiarEstadoVacante(vacante.id, estado);
    res.redirect(`/empresarial/vacantes?ok=${estado.toLowerCase()}`);
}

async function eliminarVacante(req, res) {
    if (!await servicio.eliminarVacante(req.params.id)) return noEncontrado(req, res);
    res.redirect('/empresarial/vacantes?ok=eliminada');
}

// EMP-04
const mensajesPostulaciones = {
    preseleccionado: 'Candidato preseleccionado.',
    rechazado: 'Candidato rechazado.',
    masivo: 'Estado actualizado a los candidatos seleccionados.'
};

function haceCuanto(fecha) {
    const horas = Math.floor((Date.now() - new Date(fecha)) / 3600000);
    if (horas < 1) return 'Hace un momento';
    if (horas < 24) return `Hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    return dias === 1 ? 'Ayer' : `Hace ${dias} días`;
}

async function vacantesConPostulaciones() {
    return (await servicio.listarVacantes()).filter(v => v.estado !== 'Borrador');
}

// solo rutas internas
function urlVolver(body) {
    const volver = body.volver || '';
    return volver.startsWith('/empresarial/postulaciones') ? volver : '/empresarial/postulaciones';
}

function conMensaje(url, ok) {
    const limpia = url.replace(/[?&]ok=[^&]*/, '');
    return limpia + (limpia.includes('?') ? '&' : '?') + 'ok=' + ok;
}

async function mostrarPostulaciones(req, res) {
    const lista = await vacantesConPostulaciones();
    const vacante = req.query.vacante ? await servicio.obtenerVacante(req.query.vacante) : lista[0];

    // An empty company inbox is a valid page; an explicitly requested foreign/missing offer is not.
    if (req.query.vacante && (!vacante || vacante.estado === 'Borrador')) return noEncontrado(req, res);

    const filtros = {
        estado: servicio.ESTADOS_POSTULACION.includes(req.query.estado) ? req.query.estado : '',
        q: req.query.q || '',
        experienciaMin: req.query.experienciaMin || '',
        compatibilidadMin: req.query.compatibilidadMin || '',
        orden: req.query.orden === 'compatibilidad' ? 'compatibilidad' : 'fecha'
    };

    const postulaciones = vacante
        ? (await servicio.listarPostulaciones(vacante.id, filtros)).map(p => ({ ...p, hace: haceCuanto(p.fecha) }))
        : [];

    res.render('empresarial/postulaciones', {
        titulo: 'Postulaciones',
        vacante,
        vacantes: lista,
        filtros,
        postulaciones,
        conteo: vacante ? await servicio.contarPostulacionesPorEstado(vacante.id) : { Todos: 0 },
        estados: servicio.ESTADOS_POSTULACION,
        volver: req.originalUrl,
        mensaje: mensajesPostulaciones[req.query.ok] || ''
    });
}

async function cambiarEstadoPostulacion(req, res) {
    const estado = req.body.estado;
    if (!await servicio.cambiarEstadoPostulacion(req.params.id, estado)) return noEncontrado(req, res);
    res.redirect(conMensaje(urlVolver(req.body), estado.toLowerCase()));
}

async function cambiarEstadoMasivo(req, res) {
    const volver = urlVolver(req.body);
    if (!req.body.ids) return res.redirect(volver);

    await servicio.cambiarEstadoVariasPostulaciones(req.body.ids, req.body.estado);
    res.redirect(conMensaje(volver, 'masivo'));
}

function csv(valor) {
    return `"${String(valor).replace(/"/g, '""')}"`;
}

async function exportarPostulaciones(req, res) {
    const vacante = await servicio.obtenerVacante(req.query.vacante);
    if (!vacante) return noEncontrado(req, res);

    const filas = [['Candidato', 'Cargo', 'Correo', 'Teléfono', 'Experiencia (años)', 'Compatibilidad (%)', 'Fecha', 'Estado']];
    (await servicio.listarPostulaciones(vacante.id)).forEach(p => {
        filas.push([p.candidato.nombre, p.candidato.cargo, p.candidato.correo, p.candidato.telefono,
            p.candidato.aniosExperiencia, p.compatibilidad, p.fecha.toISOString().slice(0, 10), p.estado]);
    });

    // bom pa excel
    const contenido = '\ufeff' + filas.map(f => f.map(csv).join(',')).join('\r\n');
    res.attachment(`postulaciones-${vacante.id}.csv`);
    res.type('text/csv').send(contenido);
}

// EMP-05
const mensajesPerfil = {
    estado: 'Estado del candidato actualizado.',
    nota: 'Nota agregada.',
    'nota-vacia': 'Escribe algo en la nota antes de guardarla.'
};

function iniciales(nombre) {
    return nombre.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase();
}

async function mostrarPerfil(req, res) {
    const postulacion = await servicio.obtenerPostulacion(req.params.id);
    if (!postulacion || !postulacion.candidato) return noEncontrado(req, res);

    res.render('empresarial/candidato', {
        titulo: postulacion.candidato.nombre,
        postulacion,
        candidato: postulacion.candidato,
        vacante: postulacion.vacante,
        coincidentes: servicio.habilidadesCoincidentes(postulacion.candidato, postulacion.vacante),
        estados: servicio.ESTADOS_POSTULACION,
        iniciales: iniciales(postulacion.candidato.nombre),
        hace: haceCuanto(postulacion.fecha),
        haceCuanto,
        mensaje: mensajesPerfil[req.query.ok] || ''
    });
}

async function cambiarEstadoPerfil(req, res) {
    if (!await servicio.cambiarEstadoPostulacion(req.params.id, req.body.estado)) return noEncontrado(req, res);
    res.redirect(`/empresarial/candidatos/${req.params.id}?ok=estado`);
}

async function agregarNota(req, res) {
    if (!(req.body.texto || '').trim()) return res.redirect(`/empresarial/candidatos/${req.params.id}?ok=nota-vacia`);
    if (!await servicio.agregarNota(req.params.id, req.body.texto)) return noEncontrado(req, res);
    res.redirect(`/empresarial/candidatos/${req.params.id}?ok=nota#notas`);
}

async function datosCv(req, res) {
    const postulacion = await servicio.obtenerPostulacion(req.params.id);
    if (!postulacion || !postulacion.candidato) {
        noEncontrado(req, res);
        return null;
    }
    return { candidato: postulacion.candidato, iniciales: iniciales(postulacion.candidato.nombre) };
}

async function verCv(req, res) {
    const datos = await datosCv(req, res);
    if (datos) res.render('empresarial/cv', datos);
}

async function descargarCv(req, res) {
    const datos = await datosCv(req, res);
    if (!datos) return;
    const nombre = (datos.candidato.cv || `CV_${datos.candidato.nombre}`).replace(/\.pdf$/i, '').replace(/\s+/g, '');
    res.attachment(`${nombre}.html`);
    res.render('empresarial/cv', datos);
}

module.exports = {
    mostrarInicio,
    mostrarPerfil,
    cambiarEstadoPerfil,
    agregarNota,
    verCv,
    descargarCv,
    mostrarPostulaciones,
    cambiarEstadoPostulacion,
    cambiarEstadoMasivo,
    exportarPostulaciones,
    mostrarPerfilEmpresa,
    actualizarPerfilEmpresa,
    mostrarVacantes,
    mostrarPublicar,
    publicarVacante,
    actualizarVacante,
    cambiarEstadoVacante,
    eliminarVacante
};
