const { registrarError } = require('../utils/logger');
const candidatoService = require('../services/candidato.service');
const adminService = require('../services/administrativo.service');

function resolverIdCandidato(req, idExplicito = null) {
    if (req.usuario && req.usuario.rol === 'candidato' && req.usuario.candidatoId) {
        return Number(req.usuario.candidatoId);
    }
    if (idExplicito && Number.isFinite(Number(idExplicito))) {
        return Number(idExplicito);
    }
    return null;
}

const candidatoController = {
    // Consultar toda la información del área del candidato
    mostrarInicio: async (req, res) => {
        try {
            const idResuelto = resolverIdCandidato(req, req.query.id);
            const perfil = idResuelto
                ? await candidatoService.obtenerPerfilPorId(idResuelto)
                : await candidatoService.obtenerCandidatoPorDefecto();

            if (!perfil) {
                return res.render('candidato/index', {
                    titulo: 'Módulo de Aplicante',
                    descripcion: 'Gestiona tu perfil profesional, postulaciones, alertas, cursos y valoraciones.',
                    perfil: null,
                    postulaciones: [],
                    alertas: [],
                    valoraciones: [],
                    empresas: [],
                    cursos: [],
                    mensaje: null,
                    error: 'No se encontró ningún candidato registrado en la base de datos.'
                });
            }

            const [postulaciones, alertas, valoraciones, empresas, cursos] = await Promise.all([
                candidatoService.obtenerHistorialPostulaciones(perfil.id_candidato),
                candidatoService.obtenerAlertas(perfil.id_candidato),
                candidatoService.obtenerValoraciones(perfil.id_candidato),
                candidatoService.obtenerEmpresasActivas(),
                candidatoService.obtenerCursosParaCandidato(perfil.id_candidato)
            ]);

            res.render('candidato/index', {
                titulo: 'Módulo de Aplicante',
                descripcion: 'Gestiona tu perfil profesional, postulaciones, alertas, cursos y valoraciones.',
                perfil,
                postulaciones,
                alertas,
                valoraciones,
                empresas,
                cursos,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            registrarError(error, { scope: 'controller:candidato', req });
            throw error;
        }
    },

    // Actualizar datos del perfil
    actualizarPerfil: async (req, res) => {
        const idCandidato = resolverIdCandidato(req, req.params.id);
        try {
            await candidatoService.actualizarPerfil(idCandidato, req.body);
            res.redirect(`/candidato?mensaje=${encodeURIComponent('Perfil actualizado correctamente')}`);
        } catch (error) {
            registrarError(error, { scope: 'controller:candidato', req });
            res.redirect(`/candidato?error=${encodeURIComponent('No se pudo actualizar el perfil')}`);
        }
    },

    // Cancelar una postulación si aún está en estado 'nuevo'
    cancelarPostulacion: async (req, res) => {
        const idCandidato = resolverIdCandidato(req, req.body.candidato_id);
        const idPostulacion = Number(req.params.idPostulacion);
        try {
            await candidatoService.cancelarPostulacion(idPostulacion, idCandidato);
            res.redirect(`/candidato?mensaje=${encodeURIComponent('Postulación cancelada')}`);
        } catch (error) {
            registrarError(error, { scope: 'controller:candidato', req });
            res.redirect(`/candidato?error=${encodeURIComponent('No se pudo cancelar la postulación')}`);
        }
    },

    // Crear alerta de empleo
    crearAlerta: async (req, res) => {
        const idCandidato = resolverIdCandidato(req, req.body.candidato_id);
        try {
            await candidatoService.crearAlerta(idCandidato, req.body);
            res.redirect(`/candidato?mensaje=${encodeURIComponent('Alerta de empleo creada')}`);
        } catch (error) {
            registrarError(error, { scope: 'controller:candidato', req });
            res.redirect(`/candidato?error=${encodeURIComponent('No se pudo crear la alerta')}`);
        }
    },

    // Activar o pausar alerta de empleo
    alternarAlerta: async (req, res) => {
        const idCandidato = resolverIdCandidato(req, req.body.candidato_id);
        const idAlerta = Number(req.params.idAlerta);
        try {
            await candidatoService.alternarEstadoAlerta(idAlerta, idCandidato);
            res.redirect(`/candidato?mensaje=${encodeURIComponent('Estado de alerta actualizado')}`);
        } catch (error) {
            registrarError(error, { scope: 'controller:candidato', req });
            res.redirect(`/candidato?error=${encodeURIComponent('No se pudo actualizar la alerta')}`);
        }
    },

    // Eliminar alerta de empleo
    eliminarAlerta: async (req, res) => {
        const idCandidato = resolverIdCandidato(req, req.body.candidato_id);
        const idAlerta = Number(req.params.idAlerta);
        try {
            await candidatoService.eliminarAlerta(idAlerta, idCandidato);
            res.redirect(`/candidato?mensaje=${encodeURIComponent('Alerta eliminada')}`);
        } catch (error) {
            registrarError(error, { scope: 'controller:candidato', req });
            res.redirect(`/candidato?error=${encodeURIComponent('No se pudo eliminar la alerta')}`);
        }
    },

    // Crear valoración de empresa
    crearValoracion: async (req, res) => {
        const idCandidato = resolverIdCandidato(req, req.body.candidato_id);
        try {
            await candidatoService.crearValoracion(idCandidato, req.body);
            res.redirect(`/candidato?mensaje=${encodeURIComponent('Valoración publicada')}`);
        } catch (error) {
            registrarError(error, { scope: 'controller:candidato', req });
            res.redirect(`/candidato?error=${encodeURIComponent('No se pudo publicar la valoración')}`);
        }
    },

    // Actualizar valoración existente
    actualizarValoracion: async (req, res) => {
        const idCandidato = resolverIdCandidato(req, req.body.candidato_id);
        const idValoracion = Number(req.params.idValoracion);
        try {
            await candidatoService.actualizarValoracion(idValoracion, idCandidato, req.body);
            res.redirect(`/candidato?mensaje=${encodeURIComponent('Valoración actualizada')}`);
        } catch (error) {
            registrarError(error, { scope: 'controller:candidato', req });
            res.redirect(`/candidato?error=${encodeURIComponent('No se pudo actualizar la valoración')}`);
        }
    },

    // Inscribir al candidato en un curso publicado (LMS)
    inscribirCurso: async (req, res) => {
        const idCandidato = resolverIdCandidato(req, req.body.candidato_id);
        const idCurso = Number(req.params.idCurso);
        try {
            await adminService.inscribirCandidatoCurso(idCurso, idCandidato);
            res.redirect(`/candidato?mensaje=${encodeURIComponent('Te has inscrito en el curso exitosamente')}`);
        } catch (error) {
            res.redirect(`/candidato?error=${encodeURIComponent(error.message)}`);
        }
    }
};

module.exports = candidatoController;
