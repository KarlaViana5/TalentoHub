const forosService = require('../services/foros.service');

function formatearFechaRelativa(fecha) {
    if (!fecha) return 'Sin actividad reciente';
    const segundos = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000);
    if (segundos < 60) return 'Hace un momento';
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `Hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    if (dias === 1) return 'Ayer';
    if (dias < 30) return `Hace ${dias} días`;
    return new Date(fecha).toLocaleDateString('es-SV', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function queryActor(actor) {
    return actor && actor.clave ? `actor=${encodeURIComponent(actor.clave)}` : '';
}

const forosController = {
    cargarContextoActor: async (req, res, next) => {
        try {
            let clavePorSesion = 'visitante';
            if (req.usuario) {
                if (req.usuario.rol === 'admin') {
                    clavePorSesion = 'admin';
                } else if (req.usuario.rol === 'empresa' && req.usuario.empresaId) {
                    clavePorSesion = `empresa:${req.usuario.empresaId}`;
                } else if (req.usuario.rol === 'candidato' && req.usuario.candidatoId) {
                    clavePorSesion = `candidato:${req.usuario.candidatoId}`;
                }
            }

            const queryEfectivo = {
                ...req.query,
                actor: req.query.actor || req.body?.actor || clavePorSesion
            };

            const [actor, actoresDisponibles] = await Promise.all([
                forosService.resolverActor(queryEfectivo, req.body),
                forosService.listarActoresDisponibles()
            ]);
            req.actorForo = actor;
            res.locals.actorActual = actor;
            res.locals.actoresDisponibles = actoresDisponibles;
            res.locals.formatearFechaRelativa = formatearFechaRelativa;
            res.locals.queryActor = req.query.actor ? queryActor(actor) : '';
            next();
        } catch (error) {
            console.error('Error al cargar contexto de actor en foros:', error);
            next(error);
        }
    },

    // Pantalla 1: Listado público de foros
    mostrarInicio: async (req, res) => {
        try {
            const filtros = {
                q: req.query.q || '',
                origen: req.query.origen || '',
                orden: req.query.orden || 'orden'
            };

            const [foros, estadisticas] = await Promise.all([
                forosService.listarForosPublicos(filtros),
                forosService.obtenerEstadisticasComunidad()
            ]);

            res.render('foros/index', {
                titulo: 'Comunidad y Foros de Discusión',
                descripcion: 'Participa en conversaciones por temas, comparte experiencias laborales y resuelve dudas con candidatos y empresas.',
                foros,
                estadisticas,
                filtros,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar listado de foros:', error);
            res.status(500).send('Ocurrió un error al cargar el listado de foros.');
        }
    },

    // Pantalla 2: Listado de hilos de un foro
    mostrarForo: async (req, res) => {
        try {
            const foro = await forosService.obtenerForoPorSlugOId(req.params.foro);
            if (!foro) {
                return res.status(404).render('errors/404', {
                    titulo: 'Foro no encontrado',
                    ruta: req.originalUrl
                });
            }

            const filtros = {
                q: req.query.q || '',
                estado: req.query.estado || '',
                orden: req.query.orden || 'recientes'
            };

            const resultado = await forosService.listarHilosDeForo(foro.id, filtros, {
                pagina: req.query.pagina || 1,
                limite: 8
            });

            res.render('foros/hilos', {
                titulo: `${foro.nombre} | Foros TalentoHub`,
                descripcion: foro.descripcion,
                foro,
                filtros,
                hilos: resultado.hilos,
                totalResultados: resultado.totalResultados,
                paginaActual: resultado.pagina,
                totalPaginas: resultado.totalPaginas,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar hilos del foro:', error);
            res.status(500).send('Ocurrió un error al cargar los hilos del foro.');
        }
    },

    // Pantalla 4: Formulario para crear hilo
    mostrarCrearHilo: async (req, res) => {
        try {
            const foro = await forosService.obtenerForoPorSlugOId(req.params.foro);
            if (!foro) {
                return res.status(404).render('errors/404', {
                    titulo: 'Foro no encontrado',
                    ruta: req.originalUrl
                });
            }

            const forosActivos = await forosService.listarForosPublicos();

            res.render('foros/crear-hilo', {
                titulo: `Nueva discusión en ${foro.nombre}`,
                descripcion: 'Inicia una nueva conversación abierta para la comunidad.',
                foro,
                forosActivos,
                valores: { titulo: '', contenido: '' },
                errores: [],
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar formulario de nuevo hilo:', error);
            res.status(500).send('Ocurrió un error al preparar el formulario.');
        }
    },

    // Procesar creación de hilo
    crearHilo: async (req, res) => {
        const slugForo = req.body.foroSlug || req.params.foro;
        try {
            const foro = await forosService.obtenerForoPorSlugOId(slugForo);
            if (!foro) {
                return res.status(404).render('errors/404', {
                    titulo: 'Foro no encontrado',
                    ruta: req.originalUrl
                });
            }

            const nuevoHilo = await forosService.crearHilo(foro.id, req.actorForo, req.body);
            res.redirect(`/foros/${foro.slug}/hilos/${nuevoHilo.id}?${queryActor(req.actorForo)}&mensaje=${encodeURIComponent('Hilo de discusión publicado exitosamente.')}`);
        } catch (error) {
            try {
                const foro = await forosService.obtenerForoPorSlugOId(slugForo);
                const forosActivos = await forosService.listarForosPublicos();
                res.status(400).render('foros/crear-hilo', {
                    titulo: foro ? `Nueva discusión en ${foro.nombre}` : 'Nueva discusión',
                    descripcion: 'Inicia una nueva conversación abierta para la comunidad.',
                    foro: foro || { slug: slugForo, nombre: 'Foro' },
                    forosActivos,
                    valores: {
                        titulo: req.body.titulo || '',
                        contenido: req.body.contenido || ''
                    },
                    errores: [error.message],
                    error: error.message
                });
            } catch {
                res.redirect(`/foros?${queryActor(req.actorForo)}&error=${encodeURIComponent(error.message)}`);
            }
        }
    },

    // Pantalla 3: Detalle de un hilo y respuestas
    mostrarHilo: async (req, res) => {
        try {
            const hilo = await forosService.obtenerHiloDetalle(req.params.hilo);
            if (!hilo) {
                return res.status(404).render('errors/404', {
                    titulo: 'Hilo no encontrado o no disponible',
                    ruta: req.originalUrl
                });
            }

            res.render('foros/detalle-hilo', {
                titulo: `${hilo.titulo} | ${hilo.foroNombre}`,
                descripcion: hilo.contenido.slice(0, 140),
                hilo,
                modoEdicion: req.query.editar === '1',
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar detalle del hilo:', error);
            res.status(500).send('Ocurrió un error al cargar la discusión.');
        }
    },

    // Editar hilo propio
    editarHilo: async (req, res) => {
        const { foro, hilo } = req.params;
        try {
            await forosService.editarHiloPropio(hilo, req.actorForo, req.body);
            res.redirect(`/foros/${foro}/hilos/${hilo}?${queryActor(req.actorForo)}&mensaje=${encodeURIComponent('Tu hilo ha sido actualizado.')}`);
        } catch (error) {
            res.redirect(`/foros/${foro}/hilos/${hilo}?${queryActor(req.actorForo)}&error=${encodeURIComponent(error.message)}`);
        }
    },

    // Eliminar lógicamente hilo propio
    eliminarHilo: async (req, res) => {
        const { foro, hilo } = req.params;
        try {
            await forosService.eliminarHiloPropio(hilo, req.actorForo);
            res.redirect(`/foros/${foro}?${queryActor(req.actorForo)}&mensaje=${encodeURIComponent('El hilo ha sido eliminado.')}`);
        } catch (error) {
            res.redirect(`/foros/${foro}/hilos/${hilo}?${queryActor(req.actorForo)}&error=${encodeURIComponent(error.message)}`);
        }
    },

    // Publicar comentario o respuesta en un hilo
    crearComentario: async (req, res) => {
        const { foro, hilo } = req.params;
        try {
            await forosService.crearComentario(hilo, req.actorForo, req.body);
            res.redirect(`/foros/${foro}/hilos/${hilo}?${queryActor(req.actorForo)}&mensaje=${encodeURIComponent('Tu respuesta fue publicada.')}#comentarios`);
        } catch (error) {
            res.redirect(`/foros/${foro}/hilos/${hilo}?${queryActor(req.actorForo)}&error=${encodeURIComponent(error.message)}#form-comentar`);
        }
    },

    // Eliminar comentario propio
    eliminarComentario: async (req, res) => {
        const { foro, hilo, comentario } = req.params;
        try {
            await forosService.eliminarComentarioPropio(comentario, req.actorForo);
            res.redirect(`/foros/${foro}/hilos/${hilo}?${queryActor(req.actorForo)}&mensaje=${encodeURIComponent('Comentario eliminado.')}#comentarios`);
        } catch (error) {
            res.redirect(`/foros/${foro}/hilos/${hilo}?${queryActor(req.actorForo)}&error=${encodeURIComponent(error.message)}`);
        }
    },

    // Pantalla 5: Formulario para proponer un nuevo foro
    mostrarSolicitarForo: async (req, res) => {
        try {
            res.render('foros/solicitar', {
                titulo: 'Solicitar nuevo foro comunitario',
                descripcion: 'Propón un nuevo espacio temático para la comunidad de TalentoHub.',
                valores: { nombre: '', icono: '🗣️', descripcion: '', motivo: '' },
                error: req.query.error || null,
                mensaje: req.query.mensaje || null
            });
        } catch (error) {
            console.error('Error al mostrar solicitud de foro:', error);
            res.status(500).send('Ocurrió un error al mostrar el formulario.');
        }
    },

    // Procesar propuesta de nuevo foro
    crearSolicitudForo: async (req, res) => {
        try {
            await forosService.crearSolicitudForo(req.actorForo, req.body);
            res.redirect(`/foros/mis-solicitudes?${queryActor(req.actorForo)}&mensaje=${encodeURIComponent('Solicitud enviada como "Pendiente". El administrador revisará tu propuesta.')}`);
        } catch (error) {
            res.status(400).render('foros/solicitar', {
                titulo: 'Solicitar nuevo foro comunitario',
                descripcion: 'Propón un nuevo espacio temático para la comunidad de TalentoHub.',
                valores: {
                    nombre: req.body.nombre || '',
                    icono: req.body.icono || '🗣️',
                    descripcion: req.body.descripcion || '',
                    motivo: req.body.motivo || ''
                },
                error: error.message,
                mensaje: null
            });
        }
    },

    // Pantalla 6: Historial de mis solicitudes de foros
    mostrarMisSolicitudes: async (req, res) => {
        try {
            const solicitudes = await forosService.listarSolicitudesForoUsuario(req.actorForo);
            res.render('foros/mis-solicitudes', {
                titulo: 'Mis solicitudes de foros',
                descripcion: 'Consulta el estado de revisión y las observaciones de tus propuestas de foros.',
                solicitudes,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar solicitudes de foro:', error);
            res.status(500).send('Ocurrió un error al consultar tus solicitudes.');
        }
    },

    // Denunciar hilo o comentario
    reportarContenido: async (req, res) => {
        const volver = (req.body.volver && String(req.body.volver).startsWith('/foros'))
            ? req.body.volver
            : `/foros?${queryActor(req.actorForo)}`;
        const separador = volver.includes('?') ? '&' : '?';

        try {
            await forosService.denunciarContenidoForo(req.actorForo, req.body);
            res.redirect(`${volver}${separador}mensaje=${encodeURIComponent('Denuncia registrada en estado Pendiente. El administrador revisará el caso.')}`);
        } catch (error) {
            res.redirect(`${volver}${separador}error=${encodeURIComponent(error.message)}`);
        }
    }
};

module.exports = forosController;
