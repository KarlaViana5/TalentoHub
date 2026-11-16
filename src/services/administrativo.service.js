const { pool } = require('../config/database');
const { generarSlug } = require('./foros.service');

const ADMIN_ACTUAL = {
    id: 1,
    nombre: 'Administrador Principal',
    correo: 'admin@talentohub.edu.sv',
    rol: 'admin'
};

let db = pool;

function usarConexion(conexion) {
    db = conexion || pool;
}

async function consulta(sql, valores = []) {
    const resultado = await db.query(sql, valores);
    return resultado.rows;
}

function texto(valor) {
    return String(valor ?? '').trim();
}

function idValido(id) {
    return /^\d+$/.test(String(id));
}

// ==========================================================
// AUDITORÍA ADMINISTRATIVA (RN-10, RN-ADM-06, RN-FOR-16)
// ==========================================================

async function registrarAuditoria({
    adminNombre = ADMIN_ACTUAL.nombre,
    accion,
    entidadTipo,
    entidadId = null,
    descripcion,
    valoresAnteriores = null,
    valoresNuevos = null,
    ipAddress = '127.0.0.1'
}) {
    const filas = await consulta(
        `INSERT INTO auditoria_admin (
            admin_nombre, accion, entidad_tipo, entidad_id, descripcion, valores_anteriores, valores_nuevos, ip_address
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id_log::int AS id, admin_nombre AS "adminNombre", accion, entidad_tipo AS "entidadTipo",
                   entidad_id::int AS "entidadId", descripcion, fecha_creacion AS "fechaCreacion"`,
        [
            adminNombre,
            accion,
            entidadTipo,
            entidadId ? Number(entidadId) : null,
            descripcion,
            valoresAnteriores ? JSON.stringify(valoresAnteriores) : null,
            valoresNuevos ? JSON.stringify(valoresNuevos) : null,
            ipAddress
        ]
    );
    return filas[0];
}

async function listarAuditoria(filtros = {}) {
    const condiciones = [];
    const valores = [];

    if (texto(filtros.q)) {
        valores.push(`%${texto(filtros.q)}%`);
        condiciones.push(`(accion ILIKE $${valores.length} OR descripcion ILIKE $${valores.length} OR admin_nombre ILIKE $${valores.length})`);
    }
    if (texto(filtros.entidadTipo)) {
        valores.push(texto(filtros.entidadTipo));
        condiciones.push(`entidad_tipo = $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    return consulta(
        `SELECT
            id_log::int AS id,
            admin_nombre AS "adminNombre",
            accion,
            entidad_tipo AS "entidadTipo",
            entidad_id::int AS "entidadId",
            descripcion,
            valores_anteriores AS "valoresAnteriores",
            valores_nuevos AS "valoresNuevos",
            ip_address AS "ipAddress",
            fecha_creacion AS "fechaCreacion"
         FROM auditoria_admin
         ${where}
         ORDER BY fecha_creacion DESC, id_log DESC
         LIMIT 100`,
        valores
    );
}

// ==========================================================
// 1. DASHBOARD Y ESTADÍSTICAS (RF-02, RN-ADM-02, 03, 04)
// ==========================================================

async function obtenerResumenAlertasPendientes() {
    const [resumen] = await consulta(`
        SELECT
            (SELECT COUNT(*)::int FROM empresas WHERE estado_aprobacion IN ('pendiente', 'en_correccion') OR estado = 'pendiente') AS "empresasPendientes",
            (SELECT COUNT(*)::int FROM solicitudes_foros WHERE estado = 'pendiente') AS "forosPendientes",
            (SELECT COUNT(*)::int FROM reportes WHERE estado IN ('pendiente', 'en_revision')) AS "denunciasPendientes"
    `);
    resumen.totalPendientes = resumen.empresasPendientes + resumen.forosPendientes + resumen.denunciasPendientes;
    return resumen;
}

async function obtenerDashboardAdmin(periodoDias = 30) {
    const dias = [7, 30, 90].includes(Number(periodoDias)) ? Number(periodoDias) : 30;

    const [kpis] = await consulta(`
        SELECT
            (SELECT COUNT(*)::int FROM candidatos) AS "totalCandidatos",
            (SELECT COUNT(*)::int FROM candidatos WHERE estado = 'activo') AS "candidatosActivos",
            (SELECT COUNT(*)::int FROM candidatos WHERE estado = 'suspendido') AS "candidatosSuspendidos",
            (SELECT COUNT(*)::int FROM empresas) AS "totalEmpresas",
            (SELECT COUNT(*)::int FROM empresas WHERE estado = 'activa' AND estado_aprobacion = 'aprobada') AS "empresasAprobadas",
            (SELECT COUNT(*)::int FROM empresas WHERE estado_aprobacion IN ('pendiente', 'en_correccion') OR estado = 'pendiente') AS "empresasPendientes",
            (SELECT COUNT(*)::int FROM empresas WHERE estado_aprobacion = 'suspendida') AS "empresasSuspendidas",
            (SELECT COUNT(*)::int FROM vacantes WHERE estado = 'publicada' AND estado_moderacion = 'normal' AND (fecha_cierre IS NULL OR fecha_cierre >= CURRENT_DATE)) AS "vacantesPublicadas",
            (SELECT COUNT(*)::int FROM vacantes WHERE estado = 'cerrada' OR (fecha_cierre IS NOT NULL AND fecha_cierre < CURRENT_DATE)) AS "vacantesCerradas",
            (SELECT COUNT(*)::int FROM vacantes WHERE estado_moderacion = 'oculta') AS "vacantesOcultas",
            (SELECT COUNT(*)::int FROM postulaciones) AS "totalPostulaciones",
            (SELECT COUNT(*)::int FROM recursos WHERE estado = 'publicado') AS "recursosDisponibles",
            (SELECT COUNT(*)::int FROM cursos WHERE estado = 'publicado') AS "cursosPublicados",
            (SELECT COUNT(*)::int FROM inscripciones_curso) AS "totalInscripciones",
            (SELECT COUNT(*)::int FROM inscripciones_curso WHERE estado = 'completada') AS "cursosCompletados",
            (SELECT COUNT(*)::int FROM foros WHERE estado = 'activo') AS "forosActivos",
            (SELECT COUNT(*)::int FROM hilos_foro WHERE estado = 'visible' AND eliminado_en IS NULL) AS "hilosActivos",
            (SELECT COUNT(*)::int FROM solicitudes_foros WHERE estado = 'pendiente') AS "solicitudesForosPendientes",
            (SELECT COUNT(*)::int FROM reportes WHERE estado IN ('pendiente', 'en_revision')) AS "reportesPendientes"
    `);

    kpis.usuariosRegistrados = kpis.totalCandidatos + kpis.totalEmpresas;

    const [
        vacantesPorSector,
        vacantesPorUbicacion,
        inscripcionesPorCurso,
        participacionForos,
        actividadReciente,
        bandejaSolicitudes
    ] = await Promise.all([
        consulta(`
            SELECT COALESCE(sector, 'General') AS etiqueta, COUNT(*)::int AS total
            FROM vacantes
            GROUP BY COALESCE(sector, 'General')
            ORDER BY total DESC
            LIMIT 6
        `),
        consulta(`
            SELECT COALESCE(SPLIT_PART(ubicacion, ',', 1), 'No especificada') AS etiqueta, COUNT(*)::int AS total
            FROM vacantes
            GROUP BY COALESCE(SPLIT_PART(ubicacion, ',', 1), 'No especificada')
            ORDER BY total DESC
            LIMIT 6
        `),
        consulta(`
            SELECT
                c.titulo AS etiqueta,
                COUNT(i.id_inscripcion)::int AS inscritos,
                COUNT(i.id_inscripcion) FILTER (WHERE i.estado = 'completada')::int AS completados
            FROM cursos c
            LEFT JOIN inscripciones_curso i ON i.curso_id = c.id_curso
            GROUP BY c.id_curso, c.titulo
            ORDER BY inscritos DESC
            LIMIT 5
        `),
        consulta(`
            SELECT
                f.nombre AS etiqueta,
                COUNT(DISTINCT h.id_hilo)::int AS hilos,
                COUNT(cm.id_comentario)::int AS comentarios
            FROM foros f
            LEFT JOIN hilos_foro h ON h.foro_id = f.id_foro AND h.eliminado_en IS NULL
            LEFT JOIN comentarios_foro cm ON cm.hilo_id = h.id_hilo AND cm.eliminado_en IS NULL
            GROUP BY f.id_foro, f.nombre
            ORDER BY (COUNT(DISTINCT h.id_hilo) + COUNT(cm.id_comentario)) DESC
            LIMIT 6
        `),
        listarAuditoria({}),
        obtenerBandejaUnificadaSolicitudes()
    ]);

    return {
        periodoDias: dias,
        kpis,
        graficos: {
            vacantesPorSector,
            vacantesPorUbicacion,
            inscripcionesPorCurso,
            participacionForos,
            proporcionUsuarios: {
                candidatos: kpis.totalCandidatos,
                empresas: kpis.totalEmpresas,
                porcentajeCandidatos: kpis.usuariosRegistrados
                    ? Math.round((kpis.totalCandidatos / kpis.usuariosRegistrados) * 100)
                    : 50
            }
        },
        actividadReciente: actividadReciente.slice(0, 8),
        bandejaSolicitudes: bandejaSolicitudes.slice(0, 8)
    };
}

async function obtenerBandejaUnificadaSolicitudes() {
    const [empresasSol, forosSol] = await Promise.all([
        consulta(`
            SELECT
                'empresa' AS tipo,
                id_empresa::int AS id,
                nombre AS titulo,
                COALESCE(representante, nombre) AS solicitante,
                'Empresa' AS "rolSolicitante",
                estado_aprobacion AS estado,
                fecha_registro AS fecha,
                '/administrativo/empresas?ver=' || id_empresa AS enlace
            FROM empresas
            ORDER BY CASE WHEN estado_aprobacion IN ('pendiente', 'en_correccion') THEN 0 ELSE 1 END, fecha_registro DESC
            LIMIT 6
        `),
        consulta(`
            SELECT
                'foro' AS tipo,
                id_solicitud::int AS id,
                nombre AS titulo,
                solicitante_nombre AS solicitante,
                INITCAP(solicitante_tipo) AS "rolSolicitante",
                estado,
                fecha_creacion AS fecha,
                '/administrativo/foros?tab=solicitudes' AS enlace
            FROM solicitudes_foros
            ORDER BY CASE WHEN estado = 'pendiente' THEN 0 ELSE 1 END, fecha_creacion DESC
            LIMIT 6
        `)
    ]);

    return [...empresasSol, ...forosSol].sort((a, b) => {
        const aPend = ['pendiente', 'en_correccion'].includes(a.estado) ? 0 : 1;
        const bPend = ['pendiente', 'en_correccion'].includes(b.estado) ? 0 : 1;
        if (aPend !== bPend) return aPend - bPend;
        return new Date(b.fecha) - new Date(a.fecha);
    });
}

// ==========================================================
// 2. GESTIÓN DE USUARIOS (Págs. 5-6 y 112-113, RN-05)
// ==========================================================

async function listarUsuarios(filtros = {}) {
    const q = texto(filtros.q).toLowerCase();
    const rolFiltro = filtros.rol || '';
    const estadoFiltro = filtros.estado || '';

    const [candidatos, empresas] = await Promise.all([
        consulta(`
            SELECT
                id_candidato::int AS id,
                nombre,
                correo,
                'candidato' AS rol,
                'Candidato' AS "rolEtiqueta",
                COALESCE(cargo, 'Candidato') AS subtitulo,
                ubicacion,
                fecha_registro AS "fechaRegistro",
                CASE WHEN estado = 'suspendido' THEN 'Suspendido' ELSE 'Activo' END AS estado,
                motivo_suspension AS "motivoSuspension"
            FROM candidatos
            ORDER BY id_candidato ASC
        `),
        consulta(`
            SELECT
                id_empresa::int AS id,
                nombre,
                COALESCE(correo, 'contacto@empresa.com') AS correo,
                'empresa' AS rol,
                'Empresa' AS "rolEtiqueta",
                sector AS subtitulo,
                ubicacion,
                fecha_registro AS "fechaRegistro",
                CASE
                    WHEN estado_aprobacion = 'suspendida' OR estado = 'inactiva' THEN 'Suspendido'
                    WHEN estado_aprobacion IN ('pendiente', 'en_correccion') OR estado = 'pendiente' THEN 'Pendiente'
                    ELSE 'Activo'
                END AS estado,
                motivo_rechazo AS "motivoSuspension"
            FROM empresas
            ORDER BY id_empresa ASC
        `)
    ]);

    return [...candidatos, ...empresas].filter(u => {
        if (rolFiltro && u.rol !== rolFiltro) return false;
        if (estadoFiltro && u.estado.toLowerCase() !== estadoFiltro.toLowerCase()) return false;
        if (q && !u.nombre.toLowerCase().includes(q) && !u.correo.toLowerCase().includes(q)) return false;
        return true;
    });
}

async function obtenerDetalleUsuario(rol, id) {
    if (!idValido(id)) return null;
    const idNum = Number(id);

    if (rol === 'empresa') {
        return obtenerExpedienteEmpresa(idNum);
    }

    const [candidato] = await consulta(
        `SELECT
            id_candidato::int AS id,
            nombre,
            cargo,
            empresa_actual AS "empresaActual",
            ubicacion,
            correo,
            telefono,
            anios_experiencia AS "aniosExperiencia",
            COALESCE(habilidades, '{}') AS habilidades,
            COALESCE(experiencia, '[]'::jsonb) AS experiencia,
            COALESCE(formacion, '[]'::jsonb) AS formacion,
            cv_url AS "cvUrl",
            fecha_registro AS "fechaRegistro",
            estado,
            motivo_suspension AS "motivoSuspension"
         FROM candidatos
         WHERE id_candidato = $1
         LIMIT 1`,
        [idNum]
    );

    if (!candidato) return null;

    const [postulaciones, inscripciones, hilos, comentarios, opiniones, reportes, sanciones] = await Promise.all([
        consulta(`
            SELECT p.id_postulacion::int AS id, p.fecha_postulacion AS fecha, p.estado,
                   v.titulo AS vacante, e.nombre AS empresa
            FROM postulaciones p
            JOIN vacantes v ON v.id_vacante = p.vacante_id
            JOIN empresas e ON e.id_empresa = v.empresa_id
            WHERE p.candidato_id = $1
            ORDER BY p.fecha_postulacion DESC
        `, [idNum]),
        consulta(`
            SELECT i.id_inscripcion::int AS id, i.porcentaje_avance AS "porcentajeAvance",
                   i.estado, i.fecha_inscripcion AS "fechaInscripcion", c.titulo AS curso
            FROM inscripciones_curso i
            JOIN cursos c ON c.id_curso = i.curso_id
            WHERE i.candidato_id = $1
            ORDER BY i.fecha_inscripcion DESC
        `, [idNum]),
        consulta(`
            SELECT h.id_hilo::int AS id, h.titulo, h.estado, h.fecha_creacion AS fecha, f.nombre AS foro, f.slug AS "foroSlug"
            FROM hilos_foro h
            JOIN foros f ON f.id_foro = h.foro_id
            WHERE h.autor_tipo = 'candidato' AND h.autor_id = $1
            ORDER BY h.fecha_creacion DESC
        `, [idNum]),
        consulta(`
            SELECT c.id_comentario::int AS id, c.contenido, c.estado, c.fecha_creacion AS fecha, h.titulo AS hilo
            FROM comentarios_foro c
            JOIN hilos_foro h ON h.id_hilo = c.hilo_id
            WHERE c.autor_tipo = 'candidato' AND c.autor_id = $1
            ORDER BY c.fecha_creacion DESC
        `, [idNum]),
        consulta(`
            SELECT val.id_valoracion::int AS id, val.puntuacion, val.titulo, val.comentario,
                   val.estado_moderacion AS "estadoModeracion", val.fecha_valoracion AS fecha, e.nombre AS empresa
            FROM valoraciones val
            JOIN empresas e ON e.id_empresa = val.empresa_id
            WHERE val.candidato_id = $1
            ORDER BY val.fecha_valoracion DESC
        `, [idNum]),
        consulta(`
            SELECT id_reporte::int AS id, tipo_contenido AS "tipoContenido", contenido_resumen AS resumen,
                   motivo, estado, resolucion, fecha_creacion AS fecha
            FROM reportes
            WHERE LOWER(usuario_reportado_nombre) = LOWER($1)
               OR (denunciante_tipo = 'candidato' AND denunciante_id = $2)
            ORDER BY fecha_creacion DESC
        `, [candidato.nombre, idNum]),
        consulta(`
            SELECT id_log::int AS id, accion, descripcion, fecha_creacion AS fecha, admin_nombre AS "adminNombre"
            FROM auditoria_admin
            WHERE entidad_tipo = 'candidato' AND entidad_id = $1
            ORDER BY fecha_creacion DESC
        `, [idNum])
    ]);

    return {
        rol: 'candidato',
        usuario: candidato,
        postulaciones,
        inscripciones,
        hilos,
        comentarios,
        opiniones,
        reportes,
        sanciones
    };
}

// ==========================================================
// 3. ADMINISTRACIÓN Y APROBACIÓN DE EMPRESAS (Págs. 6-7, 36-38, 97-99)
// ==========================================================

async function listarEmpresasAdmin(filtros = {}) {
    const condiciones = [];
    const valores = [];

    if (texto(filtros.q)) {
        valores.push(`%${texto(filtros.q)}%`);
        condiciones.push(`(e.nombre ILIKE $${valores.length} OR e.representante ILIKE $${valores.length} OR e.correo ILIKE $${valores.length})`);
    }
    if (texto(filtros.estadoAprobacion)) {
        valores.push(texto(filtros.estadoAprobacion));
        condiciones.push(`e.estado_aprobacion = $${valores.length}`);
    }
    if (texto(filtros.sector)) {
        valores.push(texto(filtros.sector));
        condiciones.push(`e.sector = $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const empresas = await consulta(
        `SELECT
            e.id_empresa::int AS id,
            e.nombre,
            COALESCE(e.razon_social, e.nombre || ', S.A. de C.V.') AS "razonSocial",
            COALESCE(e.nit, '0614-000000-000-0') AS nit,
            COALESCE(e.representante, 'Representante Legal') AS representante,
            COALESCE(e.correo, 'contacto@empresa.com') AS correo,
            e.telefono,
            e.sector,
            e.ubicacion,
            e.descripcion,
            e.estado,
            e.estado_aprobacion AS "estadoAprobacion",
            e.estado_verificacion AS "estadoVerificacion",
            e.motivo_rechazo AS "motivoRechazo",
            e.aprobada_en AS "aprobadaEn",
            e.aprobada_por AS "aprobadaPor",
            e.fecha_registro AS "fechaRegistro",
            (SELECT COUNT(*)::int FROM vacantes v WHERE v.empresa_id = e.id_empresa) AS "totalVacantes",
            (SELECT COUNT(*)::int FROM vacantes v WHERE v.empresa_id = e.id_empresa AND v.estado = 'publicada' AND v.estado_moderacion = 'normal') AS "vacantesActivas"
         FROM empresas e
         ${where}
         ORDER BY
            CASE WHEN e.estado_aprobacion IN ('pendiente', 'en_correccion') THEN 0 ELSE 1 END,
            e.id_empresa ASC`,
        valores
    );

    const [conteos] = await consulta(`
        SELECT
            COUNT(*)::int AS todas,
            COUNT(*) FILTER (WHERE estado_aprobacion = 'pendiente')::int AS pendientes,
            COUNT(*) FILTER (WHERE estado_aprobacion = 'en_correccion')::int AS "enCorreccion",
            COUNT(*) FILTER (WHERE estado_aprobacion = 'aprobada')::int AS aprobadas,
            COUNT(*) FILTER (WHERE estado_aprobacion = 'rechazada')::int AS rechazadas,
            COUNT(*) FILTER (WHERE estado_aprobacion = 'suspendida')::int AS suspendidas
        FROM empresas
    `);

    return { empresas, conteos };
}

async function obtenerExpedienteEmpresa(idEmpresa) {
    if (!idValido(idEmpresa)) return null;
    const idNum = Number(idEmpresa);

    const [empresa] = await consulta(
        `SELECT
            e.id_empresa::int AS id,
            e.nombre,
            COALESCE(e.razon_social, e.nombre || ', S.A. de C.V.') AS "razonSocial",
            COALESCE(e.nit, '0614-000000-000-0') AS nit,
            COALESCE(e.representante, 'Representante Legal') AS representante,
            COALESCE(e.correo, 'contacto@empresa.com') AS correo,
            e.telefono,
            e.sector,
            e.ubicacion,
            e.descripcion,
            e.estado,
            e.estado_aprobacion AS "estadoAprobacion",
            e.estado_verificacion AS "estadoVerificacion",
            e.motivo_rechazo AS "motivoRechazo",
            e.aprobada_en AS "aprobadaEn",
            e.aprobada_por AS "aprobadaPor",
            e.fecha_registro AS "fechaRegistro"
         FROM empresas e
         WHERE e.id_empresa = $1
         LIMIT 1`,
        [idNum]
    );

    if (!empresa) return null;

    const [vacantes, historialDecisiones, opiniones, reportes] = await Promise.all([
        consulta(`
            SELECT id_vacante::int AS id, titulo, ubicacion, modalidad, estado,
                   estado_moderacion AS "estadoModeracion", fecha_publicacion AS "fechaPublicacion",
                   fecha_cierre AS "fechaCierre",
                   (SELECT COUNT(*)::int FROM postulaciones p WHERE p.vacante_id = vacantes.id_vacante) AS postulaciones
            FROM vacantes
            WHERE empresa_id = $1
            ORDER BY fecha_publicacion DESC
        `, [idNum]),
        consulta(`
            SELECT id_solicitud_empresa::int AS id,
                   notas_solicitante AS "notasSolicitante", estado, motivo_decision AS "motivoDecision",
                   revisado_por AS "revisadoPor", fecha_solicitud AS "fechaSolicitud", fecha_revision AS "fechaRevision"
            FROM solicitudes_empresas
            WHERE empresa_id = $1
            ORDER BY COALESCE(fecha_revision, fecha_solicitud) DESC, id_solicitud_empresa DESC
        `, [idNum]),
        consulta(`
            SELECT val.id_valoracion::int AS id, val.puntuacion, val.titulo, val.comentario,
                   val.estado_moderacion AS "estadoModeracion", val.fecha_valoracion AS fecha,
                   c.nombre AS candidato
            FROM valoraciones val
            JOIN candidatos c ON c.id_candidato = val.candidato_id
            WHERE val.empresa_id = $1
            ORDER BY val.fecha_valoracion DESC
        `, [idNum]),
        consulta(`
            SELECT id_reporte::int AS id, tipo_contenido AS "tipoContenido", contenido_resumen AS resumen,
                   motivo, estado, resolucion, fecha_creacion AS fecha
            FROM reportes
            WHERE (tipo_contenido = 'empresa' AND contenido_id = $1)
               OR LOWER(usuario_reportado_nombre) = LOWER($2)
            ORDER BY fecha_creacion DESC
        `, [idNum, empresa.nombre])
    ]);

    return {
        rol: 'empresa',
        empresa,
        vacantes,
        historialDecisiones,
        opiniones,
        reportes
    };
}

async function decidirEstadoEmpresa(idEmpresa, accion, motivo = '') {
    if (!idValido(idEmpresa)) return null;
    const idNum = Number(idEmpresa);
    const motivoLimpio = texto(motivo);

    const [empresa] = await consulta(
        'SELECT id_empresa::int AS id, nombre, estado, estado_aprobacion AS "estadoAprobacion" FROM empresas WHERE id_empresa = $1',
        [idNum]
    );
    if (!empresa) return null;

    // Pág. 38 y 99: Rechazar, solicitar corrección o suspender exige motivo obligatorio.
    if (['rechazar', 'correccion', 'suspender'].includes(accion) && !motivoLimpio) {
        throw new Error('Debes indicar el motivo u observación para esta decisión administrativa.');
    }

    const mapeo = {
        aprobar: {
            estadoBd: 'activa',
            estadoAprobacion: 'aprobada',
            estadoVerificacion: 'verificada',
            accionLog: 'APROBAR_EMPRESA',
            tituloNotif: 'Solicitud empresarial aprobada'
        },
        correccion: {
            estadoBd: 'pendiente',
            estadoAprobacion: 'en_correccion',
            estadoVerificacion: 'en_revision',
            accionLog: 'SOLICITAR_CORRECCION_EMPRESA',
            tituloNotif: 'Solicitud de corrección en tu registro empresarial'
        },
        rechazar: {
            estadoBd: 'inactiva',
            estadoAprobacion: 'rechazada',
            estadoVerificacion: 'no_verificada',
            accionLog: 'RECHAZAR_EMPRESA',
            tituloNotif: 'Solicitud empresarial rechazada'
        },
        suspender: {
            estadoBd: 'inactiva',
            estadoAprobacion: 'suspendida',
            estadoVerificacion: 'en_revision',
            accionLog: 'SUSPENDER_EMPRESA',
            tituloNotif: 'Cuenta empresarial suspendida'
        },
        reactivar: {
            estadoBd: 'activa',
            estadoAprobacion: 'aprobada',
            estadoVerificacion: 'verificada',
            accionLog: 'REACTIVAR_EMPRESA',
            tituloNotif: 'Cuenta empresarial reactivada'
        }
    };

    const config = mapeo[accion];
    if (!config) throw new Error('Acción empresarial no válida.');

    const [actualizada] = await consulta(
        `UPDATE empresas
         SET estado = $2,
             estado_aprobacion = $3,
             estado_verificacion = $4,
             motivo_rechazo = $5,
             aprobada_en = CASE WHEN $3 = 'aprobada' THEN CURRENT_TIMESTAMP ELSE aprobada_en END,
             aprobada_por = $6
         WHERE id_empresa = $1
         RETURNING id_empresa::int AS id, nombre, estado, estado_aprobacion AS "estadoAprobacion",
                   estado_verificacion AS "estadoVerificacion", motivo_rechazo AS "motivoRechazo"`,
        [
            idNum,
            config.estadoBd,
            config.estadoAprobacion,
            config.estadoVerificacion,
            motivoLimpio || null,
            ADMIN_ACTUAL.nombre
        ]
    );

    // Conservar siempre el expediente en el historial (Pág. 97 y 99)
    await consulta(
        `INSERT INTO solicitudes_empresas (empresa_id, documento_url, notas_solicitante, estado, motivo_decision, revisado_por, fecha_revision)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
            idNum,
            `https://talentohub.edu.sv/docs/registro-mercantil-${idNum}.pdf`,
            `Revisión administrativa de ${empresa.nombre}`,
            config.estadoAprobacion,
            motivoLimpio || 'Aprobación administrativa verificada.',
            ADMIN_ACTUAL.nombre
        ]
    );

    await registrarAuditoria({
        accion: config.accionLog,
        entidadTipo: 'empresa',
        entidadId: idNum,
        descripcion: `Decisión sobre empresa "${empresa.nombre}": ${config.estadoAprobacion}.${motivoLimpio ? ' Motivo: ' + motivoLimpio : ''}`,
        valoresAnteriores: { estado: empresa.estado, estadoAprobacion: empresa.estadoAprobacion },
        valoresNuevos: { estado: config.estadoBd, estadoAprobacion: config.estadoAprobacion, motivo: motivoLimpio }
    });

    await consulta(
        `INSERT INTO notificaciones (destinatario_tipo, destinatario_id, titulo, mensaje, tipo_evento, referencia_url)
         VALUES ('empresas', $1, $2, $3, 'decision_empresa', '/empresarial/empresas')`,
        [
            idNum,
            config.tituloNotif,
            motivoLimpio
                ? `${config.tituloNotif} (${empresa.nombre}): ${motivoLimpio}`
                : `La empresa ${empresa.nombre} ha sido autorizada para operar en TalentoHub.`
        ]
    );

    return actualizada;
}

async function moderarVacante(idVacante, accion, motivo = '') {
    // RN-ADM-07: El administrador NO modifica salario, descripción ni estado empresarial; solo cambia estado_moderacion ('normal' / 'oculta')
    if (!idValido(idVacante)) return null;
    const idNum = Number(idVacante);

    const [vacante] = await consulta(
        'SELECT id_vacante::int AS id, titulo, empresa_id::int AS "empresaId", estado, estado_moderacion AS "estadoModeracion" FROM vacantes WHERE id_vacante = $1',
        [idNum]
    );
    if (!vacante) return null;

    const ocultar = accion === 'ocultar';
    const motivoLimpio = texto(motivo);
    if (ocultar && !motivoLimpio) {
        throw new Error('Para ocultar una vacante por incumplimiento debes registrar el motivo de moderación.');
    }

    const nuevoEstadoMod = ocultar ? 'oculta' : 'normal';

    const [actualizada] = await consulta(
        `UPDATE vacantes
         SET estado_moderacion = $2,
             motivo_moderacion = $3,
             moderada_por = $4,
             moderada_en = CURRENT_TIMESTAMP
         WHERE id_vacante = $1
         RETURNING id_vacante::int AS id, titulo, estado AS "estadoEmpresarial",
                   estado_moderacion AS "estadoModeracion", motivo_moderacion AS "motivoModeracion"`,
        [idNum, nuevoEstadoMod, ocultar ? motivoLimpio : null, ADMIN_ACTUAL.nombre]
    );

    await registrarAuditoria({
        accion: ocultar ? 'OCULTAR_VACANTE' : 'RESTAURAR_VACANTE',
        entidadTipo: 'vacante',
        entidadId: idNum,
        descripcion: `${ocultar ? 'Se ocultó' : 'Se restauró'} la vacante "${vacante.titulo}" (conservando estado empresarial "${vacante.estado}").${motivoLimpio ? ' Motivo: ' + motivoLimpio : ''}`,
        valoresAnteriores: { estadoModeracion: vacante.estadoModeracion, estadoEmpresarial: vacante.estado },
        valoresNuevos: { estadoModeracion: nuevoEstadoMod, estadoEmpresarial: vacante.estado, motivo: motivoLimpio }
    });

    await consulta(
        `INSERT INTO notificaciones (destinatario_tipo, destinatario_id, titulo, mensaje, tipo_evento, referencia_url)
         VALUES ('empresas', $1, $2, $3, 'moderacion_vacante', '/empresarial/vacantes')`,
        [
            vacante.empresaId,
            ocultar ? `Vacante ocultada por moderación: ${vacante.titulo}` : `Vacante restaurada: ${vacante.titulo}`,
            ocultar
                ? `La administración ocultó temporalmente la vacante "${vacante.titulo}". Motivo: ${motivoLimpio}. Corrígela para solicitar su restauración.`
                : `La vacante "${vacante.titulo}" ha sido restaurada y vuelve a estar visible según su vigencia.`
        ]
    );

    return actualizada;
}

// ==========================================================
// 5. BIBLIOTECA DIGITAL, RECURSOS Y ARTÍCULOS (Págs. 8-10, 12-13, 100-104, 109-110)
// ==========================================================

async function listarRecursosAdmin(filtros = {}) {
    const condiciones = [];
    const valores = [];

    if (texto(filtros.q)) {
        valores.push(`%${texto(filtros.q)}%`);
        condiciones.push(`(r.titulo ILIKE $${valores.length} OR r.resumen ILIKE $${valores.length} OR r.autor ILIKE $${valores.length})`);
    }
    if (filtros.categoriaId && idValido(filtros.categoriaId)) {
        valores.push(Number(filtros.categoriaId));
        condiciones.push(`r.categoria_id = $${valores.length}`);
    }
    if (texto(filtros.estado)) {
        valores.push(texto(filtros.estado));
        condiciones.push(`r.estado = $${valores.length}`);
    }
    if (texto(filtros.tipo)) {
        valores.push(texto(filtros.tipo));
        condiciones.push(`r.tipo = $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const [recursos, categorias] = await Promise.all([
        consulta(
            `SELECT
                r.id_recurso::int AS id,
                r.titulo,
                COALESCE(r.slug, 'recurso-' || r.id_recurso) AS slug,
                r.resumen,
                r.tipo,
                r.subtipo_material AS "subtipoMaterial",
                r.imagen_url AS "imagenUrl",
                r.archivo_url AS "archivoUrl",
                r.autor,
                r.tiempo_lectura AS "tiempoLectura",
                r.nivel,
                COALESCE(r.etiquetas, '{}') AS etiquetas,
                r.visibilidad,
                r.estado,
                r.destacado,
                r.vistas,
                r.descargas,
                r.fecha_publicacion AS "fechaPublicacion",
                c.id_categoria::int AS "categoriaId",
                c.nombre AS categoria,
                (SELECT COUNT(*)::int FROM secciones_recursos s WHERE s.recurso_id = r.id_recurso) AS "totalSecciones"
             FROM recursos r
             JOIN categorias_recursos c ON c.id_categoria = r.categoria_id
             ${where}
             ORDER BY r.destacado DESC, r.fecha_publicacion DESC, r.id_recurso DESC`,
            valores
        ),
        consulta('SELECT id_categoria::int AS id, nombre, descripcion, estado FROM categorias_recursos ORDER BY nombre ASC')
    ]);

    return { recursos, categorias };
}

async function guardarRecursoAdmin(datos, idRecurso = null) {
    const titulo = texto(datos.titulo);
    const resumen = texto(datos.resumen);
    const contenido = texto(datos.contenido);
    const archivoUrl = texto(datos.archivoUrl);
    const imagenUrl = texto(datos.imagenUrl) || 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80';
    const categoriaId = idValido(datos.categoriaId) ? Number(datos.categoriaId) : 1;
    const tipo = ['articulo', 'tutorial', 'video', 'audio'].includes(datos.tipo) ? datos.tipo : 'articulo';
    const subtipoMaterial = texto(datos.subtipoMaterial) || (tipo === 'tutorial' ? 'pdf' : tipo);
    const nivel = ['basico', 'intermedio', 'avanzado'].includes(datos.nivel) ? datos.nivel : 'basico';
    const visibilidad = ['publico', 'curso'].includes(datos.visibilidad) ? datos.visibilidad : 'publico';
    const estado = ['borrador', 'publicado', 'archivado'].includes(datos.estado) ? datos.estado : 'publicado';
    const destacado = Boolean(datos.destacado);
    const autor = texto(datos.autor) || 'Equipo Editorial TalentoHub';
    const tiempoLectura = Math.max(1, Number(datos.tiempoLectura) || 5);
    const etiquetas = Array.isArray(datos.etiquetas)
        ? datos.etiquetas.map(texto).filter(Boolean)
        : texto(datos.etiquetas).split(',').map(texto).filter(Boolean);

    if (!titulo) throw new Error('El título del recurso o artículo es obligatorio.');
    if (!resumen) throw new Error('El resumen o descripción es obligatorio.');

    // Regla pág. 32: Impedir que un recurso sin archivo o contenido válido se publique.
    if (estado === 'publicado' && !contenido && !archivoUrl) {
        throw new Error('No se puede publicar un recurso o artículo vacío sin archivo adjunto, enlace o contenido válido (Regla de validación pág. 32).');
    }

    const slug = generarSlug(datos.slug || titulo);

    if (idRecurso && idValido(idRecurso)) {
        const idNum = Number(idRecurso);
        const [actualizado] = await consulta(
            `UPDATE recursos
             SET categoria_id = $2, titulo = $3, slug = $4, resumen = $5, tipo = $6,
                 subtipo_material = $7, imagen_url = $8, archivo_url = $9, autor = $10,
                 tiempo_lectura = $11, nivel = $12, etiquetas = $13, visibilidad = $14,
                 estado = $15, destacado = $16
             WHERE id_recurso = $1
             RETURNING id_recurso::int AS id, titulo, estado`,
            [
                idNum, categoriaId, titulo, slug, resumen, tipo,
                subtipoMaterial, imagenUrl, archivoUrl || null, autor,
                tiempoLectura, nivel, etiquetas, visibilidad, estado, destacado
            ]
        );

        if (contenido) {
            await consulta(
                `INSERT INTO secciones_recursos (recurso_id, titulo, contenido, orden)
                 VALUES ($1, $2, $3, 1)
                 ON CONFLICT (recurso_id, orden)
                 DO UPDATE SET titulo = EXCLUDED.titulo, contenido = EXCLUDED.contenido`,
                [idNum, datos.tituloSeccion || 'Contenido principal', contenido]
            );
        }

        await registrarAuditoria({
            accion: 'EDITAR_RECURSO',
            entidadTipo: 'recurso',
            entidadId: idNum,
            descripcion: `Se actualizó el recurso/artículo "${titulo}" (${estado}).`
        });
        return actualizado;
    }

    const [nuevo] = await consulta(
        `INSERT INTO recursos (
            categoria_id, titulo, slug, resumen, tipo, subtipo_material,
            imagen_url, archivo_url, autor, tiempo_lectura, nivel, etiquetas,
            visibilidad, estado, destacado, fecha_publicacion
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
         RETURNING id_recurso::int AS id, titulo, estado, tipo`,
        [
            categoriaId, titulo, `${slug}-${Date.now().toString().slice(-4)}`, resumen, tipo, subtipoMaterial,
            imagenUrl, archivoUrl || null, autor, tiempoLectura, nivel, etiquetas,
            visibilidad, estado, destacado
        ]
    );

    if (contenido) {
        await consulta(
            `INSERT INTO secciones_recursos (recurso_id, titulo, contenido, orden)
             VALUES ($1, $2, $3, 1)`,
            [nuevo.id, texto(datos.tituloSeccion) || 'Desarrollo del tema', contenido]
        );
    }

    await registrarAuditoria({
        accion: 'CREAR_RECURSO',
        entidadTipo: 'recurso',
        entidadId: nuevo.id,
        descripcion: `Se creó el recurso/artículo "${titulo}" en estado "${estado}".`,
        valoresNuevos: nuevo
    });

    return nuevo;
}

async function cambiarEstadoRecursoAdmin(idRecurso, nuevoEstado) {
    if (!idValido(idRecurso) || !['borrador', 'publicado', 'archivado'].includes(nuevoEstado)) return null;
    const idNum = Number(idRecurso);

    if (nuevoEstado === 'publicado') {
        const [rec] = await consulta(
            `SELECT r.archivo_url, (SELECT COUNT(*)::int FROM secciones_recursos s WHERE s.recurso_id = r.id_recurso) AS secciones
             FROM recursos r WHERE r.id_recurso = $1`,
            [idNum]
        );
        if (rec && !rec.archivo_url && rec.secciones === 0) {
            throw new Error('No se puede publicar un recurso sin archivo ni secciones de contenido.');
        }
    }

    const [actualizado] = await consulta(
        `UPDATE recursos SET estado = $2 WHERE id_recurso = $1
         RETURNING id_recurso::int AS id, titulo, estado`,
        [idNum, nuevoEstado]
    );

    if (actualizado) {
        await registrarAuditoria({
            accion: 'CAMBIAR_ESTADO_RECURSO',
            entidadTipo: 'recurso',
            entidadId: idNum,
            descripcion: `El recurso "${actualizado.titulo}" cambió a estado "${nuevoEstado}".`
        });
    }
    return actualizadaO(actualizado);
}

function actualizadaO(valor) {
    return valor || null;
}

async function alternarDestacadoRecurso(idRecurso) {
    if (!idValido(idRecurso)) return null;
    const [actualizado] = await consulta(
        `UPDATE recursos SET destacado = NOT destacado WHERE id_recurso = $1
         RETURNING id_recurso::int AS id, titulo, destacado`,
        [Number(idRecurso)]
    );
    return actualizado || null;
}

async function crearCategoriaRecurso(datos) {
    const nombre = texto(datos.nombre);
    const descripcion = texto(datos.descripcion);
    if (!nombre) throw new Error('El nombre de la categoría es obligatorio.');

    const [cat] = await consulta(
        `INSERT INTO categorias_recursos (nombre, descripcion, estado)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion, estado = TRUE
         RETURNING id_categoria::int AS id, nombre, descripcion, estado`,
        [nombre, descripcion || 'Categoría educativa']
    );

    await registrarAuditoria({
        accion: 'CREAR_CATEGORIA_RECURSO',
        entidadTipo: 'categoria_recurso',
        entidadId: cat.id,
        descripcion: `Se registró la categoría de biblioteca "${cat.nombre}".`
    });
    return cat;
}

// ==========================================================
// 6. CURSOS, CAPACITACIONES Y EXÁMENES - LMS (Págs. 10-12, 104-109, RN-07, RN-11)
// ==========================================================

async function listarCursosAdmin() {
    const cursos = await consulta(`
        SELECT
            c.id_curso::int AS id,
            c.titulo,
            c.slug,
            c.descripcion,
            c.objetivos,
            c.portada_url AS "portadaUrl",
            c.categoria_id::int AS "categoriaId",
            cat.nombre AS categoria,
            c.nivel,
            c.duracion_minutos AS "duracionMinutos",
            c.autor,
            c.estado,
            c.fecha_publicacion AS "fechaPublicacion",
            (SELECT COUNT(*)::int FROM modulos_curso m WHERE m.curso_id = c.id_curso) AS "totalModulos",
            (SELECT COUNT(*)::int FROM lecciones_curso l JOIN modulos_curso m ON m.id_modulo = l.modulo_id WHERE m.curso_id = c.id_curso) AS "totalLecciones",
            (SELECT COUNT(*)::int FROM inscripciones_curso i WHERE i.curso_id = c.id_curso) AS "totalInscritos",
            (SELECT COUNT(*)::int FROM inscripciones_curso i WHERE i.curso_id = c.id_curso AND i.estado = 'completada') AS "totalCompletados",
            (SELECT COUNT(*)::int FROM examenes ex WHERE ex.curso_id = c.id_curso) AS "totalExamenes"
        FROM cursos c
        LEFT JOIN categorias_recursos cat ON cat.id_categoria = c.categoria_id
        ORDER BY c.id_curso ASC
    `);
    return cursos;
}

async function obtenerCursoCompleto(idCurso) {
    if (!idValido(idCurso)) return null;
    const idNum = Number(idCurso);

    const [curso] = await consulta(
        `SELECT
            c.id_curso::int AS id,
            c.titulo,
            c.slug,
            c.descripcion,
            c.objetivos,
            c.portada_url AS "portadaUrl",
            c.categoria_id::int AS "categoriaId",
            cat.nombre AS categoria,
            c.nivel,
            c.duracion_minutos AS "duracionMinutos",
            c.requisitos_previos AS "requisitosPrevios",
            c.autor,
            c.estado,
            c.fecha_publicacion AS "fechaPublicacion"
         FROM cursos c
         LEFT JOIN categorias_recursos cat ON cat.id_categoria = c.categoria_id
         WHERE c.id_curso = $1
         LIMIT 1`,
        [idNum]
    );
    if (!curso) return null;

    const [modulos, lecciones, inscritos, examenes] = await Promise.all([
        consulta(
            `SELECT id_modulo::int AS id, curso_id::int AS "cursoId", titulo, descripcion, orden, estado
             FROM modulos_curso WHERE curso_id = $1 ORDER BY orden ASC, id_modulo ASC`,
            [idNum]
        ),
        consulta(
            `SELECT
                l.id_leccion::int AS id,
                l.modulo_id::int AS "moduloId",
                l.titulo,
                l.descripcion,
                l.contenido,
                l.video_url AS "videoUrl",
                l.adjunto_url AS "adjuntoUrl",
                l.recurso_biblioteca_id::int AS "recursoBibliotecaId",
                r.titulo AS "recursoBibliotecaTitulo",
                l.duracion_minutos AS "duracionMinutos",
                l.orden,
                l.obligatoria,
                l.estado
             FROM lecciones_curso l
             JOIN modulos_curso m ON m.id_modulo = l.modulo_id
             LEFT JOIN recursos r ON r.id_recurso = l.recurso_biblioteca_id
             WHERE m.curso_id = $1
             ORDER BY m.orden ASC, l.orden ASC, l.id_leccion ASC`,
            [idNum]
        ),
        consulta(
            `SELECT
                i.id_inscripcion::int AS id,
                i.candidato_id::int AS "candidatoId",
                cand.nombre AS candidato,
                cand.correo,
                i.porcentaje_avance AS "porcentajeAvance",
                i.estado,
                i.fecha_inscripcion AS "fechaInscripcion",
                i.ultima_actividad AS "ultimaActividad",
                i.fecha_completado AS "fechaCompletado"
             FROM inscripciones_curso i
             JOIN candidatos cand ON cand.id_candidato = i.candidato_id
             WHERE i.curso_id = $1
             ORDER BY i.fecha_inscripcion DESC`,
            [idNum]
        ),
        consulta(
            `SELECT
                ex.id_examen::int AS id,
                ex.titulo,
                ex.nota_minima AS "notaMinima",
                ex.intentos_maximos AS "intentosMaximos",
                ex.tiempo_limite_min AS "tiempoLimiteMin",
                ex.estado,
                (SELECT COUNT(*)::int FROM preguntas_examen p WHERE p.examen_id = ex.id_examen) AS "totalPreguntas"
             FROM examenes ex
             WHERE ex.curso_id = $1
             ORDER BY ex.id_examen ASC`,
            [idNum]
        )
    ]);

    const modulosConLecciones = modulos.map(m => ({
        ...m,
        lecciones: lecciones.filter(l => l.moduloId === m.id)
    }));

    return {
        ...curso,
        modulos: modulosConLecciones,
        lecciones,
        inscritos,
        examenes
    };
}

async function crearCurso(datos) {
    const titulo = texto(datos.titulo);
    const descripcion = texto(datos.descripcion);
    const objetivos = texto(datos.objetivos);
    const categoriaId = idValido(datos.categoriaId) ? Number(datos.categoriaId) : 1;
    const nivel = ['basico', 'intermedio', 'avanzado'].includes(datos.nivel) ? datos.nivel : 'basico';
    const duracionMinutos = Math.max(10, Number(datos.duracionMinutos) || 60);
    const autor = texto(datos.autor) || 'Equipo Académico TalentoHub';
    const portadaUrl = texto(datos.portadaUrl) || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80';

    if (!titulo || !descripcion) {
        throw new Error('El título y la descripción del curso son obligatorios.');
    }

    const slug = `${generarSlug(titulo)}-${Date.now().toString().slice(-4)}`;

    // Todo curso nuevo inicia en borrador hasta que tenga módulos y lecciones (RN-07 / Pág. 106)
    const [curso] = await consulta(
        `INSERT INTO cursos (
            titulo, slug, descripcion, objetivos, portada_url, categoria_id,
            nivel, duracion_minutos, requisitos_previos, autor, estado
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'borrador')
         RETURNING id_curso::int AS id, titulo, slug, estado`,
        [
            titulo, slug, descripcion, objetivos || null, portadaUrl, categoriaId,
            nivel, duracionMinutos, texto(datos.requisitosPrevios) || null, autor
        ]
    );

    await registrarAuditoria({
        accion: 'CREAR_CURSO',
        entidadTipo: 'curso',
        entidadId: curso.id,
        descripcion: `Se creó el curso "${curso.titulo}" en estado borrador.`
    });

    return curso;
}

async function agregarModuloCurso(cursoId, datos) {
    if (!idValido(cursoId)) throw new Error('Curso inválido.');
    const titulo = texto(datos.titulo);
    if (!titulo) throw new Error('El título del módulo es obligatorio.');

    const [maxOrden] = await consulta(
        'SELECT COALESCE(MAX(orden), 0)::int AS max FROM modulos_curso WHERE curso_id = $1',
        [Number(cursoId)]
    );
    const orden = Number(datos.orden) || (maxOrden.max + 1);

    const [modulo] = await consulta(
        `INSERT INTO modulos_curso (curso_id, titulo, descripcion, orden, estado)
         VALUES ($1, $2, $3, $4, 'activo')
         RETURNING id_modulo::int AS id, curso_id::int AS "cursoId", titulo, orden`,
        [Number(cursoId), titulo, texto(datos.descripcion) || null, orden]
    );

    await registrarAuditoria({
        accion: 'AGREGAR_MODULO_CURSO',
        entidadTipo: 'modulo_curso',
        entidadId: modulo.id,
        descripcion: `Se agregó el módulo "${modulo.titulo}" al curso #${cursoId}.`
    });
    return modulo;
}

async function agregarLeccionModulo(moduloId, datos) {
    if (!idValido(moduloId)) throw new Error('Módulo inválido.');
    const titulo = texto(datos.titulo);
    const contenido = texto(datos.contenido);
    if (!titulo || !contenido) {
        throw new Error('El título y el contenido de la lección son obligatorios.');
    }

    const [maxOrden] = await consulta(
        'SELECT COALESCE(MAX(orden), 0)::int AS max FROM lecciones_curso WHERE modulo_id = $1',
        [Number(moduloId)]
    );
    const orden = Number(datos.orden) || (maxOrden.max + 1);
    const recursoId = idValido(datos.recursoBibliotecaId) ? Number(datos.recursoBibliotecaId) : null;

    const [leccion] = await consulta(
        `INSERT INTO lecciones_curso (
            modulo_id, titulo, descripcion, contenido, video_url, adjunto_url,
            recurso_biblioteca_id, duracion_minutos, orden, obligatoria, estado
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'publicada')
         RETURNING id_leccion::int AS id, modulo_id::int AS "moduloId", titulo, orden, estado`,
        [
            Number(moduloId),
            titulo,
            texto(datos.descripcion) || null,
            contenido,
            texto(datos.videoUrl) || null,
            texto(datos.adjuntoUrl) || null,
            recursoId,
            Math.max(5, Number(datos.duracionMinutos) || 15),
            orden,
            datos.obligatoria !== 'false' && datos.obligatoria !== false
        ]
    );

    await registrarAuditoria({
        accion: 'AGREGAR_LECCION_CURSO',
        entidadTipo: 'leccion_curso',
        entidadId: leccion.id,
        descripcion: `Se agregó la lección "${leccion.titulo}" al módulo #${moduloId}.`
    });
    return leccion;
}

async function cambiarEstadoCurso(idCurso, nuevoEstado) {
    if (!idValido(idCurso) || !['borrador', 'publicado', 'archivado'].includes(nuevoEstado)) return null;
    const idNum = Number(idCurso);

    const curso = await obtenerCursoCompleto(idNum);
    if (!curso) return null;

    // RN-07 y Pág. 106-107: Requisitos obligatorios antes de publicar un curso
    if (nuevoEstado === 'publicado') {
        const leccionesPublicadas = curso.lecciones.filter(l => l.estado === 'publicada');
        if (!curso.titulo || !curso.descripcion || !curso.objetivos) {
            throw new Error('Para publicar el curso debe tener título, descripción y objetivos definidos (Pág. 106).');
        }
        if (curso.modulos.length === 0 || leccionesPublicadas.length === 0) {
            throw new Error('No se puede publicar un curso vacío: debe tener al menos un módulo y una lección disponible (RN-07 / Pág. 106).');
        }
    }

    const [actualizado] = await consulta(
        `UPDATE cursos
         SET estado = $2,
             fecha_publicacion = CASE WHEN $2 = 'publicado' AND fecha_publicacion IS NULL THEN CURRENT_TIMESTAMP ELSE fecha_publicacion END,
             fecha_actualizacion = CURRENT_TIMESTAMP
         WHERE id_curso = $1
         RETURNING id_curso::int AS id, titulo, estado`,
        [idNum, nuevoEstado]
    );

    await registrarAuditoria({
        accion: `CURSO_${nuevoEstado.toUpperCase()}`,
        entidadTipo: 'curso',
        entidadId: idNum,
        descripcion: `El curso "${curso.titulo}" cambió a estado "${nuevoEstado}".`
    });

    return actualizado;
}

async function inscribirCandidatoCurso(cursoId, candidatoId) {
    if (!idValido(cursoId) || !idValido(candidatoId)) throw new Error('Datos de inscripción inválidos.');

    const [curso] = await consulta('SELECT id_curso::int AS id, titulo, estado FROM cursos WHERE id_curso = $1', [Number(cursoId)]);
    if (!curso) throw new Error('El curso no existe.');

    // Regla pág. 31 y 106: Un curso archivado o en borrador no acepta nuevas inscripciones.
    if (curso.estado !== 'publicado') {
        throw new Error('Este curso no acepta nuevas inscripciones porque no se encuentra publicado (Regla pág. 31 / 106).');
    }

    const [inscripcion] = await consulta(
        `INSERT INTO inscripciones_curso (curso_id, candidato_id, porcentaje_avance, estado)
         VALUES ($1, $2, 0, 'activa')
         ON CONFLICT (curso_id, candidato_id)
         DO UPDATE SET ultima_actividad = CURRENT_TIMESTAMP
         RETURNING id_inscripcion::int AS id, curso_id::int AS "cursoId", candidato_id::int AS "candidatoId", porcentaje_avance AS "porcentajeAvance", estado`,
        [Number(cursoId), Number(candidatoId)]
    );

    await consulta(
        `INSERT INTO notificaciones (destinatario_tipo, destinatario_id, titulo, mensaje, tipo_evento, referencia_url)
         VALUES ('candidatos', $1, $2, $3, 'inscripcion_curso', $4)`,
        [
            Number(candidatoId),
            `Inscripción confirmada: ${curso.titulo}`,
            `Te has inscrito exitosamente en el curso "${curso.titulo}".`,
            `/administrativo/cursos/${curso.id}`
        ]
    );

    return inscripcion;
}

async function completarLeccionCandidato(inscripcionId, leccionId) {
    if (!idValido(inscripcionId) || !idValido(leccionId)) throw new Error('Parámetros inválidos.');
    const idInsc = Number(inscripcionId);
    const idLec = Number(leccionId);

    const [insc] = await consulta(
        'SELECT id_inscripcion::int AS id, curso_id::int AS "cursoId", candidato_id::int AS "candidatoId", estado FROM inscripciones_curso WHERE id_inscripcion = $1',
        [idInsc]
    );
    if (!insc) throw new Error('Inscripción no encontrada.');

    await consulta(
        `INSERT INTO progreso_lecciones (inscripcion_id, leccion_id, completada)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (inscripcion_id, leccion_id) DO UPDATE SET completada = TRUE, fecha_completado = CURRENT_TIMESTAMP`,
        [idInsc, idLec]
    );

    // Calcular avance sobre todas las lecciones obligatorias del curso (RN-11)
    const [conteo] = await consulta(
        `SELECT
            COUNT(l.id_leccion)::int AS obligatorias,
            COUNT(pl.id_progreso)::int AS completadas
         FROM lecciones_curso l
         JOIN modulos_curso m ON m.id_modulo = l.modulo_id
         LEFT JOIN progreso_lecciones pl ON pl.leccion_id = l.id_leccion AND pl.inscripcion_id = $2 AND pl.completada = TRUE
         WHERE m.curso_id = $1 AND l.obligatoria = TRUE AND l.estado = 'publicada'`,
        [insc.cursoId, idInsc]
    );

    const porcentaje = conteo.obligatorias > 0
        ? Math.min(100, Math.round((conteo.completadas / conteo.obligatorias) * 100))
        : 100;
    const nuevoEstado = porcentaje === 100 ? 'completada' : 'activa';

    const [actualizada] = await consulta(
        `UPDATE inscripciones_curso
         SET porcentaje_avance = $2,
             estado = $3,
             ultima_actividad = CURRENT_TIMESTAMP,
             fecha_completado = CASE WHEN $3 = 'completada' THEN CURRENT_TIMESTAMP ELSE fecha_completado END
         WHERE id_inscripcion = $1
         RETURNING id_inscripcion::int AS id, porcentaje_avance AS "porcentajeAvance", estado`,
        [idInsc, porcentaje, nuevoEstado]
    );

    return actualizada;
}

// Exámenes y Evaluaciones (Págs. 107-109)

async function listarExamenesAdmin() {
    return consulta(`
        SELECT
            ex.id_examen::int AS id,
            ex.curso_id::int AS "cursoId",
            c.titulo AS curso,
            ex.titulo,
            ex.descripcion,
            ex.nota_minima AS "notaMinima",
            ex.intentos_maximos AS "intentosMaximos",
            ex.tiempo_limite_min AS "tiempoLimiteMin",
            ex.mostrar_resultados AS "mostrarResultados",
            ex.obligatorio,
            ex.estado,
            (SELECT COUNT(*)::int FROM preguntas_examen p WHERE p.examen_id = ex.id_examen) AS "totalPreguntas",
            (SELECT COUNT(*)::int FROM intentos_examen it WHERE it.examen_id = ex.id_examen) AS "totalIntentos",
            (SELECT COUNT(*)::int FROM intentos_examen it WHERE it.examen_id = ex.id_examen AND it.aprobado = TRUE) AS "intentosAprobados"
        FROM examenes ex
        JOIN cursos c ON c.id_curso = ex.curso_id
        ORDER BY ex.id_examen ASC
    `);
}

async function obtenerExamenCompleto(idExamen, incluirRespuestasCorrectas = true) {
    if (!idValido(idExamen)) return null;
    const idNum = Number(idExamen);

    const [examen] = await consulta(
        `SELECT
            ex.id_examen::int AS id,
            ex.curso_id::int AS "cursoId",
            c.titulo AS curso,
            ex.modulo_id::int AS "moduloId",
            ex.titulo,
            ex.descripcion,
            ex.nota_minima AS "notaMinima",
            ex.intentos_maximos AS "intentosMaximos",
            ex.tiempo_limite_min AS "tiempoLimiteMin",
            ex.mostrar_resultados AS "mostrarResultados",
            ex.obligatorio,
            ex.estado
         FROM examenes ex
         JOIN cursos c ON c.id_curso = ex.curso_id
         WHERE ex.id_examen = $1
         LIMIT 1`,
        [idNum]
    );
    if (!examen) return null;

    const [preguntas, opciones, intentos] = await Promise.all([
        consulta(
            `SELECT id_pregunta::int AS id, examen_id::int AS "examenId", enunciado, tipo, puntos, orden
             FROM preguntas_examen WHERE examen_id = $1 ORDER BY orden ASC, id_pregunta ASC`,
            [idNum]
        ),
        consulta(
            `SELECT
                o.id_opcion::int AS id,
                o.pregunta_id::int AS "preguntaId",
                o.texto,
                ${incluirRespuestasCorrectas ? 'o.es_correcta AS "esCorrecta",' : ''}
                o.orden
             FROM opciones_examen o
             JOIN preguntas_examen p ON p.id_pregunta = o.pregunta_id
             WHERE p.examen_id = $1
             ORDER BY o.orden ASC, o.id_opcion ASC`,
            [idNum]
        ),
        consulta(
            `SELECT
                it.id_intento::int AS id,
                it.candidato_id::int AS "candidatoId",
                cand.nombre AS candidato,
                it.numero_intento AS "numeroIntento",
                it.calificacion,
                it.aprobado,
                it.estado,
                it.fecha_entrega AS "fechaEntrega"
             FROM intentos_examen it
             JOIN candidatos cand ON cand.id_candidato = it.candidato_id
             WHERE it.examen_id = $1
             ORDER BY it.fecha_entrega DESC`,
            [idNum]
        )
    ]);

    return {
        ...examen,
        preguntas: preguntas.map(p => ({
            ...p,
            opciones: opciones.filter(o => o.preguntaId === p.id)
        })),
        intentos
    };
}

async function crearExamen(datos) {
    if (!idValido(datos.cursoId)) throw new Error('Selecciona el curso al que pertenece el examen.');
    const titulo = texto(datos.titulo);
    if (!titulo) throw new Error('El título de la evaluación es obligatorio.');

    const notaMinima = Math.min(Math.max(Number(datos.notaMinima) || 70, 1), 100);
    const intentosMaximos = Math.max(1, Number(datos.intentosMaximos) || 3);
    const tiempoLimiteMin = Math.max(5, Number(datos.tiempoLimiteMin) || 30);
    const estado = ['borrador', 'publicado', 'archivado'].includes(datos.estado) ? datos.estado : 'publicado';

    const [examen] = await consulta(
        `INSERT INTO examenes (
            curso_id, titulo, descripcion, nota_minima, intentos_maximos,
            tiempo_limite_min, mostrar_resultados, obligatorio, estado
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
         RETURNING id_examen::int AS id, curso_id::int AS "cursoId", titulo, nota_minima AS "notaMinima", estado`,
        [
            Number(datos.cursoId),
            titulo,
            texto(datos.descripcion) || null,
            notaMinima,
            intentosMaximos,
            tiempoLimiteMin,
            datos.mostrarResultados !== 'false' && datos.mostrarResultados !== false,
            estado
        ]
    );

    await registrarAuditoria({
        accion: 'CREAR_EXAMEN',
        entidadTipo: 'examen',
        entidadId: examen.id,
        descripcion: `Se configuró la evaluación "${examen.titulo}" (aprobación: ${notaMinima}%).`
    });
    return examen;
}

async function agregarPreguntaExamen(examenId, datos) {
    if (!idValido(examenId)) throw new Error('Examen inválido.');
    const enunciado = texto(datos.enunciado);
    if (!enunciado) throw new Error('El enunciado de la pregunta es obligatorio.');

    const tipo = ['opcion_unica', 'opcion_multiple', 'verdadero_falso'].includes(datos.tipo)
        ? datos.tipo
        : 'opcion_unica';
    const puntos = Math.max(1, Number(datos.puntos) || 10);

    const [pregunta] = await consulta(
        `INSERT INTO preguntas_examen (examen_id, enunciado, tipo, puntos, orden)
         VALUES ($1, $2, $3, $4,
            COALESCE((SELECT MAX(orden) + 1 FROM preguntas_examen WHERE examen_id = $1), 1))
         RETURNING id_pregunta::int AS id, enunciado, tipo, puntos`,
        [Number(examenId), enunciado, tipo, puntos]
    );

    if (tipo === 'verdadero_falso') {
        const correctaVF = String(datos.respuestaCorrecta).toLowerCase() !== 'falso';
        await consulta(
            `INSERT INTO opciones_examen (pregunta_id, texto, es_correcta, orden)
             VALUES ($1, 'Verdadero', $2, 1), ($1, 'Falso', $3, 2)`,
            [pregunta.id, correctaVF, !correctaVF]
        );
    } else {
        const textosOpciones = Array.isArray(datos.opciones)
            ? datos.opciones.map(texto).filter(Boolean)
            : String(datos.opciones || '').split(/\r?\n/).map(texto).filter(Boolean);

        const indicesCorrectos = [].concat(datos.correctas ?? [0]).map(Number);

        for (let i = 0; i < textosOpciones.length; i++) {
            await consulta(
                `INSERT INTO opciones_examen (pregunta_id, texto, es_correcta, orden)
                 VALUES ($1, $2, $3, $4)`,
                [pregunta.id, textosOpciones[i], indicesCorrectos.includes(i), i + 1]
            );
        }
    }

    return pregunta;
}

// Calificación automática en servidor (Pág. 109)
async function calificarIntentoExamen(examenId, candidatoId, respuestasUsuario = {}) {
    const examen = await obtenerExamenCompleto(examenId, true);
    if (!examen || examen.estado !== 'publicado') {
        throw new Error('La evaluación no está disponible para presentar intentos.');
    }

    const [conteoIntentos] = await consulta(
        'SELECT COUNT(*)::int AS previos FROM intentos_examen WHERE examen_id = $1 AND candidato_id = $2',
        [examen.id, Number(candidatoId)]
    );

    if (conteoIntentos.previos >= examen.intentosMaximos) {
        throw new Error(`Has alcanzado el límite máximo de ${examen.intentosMaximos} intentos permitidos para este examen.`);
    }

    let puntosTotales = 0;
    let puntosObtenidos = 0;
    const detalleRespuestas = [];

    for (const pregunta of examen.preguntas) {
        puntosTotales += pregunta.puntos;
        const clavePregunta = `pregunta_${pregunta.id}`;
        const seleccionRaw = respuestasUsuario[clavePregunta] ?? respuestasUsuario[pregunta.id] ?? [];
        const seleccionIds = [].concat(seleccionRaw).map(Number).filter(Number.isFinite);

        const correctasIds = pregunta.opciones.filter(o => o.esCorrecta).map(o => o.id);

        const acerto =
            seleccionIds.length === correctasIds.length &&
            correctasIds.every(id => seleccionIds.includes(id));

        if (acerto) {
            puntosObtenidos += pregunta.puntos;
        }

        detalleRespuestas.push({
            preguntaId: pregunta.id,
            seleccionIds,
            correcta: acerto
        });
    }

    const calificacion = puntosTotales > 0 ? Math.round((puntosObtenidos / puntosTotales) * 100) : 100;
    const aprobado = calificacion >= examen.notaMinima;

    const [intento] = await consulta(
        `INSERT INTO intentos_examen (
            examen_id, candidato_id, numero_intento, calificacion, aprobado, estado, respuestas_json
         )
         VALUES ($1, $2, $3, $4, $5, 'calificado', $6)
         RETURNING id_intento::int AS id, examen_id::int AS "examenId", candidato_id::int AS "candidatoId",
                   numero_intento AS "numeroIntento", calificacion, aprobado, estado`,
        [
            examen.id,
            Number(candidatoId),
            conteoIntentos.previos + 1,
            calificacion,
            aprobado,
            JSON.stringify(detalleRespuestas)
        ]
    );

    await consulta(
        `INSERT INTO notificaciones (destinatario_tipo, destinatario_id, titulo, mensaje, tipo_evento, referencia_url)
         VALUES ('candidatos', $1, $2, $3, 'examen_calificado', $4)`,
        [
            Number(candidatoId),
            `Examen calificado: ${examen.titulo}`,
            `Obtuviste ${calificacion}% (${aprobado ? 'Aprobado' : 'Reprobado'}). Nota mínima requerida: ${examen.notaMinima}%.`,
            `/administrativo/examenes/${examen.id}`
        ]
    );

    return {
        ...intento,
        resultado: aprobado ? 'passed' : 'failed',
        notaMinima: examen.notaMinima
    };
}

// ==========================================================
// 7. ADMINISTRACIÓN DE FOROS, SOLICITUDES, HILOS Y COMENTARIOS
// ==========================================================

async function listarForosYSolicitudesAdmin() {
    const [foros, solicitudes] = await Promise.all([
        consulta(`
            SELECT
                f.id_foro::int AS id,
                f.nombre,
                f.slug,
                f.descripcion,
                f.icono,
                f.orden,
                f.origen,
                f.creado_por AS "creadoPor",
                f.aprobado_por AS "aprobadoPor",
                f.estado,
                f.fecha_creacion AS "fechaCreacion",
                (SELECT COUNT(*)::int FROM hilos_foro h WHERE h.foro_id = f.id_foro AND h.eliminado_en IS NULL) AS "totalHilos",
                (SELECT COUNT(*)::int FROM comentarios_foro c JOIN hilos_foro h ON h.id_hilo = c.hilo_id WHERE h.foro_id = f.id_foro AND c.eliminado_en IS NULL) AS "totalComentarios"
            FROM foros f
            ORDER BY f.orden ASC, f.id_foro ASC
        `),
        consulta(`
            SELECT
                s.id_solicitud::int AS id,
                s.solicitante_tipo AS "solicitanteTipo",
                s.solicitante_id::int AS "solicitanteId",
                s.solicitante_nombre AS "solicitanteNombre",
                s.nombre,
                s.descripcion,
                s.icono,
                s.motivo,
                s.estado,
                s.revisado_por AS "revisadoPor",
                s.notas_revision AS "notasRevision",
                s.foro_creado_id::int AS "foroCreadoId",
                s.fecha_creacion AS "fechaCreacion",
                s.fecha_revision AS "fechaRevision"
            FROM solicitudes_foros s
            ORDER BY CASE WHEN s.estado = 'pendiente' THEN 0 ELSE 1 END, s.fecha_creacion DESC
        `)
    ]);

    return { foros, solicitudes };
}

async function guardarForoAdmin(datos, idForo = null) {
    const nombre = texto(datos.nombre);
    const descripcion = texto(datos.descripcion);
    const icono = texto(datos.icono) || '💬';
    const orden = Math.max(1, Number(datos.orden) || 1);
    const estado = ['activo', 'inactivo', 'archivado'].includes(datos.estado) ? datos.estado : 'activo';

    if (!nombre || !descripcion) {
        throw new Error('El nombre y la descripción del foro son obligatorios.');
    }

    if (idForo && idValido(idForo)) {
        const [actualizado] = await consulta(
            `UPDATE foros
             SET nombre = $2, descripcion = $3, icono = $4, orden = $5, estado = $6, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id_foro = $1
             RETURNING id_foro::int AS id, nombre, slug, estado`,
            [Number(idForo), nombre, descripcion, icono, orden, estado]
        );
        await registrarAuditoria({
            accion: 'EDITAR_FORO',
            entidadTipo: 'foro',
            entidadId: Number(idForo),
            descripcion: `Se actualizó el foro "${nombre}" (${estado}).`
        });
        return actualizado;
    }

    const slugBase = generarSlug(nombre);
    const [nuevo] = await consulta(
        `INSERT INTO foros (nombre, slug, descripcion, icono, orden, origen, creado_por, aprobado_por, estado)
         VALUES ($1, $2, $3, $4, $5, 'oficial', $6, $6, $7)
         RETURNING id_foro::int AS id, nombre, slug, origen, estado`,
        [nombre, slugBase, descripcion, icono, orden, ADMIN_ACTUAL.nombre, estado]
    );

    await registrarAuditoria({
        accion: 'CREAR_FORO_OFICIAL',
        entidadTipo: 'foro',
        entidadId: nuevo.id,
        descripcion: `Se creó el foro oficial "${nuevo.nombre}".`
    });
    return nuevo;
}

async function cambiarEstadoForoAdmin(idForo, estado) {
    if (!idValido(idForo) || !['activo', 'inactivo', 'archivado'].includes(estado)) return null;
    const [foro] = await consulta(
        `UPDATE foros SET estado = $2, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_foro = $1
         RETURNING id_foro::int AS id, nombre, estado`,
        [Number(idForo), estado]
    );
    if (foro) {
        await registrarAuditoria({
            accion: 'CAMBIAR_ESTADO_FORO',
            entidadTipo: 'foro',
            entidadId: foro.id,
            descripcion: `El foro "${foro.nombre}" cambió a estado "${estado}".`
        });
    }
    return foro || null;
}

// Aprobar o rechazar solicitud de foro dentro de una transacción (Pág. 76, RN-FOR-05, 07, 08, 16)
async function revisarSolicitudForo(idSolicitud, accion, notasRevision = '') {
    if (!idValido(idSolicitud)) return null;
    const idNum = Number(idSolicitud);
    const notasLimpias = texto(notasRevision);

    const [solicitud] = await consulta(
        'SELECT * FROM solicitudes_foros WHERE id_solicitud = $1 LIMIT 1',
        [idNum]
    );
    if (!solicitud) return null;

    if (solicitud.estado !== 'pendiente') {
        throw new Error('Esta solicitud de foro ya fue procesada anteriormente.');
    }

    if (accion === 'rechazar') {
        if (!notasLimpias) {
            throw new Error('Toda propuesta de foro rechazada debe incluir un motivo obligatorio (RN-FOR-07).');
        }

        const [rechazada] = await consulta(
            `UPDATE solicitudes_foros
             SET estado = 'rechazada',
                 revisado_por = $2,
                 notas_revision = $3,
                 fecha_revision = CURRENT_TIMESTAMP
             WHERE id_solicitud = $1
             RETURNING id_solicitud::int AS id, nombre, estado, notas_revision AS "notasRevision"`,
            [idNum, ADMIN_ACTUAL.nombre, notasLimpias]
        );

        await registrarAuditoria({
            accion: 'RECHAZAR_FORO',
            entidadTipo: 'solicitud_foro',
            entidadId: idNum,
            descripcion: `Se rechazó la propuesta de foro "${solicitud.nombre}". Motivo: ${notasLimpias}`
        });

        await consulta(
            `INSERT INTO notificaciones (destinatario_tipo, destinatario_id, titulo, mensaje, tipo_evento, referencia_url)
             VALUES ($1, $2, $3, $4, 'foro_rechazado', '/foros/mis-solicitudes')`,
            [
                solicitud.solicitante_tipo === 'empresa' ? 'empresas' : 'candidatos',
                solicitud.solicitante_id,
                `Propuesta de foro rechazada: ${solicitud.nombre}`,
                `Motivo de revisión: ${notasLimpias}`
            ]
        );

        return { solicitud: rechazada, foro: null };
    }

    // Aprobación transaccional para evitar duplicados (Pág. 76, RN-FOR-08)
    const usaPoolGeneral = db === pool;
    const cliente = usaPoolGeneral ? await pool.connect() : db;

    try {
        await cliente.query(usaPoolGeneral ? 'BEGIN' : 'SAVEPOINT sp_aprobar_foro');

        const slugBase = generarSlug(solicitud.nombre);
        const { rows: maxOrden } = await cliente.query('SELECT COALESCE(MAX(orden), 0)::int AS max FROM foros');

        const { rows: foroRows } = await cliente.query(
            `INSERT INTO foros (nombre, slug, descripcion, icono, orden, origen, creado_por, aprobado_por, estado)
             VALUES ($1, $2, $3, $4, $5, 'comunitario', $6, $7, 'activo')
             RETURNING id_foro::int AS id, nombre, slug, origen, estado`,
            [
                solicitud.nombre,
                slugBase,
                solicitud.descripcion,
                solicitud.icono || '🗣️',
                maxOrden[0].max + 1,
                solicitud.solicitante_nombre,
                ADMIN_ACTUAL.nombre
            ]
        );
        const foroCreado = foroRows[0];

        const { rows: solRows } = await cliente.query(
            `UPDATE solicitudes_foros
             SET estado = 'aprobada',
                 revisado_por = $2,
                 notas_revision = $3,
                 foro_creado_id = $4,
                 fecha_revision = CURRENT_TIMESTAMP
             WHERE id_solicitud = $1
             RETURNING id_solicitud::int AS id, nombre, estado, foro_creado_id::int AS "foroCreadoId"`,
            [idNum, ADMIN_ACTUAL.nombre, notasLimpias || 'Propuesta aprobada y foro comunitario habilitado.', foroCreado.id]
        );

        await cliente.query(usaPoolGeneral ? 'COMMIT' : 'RELEASE SAVEPOINT sp_aprobar_foro');

        await registrarAuditoria({
            accion: 'APROBAR_FORO',
            entidadTipo: 'solicitud_foro',
            entidadId: idNum,
            descripcion: `Se aprobó la solicitud #${idNum} y se publicó el foro comunitario "${foroCreado.nombre}".`,
            valoresNuevos: foroCreado
        });

        await consulta(
            `INSERT INTO notificaciones (destinatario_tipo, destinatario_id, titulo, mensaje, tipo_evento, referencia_url)
             VALUES ($1, $2, $3, $4, 'foro_aprobado', $5)`,
            [
                solicitud.solicitante_tipo === 'empresa' ? 'empresas' : 'candidatos',
                solicitud.solicitante_id,
                `¡Tu propuesta de foro "${foroCreado.nombre}" fue aprobada!`,
                `El foro comunitario ya está publicado y abierto a toda la comunidad.`,
                `/foros/${foroCreado.slug}`
            ]
        );

        return { solicitud: solRows[0], foro: foroCreado };
    } catch (error) {
        await cliente.query(usaPoolGeneral ? 'ROLLBACK' : 'ROLLBACK TO SAVEPOINT sp_aprobar_foro');
        throw error;
    } finally {
        if (usaPoolGeneral) cliente.release();
    }
}

// Moderación de hilos y comentarios (Págs. 14, 55, 73, 111-112, RN-FOR-10, 13, 14, 16)

async function listarHilosYComentariosAdmin(filtros = {}) {
    const condicionesHilos = ['h.eliminado_en IS NULL'];
    const valoresHilos = [];

    if (texto(filtros.q)) {
        valoresHilos.push(`%${texto(filtros.q)}%`);
        condicionesHilos.push(`(h.titulo ILIKE $${valoresHilos.length} OR h.autor_nombre ILIKE $${valoresHilos.length})`);
    }
    if (filtros.foroId && idValido(filtros.foroId)) {
        valoresHilos.push(Number(filtros.foroId));
        condicionesHilos.push(`h.foro_id = $${valoresHilos.length}`);
    }

    const [hilos, comentarios] = await Promise.all([
        consulta(
            `SELECT
                h.id_hilo::int AS id,
                h.foro_id::int AS "foroId",
                f.nombre AS foro,
                f.slug AS "foroSlug",
                h.titulo,
                h.autor_nombre AS autor,
                h.autor_tipo AS "autorTipo",
                h.fijado,
                h.bloqueado,
                h.estado,
                h.motivo_moderacion AS "motivoModeracion",
                h.fecha_creacion AS "fechaCreacion",
                (SELECT COUNT(*)::int FROM comentarios_foro c WHERE c.hilo_id = h.id_hilo AND c.eliminado_en IS NULL) AS "totalComentarios",
                (SELECT COUNT(*)::int FROM reportes r WHERE r.tipo_contenido = 'hilo' AND r.contenido_id = h.id_hilo) AS "totalReportes"
             FROM hilos_foro h
             JOIN foros f ON f.id_foro = h.foro_id
             WHERE ${condicionesHilos.join(' AND ')}
             ORDER BY h.fijado DESC, h.fecha_creacion DESC`,
            valoresHilos
        ),
        consulta(
            `SELECT
                c.id_comentario::int AS id,
                c.hilo_id::int AS "hiloId",
                h.titulo AS hilo,
                f.slug AS "foroSlug",
                c.autor_nombre AS autor,
                c.autor_tipo AS "autorTipo",
                c.contenido,
                c.estado,
                c.motivo_moderacion AS "motivoModeracion",
                c.fecha_creacion AS "fechaCreacion",
                (SELECT COUNT(*)::int FROM reportes r WHERE r.tipo_contenido = 'comentario' AND r.contenido_id = c.id_comentario) AS "totalReportes"
             FROM comentarios_foro c
             JOIN hilos_foro h ON h.id_hilo = c.hilo_id
             JOIN foros f ON f.id_foro = h.foro_id
             WHERE c.eliminado_en IS NULL
             ORDER BY c.fecha_creacion DESC
             LIMIT 60`
        )
    ]);

    return { hilos, comentarios };
}

async function moderarHiloAdmin(idHilo, accion, motivo = '') {
    if (!idValido(idHilo)) return null;
    const idNum = Number(idHilo);

    const [hilo] = await consulta('SELECT id_hilo::int AS id, titulo, fijado, bloqueado, estado FROM hilos_foro WHERE id_hilo = $1', [idNum]);
    if (!hilo) return null;

    let sqlUpdate = '';
    let valores = [idNum];

    if (accion === 'fijar' || accion === 'desfijar') {
        sqlUpdate = 'UPDATE hilos_foro SET fijado = $2 WHERE id_hilo = $1 RETURNING id_hilo::int AS id, titulo, fijado, bloqueado, estado';
        valores.push(accion === 'fijar');
    } else if (accion === 'bloquear' || accion === 'desbloquear') {
        sqlUpdate = 'UPDATE hilos_foro SET bloqueado = $2 WHERE id_hilo = $1 RETURNING id_hilo::int AS id, titulo, fijado, bloqueado, estado';
        valores.push(accion === 'bloquear');
    } else if (accion === 'ocultar' || accion === 'restaurar') {
        const nuevoEstado = accion === 'ocultar' ? 'oculto' : 'visible';
        sqlUpdate = 'UPDATE hilos_foro SET estado = $2, motivo_moderacion = $3 WHERE id_hilo = $1 RETURNING id_hilo::int AS id, titulo, fijado, bloqueado, estado';
        valores.push(nuevoEstado, texto(motivo) || null);
    } else {
        throw new Error('Acción de moderación de hilo no válida.');
    }

    const [actualizado] = await consulta(sqlUpdate, valores);

    await registrarAuditoria({
        accion: `HILO_${accion.toUpperCase()}`,
        entidadTipo: 'hilo_foro',
        entidadId: idNum,
        descripcion: `Moderación sobre hilo "${hilo.titulo}": ${accion}.${texto(motivo) ? ' Motivo: ' + texto(motivo) : ''}`,
        valoresAnteriores: hilo,
        valoresNuevos: actualizado
    });

    return actualizado;
}

async function moderarComentarioAdmin(idComentario, accion, motivo = '') {
    if (!idValido(idComentario) || !['ocultar', 'restaurar'].includes(accion)) return null;
    const idNum = Number(idComentario);
    const nuevoEstado = accion === 'ocultar' ? 'oculto' : 'visible';

    const [actualizado] = await consulta(
        `UPDATE comentarios_foro
         SET estado = $2, motivo_moderacion = $3, fecha_actualizacion = CURRENT_TIMESTAMP
         WHERE id_comentario = $1
         RETURNING id_comentario::int AS id, hilo_id::int AS "hiloId", autor_nombre AS autor, estado`,
        [idNum, nuevoEstado, texto(motivo) || null]
    );

    if (actualizado) {
        await registrarAuditoria({
            accion: `COMENTARIO_${accion.toUpperCase()}`,
            entidadTipo: 'comentario_foro',
            entidadId: idNum,
            descripcion: `Se cambió la visibilidad del comentario #${idNum} de ${actualizado.autor} a "${nuevoEstado}".`
        });
    }
    return actualizado || null;
}

// ==========================================================
// 8. MODERACIÓN DE OPINIONES Y CENTRO DE REPORTES (Págs. 14-15, 112, RN-09, RN-10, RN-12)
// ==========================================================

async function listarModeracionYReportes(filtros = {}) {
    const condicionesRep = [];
    const valoresRep = [];

    if (texto(filtros.estado)) {
        valoresRep.push(texto(filtros.estado));
        condicionesRep.push(`r.estado = $${valoresRep.length}`);
    }
    if (texto(filtros.tipoContenido)) {
        valoresRep.push(texto(filtros.tipoContenido));
        condicionesRep.push(`r.tipo_contenido = $${valoresRep.length}`);
    }

    const whereRep = condicionesRep.length ? `WHERE ${condicionesRep.join(' AND ')}` : '';

    const [reportes, opiniones] = await Promise.all([
        consulta(
            `SELECT
                r.id_reporte::int AS id,
                r.denunciante_tipo AS "denuncianteTipo",
                r.denunciante_nombre AS denunciante,
                r.tipo_contenido AS "tipoContenido",
                r.contenido_id::int AS "contenidoId",
                r.contenido_resumen AS "contenidoResumen",
                r.usuario_reportado_nombre AS "usuarioReportado",
                r.motivo,
                r.descripcion,
                r.estado,
                r.medida_tomada AS "medidaTomada",
                r.resolucion,
                r.revisado_por AS "revisadoPor",
                r.fecha_creacion AS "fechaCreacion",
                r.fecha_revision AS "fechaRevision",
                (SELECT COUNT(*)::int
                   FROM reportes similares
                  WHERE similares.tipo_contenido = r.tipo_contenido
                    AND similares.contenido_id = r.contenido_id) AS "reportesRelacionados",
                CASE r.tipo_contenido
                    WHEN 'vacante' THEN '/busqueda/empleo/' || r.contenido_id
                    WHEN 'hilo' THEN '/foros/hilos/' || r.contenido_id
                    ELSE NULL
                END AS "enlaceContenido"
             FROM reportes r
             ${whereRep}
             ORDER BY
                CASE WHEN r.estado IN ('pendiente', 'en_revision') THEN 0 ELSE 1 END,
                r.fecha_creacion DESC`,
            valoresRep
        ),
        consulta(
            `SELECT
                val.id_valoracion::int AS id,
                val.puntuacion,
                val.titulo,
                val.comentario,
                val.estado_moderacion AS "estadoModeracion",
                val.motivo_moderacion AS "motivoModeracion",
                val.fecha_valoracion AS "fechaValoracion",
                c.id_candidato::int AS "candidatoId",
                c.nombre AS candidato,
                e.id_empresa::int AS "empresaId",
                e.nombre AS empresa
             FROM valoraciones val
             JOIN candidatos c ON c.id_candidato = val.candidato_id
             JOIN empresas e ON e.id_empresa = val.empresa_id
             ORDER BY val.fecha_valoracion DESC`
        )
    ]);

    return { reportes, opiniones };
}

async function moderarValoracionAdmin(idValoracion, nuevoEstado, motivo = '') {
    // RN-12: Una opinión retirada u oculta NO desaparece del historial de moderación.
    if (!idValido(idValoracion) || !['visible', 'oculta', 'retirada'].includes(nuevoEstado)) return null;
    const idNum = Number(idValoracion);

    const [actualizada] = await consulta(
        `UPDATE valoraciones
         SET estado_moderacion = $2, motivo_moderacion = $3
         WHERE id_valoracion = $1
         RETURNING id_valoracion::int AS id, titulo, comentario, estado_moderacion AS "estadoModeracion"`,
        [idNum, nuevoEstado, texto(motivo) || null]
    );

    if (actualizada) {
        await registrarAuditoria({
            accion: 'MODERAR_VALORACION',
            entidadTipo: 'valoracion',
            entidadId: idNum,
            descripcion: `La opinión empresarial #${idNum} pasó a estado "${nuevoEstado}" conservándose en el historial (RN-12).`
        });
    }
    return actualizada || null;
}

async function resolverReporteAdmin(idReporte, datos) {
    if (!idValido(idReporte)) return null;
    const idNum = Number(idReporte);

    const [reporte] = await consulta('SELECT * FROM reportes WHERE id_reporte = $1', [idNum]);
    if (!reporte) return null;
    if (['resuelta', 'desestimada'].includes(reporte.estado)) {
        throw new Error('Este reporte ya fue cerrado y no puede modificarse.');
    }

    const nuevoEstado = ['en_revision', 'resuelta', 'desestimada'].includes(datos.estado)
        ? datos.estado
        : 'resuelta';
    const medidasPermitidas = [
        'Sin medida',
        'Advertencia a la empresa',
        'Corrección solicitada',
        'Contenido ocultado',
        'Contenido ocultado'
    ];
    const medidaTomada = nuevoEstado === 'desestimada'
        ? 'Sin medida'
        : (medidasPermitidas.includes(datos.medidaTomada)
        ? datos.medidaTomada
        : '');
    const resolucion = texto(datos.resolucion);

    if (['resuelta', 'desestimada'].includes(nuevoEstado) && !resolucion) {
        throw new Error('Debes registrar la resolución de la revisión antes de cerrar el reporte.');
    }
    if (nuevoEstado === 'resuelta' && !medidaTomada) {
        throw new Error('Selecciona la medida aplicada antes de resolver el reporte.');
    }
    const debeOcultar = nuevoEstado === 'resuelta'
        && (datos.ocultarContenido || medidaTomada === 'Contenido ocultado');
    if (debeOcultar && medidaTomada === 'Sin medida') {
        throw new Error('La medida debe reflejar que el contenido fue ocultado.');
    }

    // Si el administrador eligió ocultar el contenido denunciado al resolver
    if (debeOcultar) {
        if (reporte.tipo_contenido === 'vacante') {
            await moderarVacante(reporte.contenido_id, 'ocultar', resolucion);
        } else if (reporte.tipo_contenido === 'hilo') {
            await moderarHiloAdmin(reporte.contenido_id, 'ocultar', resolucion);
        } else if (reporte.tipo_contenido === 'comentario') {
            await moderarComentarioAdmin(reporte.contenido_id, 'ocultar', resolucion);
        } else if (reporte.tipo_contenido === 'opinion') {
            await moderarValoracionAdmin(reporte.contenido_id, 'retirada', resolucion);
        }
    }

    if (nuevoEstado === 'en_revision') {
        const [actualizadoEnRevision] = await consulta(
            `UPDATE reportes
             SET estado = 'en_revision',
                 revisado_por = $2,
                 fecha_revision = CURRENT_TIMESTAMP
             WHERE id_reporte = $1
             RETURNING id_reporte::int AS id, estado, revisado_por AS "revisadoPor"`,
            [idNum, ADMIN_ACTUAL.nombre]
        );

        await registrarAuditoria({
            accion: 'TOMAR_REPORTE_EN_REVISION',
            entidadTipo: 'reporte',
            entidadId: idNum,
            descripcion: `El reporte #${idNum} fue tomado para investigación por ${ADMIN_ACTUAL.nombre}.`
        });

        return actualizadoEnRevision;
    }

    const [actualizado] = await consulta(
        `UPDATE reportes
         SET estado = $2,
             medida_tomada = $3,
             resolucion = $4,
             revisado_por = $5,
             fecha_revision = CURRENT_TIMESTAMP
         WHERE id_reporte = $1
         RETURNING id_reporte::int AS id, tipo_contenido AS "tipoContenido", contenido_id::int AS "contenidoId",
                   estado, medida_tomada AS "medidaTomada", resolucion, revisado_por AS "revisadoPor"`,
        [idNum, nuevoEstado, medidaTomada, resolucion || null, ADMIN_ACTUAL.nombre]
    );

    await registrarAuditoria({
        accion: 'RESOLVER_REPORTE',
        entidadTipo: 'reporte',
        entidadId: idNum,
        descripcion: `Reporte #${idNum} (${reporte.tipo_contenido}) actualizado a "${nuevoEstado}". Medida: ${medidaTomada}.`
    });

    return actualizado;
}

// ==========================================================
// 9. NOTIFICACIONES Y CONFIGURACIÓN GENERAL (Págs. 15-16, 113-114)
// ==========================================================

async function listarNotificacionesAdmin() {
    return consulta(`
        SELECT
            id_notificacion::int AS id,
            destinatario_tipo AS "destinatarioTipo",
            destinatario_id::int AS "destinatarioId",
            titulo,
            mensaje,
            tipo_evento AS "tipoEvento",
            referencia_url AS "referenciaUrl",
            estado,
            fecha_creacion AS "fechaCreacion"
        FROM notificaciones
        ORDER BY fecha_creacion DESC, id_notificacion DESC
        LIMIT 50
    `);
}

async function crearNotificacionPublica(datos) {
    const titulo = texto(datos.titulo);
    const mensaje = texto(datos.mensaje);
    const destinatarioTipo = ['general', 'candidatos', 'empresas', 'cursos', 'comunidad'].includes(datos.destinatarioTipo)
        ? datos.destinatarioTipo
        : 'general';
    const referenciaUrl = texto(datos.referenciaUrl) || '/';

    if (!titulo || !mensaje) {
        throw new Error('El título y el mensaje de la notificación son obligatorios.');
    }

    const [notif] = await consulta(
        `INSERT INTO notificaciones (destinatario_tipo, titulo, mensaje, tipo_evento, referencia_url, estado)
         VALUES ($1, $2, $3, 'aviso_administrativo', $4, 'publicada')
         RETURNING id_notificacion::int AS id, destinatario_tipo AS "destinatarioTipo", titulo, mensaje, estado`,
        [destinatarioTipo, titulo, mensaje, referenciaUrl]
    );

    await registrarAuditoria({
        accion: 'PUBLICAR_NOTIFICACION',
        entidadTipo: 'notificacion',
        entidadId: notif.id,
        descripcion: `Se publicó el aviso "${notif.titulo}" para destinatarios: ${notif.destinatarioTipo}.`
    });

    return notif;
}

async function obtenerConfiguracionPlataforma() {
    const filas = await consulta(
        'SELECT clave, valor, etiqueta, grupo, fecha_actualizacion AS "fechaActualizacion" FROM configuracion_plataforma ORDER BY grupo, clave'
    );
    const mapa = {};
    filas.forEach(f => { mapa[f.clave] = f.valor; });
    return { lista: filas, mapa };
}

async function guardarConfiguracionPlataforma(datos = {}) {
    const clavesPermitidas = [
        'nombre_plataforma',
        'lema_plataforma',
        'logo_url',
        'correo_contacto',
        'telefono_contacto',
        'direccion_fisica',
        'redes_sociales',
        'normas_comunidad',
        'terminos_condiciones',
        'politica_privacidad'
    ];

    for (const clave of clavesPermitidas) {
        if (datos[clave] !== undefined) {
            await consulta(
                `UPDATE configuracion_plataforma
                 SET valor = $2, fecha_actualizacion = CURRENT_TIMESTAMP
                 WHERE clave = $1`,
                [clave, texto(datos[clave])]
            );
        }
    }

    await registrarAuditoria({
        accion: 'ACTUALIZAR_CONFIGURACION',
        entidadTipo: 'configuracion_plataforma',
        entidadId: 1,
        descripcion: 'Se actualizaron los parámetros generales, contacto y políticas de la plataforma.'
    });

    return obtenerConfiguracionPlataforma();
}

module.exports = {
    ADMIN_ACTUAL,
    usarConexion,
    registrarAuditoria,
    listarAuditoria,
    obtenerResumenAlertasPendientes,
    obtenerDashboardAdmin,
    obtenerBandejaUnificadaSolicitudes,
    listarUsuarios,
    obtenerDetalleUsuario,
    listarEmpresasAdmin,
    obtenerExpedienteEmpresa,
    decidirEstadoEmpresa,
    moderarVacante,
    listarRecursosAdmin,
    guardarRecursoAdmin,
    cambiarEstadoRecursoAdmin,
    alternarDestacadoRecurso,
    crearCategoriaRecurso,
    listarCursosAdmin,
    obtenerCursoCompleto,
    crearCurso,
    agregarModuloCurso,
    agregarLeccionModulo,
    cambiarEstadoCurso,
    inscribirCandidatoCurso,
    completarLeccionCandidato,
    listarExamenesAdmin,
    obtenerExamenCompleto,
    crearExamen,
    agregarPreguntaExamen,
    calificarIntentoExamen,
    listarForosYSolicitudesAdmin,
    guardarForoAdmin,
    cambiarEstadoForoAdmin,
    revisarSolicitudForo,
    listarHilosYComentariosAdmin,
    moderarHiloAdmin,
    moderarComentarioAdmin,
    listarModeracionYReportes,
    moderarValoracionAdmin,
    resolverReporteAdmin,
    listarNotificacionesAdmin,
    crearNotificacionPublica,
    obtenerConfiguracionPlataforma,
    guardarConfiguracionPlataforma
};
