const candidatoService = require('../services/candidato.service');

const candidatoController = {
    // Consultar toda la información del área del candidato
    mostrarInicio: async (req, res) => {
        try {
            const idQuery = req.query.id ? Number(req.query.id) : null;
            const perfil = idQuery
                ? await candidatoService.obtenerPerfilPorId(idQuery)
                : await candidatoService.obtenerCandidatoPorDefecto();

            if (!perfil) {
                return res.render('candidato/index', {
                    titulo: 'Módulo de candidato',
                    descripcion: 'Gestiona tu perfil profesional, postulaciones, alertas y valoraciones.',
                    perfil: null,
                    postulaciones: [],
                    alertas: [],
                    valoraciones: [],
                    empresas: [],
                    mensaje: null,
                    error: 'No se encontró ningún candidato registrado en la base de datos.'
                });
            }

            const [postulaciones, alertas, valoraciones, empresas] = await Promise.all([
                candidatoService.obtenerHistorialPostulaciones(perfil.id_candidato),
                candidatoService.obtenerAlertas(perfil.id_candidato),
                candidatoService.obtenerValoraciones(perfil.id_candidato),
                candidatoService.obtenerEmpresasActivas()
            ]);

            res.render('candidato/index', {
                titulo: 'Módulo de candidato',
                descripcion: 'Gestiona tu perfil profesional, postulaciones, alertas y valoraciones.',
                perfil,
                postulaciones,
                alertas,
                valoraciones,
                empresas,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al cargar módulo candidato:', error);
            res.status(500).send('Error interno al consultar la información del candidato.');
        }
    },

    // Actualizar datos del perfil
    actualizarPerfil: async (req, res) => {
        const idCandidato = Number(req.params.id);
        try {
            await candidatoService.actualizarPerfil(idCandidato, req.body);
            res.redirect(`/candidato?id=${idCandidato}&mensaje=Perfil actualizado correctamente`);
        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            res.redirect(`/candidato?id=${idCandidato}&error=No se pudo actualizar el perfil`);
        }
    },

    // Cancelar una postulación si aún está en estado 'nuevo'
    cancelarPostulacion: async (req, res) => {
        const idCandidato = Number(req.body.candidato_id);
        const idPostulacion = Number(req.params.idPostulacion);
        try {
            await candidatoService.cancelarPostulacion(idPostulacion, idCandidato);
            res.redirect(`/candidato?id=${idCandidato}&mensaje=Postulación cancelada`);
        } catch (error) {
            console.error('Error al cancelar postulación:', error);
            res.redirect(`/candidato?id=${idCandidato}&error=No se pudo cancelar la postulación`);
        }
    },

    // Crear alerta de empleo
    crearAlerta: async (req, res) => {
        const idCandidato = Number(req.body.candidato_id);
        try {
            await candidatoService.crearAlerta(idCandidato, req.body);
            res.redirect(`/candidato?id=${idCandidato}&mensaje=Alerta de empleo creada`);
        } catch (error) {
            console.error('Error al crear alerta:', error);
            res.redirect(`/candidato?id=${idCandidato}&error=No se pudo crear la alerta`);
        }
    },

    // Activar o pausar alerta de empleo
    alternarAlerta: async (req, res) => {
        const idCandidato = Number(req.body.candidato_id);
        const idAlerta = Number(req.params.idAlerta);
        try {
            await candidatoService.alternarEstadoAlerta(idAlerta, idCandidato);
            res.redirect(`/candidato?id=${idCandidato}&mensaje=Estado de alerta actualizado`);
        } catch (error) {
            console.error('Error al actualizar alerta:', error);
            res.redirect(`/candidato?id=${idCandidato}&error=No se pudo actualizar la alerta`);
        }
    },

    // Eliminar alerta de empleo
    eliminarAlerta: async (req, res) => {
        const idCandidato = Number(req.body.candidato_id);
        const idAlerta = Number(req.params.idAlerta);
        try {
            await candidatoService.eliminarAlerta(idAlerta, idCandidato);
            res.redirect(`/candidato?id=${idCandidato}&mensaje=Alerta eliminada`);
        } catch (error) {
            console.error('Error al eliminar alerta:', error);
            res.redirect(`/candidato?id=${idCandidato}&error=No se pudo eliminar la alerta`);
        }
    },

    // Crear valoración de empresa
    crearValoracion: async (req, res) => {
        const idCandidato = Number(req.body.candidato_id);
        try {
            await candidatoService.crearValoracion(idCandidato, req.body);
            res.redirect(`/candidato?id=${idCandidato}&mensaje=Valoración publicada`);
        } catch (error) {
            console.error('Error al crear valoración:', error);
            res.redirect(`/candidato?id=${idCandidato}&error=No se pudo publicar la valoración`);
        }
    },

    // Actualizar valoración existente
    actualizarValoracion: async (req, res) => {
        const idCandidato = Number(req.body.candidato_id);
        const idValoracion = Number(req.params.idValoracion);
        try {
            await candidatoService.actualizarValoracion(idValoracion, idCandidato, req.body);
            res.redirect(`/candidato?id=${idCandidato}&mensaje=Valoración actualizada`);
        } catch (error) {
            console.error('Error al actualizar valoración:', error);
            res.redirect(`/candidato?id=${idCandidato}&error=No se pudo actualizar la valoración`);
        }
    }
};

module.exports = candidatoController;