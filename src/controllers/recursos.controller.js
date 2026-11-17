const { registrarError } = require('../utils/logger');

// src/controllers/recursos.controller.js

const {
    obtenerCategorias,
    buscarRecursos,
    obtenerRecursoPorId,
    obtenerRecursosRelacionados
} = require('../services/recursos.service');

const recursosController = {

    // ==========================================
    // REC-01: LISTADO DE RECURSOS
    // ==========================================

    mostrarInicio: async (req, res, next) => {

        try {

            // Recibir los filtros desde la URL.
            const filtros = {
                q: req.query.q || '',
                categoria: req.query.categoria || '',
                tipo: req.query.tipo || '',
                fecha: req.query.fecha || '',
                orden: req.query.orden || 'recientes'
            };

            // Obtener el número de página.
            const paginaSolicitada = Number.parseInt(
                req.query.pagina,
                10
            ) || 1;

            const pagina = Math.max(paginaSolicitada, 1);

            // Consultar las categorías disponibles.
            const categoriasPendientes = obtenerCategorias();

            // Buscar los recursos en PostgreSQL.
            const resultadoPendiente = buscarRecursos(
                filtros,
                {
                    pagina,
                    limite: 9
                }
            );

            const [categorias, resultado] = await Promise.all([categoriasPendientes, resultadoPendiente]);

            // Calcular las páginas disponibles.
            const totalPaginas = Math.ceil(
                resultado.totalResultados / resultado.limite
            );

            res.render('recursos/index', {

                titulo: 'Recursos profesionales',

                descripcion:
                    'Encuentra herramientas, consejos y materiales para impulsar tu desarrollo profesional.',

                filtros,

                categorias,

                recursos: resultado.recursos,

                totalResultados: resultado.totalResultados,

                paginaActual: pagina,

                totalPaginas

            });

        } catch (error) {

            registrarError(error, { scope: 'controller:recursos', req });

            next(error);

        }

    },


    // ==========================================
    // REC-02: DETALLE DE UN RECURSO
    // ==========================================

    mostrarDetalle: async (req, res, next) => {

        try {

            const { id } = req.params;

            // Consultar el recurso seleccionado.
            const recurso = await obtenerRecursoPorId(id);

            // Comprobar si existe.
            if (!recurso) {

                return res.status(404).render('errors/404', {
                    titulo: 'Recurso no encontrado',
                    ruta: req.originalUrl
                });

            }

            // Consultar recursos de la misma categoría.
            const recursosRelacionados =
                await obtenerRecursosRelacionados(recurso);

            res.render('recursos/detalle', {

                titulo: recurso.titulo,

                descripcion: recurso.resumen,

                recurso,

                recursosRelacionados

            });

        } catch (error) {

            registrarError(error, { scope: 'controller:recursos', req });

            next(error);

        }

    }

};

module.exports = recursosController;
