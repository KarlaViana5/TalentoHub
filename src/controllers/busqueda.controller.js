
const {
    buscarVacantes,
    obtenerVacantePorId,
    obtenerVacantesSimilares
} = require('../services/vacantes.service');

// ============================================
// BUS-01: RESULTADOS DE BÚSQUEDA
// ============================================

async function mostrarResultados(req, res) {
    try {
        // Recopilar los filtros enviados desde la URL.
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

        // Configuración de paginación.
        const resultadosPorPagina = 10;

        let paginaActual = Number.parseInt(req.query.pagina, 10);

        if (!Number.isInteger(paginaActual) || paginaActual < 1) {
            paginaActual = 1;
        }

        // Consultar las vacantes en PostgreSQL.
        let resultado = await buscarVacantes(filtros, {
            limite: resultadosPorPagina,
            pagina: paginaActual
        });

        const totalResultados = resultado.totalResultados;

        const totalPaginas = Math.max(
            1,
            Math.ceil(totalResultados / resultadosPorPagina)
        );

        // Evitar solicitar una página que no existe.
        if (paginaActual > totalPaginas) {
            paginaActual = totalPaginas;

            resultado = await buscarVacantes(filtros, {
                limite: resultadosPorPagina,
                pagina: paginaActual
            });
        }

        // Enviar los resultados a la vista.
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

        res.status(500).send(
            'Ocurrió un error al consultar las vacantes. Inténtalo nuevamente.'
        );
    }
}

// ============================================
// BUS-02: DETALLE DE EMPLEO
// ============================================

async function mostrarDetalle(req, res) {
    try {
        const id = req.params.id;

        // Validar que el identificador sea numérico.
        if (!/^\d+$/.test(id)) {
            return res.status(404).send(
                'Error 404: La vacante que buscas no existe.'
            );
        }

        // Consultar la vacante en PostgreSQL.
        const vacante = await obtenerVacantePorId(id);

        if (!vacante) {
            return res.status(404).send(
                'Error 404: La vacante que buscas no existe.'
            );
        }

        // Consultar vacantes similares.
        const vacantesSimilares = await obtenerVacantesSimilares(vacante);

        // Mostrar el detalle.
        res.render('busqueda/detalle', {
            titulo: `${vacante.titulo} | TalentoHub`,
            vacante,
            vacantesSimilares
        });

    } catch (error) {
        console.error('Error al mostrar el detalle de la vacante:', error);

        res.status(500).send(
            'Ocurrió un error al consultar el detalle del empleo.'
        );
    }
}

// ============================================
// EXPORTAR CONTROLADORES
// ============================================

module.exports = {
    mostrarResultados,
    mostrarDetalle
};
