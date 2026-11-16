
// src/services/recursos.service.js

const { pool } = require('../config/database');

// ==========================================
// CONSULTA BASE DE RECURSOS
// ==========================================

const SELECT_RECURSOS = `
    SELECT
        r.id_recurso AS id,
        r.titulo,
        r.resumen,
        r.tipo,
        r.imagen_url AS "imagenUrl",
        r.autor,
        r.tiempo_lectura AS "tiempoLectura",
        r.fecha_publicacion AS "fechaPublicacion",
        r.destacado,
        c.id_categoria AS "idCategoria",
        c.nombre AS categoria
    FROM recursos r
    INNER JOIN categorias_recursos c
        ON c.id_categoria = r.categoria_id
`;

const RECURSO_VISIBLE = `COALESCE(r.visibilidad, 'publico') = 'publico'`;

// ==========================================
// OBTENER CATEGORÍAS DISPONIBLES
// ==========================================

async function obtenerCategorias() {

    const consulta = `
        SELECT
            id_categoria AS id,
            nombre,
            descripcion
        FROM categorias_recursos
        WHERE estado = TRUE
        ORDER BY nombre ASC
    `;

    const resultado = await pool.query(consulta);

    return resultado.rows;
}


// ==========================================
// CONSTRUIR FILTROS DE BÚSQUEDA
// ==========================================

function construirFiltros(filtros = {}) {

    const condiciones = [
        "r.estado = 'publicado'",
        "c.estado = TRUE",
        RECURSO_VISIBLE
    ];

    const valores = [];

    function agregarCondicion(condicion, valor) {

        valores.push(valor);

        condiciones.push(
            condicion.replace('?', `$${valores.length}`)
        );
    }

    // Búsqueda por título o resumen.

    if (filtros.q && filtros.q.trim()) {

        const palabra = `%${filtros.q.trim()}%`;

        valores.push(palabra);

        const posicion = valores.length;

        condiciones.push(`
            (
                r.titulo ILIKE $${posicion}
                OR r.resumen ILIKE $${posicion}
                OR r.autor ILIKE $${posicion}
            )
        `);
    }

    // Filtro por categoría.

    if (filtros.categoria) {

        const categoria = Number(filtros.categoria);

        if (Number.isInteger(categoria) && categoria > 0) {

            agregarCondicion(
                'r.categoria_id = ?',
                categoria
            );
        }
    }

    // Filtro por tipo de recurso.

    const tiposPermitidos = [
        'articulo',
        'tutorial',
        'video',
        'audio'
    ];

    if (tiposPermitidos.includes(filtros.tipo)) {

        agregarCondicion(
            'r.tipo = ?',
            filtros.tipo
        );
    }

    // Filtro por fecha de publicación.

    if (filtros.fecha === '7') {

        condiciones.push(
            "r.fecha_publicacion >= CURRENT_DATE - INTERVAL '7 days'"
        );

    } else if (filtros.fecha === '30') {

        condiciones.push(
            "r.fecha_publicacion >= CURRENT_DATE - INTERVAL '30 days'"
        );
    }

    return {
        where: condiciones.join(' AND '),
        valores
    };
}


// ==========================================
// BUSCAR Y LISTAR RECURSOS
// ==========================================

async function buscarRecursos(filtros = {}, opciones = {}) {

    const limiteSolicitado = Number(opciones.limite) || 9;

    const limite = Math.min(
        Math.max(limiteSolicitado, 1),
        50
    );

    const paginaSolicitada = Number(opciones.pagina) || 1;

    const pagina = Math.max(paginaSolicitada, 1);

    const offset = (pagina - 1) * limite;

    const { where, valores } = construirFiltros(filtros);

    // Ordenamiento permitido.

    const ordenamientos = {

        recientes: 'r.fecha_publicacion DESC',

        antiguas: 'r.fecha_publicacion ASC',

        alfabetico: 'r.titulo ASC'

    };

    const orden = ordenamientos[filtros.orden]
        || ordenamientos.recientes;


    const consultaRecursos = `
        ${SELECT_RECURSOS}

        WHERE ${where}

        ORDER BY
            r.destacado DESC,
            ${orden}

        LIMIT $${valores.length + 1}
        OFFSET $${valores.length + 2}
    `;


    const consultaTotal = `
        SELECT COUNT(*) AS total

        FROM recursos r

        INNER JOIN categorias_recursos c
            ON c.id_categoria = r.categoria_id

        WHERE ${where}
    `;


    const [
        resultadoRecursos,
        resultadoTotal
    ] = await Promise.all([

        pool.query(
            consultaRecursos,
            [...valores, limite, offset]
        ),

        pool.query(
            consultaTotal,
            valores
        )

    ]);


    return {

        recursos: resultadoRecursos.rows,

        totalResultados: Number(
            resultadoTotal.rows[0].total
        ),

        pagina,

        limite

    };
}


// ==========================================
// OBTENER RECURSO POR IDENTIFICADOR
// ==========================================

async function obtenerRecursoPorId(id) {

    const identificador = Number(id);

    if (!Number.isInteger(identificador) || identificador <= 0) {
        return null;
    }

    const consulta = `
        ${SELECT_RECURSOS}

        WHERE r.id_recurso = $1

        AND r.estado = 'publicado'

        AND ${RECURSO_VISIBLE}

        AND c.estado = TRUE

        LIMIT 1
    `;

    const resultado = await pool.query(
        consulta,
        [identificador]
    );

    const recurso = resultado.rows[0];

    if (!recurso) {
        return null;
    }


    // Obtener las secciones del recurso.

    const consultaSecciones = `
        SELECT
            id_seccion AS id,
            titulo,
            contenido,
            orden

        FROM secciones_recursos

        WHERE recurso_id = $1

        ORDER BY orden ASC
    `;

    const resultadoSecciones = await pool.query(
        consultaSecciones,
        [identificador]
    );


    recurso.secciones = resultadoSecciones.rows;

    return recurso;
}


// ==========================================
// OBTENER RECURSOS RELACIONADOS
// ==========================================

async function obtenerRecursosRelacionados(recursoActual) {

    if (!recursoActual) {
        return [];
    }

    const consulta = `
        ${SELECT_RECURSOS}

        WHERE r.categoria_id = $1

        AND r.id_recurso <> $2

        AND r.estado = 'publicado'

        AND ${RECURSO_VISIBLE}

        AND c.estado = TRUE

        ORDER BY r.fecha_publicacion DESC

        LIMIT 3
    `;

    const resultado = await pool.query(
        consulta,
        [
            recursoActual.idCategoria,
            recursoActual.id
        ]
    );

    return resultado.rows;
}


// ==========================================
// EXPORTAR FUNCIONES
// ==========================================

module.exports = {

    obtenerCategorias,

    buscarRecursos,

    obtenerRecursoPorId,

    obtenerRecursosRelacionados

};
