const { pool } = require('../config/database');

async function obtenerPerfilPorId(idCandidato) {
    const consulta = `
        SELECT
            id_candidato,
            nombre,
            cargo,
            empresa_actual,
            ubicacion,
            correo,
            telefono,
            anios_experiencia,
            habilidades,
            experiencia,
            formacion,
            cv_url,
            fecha_registro,
            COALESCE(estado, 'activo') AS estado,
            motivo_suspension
        FROM candidatos
        WHERE id_candidato = $1
        LIMIT 1
    `;

    const resultado = await pool.query(consulta, [idCandidato]);
    return resultado.rows[0] || null;
}

async function obtenerCandidatoPorDefecto() {
    const consulta = `
        SELECT *
        FROM candidatos
        ORDER BY id_candidato ASC
        LIMIT 1
    `;
    const resultado = await pool.query(consulta);
    return resultado.rows[0] || null;
}

async function actualizarPerfil(idCandidato, datos) {
    const habilidadesArray = typeof datos.habilidades === 'string'
        ? datos.habilidades.split(',').map((h) => h.trim()).filter(Boolean)
        : (Array.isArray(datos.habilidades) ? datos.habilidades : []);

    const anios = Number.isFinite(Number(datos.anios_experiencia))
        ? Math.max(0, Number(datos.anios_experiencia))
        : 0;

    const consulta = `
        UPDATE candidatos
        SET
            nombre = $1,
            cargo = $2,
            empresa_actual = $3,
            ubicacion = $4,
            telefono = $5,
            anios_experiencia = $6,
            habilidades = $7,
            cv_url = $8
        WHERE id_candidato = $9
        RETURNING *
    `;

    const valores = [
        datos.nombre.trim(),
        datos.cargo?.trim() || null,
        datos.empresa_actual?.trim() || null,
        datos.ubicacion?.trim() || null,
        datos.telefono?.trim() || null,
        anios,
        habilidadesArray,
        datos.cv_url?.trim() || null,
        idCandidato
    ];

    const resultado = await pool.query(consulta, valores);
    return resultado.rows[0] || null;
}

async function obtenerHistorialPostulaciones(idCandidato) {
    const consulta = `
        SELECT
            p.id_postulacion,
            p.fecha_postulacion,
            p.estado,
            v.id_vacante,
            v.titulo AS titulo_vacante,
            v.ubicacion,
            v.modalidad,
            e.nombre AS empresa,
            e.logo_url AS logo_empresa
        FROM postulaciones p
        INNER JOIN vacantes v ON v.id_vacante = p.vacante_id
        INNER JOIN empresas e ON e.id_empresa = v.empresa_id
        WHERE p.candidato_id = $1
        ORDER BY p.fecha_postulacion DESC
    `;

    const resultado = await pool.query(consulta, [idCandidato]);
    return resultado.rows;
}

async function cancelarPostulacion(idPostulacion, idCandidato) {
    const consulta = `
        DELETE FROM postulaciones
        WHERE id_postulacion = $1
          AND candidato_id = $2
          AND estado = 'nuevo'
        RETURNING id_postulacion
    `;

    const resultado = await pool.query(consulta, [idPostulacion, idCandidato]);
    return resultado.rows[0] || null;
}

async function obtenerAlertas(idCandidato) {
    const consulta = `
        SELECT
            id_alerta,
            palabras_clave,
            ubicacion,
            modalidad,
            frecuencia,
            activa,
            fecha_creacion
        FROM alertas_empleo
        WHERE candidato_id = $1
        ORDER BY fecha_creacion DESC
    `;

    const resultado = await pool.query(consulta, [idCandidato]);
    return resultado.rows;
}

async function crearAlerta(idCandidato, datos) {
    const consulta = `
        INSERT INTO alertas_empleo (
            candidato_id,
            palabras_clave,
            ubicacion,
            modalidad,
            frecuencia,
            activa
        )
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING *
    `;

    const valores = [
        idCandidato,
        datos.palabras_clave.trim(),
        datos.ubicacion?.trim() || null,
        datos.modalidad || null,
        datos.frecuencia || 'diaria'
    ];

    const resultado = await pool.query(consulta, valores);
    return resultado.rows[0];
}

async function alternarEstadoAlerta(idAlerta, idCandidato) {
    const consulta = `
        UPDATE alertas_empleo
        SET activa = NOT activa
        WHERE id_alerta = $1
          AND candidato_id = $2
        RETURNING *
    `;

    const resultado = await pool.query(consulta, [idAlerta, idCandidato]);
    return resultado.rows[0] || null;
}

async function eliminarAlerta(idAlerta, idCandidato) {
    const consulta = `
        DELETE FROM alertas_empleo
        WHERE id_alerta = $1
          AND candidato_id = $2
        RETURNING id_alerta
    `;

    const resultado = await pool.query(consulta, [idAlerta, idCandidato]);
    return resultado.rows[0] || null;
}

async function obtenerValoraciones(idCandidato) {
    const consulta = `
        SELECT
            val.id_valoracion,
            val.puntuacion,
            val.titulo,
            val.comentario,
            val.fecha_valoracion,
            (COALESCE(val.estado_moderacion, 'visible') <> 'visible') AS moderada,
            e.id_empresa,
            e.nombre AS empresa
        FROM valoraciones val
        INNER JOIN empresas e ON e.id_empresa = val.empresa_id
        WHERE val.candidato_id = $1
        ORDER BY val.fecha_valoracion DESC
    `;

    const resultado = await pool.query(consulta, [idCandidato]);
    return resultado.rows;
}

async function obtenerEmpresasActivas() {
    const consulta = `
        SELECT id_empresa, nombre
        FROM empresas
        WHERE estado = 'activa'
          AND COALESCE(estado_aprobacion, 'aprobada') = 'aprobada'
        ORDER BY nombre ASC
    `;

    const resultado = await pool.query(consulta);
    return resultado.rows;
}

async function crearValoracion(idCandidato, datos) {
    const consulta = `
        INSERT INTO valoraciones (
            candidato_id,
            empresa_id,
            puntuacion,
            titulo,
            comentario
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;

    const valores = [
        idCandidato,
        Number(datos.empresa_id),
        Number(datos.puntuacion),
        datos.titulo?.trim() || null,
        datos.comentario.trim()
    ];

    const resultado = await pool.query(consulta, valores);
    return resultado.rows[0];
}

async function actualizarValoracion(idValoracion, idCandidato, datos) {
    const consulta = `
        UPDATE valoraciones
        SET
            puntuacion = $1,
            titulo = $2,
            comentario = $3
        WHERE id_valoracion = $4
          AND candidato_id = $5
        RETURNING *
    `;

    const valores = [
        Number(datos.puntuacion),
        datos.titulo?.trim() || null,
        datos.comentario.trim(),
        idValoracion,
        idCandidato
    ];

    const resultado = await pool.query(consulta, valores);
    return resultado.rows[0] || null;
}

async function obtenerCursosParaCandidato(idCandidato) {
    const { rows } = await pool.query(
        `SELECT
            c.id_curso::int AS id,
            c.titulo,
            c.descripcion,
            c.nivel,
            c.duracion_minutos AS "duracionMinutos",
            c.autor,
            i.id_inscripcion::int AS "inscripcionId",
            COALESCE(i.porcentaje_avance, 0)::int AS "porcentajeAvance",
            i.estado AS "estadoInscripcion",
            (SELECT COUNT(*)::int FROM lecciones_curso l JOIN modulos_curso m ON m.id_modulo = l.modulo_id WHERE m.curso_id = c.id_curso AND l.estado = 'publicada') AS "totalLecciones"
         FROM cursos c
         LEFT JOIN inscripciones_curso i ON i.curso_id = c.id_curso AND i.candidato_id = $1
         WHERE c.estado = 'publicado'
         ORDER BY c.id_curso ASC`,
        [Number(idCandidato)]
    );
    return rows;
}

module.exports = {
    obtenerPerfilPorId,
    obtenerCandidatoPorDefecto,
    actualizarPerfil,
    obtenerHistorialPostulaciones,
    cancelarPostulacion,
    obtenerAlertas,
    crearAlerta,
    alternarEstadoAlerta,
    eliminarAlerta,
    obtenerValoraciones,
    obtenerEmpresasActivas,
    crearValoracion,
    actualizarValoracion,
    obtenerCursosParaCandidato
};
