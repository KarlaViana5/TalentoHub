const { paginacion } = require('../utils/paginacion');
const { pool } = require('../config/database');

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
    return /^[1-9]\d{0,14}$/.test(String(id)) && Number.isSafeInteger(Number(id));
}

function generarSlug(nombre) {
    return texto(nombre)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `foro-${Date.now()}`;
}

// ==========================================================
// GESTIÓN DE ACTOR Y PERMISOS DE PARTICIPACIÓN (Págs. 53-54)
// ==========================================================

const actoresValidados = new WeakSet();
function autenticarActor(actor) { Object.freeze(actor); actoresValidados.add(actor); return actor; }
function exigirActor(actor) {
    if (!actor || !actoresValidados.has(actor) || !actor.puedeParticipar) {
        const error = new Error('Necesitas una sesion activa con permisos de participacion.');
        error.status = 403; throw error;
    }
}
async function resolverActor(usuario = null) {
    const cadenaActor = !usuario ? 'visitante' : usuario.rol === 'admin' ? 'admin' :
        usuario.rol === 'empresa' && idValido(usuario.empresaId) ? 'empresa:' + usuario.empresaId :
        usuario.rol === 'candidato' && idValido(usuario.candidatoId) ? 'candidato:' + usuario.candidatoId : 'visitante';

    if (cadenaActor === 'visitante') {
        return autenticarActor({
            clave: 'visitante',
            tipo: 'visitante',
            id: 0,
            nombre: 'Visitante',
            etiquetaRol: 'Visitante (Solo lectura)',
            estadoCuenta: 'lectura',
            puedeParticipar: false,
            puedeProponerForo: false,
            esAdmin: false,
            motivoBloqueo: 'Inicia sesión como candidato activo o empresa aprobada para crear hilos, comentar o proponer foros.'
        });
    }

    if (cadenaActor === 'admin') {
        return autenticarActor({
            clave: 'admin',
            tipo: 'admin',
            id: Number(usuario.id),
            nombre: usuario.nombreMostrar || usuario.nombre,
            etiquetaRol: 'Administrador',
            estadoCuenta: 'activo',
            puedeParticipar: true,
            puedeProponerForo: true,
            esAdmin: true,
            motivoBloqueo: null
        });
    }

    const [tipoRaw, idRaw] = cadenaActor.split(':');
    const tipo = tipoRaw === 'empresa' ? 'empresa' : 'candidato';
    const id = idValido(idRaw) ? Number(idRaw) : 1;

    if (tipo === 'empresa') {
        const filas = await consulta(
            `SELECT id_empresa::int AS id, nombre, sector, estado, estado_aprobacion AS "estadoAprobacion"
             FROM empresas WHERE id_empresa = $1 LIMIT 1`,
            [id]
        );
        const emp = filas[0];
        if (!emp) {
            return resolverActor(null);
        }
        const aprobada = emp.estado === 'activa' && emp.estadoAprobacion === 'aprobada';
        return autenticarActor({
            clave: `empresa:${emp.id}`,
            tipo: 'empresa',
            id: emp.id,
            nombre: emp.nombre,
            etiquetaRol: `Empresa · ${emp.sector}`,
            estadoCuenta: aprobada ? 'aprobada' : emp.estadoAprobacion || emp.estado,
            puedeParticipar: aprobada,
            puedeProponerForo: aprobada,
            esAdmin: false,
            motivoBloqueo: aprobada
                ? null
                : `Tu cuenta empresarial (${emp.nombre}) se encuentra en estado "${emp.estadoAprobacion || emp.estado}". Solo las empresas aprobadas pueden publicar o proponer foros (RN-FOR-03 / RN-FOR-15).`
        });
    }

    const filas = await consulta(
        `SELECT id_candidato::int AS id, nombre, cargo, estado
         FROM candidatos WHERE id_candidato = $1 LIMIT 1`,
        [id]
    );
    const cand = filas[0];
    if (!cand) {
        return resolverActor(null);
    }
    const activo = cand.estado === 'activo';
    return autenticarActor({
        clave: `candidato:${cand.id}`,
        tipo: 'candidato',
        id: cand.id,
        nombre: cand.nombre,
        etiquetaRol: `Candidato · ${cand.cargo || 'Profesional'}`,
        estadoCuenta: cand.estado,
        puedeParticipar: activo,
        puedeProponerForo: activo,
        esAdmin: false,
        motivoBloqueo: activo
            ? null
            : `Tu cuenta de candidato (${cand.nombre}) está suspendida y no puede publicar contenido (RN-FOR-06 / RN-05).`
        });
}

async function listarActoresDisponibles() {
    const [candidatos, empresas] = await Promise.all([
        consulta('SELECT id_candidato::int AS id, nombre, cargo, estado FROM candidatos ORDER BY id_candidato ASC LIMIT 8'),
        consulta('SELECT id_empresa::int AS id, nombre, sector, estado, estado_aprobacion AS "estadoAprobacion" FROM empresas ORDER BY id_empresa ASC LIMIT 8')
    ]);
    return { candidatos, empresas };
}

// ==========================================================
// LISTADO PÚBLICO DE FOROS Y ESTADÍSTICAS (RF-01)
// ==========================================================

async function obtenerEstadisticasComunidad() {
    const [resumen] = await consulta(`
        SELECT
            (SELECT COUNT(*)::int FROM foros WHERE estado = 'activo') AS "forosActivos",
            (SELECT COUNT(*)::int FROM hilos_foro h JOIN foros f ON f.id_foro = h.foro_id WHERE h.estado = 'visible' AND h.eliminado_en IS NULL AND f.estado = 'activo') AS "totalHilos",
            (SELECT COUNT(*)::int FROM comentarios_foro c JOIN hilos_foro h ON h.id_hilo = c.hilo_id JOIN foros f ON f.id_foro = h.foro_id WHERE c.estado = 'visible' AND c.eliminado_en IS NULL AND h.estado = 'visible' AND f.estado = 'activo') AS "totalRespuestas",
            (SELECT COUNT(*)::int FROM solicitudes_foros WHERE estado = 'pendiente') AS "solicitudesPendientes"
    `);
    return resumen;
}

async function listarForosPublicos(filtros = {}) {
    const condiciones = ["f.estado = 'activo'"];
    const valores = [];

    if (texto(filtros.q)) {
        valores.push(`%${texto(filtros.q)}%`);
        condiciones.push(`(f.nombre ILIKE $${valores.length} OR f.descripcion ILIKE $${valores.length})`);
    }

    if (['oficial', 'comunitario'].includes(filtros.origen)) {
        valores.push(filtros.origen);
        condiciones.push(`f.origen = $${valores.length}`);
    }

    const ordenamientos = {
        orden: 'f.orden ASC, f.nombre ASC',
        actividad: '"ultimaActividadFecha" DESC NULLS LAST, f.orden ASC',
        hilos: '"totalHilos" DESC, f.orden ASC'
    };
    const ordenSql = ordenamientos[filtros.orden] || ordenamientos.orden;

    const filas = await consulta(
        `SELECT
            f.id_foro::int AS id,
            f.nombre,
            f.slug,
            f.descripcion,
            f.icono,
            f.orden,
            f.origen,
            f.creado_por AS "creadoPor",
            f.estado,
            f.fecha_creacion AS "fechaCreacion",
            (
                SELECT COUNT(*)::int
                FROM hilos_foro h
                WHERE h.foro_id = f.id_foro
                  AND h.estado = 'visible'
                  AND h.eliminado_en IS NULL
            ) AS "totalHilos",
            (
                SELECT COUNT(*)::int
                FROM comentarios_foro c
                JOIN hilos_foro h ON h.id_hilo = c.hilo_id
                WHERE h.foro_id = f.id_foro
                  AND h.estado = 'visible'
                  AND h.eliminado_en IS NULL
                  AND c.estado = 'visible'
                  AND c.eliminado_en IS NULL
            ) AS "totalRespuestas",
            GREATEST(
                (SELECT MAX(h.fecha_creacion) FROM hilos_foro h WHERE h.foro_id = f.id_foro AND h.estado = 'visible' AND h.eliminado_en IS NULL),
                (SELECT MAX(c.fecha_creacion) FROM comentarios_foro c JOIN hilos_foro h ON h.id_hilo = c.hilo_id WHERE h.foro_id = f.id_foro AND h.estado = 'visible' AND c.estado = 'visible' AND c.eliminado_en IS NULL)
            ) AS "ultimaActividadFecha",
            (
                SELECT h.titulo
                FROM hilos_foro h
                WHERE h.foro_id = f.id_foro
                  AND h.estado = 'visible'
                  AND h.eliminado_en IS NULL
                ORDER BY h.fecha_creacion DESC
                LIMIT 1
            ) AS "ultimoHiloTitulo"
         FROM foros f
         WHERE ${condiciones.join(' AND ')}
         ORDER BY ${ordenSql}`,
        valores
    );

    return filas;
}

async function obtenerForoPorSlugOId(identificador, incluirInactivos = false) {
    const esId = idValido(identificador);
    const condicionEstado = incluirInactivos ? '' : "AND f.estado = 'activo'";
    const filas = await consulta(
        `SELECT
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
            f.fecha_creacion AS "fechaCreacion"
         FROM foros f
         WHERE ${esId ? 'f.id_foro = $1' : 'f.slug = $1'}
         ${condicionEstado}
         LIMIT 1`,
        [esId ? Number(identificador) : texto(identificador)]
    );
    return filas[0] || null;
}

// ==========================================================
// HILOS DE DISCUSIÓN POR FORO (Págs. 52-53, RN-FOR-08 a 14)
// ==========================================================

async function listarHilosDeForo(foroId, filtros = {}, opciones = {}) {
    if (!idValido(foroId)) return { hilos: [], totalResultados: 0, pagina: 1, totalPaginas: 1 };

    const { limite, pagina: paginaSolicitada } = paginacion(opciones, 8, 50);

    const condiciones = [
        'h.foro_id = $1',
        "h.estado = 'visible'",
        'h.eliminado_en IS NULL'
    ];
    const valores = [Number(foroId)];

    if (texto(filtros.q)) {
        valores.push(`%${texto(filtros.q)}%`);
        condiciones.push(`(h.titulo ILIKE $${valores.length} OR h.contenido ILIKE $${valores.length} OR h.autor_nombre ILIKE $${valores.length})`);
    }

    if (filtros.estado === 'abierto') {
        condiciones.push('h.bloqueado = FALSE');
    } else if (filtros.estado === 'bloqueado') {
        condiciones.push('h.bloqueado = TRUE');
    }

    const where = condiciones.join(' AND ');

    const [conteoFila] = await consulta(
        `SELECT COUNT(*)::int AS total FROM hilos_foro h WHERE ${where}`,
        valores
    );
    const totalResultados = conteoFila.total;
    const totalPaginas = Math.max(1, Math.ceil(totalResultados / limite));
    const pagina = Math.min(paginaSolicitada, totalPaginas);
    const offset = (pagina - 1) * limite;

    const ordenSecundario = filtros.orden === 'participacion'
        ? '"totalRespuestas" DESC, h.fecha_creacion DESC'
        : filtros.orden === 'actividad'
            ? '"ultimaActividad" DESC, h.fecha_creacion DESC'
            : 'h.fecha_creacion DESC';

    const hilos = await consulta(
        `SELECT
            h.id_hilo::int AS id,
            h.foro_id::int AS "foroId",
            h.autor_tipo AS "autorTipo",
            h.autor_id::int AS "autorId",
            h.autor_nombre AS "autorNombre",
            h.autor_rol_etiqueta AS "autorRolEtiqueta",
            h.titulo,
            h.contenido,
            h.fijado,
            h.bloqueado,
            h.estado,
            h.vistas,
            h.fecha_creacion AS "fechaCreacion",
            (
                SELECT COUNT(*)::int
                FROM comentarios_foro c
                WHERE c.hilo_id = h.id_hilo
                  AND c.estado = 'visible'
                  AND c.eliminado_en IS NULL
            ) AS "totalRespuestas",
            COALESCE(
                (
                    SELECT MAX(c.fecha_creacion)
                    FROM comentarios_foro c
                    WHERE c.hilo_id = h.id_hilo
                      AND c.estado = 'visible'
                      AND c.eliminado_en IS NULL
                ),
                h.fecha_creacion
            ) AS "ultimaActividad"
         FROM hilos_foro h
         WHERE ${where}
         ORDER BY h.fijado DESC, ${ordenSecundario}
         LIMIT $${valores.length + 1}
         OFFSET $${valores.length + 2}`,
        [...valores, limite, offset]
    );

    return {
        hilos,
        totalResultados,
        pagina,
        totalPaginas,
        limite
    };
}

async function obtenerHiloDetalle(idHilo, incrementarVista = false) {
    if (!idValido(idHilo)) return null;

    const filas = await consulta(
        `SELECT
            h.id_hilo::int AS id,
            h.foro_id::int AS "foroId",
            h.autor_tipo AS "autorTipo",
            h.autor_id::int AS "autorId",
            h.autor_nombre AS "autorNombre",
            h.autor_rol_etiqueta AS "autorRolEtiqueta",
            h.titulo,
            h.contenido,
            h.fijado,
            h.bloqueado,
            h.estado,
            h.motivo_moderacion AS "motivoModeracion",
            h.vistas,
            h.fecha_creacion AS "fechaCreacion",
            h.fecha_actualizacion AS "fechaActualizacion",
            f.nombre AS "foroNombre",
            f.slug AS "foroSlug",
            f.estado AS "foroEstado",
            f.icono AS "foroIcono"
         FROM hilos_foro h
         JOIN foros f ON f.id_foro = h.foro_id
         WHERE h.id_hilo = $1
           AND h.estado = 'visible'
           AND h.eliminado_en IS NULL
           AND f.estado = 'activo'
         LIMIT 1`,
        [Number(idHilo)]
    );

    const hilo = filas[0];
    if (!hilo) return null;

    const comentarios = await consulta(
        `SELECT
            c.id_comentario::int AS id,
            c.hilo_id::int AS "hiloId",
            c.padre_id::int AS "padreId",
            c.autor_tipo AS "autorTipo",
            c.autor_id::int AS "autorId",
            c.autor_nombre AS "autorNombre",
            c.autor_rol_etiqueta AS "autorRolEtiqueta",
            c.contenido,
            c.estado,
            c.fecha_creacion AS "fechaCreacion",
            c.fecha_actualizacion AS "fechaActualizacion"
         FROM comentarios_foro c
         WHERE c.hilo_id = $1
           AND c.estado = 'visible'
           AND c.eliminado_en IS NULL
         ORDER BY c.fecha_creacion ASC, c.id_comentario ASC`,
        [hilo.id]
    );

    return {
        ...hilo,
        comentarios
    };
}

function validarDatosHilo(datos = {}) {
    const errores = [];
    const titulo = texto(datos.titulo);
    const contenido = texto(datos.contenido);

    if (!titulo || titulo.length < 5) {
        errores.push('El título del hilo debe tener al menos 5 caracteres.');
    }
    if (titulo.length > 200) {
        errores.push('El título del hilo no puede superar 200 caracteres.');
    }
    if (!contenido || contenido.length < 10 || contenido.length > 20000) {
        errores.push('El contenido de la discusión debe tener al menos 10 caracteres.');
    }
    return errores;
}

async function crearHilo(foroId, actor, datos) {
    exigirActor(actor);
    if (!actor || !actor.puedeParticipar) {
        throw new Error(actor?.motivoBloqueo || 'No tienes permisos para crear hilos de discusión (RN-FOR-04 / RN-FOR-09).');
    }

    const foro = await obtenerForoPorSlugOId(foroId, false);
    if (!foro) {
        throw new Error('El foro seleccionado no existe o no se encuentra activo (RN-FOR-09).');
    }

    const errores = validarDatosHilo(datos);
    if (errores.length > 0) {
        throw new Error(errores.join(' '));
    }

    const filas = await consulta(
        `INSERT INTO hilos_foro (
            foro_id, autor_tipo, autor_id, autor_nombre, autor_rol_etiqueta, titulo, contenido, fijado, bloqueado, estado
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, FALSE, 'visible')
         RETURNING id_hilo::int AS id, foro_id::int AS "foroId", titulo, estado, bloqueado, fijado`,
        [
            foro.id,
            actor.tipo,
            actor.id,
            actor.nombre,
            actor.etiquetaRol,
            texto(datos.titulo),
            texto(datos.contenido)
        ]
    );

    return filas[0];
}

async function editarHiloPropio(idHilo, actor, datos) {
    exigirActor(actor);
    if (!idValido(idHilo) || !actor || !actor.puedeParticipar) return null;

    const [actual] = await consulta(
        'SELECT id_hilo::int AS id, autor_tipo AS "autorTipo", autor_id::int AS "autorId" FROM hilos_foro WHERE id_hilo = $1 AND eliminado_en IS NULL',
        [Number(idHilo)]
    );
    if (!actual) return null;

    const esPropio = actual.autorTipo === actor.tipo && actual.autorId === actor.id;
    if (!esPropio && !actor.esAdmin) {
        throw new Error('Solo el autor del hilo o el administrador pueden editarlo.');
    }

    const errores = validarDatosHilo(datos);
    if (errores.length > 0) {
        throw new Error(errores.join(' '));
    }

    const filas = await consulta(
        `UPDATE hilos_foro
         SET titulo = $2, contenido = $3, fecha_actualizacion = CURRENT_TIMESTAMP
         WHERE id_hilo = $1 AND eliminado_en IS NULL AND ($4::boolean OR (autor_tipo = $5 AND autor_id = $6))
         RETURNING id_hilo::int AS id, titulo, contenido`,
        [Number(idHilo), texto(datos.titulo), texto(datos.contenido), actor.esAdmin, actor.tipo, actor.id]
    );
    return filas[0] || null;
}

async function eliminarHiloPropio(idHilo, actor) {
    exigirActor(actor);
    if (!idValido(idHilo) || !actor) return false;

    const [actual] = await consulta(
        'SELECT id_hilo::int AS id, autor_tipo AS "autorTipo", autor_id::int AS "autorId" FROM hilos_foro WHERE id_hilo = $1 AND eliminado_en IS NULL',
        [Number(idHilo)]
    );
    if (!actual) return false;

    const esPropio = actual.autorTipo === actor.tipo && actual.autorId === actor.id;
    if (!esPropio && !actor.esAdmin) {
        throw new Error('No tienes permiso para eliminar este hilo.');
    }

    const filas = await consulta(
        `UPDATE hilos_foro
         SET eliminado_en = CURRENT_TIMESTAMP, estado = 'oculto'
         WHERE id_hilo = $1 AND eliminado_en IS NULL AND ($2::boolean OR (autor_tipo = $3 AND autor_id = $4))
         RETURNING id_hilo`,
        [Number(idHilo), actor.esAdmin, actor.tipo, actor.id]
    );
    return filas.length > 0;
}

// ==========================================================
// COMENTARIOS Y RESPUESTAS (RN-08, RN-FOR-11, RN-FOR-14)
// ==========================================================

async function crearComentario(idHilo, actor, datos) {
    exigirActor(actor);
    if (!actor || !actor.puedeParticipar) {
        throw new Error(actor?.motivoBloqueo || 'Debes contar con una cuenta activa/aprobada para comentar (RN-FOR-11 / RN-FOR-15).');
    }

    if (!idValido(idHilo)) {
        throw new Error('El hilo especificado no es válido (RN-08).');
    }

    const [hilo] = await consulta(
        `SELECT h.id_hilo::int AS id, h.bloqueado, h.estado, h.eliminado_en, f.estado AS "foroEstado"
         FROM hilos_foro h
         JOIN foros f ON f.id_foro = h.foro_id
         WHERE h.id_hilo = $1
         LIMIT 1`,
        [Number(idHilo)]
    );

    if (!hilo || hilo.estado !== 'visible' || hilo.eliminado_en || hilo.foroEstado !== 'activo') {
        throw new Error('El hilo de discusión no existe o no está disponible (RN-08).');
    }

    if (hilo.bloqueado) {
        throw new Error('Este hilo se encuentra bloqueado y no acepta nuevas respuestas (RN-FOR-07 / RN-FOR-14).');
    }

    const contenido = texto(datos.contenido);
    if (!contenido || contenido.length < 2 || contenido.length > 10000) {
        throw new Error('Escribe un comentario válido antes de publicar.');
    }

    let padreId = null;
    if (datos.padreId && idValido(datos.padreId)) {
        const [padre] = await consulta(
            'SELECT id_comentario::int AS id FROM comentarios_foro WHERE id_comentario = $1 AND hilo_id = $2 AND estado = \'visible\' AND eliminado_en IS NULL',
            [Number(datos.padreId), hilo.id]
        );
        if (padre) padreId = padre.id;
    }

    const filas = await consulta(
        `INSERT INTO comentarios_foro (
            hilo_id, padre_id, autor_tipo, autor_id, autor_nombre, autor_rol_etiqueta, contenido, estado
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'visible')
         RETURNING id_comentario::int AS id, hilo_id::int AS "hiloId", padre_id::int AS "padreId", contenido, estado`,
        [
            hilo.id,
            padreId,
            actor.tipo,
            actor.id,
            actor.nombre,
            actor.etiquetaRol,
            contenido
        ]
    );

    return filas[0];
}

async function eliminarComentarioPropio(idComentario, actor) {
    exigirActor(actor);
    if (!idValido(idComentario) || !actor) return false;

    const [actual] = await consulta(
        'SELECT id_comentario::int AS id, hilo_id::int AS "hiloId", autor_tipo AS "autorTipo", autor_id::int AS "autorId" FROM comentarios_foro WHERE id_comentario = $1 AND eliminado_en IS NULL',
        [Number(idComentario)]
    );
    if (!actual) return false;

    const esPropio = actual.autorTipo === actor.tipo && actual.autorId === actor.id;
    if (!esPropio && !actor.esAdmin) {
        throw new Error('No tienes permiso para eliminar este comentario.');
    }

    await consulta(
        `UPDATE comentarios_foro
         SET eliminado_en = CURRENT_TIMESTAMP, estado = 'oculto'
         WHERE id_comentario = $1 AND eliminado_en IS NULL AND ($2::boolean OR (autor_tipo = $3 AND autor_id = $4))`,
        [Number(idComentario), actor.esAdmin, actor.tipo, actor.id]
    );
    return actual;
}

// ==========================================================
// SOLICITUDES DE NUEVOS FOROS PROPUESTOS POR USUARIOS (Págs. 68-76)
// ==========================================================

async function crearSolicitudForo(actor, datos) {
    exigirActor(actor);
    if (!actor || !actor.puedeProponerForo || !['candidato', 'empresa'].includes(actor.tipo)) {
        throw new Error(
            actor?.motivoBloqueo ||
            'Solo los candidatos registrados activos y las empresas aprobadas pueden proponer nuevos foros (RN-FOR-02 / RN-FOR-03).'
        );
    }

    const nombre = texto(datos.nombre);
    const descripcion = texto(datos.descripcion);
    const motivo = texto(datos.motivo);
    const icono = texto(datos.icono) || '🗣️';

    if (!nombre || nombre.length < 4) {
        throw new Error('El nombre del foro propuesto es obligatorio (mínimo 4 caracteres).');
    }
    if (!descripcion || descripcion.length < 10) {
        throw new Error('La descripción del foro propuesto es obligatoria.');
    }
    if (!motivo || motivo.length < 10) {
        throw new Error('Debes explicar el motivo o finalidad de la propuesta.');
    }

    // Verificar que no exista ya un foro con ese mismo nombre o slug
    const slugBase = generarSlug(nombre);
    const duplicados = await consulta(
        'SELECT id_foro FROM foros WHERE LOWER(nombre) = LOWER($1) OR slug = $2 LIMIT 1',
        [nombre, slugBase]
    );
    if (duplicados.length > 0) {
        throw new Error('Ya existe un foro público con un nombre similar.');
    }

    const filas = await consulta(
        `INSERT INTO solicitudes_foros (
            solicitante_tipo, solicitante_id, solicitante_nombre, nombre, descripcion, icono, motivo, estado
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente')
         RETURNING id_solicitud::int AS id, nombre, descripcion, motivo, estado, fecha_creacion AS "fechaCreacion"`,
        [actor.tipo, actor.id, actor.nombre, nombre, descripcion, icono, motivo]
    );

    // Notificar automáticamente al administrador (Pág. 114)
    await consulta(
        `INSERT INTO notificaciones (destinatario_tipo, titulo, mensaje, tipo_evento, referencia_url, estado)
         VALUES ('admin', $1, $2, 'solicitud_foro', '/administrativo/foros', 'publicada')`,
        [
            `Nueva propuesta de foro: ${nombre}`,
            `${actor.nombre} (${actor.tipo}) ha solicitado crear el foro "${nombre}".`
        ]
    );

    return filas[0];
}

async function listarSolicitudesForoUsuario(actor) {
    exigirActor(actor);
    if (!actor || actor.tipo === 'visitante') return [];

    if (actor.esAdmin) {
        return consulta(
            `SELECT
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
                s.fecha_revision AS "fechaRevision",
                f.slug AS "foroSlug"
             FROM solicitudes_foros s
             LEFT JOIN foros f ON f.id_foro = s.foro_creado_id
             ORDER BY s.fecha_creacion DESC`
        );
    }

    return consulta(
        `SELECT
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
            s.fecha_revision AS "fechaRevision",
            f.slug AS "foroSlug"
         FROM solicitudes_foros s
         LEFT JOIN foros f ON f.id_foro = s.foro_creado_id
         WHERE s.solicitante_tipo = $1 AND s.solicitante_id = $2
         ORDER BY s.fecha_creacion DESC`,
        [actor.tipo, actor.id]
    );
}

// ==========================================================
// DENUNCIAS DESDE LA COMUNIDAD (RN-09, RN-FOR-12)
// ==========================================================

async function denunciarContenidoForo(actor, datos) {
    exigirActor(actor);
    const tipoContenido = ['hilo', 'comentario'].includes(datos.tipoContenido) ? datos.tipoContenido : null;
    const contenidoId = idValido(datos.contenidoId) ? Number(datos.contenidoId) : null;
    const motivo = texto(datos.motivo);
    const descripcion = texto(datos.descripcion);

    if (!tipoContenido || !contenidoId) {
        throw new Error('Debes indicar el hilo o comentario a reportar (RN-09).');
    }
    if (!motivo) {
        throw new Error('Selecciona o escribe el motivo de la denuncia.');
    }

    let resumenContenido = '';
    let autorReportado = '';

    if (tipoContenido === 'hilo') {
        const [h] = await consulta('SELECT titulo, autor_nombre FROM hilos_foro WHERE id_hilo = $1', [contenidoId]);
        if (!h) throw new Error('El hilo que intentas reportar no existe (RN-09).');
        resumenContenido = h.titulo;
        autorReportado = h.autor_nombre;
    } else {
        const [c] = await consulta('SELECT contenido, autor_nombre FROM comentarios_foro WHERE id_comentario = $1', [contenidoId]);
        if (!c) throw new Error('El comentario que intentas reportar no existe (RN-09).');
        resumenContenido = c.contenido.slice(0, 140);
        autorReportado = c.autor_nombre;
    }

    const filas = await consulta(
        `INSERT INTO reportes (
            denunciante_tipo, denunciante_id, denunciante_nombre,
            tipo_contenido, contenido_id, contenido_resumen, usuario_reportado_nombre,
            motivo, descripcion, estado
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendiente')
         RETURNING id_reporte::int AS id, tipo_contenido AS "tipoContenido", contenido_id::int AS "contenidoId", estado`,
        [
            actor?.tipo || 'visitante',
            actor?.id || 0,
            actor?.nombre || 'Visitante',
            tipoContenido,
            contenidoId,
            resumenContenido,
            autorReportado,
            motivo,
            descripcion || null
        ]
    );

    await consulta(
        `INSERT INTO notificaciones (destinatario_tipo, titulo, mensaje, tipo_evento, referencia_url, estado)
         VALUES ('admin', $1, $2, 'nueva_denuncia', '/administrativo/moderacion', 'publicada')`,
        [
            `Nueva denuncia sobre ${tipoContenido}`,
            `Se reportó "${resumenContenido}" por motivo: ${motivo}.`
        ]
    );

    return filas[0];
}

async function registrarVista(idHilo) {
    if (!idValido(idHilo)) return;
    await consulta("UPDATE hilos_foro h SET vistas = COALESCE(h.vistas, 0) + 1 WHERE h.id_hilo = $1 AND h.estado = 'visible' AND h.eliminado_en IS NULL AND EXISTS (SELECT 1 FROM foros f WHERE f.id_foro = h.foro_id AND f.estado = 'activo')", [idHilo]);
}

module.exports = {
    registrarVista,
    usarConexion,
    generarSlug,
    resolverActor,
    listarActoresDisponibles,
    obtenerEstadisticasComunidad,
    listarForosPublicos,
    obtenerForoPorSlugOId,
    listarHilosDeForo,
    obtenerHiloDetalle,
    validarDatosHilo,
    crearHilo,
    editarHiloPropio,
    eliminarHiloPropio,
    crearComentario,
    eliminarComentarioPropio,
    crearSolicitudForo,
    listarSolicitudesForoUsuario,
    denunciarContenidoForo
};
