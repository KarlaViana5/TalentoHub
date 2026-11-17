const { paginacion } = require('../utils/paginacion');
const { pool } = require('../config/database');

// Columnas que utilizaremos para mostrar las vacantes.
const SELECT_VACANTES = `
    SELECT
        v.id_vacante AS id,
        v.empresa_id AS "empresaId",
        v.titulo,
        e.nombre AS empresa,
        e.logo_url AS "logoEmpresa",
        v.ubicacion,
        v.sector,
        v.modalidad,
        v.tipo_contrato AS "tipoContrato",
        v.experiencia,
        v.salario_minimo AS "salarioMinimo",
        v.salario_maximo AS "salarioMaximo",
        v.fecha_publicacion AS "fechaPublicacion",
        v.descripcion,
        v.responsabilidades,
        v.requisitos,
        v.beneficios,
        v.correo_contacto AS contacto,
        v.nombre_reclutador AS reclutador
    FROM vacantes v
    INNER JOIN empresas e ON e.id_empresa = v.empresa_id
`;

const VACANTE_VISIBLE = `COALESCE(v.estado_moderacion, 'normal') = 'normal'`;

// Construye los filtros de búsqueda.
function construirFiltros(filtros = {}) {
    const condiciones = [
        "v.estado = 'publicada'",
        "(v.fecha_cierre IS NULL OR v.fecha_cierre >= CURRENT_DATE)",
        "e.estado = 'activa'",
        "COALESCE(e.estado_aprobacion, 'aprobada') = 'aprobada'",
        VACANTE_VISIBLE
    ];

    const valores = [];

    function agregarCondicion(condicion, valor) {
        valores.push(valor);
        condiciones.push(condicion.replace('?', `$${valores.length}`));
    }

    if (filtros.q?.trim()) {
        agregarCondicion(
            `(v.titulo ILIKE ? OR e.nombre ILIKE ? OR v.sector ILIKE ? OR v.descripcion ILIKE ?)`,
            `%${filtros.q.trim()}%`
        );

        const ultimo = valores.pop();
        const posicion = valores.length + 1;
        valores.push(ultimo, ultimo, ultimo, ultimo);

        condiciones[condiciones.length - 1] =
            `(v.titulo ILIKE $${posicion} OR e.nombre ILIKE $${posicion + 1} OR v.sector ILIKE $${posicion + 2} OR v.descripcion ILIKE $${posicion + 3})`;
    }

    if (filtros.ubicacion?.trim()) {
        agregarCondicion('v.ubicacion ILIKE ?', `%${filtros.ubicacion.trim()}%`);
    }

    if (filtros.experiencia) {
        agregarCondicion('v.experiencia = ?', filtros.experiencia);
    }

    if (filtros.sector) {
        agregarCondicion('v.sector = ?', filtros.sector);
    }

    if (filtros.modalidad) {
        agregarCondicion('v.modalidad = ?', filtros.modalidad);
    }

    if (filtros.tipoContrato) {
        agregarCondicion('v.tipo_contrato = ?', filtros.tipoContrato);
    }

    if (filtros.salarioMinimo !== '' && filtros.salarioMinimo !== undefined) {
        const salario = Number(filtros.salarioMinimo);

        if (Number.isFinite(salario) && salario >= 0) {
            agregarCondicion('v.salario_maximo >= ?', salario);
        }
    }

    if (filtros.salarioMaximo !== '' && filtros.salarioMaximo !== undefined) {
        const salario = Number(filtros.salarioMaximo);

        if (Number.isFinite(salario) && salario >= 0) {
            agregarCondicion('v.salario_minimo <= ?', salario);
        }
    }

    if (filtros.fechaPublicacion === '7') {
        condiciones.push("v.fecha_publicacion >= CURRENT_DATE - INTERVAL '7 days'");
    }

    if (filtros.fechaPublicacion === '30') {
        condiciones.push("v.fecha_publicacion >= CURRENT_DATE - INTERVAL '30 days'");
    }

    return {
        where: condiciones.join(' AND '),
        valores
    };
}

// Busca vacantes en PostgreSQL con filtros y paginación.
async function buscarVacantes(filtros = {}, opciones = {}) {
    const { limite, pagina, offset } = paginacion(opciones, 10);

    const { where, valores } = construirFiltros(filtros);

    const ordenamientos = {
        recientes: 'v.fecha_publicacion DESC',
        antiguas: 'v.fecha_publicacion ASC',
        salarioMayor: 'v.salario_maximo DESC NULLS LAST',
        salarioMenor: 'v.salario_minimo ASC NULLS LAST'
    };

    const orden = ordenamientos[filtros.orden] || ordenamientos.recientes;

    const consultaVacantes = `
        ${SELECT_VACANTES}
        WHERE ${where}
        ORDER BY ${orden}
        LIMIT $${valores.length + 1}
        OFFSET $${valores.length + 2}
    `;

    const consultaTotal = `
        SELECT COUNT(*) AS total
        FROM vacantes v
        INNER JOIN empresas e ON e.id_empresa = v.empresa_id
        WHERE ${where}
    `;

    const [resultadoVacantes, resultadoTotal] = await Promise.all([
        pool.query(consultaVacantes, [...valores, limite, offset]),
        pool.query(consultaTotal, valores)
    ]);

    return {
        vacantes: resultadoVacantes.rows,
        totalResultados: Number(resultadoTotal.rows[0].total)
    };
}

// Obtiene una vacante por su identificador e incrementa su contador de vistas.
async function obtenerVacantePorId(id) {
    if (!/^[1-9]\d{0,14}$/.test(String(id))) return null;
    const consulta = `
        ${SELECT_VACANTES}
        WHERE v.id_vacante = $1
        AND v.estado = 'publicada'
        AND e.estado = 'activa'
        AND COALESCE(e.estado_aprobacion, 'aprobada') = 'aprobada'
        AND ${VACANTE_VISIBLE}
        AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= CURRENT_DATE)
        LIMIT 1
    `;

    const resultado = await pool.query(consulta, [id]);
    const vacante = resultado.rows[0] || null;

    return vacante;
}

// Obtiene otras vacantes del mismo sector.
async function obtenerVacantesSimilares(vacanteActual) {
    if (!vacanteActual) return [];

    const consulta = `
        ${SELECT_VACANTES}
        WHERE v.sector = $1
        AND v.id_vacante <> $2
        AND v.estado = 'publicada'
        AND e.estado = 'activa'
        AND COALESCE(e.estado_aprobacion, 'aprobada') = 'aprobada'
        AND ${VACANTE_VISIBLE}
        AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= CURRENT_DATE)
        ORDER BY v.fecha_publicacion DESC
        LIMIT 3
    `;

    const resultado = await pool.query(consulta, [
        vacanteActual.sector,
        vacanteActual.id
    ]);

    return resultado.rows;
}

async function obtenerPostulacionCandidato(vacanteId, candidatoId) {
    if (!vacanteId || !candidatoId) return null;
    const { rows } = await pool.query(
        `SELECT id_postulacion AS id, estado, fecha_postulacion AS "fechaPostulacion"
         FROM postulaciones
         WHERE vacante_id = $1 AND candidato_id = $2
         LIMIT 1`,
        [Number(vacanteId), Number(candidatoId)]
    );
    return rows[0] || null;
}

async function postularCandidatoAVacante(vacanteId, candidatoId) {
    const vacante = await obtenerVacantePorId(vacanteId);
    if (!vacante) {
        throw new Error('La vacante seleccionada ya no se encuentra disponible.');
    }

    const { rows: candRows } = await pool.query(
        'SELECT id_candidato, nombre, COALESCE(estado, \'activo\') AS estado FROM candidatos WHERE id_candidato = $1 LIMIT 1',
        [Number(candidatoId)]
    );
    const candidato = candRows[0];
    if (!candidato) {
        throw new Error('No se encontró tu perfil de candidato.');
    }
    if (candidato.estado === 'suspendido') {
        throw new Error('Tu cuenta de candidato está suspendida y no puede enviar nuevas postulaciones.');
    }

    const previa = await obtenerPostulacionCandidato(vacanteId, candidatoId);
    if (previa) {
        throw new Error('Ya te has postulado anteriormente a esta vacante.');
    }

    const { rows } = await pool.query(
        `INSERT INTO postulaciones (vacante_id, candidato_id, estado, fecha_postulacion)
         VALUES ($1, $2, 'nuevo', CURRENT_TIMESTAMP)
         RETURNING id_postulacion AS id, estado, fecha_postulacion AS "fechaPostulacion"`,
        [Number(vacanteId), Number(candidatoId)]
    );

    await pool.query(
        `INSERT INTO notificaciones (destinatario_tipo, destinatario_id, titulo, mensaje, tipo_evento, referencia_url)
         VALUES ('empresas', $1, $2, $3, 'nueva_postulacion', $4)`,
        [
            vacante.empresaId,
            `Nueva postulación en ${vacante.titulo}`,
            `El candidato ${candidato.nombre} se ha postulado a la vacante "${vacante.titulo}".`,
            `/empresarial/postulaciones?vacante=${vacante.id}`
        ]
    ).catch(() => {});

    return rows[0];
}

async function reportarVacantePublica(vacanteId, usuario, datos = {}) {
    const vacante = await obtenerVacantePorId(vacanteId);
    if (!vacante) {
        throw new Error('La vacante no existe.');
    }
    const motivo = String(datos.motivo || '').trim();
    const descripcion = String(datos.descripcion || '').trim();
    if (!motivo) {
        throw new Error('Selecciona o indica el motivo del reporte.');
    }

    const denuncianteTipo = usuario && ['candidato', 'empresa', 'admin'].includes(usuario.rol)
        ? usuario.rol
        : 'visitante';
    const denuncianteId = usuario ? (usuario.candidatoId || usuario.empresaId || usuario.id || 1) : 1;
    const denuncianteNombre = usuario ? usuario.nombreMostrar : 'Visitante';

    await pool.query(
        `INSERT INTO reportes (
            denunciante_tipo, denunciante_id, denunciante_nombre,
            tipo_contenido, contenido_id, contenido_resumen,
            usuario_reportado_nombre, motivo, descripcion, estado
         )
         VALUES ($1, $2, $3, 'vacante', $4, $5, $6, $7, $8, 'pendiente')`,
        [
            denuncianteTipo,
            denuncianteId,
            denuncianteNombre,
            Number(vacanteId),
            vacante.titulo,
            vacante.empresa,
            motivo,
            descripcion || null
        ]
    );
}

async function registrarVista(id) {
    if (!/^[1-9]\d{0,14}$/.test(String(id))) return;
    await pool.query("UPDATE vacantes v SET vistas = COALESCE(v.vistas, 0) + 1 WHERE v.id_vacante = $1 AND v.estado = 'publicada' AND COALESCE(v.estado_moderacion,'normal') = 'normal' AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= CURRENT_DATE) AND EXISTS (SELECT 1 FROM empresas e WHERE e.id_empresa = v.empresa_id AND e.estado = 'activa' AND e.estado_aprobacion = 'aprobada')", [id]);
}
module.exports = {
    registrarVista,
    buscarVacantes,
    obtenerVacantePorId,
    obtenerVacantesSimilares,
    obtenerPostulacionCandidato,
    postularCandidatoAVacante,
    reportarVacantePublica
};
