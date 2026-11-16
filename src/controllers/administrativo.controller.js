const adminService = require('../services/administrativo.service');
const forosService = require('../services/foros.service');

function formatearFecha(fecha) {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-SV', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function formatearFechaHora(fecha) {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleString('es-SV', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function csv(valor) {
    return `"${String(valor ?? '').replace(/"/g, '""')}"`;
}

const administrativoController = {
    // Middleware RN-02, RN-ADM-01, RN-ADM-05: Solo el rol admin puede acceder al panel
    verificarAccesoAdmin: async (req, res, next) => {
        try {
            if (req.query.rol && String(req.query.rol).toLowerCase() !== 'admin') {
                return res.status(403).render('administrativo/acceso-denegado', {
                    titulo: 'Acceso restringido | Panel Administrativo',
                    rolIntentado: req.query.rol,
                    rolesRequeridos: 'Administrador',
                    ruta: req.originalUrl
                });
            }

            if (!req.usuario) {
                return res.redirect(`/auth/login?volver=${encodeURIComponent(req.originalUrl)}&aviso=${encodeURIComponent('Inicia sesión como Administrador para acceder al Panel Administrativo.')}`);
            }

            if (req.usuario.rol !== 'admin') {
                return res.status(403).render('administrativo/acceso-denegado', {
                    titulo: 'Acceso restringido | Panel Administrativo',
                    rolIntentado: `${req.usuario.rolEtiqueta} (${req.usuario.nombreMostrar})`,
                    rolesRequeridos: 'Administrador',
                    ruta: req.originalUrl
                });
            }

            res.locals.adminActual = {
                ...adminService.ADMIN_ACTUAL,
                nombre: req.usuario.nombreMostrar || adminService.ADMIN_ACTUAL.nombre,
                correo: req.usuario.correo || adminService.ADMIN_ACTUAL.correo
            };
            res.locals.alertasAdmin = await adminService.obtenerResumenAlertasPendientes();
            res.locals.formatearFecha = formatearFecha;
            res.locals.formatearFechaHora = formatearFechaHora;
            next();
        } catch (error) {
            console.error('Error en middleware administrativo:', error);
            next(error);
        }
    },

    // 1. Dashboard y Estadísticas
    mostrarDashboard: async (req, res) => {
        try {
            const datos = await adminService.obtenerDashboardAdmin(req.query.periodo || 30);
            res.render('administrativo/index', {
                titulo: 'Dashboard Administrativo | TalentoHub',
                seccionActiva: req.path.includes('estadistica') || req.path.includes('statistic') ? 'estadisticas' : 'dashboard',
                ...datos,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al cargar dashboard administrativo:', error);
            res.status(500).send('Ocurrió un error al cargar el dashboard administrativo.');
        }
    },

    exportarEstadisticas: async (req, res) => {
        try {
            const datos = await adminService.obtenerDashboardAdmin(req.query.periodo || 30);
            const filas = [
                ['Indicador', 'Valor'],
                ...Object.entries(datos.kpis),
                [],
                ['Vacantes por sector', 'Total'],
                ...datos.graficos.vacantesPorSector.map(fila => [fila.etiqueta, fila.total]),
                [],
                ['Vacantes por ubicación', 'Total'],
                ...datos.graficos.vacantesPorUbicacion.map(fila => [fila.etiqueta, fila.total])
            ];

            const contenido = '\ufeff' + filas.map(fila => fila.map(csv).join(',')).join('\r\n');
            res.attachment(`estadisticas-administrativas-${datos.periodoDias}-dias.csv`);
            res.type('text/csv').send(contenido);
        } catch (error) {
            console.error('Error al exportar estadísticas administrativas:', error);
            res.status(500).send('Ocurrió un error al exportar las estadísticas administrativas.');
        }
    },

    // 2. Consulta de usuarios, cuentas e historial
    mostrarUsuarios: async (req, res) => {
        try {
            const filtros = {
                q: req.query.q || '',
                rol: req.query.rolFiltro || '',
                estado: req.query.estado || ''
            };
            const usuarios = await adminService.listarUsuarios(filtros);

            res.render('administrativo/usuarios', {
                titulo: 'Usuarios y actividad | Panel Administrativo',
                seccionActiva: 'usuarios',
                filtros,
                usuarios,
                detalle: null,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al listar usuarios:', error);
            res.status(500).send('Error al consultar listado de usuarios.');
        }
    },

    mostrarDetalleUsuario: async (req, res) => {
        try {
            const { rol, id } = req.params;
            if (rol === 'empresa') {
                return res.redirect(`/administrativo/empresas?ver=${id}`);
            }

            const detalle = await adminService.obtenerDetalleUsuario('candidato', id);
            if (!detalle) {
                return res.status(404).render('errors/404', {
                    titulo: 'Usuario no encontrado',
                    ruta: req.originalUrl
                });
            }

            const usuarios = await adminService.listarUsuarios({});
            res.render('administrativo/usuarios', {
                titulo: `Historial de ${detalle.usuario.nombre} | Administración`,
                seccionActiva: 'usuarios',
                filtros: { q: '', rol: '', estado: '' },
                usuarios,
                detalle,
                abrirModal: true,
                pestanaActiva: req.query.tab || 'general',
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar detalle de usuario:', error);
            res.status(500).send('Error al cargar el expediente del usuario.');
        }
    },

    // 3. Administración y Aprobación de Empresas
    mostrarEmpresas: async (req, res) => {
        try {
            const filtros = {
                q: req.query.q || '',
                estadoAprobacion: req.query.estado || '',
                sector: req.query.sector || ''
            };

            const { empresas, conteos } = await adminService.listarEmpresasAdmin(filtros);
            const idVer = req.query.ver || null;
            const expediente = idVer ? await adminService.obtenerExpedienteEmpresa(idVer) : null;

            res.render('administrativo/empresas', {
                titulo: 'Empresas y aprobaciones | Panel Administrativo',
                seccionActiva: 'empresas',
                filtros,
                empresas,
                conteos,
                expediente,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar administración de empresas:', error);
            res.status(500).send('Error al cargar el módulo de empresas.');
        }
    },

    decidirEmpresa: async (req, res) => {
        const { id } = req.params;
        try {
            await adminService.decidirEstadoEmpresa(id, req.body.accion, req.body.motivo);
            res.redirect(`/administrativo/empresas?ver=${id}&mensaje=${encodeURIComponent('Decisión administrativa aplicada y registrada en el expediente e historial de auditoría.')}`);
        } catch (error) {
            res.redirect(`/administrativo/empresas?ver=${id}&error=${encodeURIComponent(error.message)}`);
        }
    },

    // 4. Biblioteca Digital, Recursos y Artículos
    mostrarRecursos: async (req, res) => {
        try {
            const esArticulos = req.path.includes('articulo') || req.path.includes('article');
            const filtros = {
                q: req.query.q || '',
                categoriaId: req.query.categoriaId || '',
                estado: req.query.estado || '',
                tipo: req.query.tipo || (esArticulos ? 'articulo' : '')
            };

            const { recursos, categorias } = await adminService.listarRecursosAdmin(filtros);
            const recursoEditar = req.query.editar
                ? recursos.find(r => r.id === Number(req.query.editar)) || null
                : null;

            res.render('administrativo/recursos', {
                titulo: esArticulos ? 'Gestión de Artículos y Publicaciones' : 'Biblioteca Digital y Recursos Educativos',
                seccionActiva: esArticulos ? 'articulos' : 'recursos',
                esArticulos,
                filtros,
                recursos,
                categorias,
                recursoEditar,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar biblioteca digital y recursos:', error);
            res.status(500).send('Error al cargar los recursos educativos.');
        }
    },

    guardarRecurso: async (req, res) => {
        const rutaBase = req.path.includes('articulo') ? '/administrativo/articulos' : '/administrativo/recursos';
        try {
            await adminService.guardarRecursoAdmin(req.body);
            res.redirect(`${rutaBase}?mensaje=${encodeURIComponent('Material registrado exitosamente en la plataforma.')}`);
        } catch (error) {
            res.redirect(`${rutaBase}?error=${encodeURIComponent(error.message)}`);
        }
    },

    actualizarRecurso: async (req, res) => {
        try {
            await adminService.guardarRecursoAdmin(req.body, req.params.id);
            res.redirect(`/administrativo/recursos?mensaje=${encodeURIComponent('Material actualizado correctamente.')}`);
        } catch (error) {
            res.redirect(`/administrativo/recursos?editar=${req.params.id}&error=${encodeURIComponent(error.message)}`);
        }
    },

    cambiarEstadoRecurso: async (req, res) => {
        try {
            await adminService.cambiarEstadoRecursoAdmin(req.params.id, req.body.estado);
            res.redirect(`/administrativo/recursos?mensaje=${encodeURIComponent('Estado del material actualizado.')}`);
        } catch (error) {
            res.redirect(`/administrativo/recursos?error=${encodeURIComponent(error.message)}`);
        }
    },

    alternarDestacadoRecurso: async (req, res) => {
        try {
            await adminService.alternarDestacadoRecurso(req.params.id);
            res.redirect(`/administrativo/recursos?mensaje=${encodeURIComponent('Destacado actualizado.')}`);
        } catch (error) {
            res.redirect(`/administrativo/recursos?error=${encodeURIComponent(error.message)}`);
        }
    },

    crearCategoriaRecurso: async (req, res) => {
        try {
            await adminService.crearCategoriaRecurso(req.body);
            res.redirect(`/administrativo/recursos?mensaje=${encodeURIComponent('Categoría guardada.')}`);
        } catch (error) {
            res.redirect(`/administrativo/recursos?error=${encodeURIComponent(error.message)}`);
        }
    },

    // 6. Cursos, Capacitaciones y Exámenes (LMS)
    mostrarCursos: async (req, res) => {
        try {
            const [cursos, { categorias }] = await Promise.all([
                adminService.listarCursosAdmin(),
                adminService.listarRecursosAdmin({})
            ]);

            res.render('administrativo/cursos', {
                titulo: 'Cursos y Capacitaciones (LMS)',
                seccionActiva: 'cursos',
                cursos,
                categorias,
                cursoDetalle: null,
                recursosBiblioteca: [],
                candidatosDisponibles: [],
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar cursos:', error);
            res.status(500).send('Error al cargar el módulo de cursos.');
        }
    },

    crearCurso: async (req, res) => {
        try {
            const curso = await adminService.crearCurso(req.body);
            res.redirect(`/administrativo/cursos/${curso.id}?mensaje=${encodeURIComponent('Curso creado en borrador. Agrega al menos un módulo y una lección antes de publicarlo.')}`);
        } catch (error) {
            res.redirect(`/administrativo/cursos?error=${encodeURIComponent(error.message)}`);
        }
    },

    mostrarDetalleCurso: async (req, res) => {
        try {
            const [cursoDetalle, cursos, { recursos, categorias }, { candidatos }] = await Promise.all([
                adminService.obtenerCursoCompleto(req.params.id),
                adminService.listarCursosAdmin(),
                adminService.listarRecursosAdmin({}),
                forosService.listarActoresDisponibles()
            ]);

            if (!cursoDetalle) {
                return res.status(404).render('errors/404', {
                    titulo: 'Curso no encontrado',
                    ruta: req.originalUrl
                });
            }

            res.render('administrativo/cursos', {
                titulo: `${cursoDetalle.titulo} | Gestión de Curso`,
                seccionActiva: 'cursos',
                cursos,
                categorias,
                cursoDetalle,
                recursosBiblioteca: recursos,
                candidatosDisponibles: candidatos,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar detalle del curso:', error);
            res.status(500).send('Error al consultar el curso.');
        }
    },

    cambiarEstadoCurso: async (req, res) => {
        const { id } = req.params;
        try {
            await adminService.cambiarEstadoCurso(id, req.body.estado);
            res.redirect(`/administrativo/cursos/${id}?mensaje=${encodeURIComponent('Estado del curso actualizado correctamente.')}`);
        } catch (error) {
            res.redirect(`/administrativo/cursos/${id}?error=${encodeURIComponent(error.message)}`);
        }
    },

    agregarModulo: async (req, res) => {
        const { id } = req.params;
        try {
            await adminService.agregarModuloCurso(id, req.body);
            res.redirect(`/administrativo/cursos/${id}?mensaje=${encodeURIComponent('Módulo agregado al curso.')}`);
        } catch (error) {
            res.redirect(`/administrativo/cursos/${id}?error=${encodeURIComponent(error.message)}`);
        }
    },

    agregarLeccion: async (req, res) => {
        const { id, idModulo } = req.params;
        try {
            await adminService.agregarLeccionModulo(idModulo, req.body);
            res.redirect(`/administrativo/cursos/${id}?mensaje=${encodeURIComponent('Lección agregada al módulo.')}`);
        } catch (error) {
            res.redirect(`/administrativo/cursos/${id}?error=${encodeURIComponent(error.message)}`);
        }
    },

    inscribirCandidato: async (req, res) => {
        const { id } = req.params;
        try {
            await adminService.inscribirCandidatoCurso(id, req.body.candidatoId);
            res.redirect(`/administrativo/cursos/${id}?mensaje=${encodeURIComponent('Candidato inscrito en el curso.')}`);
        } catch (error) {
            res.redirect(`/administrativo/cursos/${id}?error=${encodeURIComponent(error.message)}`);
        }
    },

    completarLeccion: async (req, res) => {
        const { id, idInscripcion, idLeccion } = req.params;
        try {
            await adminService.completarLeccionCandidato(idInscripcion, idLeccion);
            res.redirect(`/administrativo/cursos/${id}?mensaje=${encodeURIComponent('Avance de lección registrado y porcentaje actualizado.')}`);
        } catch (error) {
            res.redirect(`/administrativo/cursos/${id}?error=${encodeURIComponent(error.message)}`);
        }
    },

    // 7. Exámenes y Evaluaciones
    mostrarExamenes: async (req, res) => {
        try {
            const [examenes, cursos] = await Promise.all([
                adminService.listarExamenesAdmin(),
                adminService.listarCursosAdmin()
            ]);

            res.render('administrativo/examenes', {
                titulo: 'Exámenes y Evaluaciones | LMS',
                seccionActiva: 'examenes',
                examenes,
                cursos,
                examenDetalle: null,
                candidatosDisponibles: [],
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar exámenes:', error);
            res.status(500).send('Error al cargar el módulo de exámenes.');
        }
    },

    crearExamen: async (req, res) => {
        try {
            const examen = await adminService.crearExamen(req.body);
            res.redirect(`/administrativo/examenes/${examen.id}?mensaje=${encodeURIComponent('Evaluación creada correctamente. Configura sus preguntas.')}`);
        } catch (error) {
            res.redirect(`/administrativo/examenes?error=${encodeURIComponent(error.message)}`);
        }
    },

    mostrarDetalleExamen: async (req, res) => {
        try {
            const [examenDetalle, examenes, cursos, { candidatos }] = await Promise.all([
                adminService.obtenerExamenCompleto(req.params.id, true),
                adminService.listarExamenesAdmin(),
                adminService.listarCursosAdmin(),
                forosService.listarActoresDisponibles()
            ]);

            if (!examenDetalle) {
                return res.status(404).render('errors/404', {
                    titulo: 'Evaluación no encontrada',
                    ruta: req.originalUrl
                });
            }

            res.render('administrativo/examenes', {
                titulo: `${examenDetalle.titulo} | Evaluación`,
                seccionActiva: 'examenes',
                examenes,
                cursos,
                examenDetalle,
                candidatosDisponibles: candidatos,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar detalle del examen:', error);
            res.status(500).send('Error al consultar la evaluación.');
        }
    },

    agregarPreguntaExamen: async (req, res) => {
        const { id } = req.params;
        try {
            await adminService.agregarPreguntaExamen(id, req.body);
            res.redirect(`/administrativo/examenes/${id}?mensaje=${encodeURIComponent('Pregunta agregada a la evaluación.')}`);
        } catch (error) {
            res.redirect(`/administrativo/examenes/${id}?error=${encodeURIComponent(error.message)}`);
        }
    },

    presentarIntentoExamen: async (req, res) => {
        const { id } = req.params;
        try {
            const resultado = await adminService.calificarIntentoExamen(id, req.body.candidatoId || 1, req.body);
            res.redirect(`/administrativo/examenes/${id}?mensaje=${encodeURIComponent(`Intento calificado en servidor: ${resultado.calificacion}% (${resultado.aprobado ? 'APROBADO - passed' : 'REPROBADO - failed'}).`)}`);
        } catch (error) {
            res.redirect(`/administrativo/examenes/${id}?error=${encodeURIComponent(error.message)}`);
        }
    },

    // 8. Administración de Foros, Solicitudes, Hilos y Comentarios
    mostrarForosAdmin: async (req, res) => {
        try {
            const [{ foros, solicitudes }, { hilos, comentarios }] = await Promise.all([
                adminService.listarForosYSolicitudesAdmin(),
                adminService.listarHilosYComentariosAdmin({
                    q: req.query.q || '',
                    foroId: req.query.foroId || ''
                })
            ]);

            const foroEditar = req.query.editarForo
                ? foros.find(f => f.id === Number(req.query.editarForo)) || null
                : null;

            res.render('administrativo/foros', {
                titulo: 'Administración de Foros y Comunidad',
                seccionActiva: 'foros',
                pestanaActiva: req.query.tab || 'solicitudes',
                foros,
                solicitudes,
                hilos,
                comentarios,
                foroEditar,
                filtros: { q: req.query.q || '', foroId: req.query.foroId || '' },
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al cargar administración de foros:', error);
            res.status(500).send('Error al cargar la administración de foros.');
        }
    },

    guardarForoOficial: async (req, res) => {
        try {
            await adminService.guardarForoAdmin(req.body);
            res.redirect(`/administrativo/foros?tab=categorias&mensaje=${encodeURIComponent('Foro oficial creado y publicado directamente.')}`);
        } catch (error) {
            res.redirect(`/administrativo/foros?tab=categorias&error=${encodeURIComponent(error.message)}`);
        }
    },

    actualizarForoOficial: async (req, res) => {
        try {
            await adminService.guardarForoAdmin(req.body, req.params.id);
            res.redirect(`/administrativo/foros?tab=categorias&mensaje=${encodeURIComponent('Foro actualizado correctamente.')}`);
        } catch (error) {
            res.redirect(`/administrativo/foros?tab=categorias&error=${encodeURIComponent(error.message)}`);
        }
    },

    cambiarEstadoForo: async (req, res) => {
        try {
            await adminService.cambiarEstadoForoAdmin(req.params.id, req.body.estado);
            res.redirect(`/administrativo/foros?tab=categorias&mensaje=${encodeURIComponent('Estado del foro actualizado.')}`);
        } catch (error) {
            res.redirect(`/administrativo/foros?tab=categorias&error=${encodeURIComponent(error.message)}`);
        }
    },

    revisarSolicitudForo: async (req, res) => {
        try {
            const resultado = await adminService.revisarSolicitudForo(req.params.id, req.body.accion, req.body.notasRevision);
            const msg = resultado.foro
                ? `Propuesta aprobada. Se ha creado y publicado el foro comunitario "${resultado.foro.nombre}".`
                : 'Propuesta de foro rechazada con motivo registrado.';
            res.redirect(`/administrativo/foros?tab=solicitudes&mensaje=${encodeURIComponent(msg)}`);
        } catch (error) {
            res.redirect(`/administrativo/foros?tab=solicitudes&error=${encodeURIComponent(error.message)}`);
        }
    },

    moderarHilo: async (req, res) => {
        try {
            await adminService.moderarHiloAdmin(req.params.id, req.body.accion, req.body.motivo);
            res.redirect(`/administrativo/foros?tab=hilos&mensaje=${encodeURIComponent('Acción de moderación sobre el hilo aplicada y registrada en auditoría.')}`);
        } catch (error) {
            res.redirect(`/administrativo/foros?tab=hilos&error=${encodeURIComponent(error.message)}`);
        }
    },

    moderarComentario: async (req, res) => {
        try {
            await adminService.moderarComentarioAdmin(req.params.id, req.body.accion, req.body.motivo);
            res.redirect(`/administrativo/foros?tab=comentarios&mensaje=${encodeURIComponent('Estado del comentario actualizado.')}`);
        } catch (error) {
            res.redirect(`/administrativo/foros?tab=comentarios&error=${encodeURIComponent(error.message)}`);
        }
    },

    // 9. Moderación de Opiniones y Centro de Reportes
    mostrarModeracion: async (req, res) => {
        try {
            const filtros = {
                estado: req.query.estado || '',
                tipoContenido: req.query.tipoContenido || ''
            };
            const { reportes, opiniones } = await adminService.listarModeracionYReportes(filtros);

            res.render('administrativo/moderacion', {
                titulo: 'Denuncias y Moderación',
                seccionActiva: 'moderacion',
                filtros,
                reportes,
                opiniones,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al cargar moderación y reportes:', error);
            res.status(500).send('Error al cargar el centro de denuncias.');
        }
    },

    moderarValoracion: async (req, res) => {
        try {
            await adminService.moderarValoracionAdmin(req.params.id, req.body.estado, req.body.motivo);
            res.redirect(`/administrativo/moderacion?mensaje=${encodeURIComponent('Opinión empresarial moderada conservando el historial (RN-12).')}`);
        } catch (error) {
            res.redirect(`/administrativo/moderacion?error=${encodeURIComponent(error.message)}`);
        }
    },

    resolverReporte: async (req, res) => {
        try {
            await adminService.resolverReporteAdmin(req.params.id, req.body);
            res.redirect(`/administrativo/moderacion?mensaje=${encodeURIComponent('Reporte revisado y resolución registrada en auditoría (RN-10).')}`);
        } catch (error) {
            res.redirect(`/administrativo/moderacion?error=${encodeURIComponent(error.message)}`);
        }
    },

    // 10. Notificaciones y Configuración General
    mostrarNotificaciones: async (req, res) => {
        try {
            const notificaciones = await adminService.listarNotificacionesAdmin();
            res.render('administrativo/notificaciones', {
                titulo: 'Gestión de Notificaciones | Administración',
                seccionActiva: 'notificaciones',
                notificaciones,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar notificaciones:', error);
            res.status(500).send('Error al cargar las notificaciones.');
        }
    },

    crearNotificacion: async (req, res) => {
        try {
            await adminService.crearNotificacionPublica(req.body);
            res.redirect(`/administrativo/notificaciones?mensaje=${encodeURIComponent('Notificación publicada y distribuida.')}`);
        } catch (error) {
            res.redirect(`/administrativo/notificaciones?error=${encodeURIComponent(error.message)}`);
        }
    },

    mostrarConfiguracion: async (req, res) => {
        try {
            const configuracion = await adminService.obtenerConfiguracionPlataforma();
            res.render('administrativo/configuracion', {
                titulo: 'Configuración General de la Plataforma',
                seccionActiva: 'configuracion',
                configuracion,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('Error al mostrar configuración:', error);
            res.status(500).send('Error al cargar la configuración.');
        }
    },

    guardarConfiguracion: async (req, res) => {
        try {
            await adminService.guardarConfiguracionPlataforma(req.body);
            res.redirect(`/administrativo/configuracion?mensaje=${encodeURIComponent('Configuración general actualizada correctamente.')}`);
        } catch (error) {
            res.redirect(`/administrativo/configuracion?error=${encodeURIComponent(error.message)}`);
        }
    },

};

module.exports = administrativoController;
