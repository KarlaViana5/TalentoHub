const {
    buscarVacantes,
    obtenerVacantePorId,
    obtenerVacantesSimilares,
    obtenerPostulacionCandidato,
    postularCandidatoAVacante,
    reportarVacantePublica
} = require('../services/vacantes.service');

// ============================================
// BUS-01: RESULTADOS DE BÚSQUEDA
// ============================================

async function mostrarResultados(req, res) {
    try {
        const filtros = {
            q: req.query.q || '',
            ubicacion: req.query.ubicacion || '',
            experiencia: req.query.experiencia || '',
            sector: req.query.sector || '',
            modalidad: req.query.modalidad || '',
            tipoContrato: req.query.tipoContrato || '',
            salarioMinimo: req.query.salarioMinimo || '',
            salarioMaximo: req.query.salarioMaximo || '',
            fechaPublicacion: req.query.fechaPublicacion || '',
            orden: req.query.orden || 'recientes'
        };

        const resultadosPorPagina = 10;
        let paginaActual = Number.parseInt(req.query.pagina, 10);

        if (!Number.isInteger(paginaActual) || paginaActual < 1) {
            paginaActual = 1;
        }

        let resultado = await buscarVacantes(filtros, {
            limite: resultadosPorPagina,
            pagina: paginaActual
        });

        const totalResultados = resultado.totalResultados;
        const totalPaginas = Math.max(1, Math.ceil(totalResultados / resultadosPorPagina));

        if (paginaActual > totalPaginas) {
            paginaActual = totalPaginas;
            resultado = await buscarVacantes(filtros, {
                limite: resultadosPorPagina,
                pagina: paginaActual
            });
        }

        res.render('busqueda/index', {
            titulo: 'Resultados de búsqueda | TalentoHub',
            filtros,
            vacantes: resultado.vacantes,
            totalResultados,
            paginaActual,
            totalPaginas
        });
    } catch (error) {
        console.error('Error al mostrar resultados de búsqueda:', error);
        res.status(500).send('Ocurrió un error al consultar las vacantes. Inténtalo nuevamente.');
    }
}

// ============================================
// BUS-02: DETALLE DE EMPLEO Y POSTULACIÓN
// ============================================

async function mostrarDetalle(req, res) {
    try {
        const id = req.params.id;

        if (!/^\d+$/.test(id)) {
            return res.status(404).send('Error 404: La vacante que buscas no existe.');
        }

        const vacante = await obtenerVacantePorId(id);

        if (!vacante) {
            return res.status(404).send('Error 404: La vacante que buscas no existe o fue retirada.');
        }

        const [vacantesSimilares, postulacionActual] = await Promise.all([
            obtenerVacantesSimilares(vacante),
            req.usuario && req.usuario.rol === 'candidato' && req.usuario.candidatoId
                ? obtenerPostulacionCandidato(id, req.usuario.candidatoId)
                : Promise.resolve(null)
        ]);

        res.render('busqueda/detalle', {
            titulo: `${vacante.titulo} | TalentoHub`,
            vacante,
            vacantesSimilares,
            postulacionActual,
            mensaje: req.query.mensaje || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Error al mostrar el detalle de la vacante:', error);
        res.status(500).send('Ocurrió un error al consultar el detalle del empleo.');
    }
}

async function postularVacante(req, res) {
    const id = req.params.id;
    try {
        if (!req.usuario) {
            return res.redirect(`/auth/login?volver=${encodeURIComponent(`/busqueda/empleo/${id}`)}&aviso=${encodeURIComponent('Inicia sesión como Aplicante para postularte a este empleo.')}`);
        }
        if (req.usuario.rol !== 'candidato' || !req.usuario.candidatoId) {
            return res.redirect(`/busqueda/empleo/${id}?error=${encodeURIComponent('Solo las cuentas con rol de Aplicante (Candidato) pueden postularse a vacantes.')}`);
        }

        await postularCandidatoAVacante(id, req.usuario.candidatoId);
        res.redirect(`/busqueda/empleo/${id}?mensaje=${encodeURIComponent('¡Postulación enviada con éxito! Ya puedes dar seguimiento al estado de tu solicitud en tu Panel de Aplicante.')}`);
    } catch (error) {
        res.redirect(`/busqueda/empleo/${id}?error=${encodeURIComponent(error.message)}`);
    }
}

async function reportarVacante(req, res) {
    const id = req.params.id;
    try {
        await reportarVacantePublica(id, req.usuario, req.body);
        res.redirect(`/busqueda/empleo/${id}?mensaje=${encodeURIComponent('Reporte enviado al Centro de Moderación Administrativa.')}`);
    } catch (error) {
        res.redirect(`/busqueda/empleo/${id}?error=${encodeURIComponent(error.message)}`);
    }
}

module.exports = {
    mostrarResultados,
    mostrarDetalle,
    postularVacante,
    reportarVacante
};
