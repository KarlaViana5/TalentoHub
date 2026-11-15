
const { pool } = require('../config/database');

// Columnas que utilizaremos para mostrar las vacantes.
const SELECT_VACANTES = `
    SELECT
        v.id_vacante AS id,
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

// Construye los filtros de búsqueda.
function construirFiltros(filtros = {}) {
    const condiciones = [
        "v.estado = 'publicada'",
        "(v.fecha_cierre IS NULL OR v.fecha_cierre >= CURRENT_DATE)",
        "e.estado = 'activa'"
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

        // La búsqueda utiliza cuatro parámetros.
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
    const limite = Number(opciones.limite) || 10;
    const pagina = Number(opciones.pagina) || 1;
    const offset = (pagina - 1) * limite;

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

// Obtiene una vacante por su identificador.
async function obtenerVacantePorId(id) {
    const consulta = `
        ${SELECT_VACANTES}
        WHERE v.id_vacante = $1
        AND v.estado = 'publicada'
        AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= CURRENT_DATE)
        LIMIT 1
    `;

    const resultado = await pool.query(consulta, [id]);

    return resultado.rows[0] || null;
}

// Obtiene otras vacantes del mismo sector.
async function obtenerVacantesSimilares(vacanteActual) {
    if (!vacanteActual) return [];

    const consulta = `
        ${SELECT_VACANTES}
        WHERE v.sector = $1
        AND v.id_vacante <> $2
        AND v.estado = 'publicada'
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

module.exports = {
    buscarVacantes,
    obtenerVacantePorId,
    obtenerVacantesSimilares
};
