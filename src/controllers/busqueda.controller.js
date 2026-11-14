
// src/controllers/busqueda.controller.js

const {
    buscarVacantes,
    obtenerVacantePorId,
    obtenerVacantesSimilares
} = require('../services/vacantes.service');

// Pantalla BUS-01: resultados de búsqueda.
function mostrarResultados(req, res) {
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

    const todasLasVacantes = buscarVacantes(filtros);

    // Paginación: mostrar 10 vacantes por página.
    const resultadosPorPagina = 10;
    const paginaSolicitada = Number.parseInt(req.query.pagina, 10) || 1;

    const totalResultados = todasLasVacantes.length;
    const totalPaginas = Math.max(
        1,
        Math.ceil(totalResultados / resultadosPorPagina)
    );

    const paginaActual = Math.min(
        Math.max(paginaSolicitada, 1),
        totalPaginas
    );

    const inicio = (paginaActual - 1) * resultadosPorPagina;

    const vacantesPagina = todasLasVacantes.slice(
        inicio,
        inicio + resultadosPorPagina
    );

    res.render('busqueda/index', {
        titulo: 'Resultados de búsqueda',
        filtros,
        vacantes: vacantesPagina,
        totalResultados,
        paginaActual,
        totalPaginas
    });
}

// Pantalla BUS-02: detalle de empleo.
function mostrarDetalle(req, res) {
    const vacante = obtenerVacantePorId(req.params.id);

    if (!vacante) {
    return res.status(404).send(
        'Error 404: La vacante que buscas no existe.'
    );
}

    const vacantesSimilares = obtenerVacantesSimilares(vacante);

    res.render('busqueda/detalle', {
        titulo: vacante.titulo,
        vacante,
        vacantesSimilares
    });
}

module.exports = {
    mostrarResultados,
    mostrarDetalle
};
