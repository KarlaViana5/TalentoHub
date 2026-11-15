const { pool } = require('../config/database');

// usuario simulado
const empleadorActual = {
    nombre: 'María Rodríguez',
    empresaId: 1
};

const ESTADOS_EMPRESA = ['Activa', 'Pendiente', 'Inactiva'];
const ESTADOS_VACANTE = ['Activa', 'Borrador', 'Inactiva', 'Cancelada'];
const ESTADOS_POSTULACION = ['Nuevo', 'Preseleccionado', 'Entrevista', 'Contratado', 'Rechazado'];
const SECTORES = ['Tecnología', 'Logística', 'Diseño y Marketing', 'Finanzas', 'Salud', 'Educación', 'Comercio', 'ONG'];

// estados en la bd
const ESTADO_VACANTE_BD = { Activa: 'publicada', Inactiva: 'pausada', Cancelada: 'cerrada', Borrador: 'borrador' };
const ESTADO_VACANTE_APP = { publicada: 'Activa', pausada: 'Inactiva', cerrada: 'Cancelada', borrador: 'Borrador' };

// pa las pruebas
let db = pool;

function usarConexion(conexion) {
    db = conexion || pool;
}

async function consulta(sql, valores = []) {
    const resultado = await db.query(sql, valores);
    return resultado.rows;
}

// utilidades

function texto(valor) {
    return String(valor ?? '').trim();
}

function convertirLista(valor) {
    const lista = Array.isArray(valor) ? valor : String(valor ?? '').split(/\r?\n/);
    return lista.map(texto).filter(Boolean);
}

function capitalizar(valor) {
    return valor ? valor.charAt(0).toUpperCase() + valor.slice(1) : valor;
}

function idValido(id) {
    return /^\d+$/.test(String(id));
}

// empresas

const SELECT_EMPRESAS = `
    SELECT id_empresa::int AS id, nombre, sector, ubicacion, descripcion, estado
    FROM empresas
`;

function mapearEmpresa(fila) {
    return fila ? { ...fila, estado: capitalizar(fila.estado) } : null;
}

async function listarEmpresas(filtros = {}) {
    const condiciones = [];
    const valores = [];

    if (texto(filtros.q)) {
        valores.push(`%${texto(filtros.q)}%`);
        condiciones.push(`(nombre ILIKE $${valores.length} OR ubicacion ILIKE $${valores.length})`);
    }
    if (filtros.sector) {
        valores.push(filtros.sector);
        condiciones.push(`sector = $${valores.length}`);
    }
    if (filtros.estado) {
        valores.push(filtros.estado.toLowerCase());
        condiciones.push(`estado = $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const filas = await consulta(`${SELECT_EMPRESAS} ${where} ORDER BY nombre`, valores);
    return filas.map(mapearEmpresa);
}

async function obtenerEmpresa(id) {
    if (!idValido(id)) return null;
    const filas = await consulta(`${SELECT_EMPRESAS} WHERE id_empresa = $1`, [id]);
    return mapearEmpresa(filas[0]);
}

function validarEmpresa(datos) {
    const errores = [];
    if (!texto(datos.nombre)) errores.push('El nombre de la empresa es obligatorio.');
    if (!SECTORES.includes(datos.sector)) errores.push('Selecciona un sector válido.');
    if (!texto(datos.ubicacion)) errores.push('La ubicación es obligatoria.');
    return errores;
}

async function crearEmpresa(datos) {
    const filas = await consulta(
        `INSERT INTO empresas (nombre, sector, ubicacion, descripcion, estado)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id_empresa::int AS id, nombre, sector, ubicacion, descripcion, estado`,
        [texto(datos.nombre), datos.sector, texto(datos.ubicacion), texto(datos.descripcion), datos.activa ? 'activa' : 'inactiva']
    );
    return mapearEmpresa(filas[0]);
}

async function actualizarEmpresa(id, datos) {
    if (!idValido(id)) return null;
    const filas = await consulta(
        `UPDATE empresas SET nombre = $2, sector = $3, ubicacion = $4, descripcion = $5, estado = $6
         WHERE id_empresa = $1
         RETURNING id_empresa::int AS id, nombre, sector, ubicacion, descripcion, estado`,
        [id, texto(datos.nombre), datos.sector, texto(datos.ubicacion), texto(datos.descripcion), datos.activa ? 'activa' : 'inactiva']
    );
    return mapearEmpresa(filas[0]);
}

async function cambiarEstadoEmpresa(id, estado) {
    if (!idValido(id) || !ESTADOS_EMPRESA.includes(estado)) return null;
    const filas = await consulta(
        `UPDATE empresas SET estado = $2 WHERE id_empresa = $1
         RETURNING id_empresa::int AS id, nombre, sector, ubicacion, descripcion, estado`,
        [id, estado.toLowerCase()]
    );
    return mapearEmpresa(filas[0]);
}

// vacantes

const SELECT_VACANTES = `
    SELECT
        v.id_vacante::int AS id,
        v.empresa_id::int AS "empresaId",
        v.titulo, v.ubicacion, v.modalidad,
        v.tipo_contrato AS "tipoContrato",
        v.experiencia, v.formacion,
        v.salario_minimo::float AS "salarioMinimo",
        v.salario_maximo::float AS "salarioMaximo",
        v.descripcion,
        COALESCE(v.responsabilidades, '{}') AS responsabilidades,
        COALESCE(v.requisitos, '{}') AS habilidades,
        COALESCE(v.beneficios, '{}') AS beneficios,
        v.correo_contacto AS contacto,
        v.nombre_reclutador AS reclutador,
        to_char(v.fecha_publicacion, 'YYYY-MM-DD') AS "fechaPublicacion",
        COALESCE(to_char(v.fecha_cierre, 'YYYY-MM-DD'), '') AS "fechaCierre",
        v.estado, v.vistas,
        e.nombre AS "empresaNombre",
        (SELECT COUNT(*) FROM postulaciones p WHERE p.vacante_id = v.id_vacante)::int AS "totalPostulantes"
    FROM vacantes v
    JOIN empresas e ON e.id_empresa = v.empresa_id
`;

function mapearVacante(fila) {
    if (!fila) return null;
    const { empresaNombre, ...vacante } = fila;
    return {
        ...vacante,
        salarioMinimo: vacante.salarioMinimo || 0,
        salarioMaximo: vacante.salarioMaximo || 0,
        estado: ESTADO_VACANTE_APP[vacante.estado] || vacante.estado,
        empresa: { id: vacante.empresaId, nombre: empresaNombre }
    };
}

async function listarVacantes(filtros = {}) {
    const condiciones = [];
    const valores = [];

    if (filtros.empresaId) {
        valores.push(filtros.empresaId);
        condiciones.push(`v.empresa_id = $${valores.length}`);
    }
    if (filtros.estado) {
        valores.push(ESTADO_VACANTE_BD[filtros.estado]);
        condiciones.push(`v.estado = $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const filas = await consulta(`${SELECT_VACANTES} ${where} ORDER BY v.fecha_publicacion DESC, v.id_vacante DESC`, valores);
    return filas.map(mapearVacante);
}

async function obtenerVacante(id) {
    if (!idValido(id)) return null;
    const filas = await consulta(`${SELECT_VACANTES} WHERE v.id_vacante = $1`, [id]);
    return mapearVacante(filas[0]);
}

async function contarVacantesPorEstado() {
    const filas = await consulta('SELECT estado, COUNT(*)::int AS total FROM vacantes GROUP BY estado');
    const conteo = { Todas: 0 };
    ESTADOS_VACANTE.forEach(estado => { conteo[estado] = 0; });
    filas.forEach(f => {
        conteo[ESTADO_VACANTE_APP[f.estado]] = f.total;
        conteo.Todas += f.total;
    });
    return conteo;
}

async function validarBorrador(datos) {
    const errores = [];
    if (!texto(datos.titulo)) errores.push('Para guardar el borrador escribe al menos el título.');
    if (!(await obtenerEmpresa(datos.empresaId))) errores.push('Selecciona una empresa.');
    return errores;
}

async function validarVacante(datos) {
    const errores = [];
    const empresa = await obtenerEmpresa(datos.empresaId);
    if (!texto(datos.titulo)) errores.push('El título del puesto es obligatorio.');
    if (!empresa) errores.push('Selecciona una empresa.');
    if (empresa && empresa.estado !== 'Activa') errores.push('La empresa seleccionada no está activa.');
    if (!texto(datos.ubicacion)) errores.push('La ubicación es obligatoria.');
    if (!texto(datos.descripcion)) errores.push('La descripción del puesto es obligatoria.');
    if (texto(datos.descripcion).length > 3000) errores.push('La descripción no puede superar 3000 caracteres.');
    if (convertirLista(datos.habilidades).length === 0) errores.push('Agrega al menos una habilidad.');
    if (!texto(datos.experiencia)) errores.push('El nivel de experiencia es obligatorio.');
    if (!/^\S+@\S+\.\S+$/.test(texto(datos.contacto))) errores.push('Escribe un correo de contacto válido.');

    const minimo = Number(datos.salarioMinimo);
    const maximo = Number(datos.salarioMaximo);
    if (datos.salarioMinimo && datos.salarioMaximo && minimo > maximo) {
        errores.push('El salario mínimo no puede ser mayor que el máximo.');
    }
    return errores;
}

function valoresVacante(datos) {
    const modalidades = ['Presencial', 'Híbrido', 'Remoto'];
    return [
        Number(datos.empresaId),
        texto(datos.titulo),
        texto(datos.ubicacion) || null,
        modalidades.includes(datos.modalidad) ? datos.modalidad : null,
        texto(datos.tipoContrato) || null,
        texto(datos.experiencia) || null,
        texto(datos.formacion) || null,
        Number(datos.salarioMinimo) || null,
        Number(datos.salarioMaximo) || null,
        texto(datos.descripcion),
        convertirLista(datos.responsabilidades),
        convertirLista(datos.habilidades),
        convertirLista(datos.beneficios),
        texto(datos.contacto) || null,
        texto(datos.fechaCierre) || null
    ];
}

async function crearVacante(datos, estado = 'Activa') {
    // sector = el d la empresa
    const filas = await consulta(
        `INSERT INTO vacantes (empresa_id, titulo, ubicacion, modalidad, tipo_contrato, experiencia, formacion,
            salario_minimo, salario_maximo, descripcion, responsabilidades, requisitos, beneficios,
            correo_contacto, fecha_cierre, nombre_reclutador, estado, sector)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            (SELECT sector FROM empresas WHERE id_empresa = $1))
         RETURNING id_vacante::int AS id`,
        [...valoresVacante(datos), empleadorActual.nombre, ESTADO_VACANTE_BD[estado]]
    );
    return obtenerVacante(filas[0].id);
}

async function actualizarVacante(id, datos, estado) {
    const vacante = await obtenerVacante(id);
    if (!vacante) return null;

    const nuevoEstado = estado || vacante.estado;
    // al publicar un borrador cambia la fecha
    const publicaBorrador = vacante.estado === 'Borrador' && nuevoEstado === 'Activa';

    await consulta(
        `UPDATE vacantes SET empresa_id = $2, titulo = $3, ubicacion = $4, modalidad = $5, tipo_contrato = $6,
            experiencia = $7, formacion = $8, salario_minimo = $9, salario_maximo = $10, descripcion = $11,
            responsabilidades = $12, requisitos = $13, beneficios = $14, correo_contacto = $15, fecha_cierre = $16,
            estado = $17,
            sector = (SELECT sector FROM empresas WHERE id_empresa = $2),
            fecha_publicacion = CASE WHEN $18 THEN CURRENT_TIMESTAMP ELSE fecha_publicacion END
         WHERE id_vacante = $1`,
        [id, ...valoresVacante(datos), ESTADO_VACANTE_BD[nuevoEstado], publicaBorrador]
    );
    return obtenerVacante(id);
}

async function cambiarEstadoVacante(id, estado) {
    if (!idValido(id) || !ESTADOS_VACANTE.includes(estado)) return null;
    await consulta('UPDATE vacantes SET estado = $2 WHERE id_vacante = $1', [id, ESTADO_VACANTE_BD[estado]]);
    return obtenerVacante(id);
}

async function eliminarVacante(id) {
    if (!idValido(id)) return false;
    // cascada borra postulasiones
    const filas = await consulta('DELETE FROM vacantes WHERE id_vacante = $1 RETURNING id_vacante', [id]);
    return filas.length > 0;
}

// postulasiones

const SELECT_CANDIDATO = `
    c.id_candidato::int AS id, c.nombre, c.cargo, c.empresa_actual AS "empresaActual", c.ubicacion,
    c.correo, c.telefono, c.anios_experiencia AS "aniosExperiencia", c.habilidades,
    c.experiencia, c.formacion, c.cv_url AS cv
`;

async function obtenerCandidato(id) {
    if (!idValido(id)) return null;
    const filas = await consulta(`SELECT ${SELECT_CANDIDATO} FROM candidatos c WHERE c.id_candidato = $1`, [id]);
    return filas[0] || null;
}

// requisito puede ser frase
function coincide(habilidad, requisito) {
    const h = habilidad.toLowerCase();
    const r = requisito.toLowerCase();
    return r.includes(h) || h.includes(r);
}

// % compatibilidad
function calcularCompatibilidad(candidato, vacante) {
    if (!candidato || !vacante || vacante.habilidades.length === 0) return 0;

    const coincidencias = vacante.habilidades.filter(r => candidato.habilidades.some(h => coincide(h, r)));
    return Math.round((coincidencias.length / vacante.habilidades.length) * 100);
}

function habilidadesCoincidentes(candidato, vacante) {
    if (!candidato || !vacante) return [];
    return candidato.habilidades.filter(h => vacante.habilidades.some(r => coincide(h, r)));
}

async function listarPostulaciones(vacanteId, filtros = {}) {
    const vacante = await obtenerVacante(vacanteId);
    if (!vacante) return [];

    const filas = await consulta(
        `SELECT p.id_postulacion::int AS id, p.vacante_id::int AS "vacanteId", p.candidato_id::int AS "candidatoId",
            (p.fecha_postulacion AT TIME ZONE 'UTC') AS fecha, p.estado, ${SELECT_CANDIDATO}
         FROM postulaciones p
         JOIN candidatos c ON c.id_candidato = p.candidato_id
         WHERE p.vacante_id = $1`,
        [vacanteId]
    );

    const busqueda = texto(filtros.q).toLowerCase();
    const experienciaMinima = Number(filtros.experienciaMin) || 0;
    const compatibilidadMinima = Number(filtros.compatibilidadMin) || 0;

    const resultado = filas
        .map(f => {
            const { id, vacanteId: vId, candidatoId, fecha, estado, ...candidato } = f;
            candidato.id = candidatoId;
            return {
                id,
                vacanteId: vId,
                candidatoId,
                fecha,
                estado: capitalizar(estado),
                candidato,
                vacante,
                compatibilidad: calcularCompatibilidad(candidato, vacante)
            };
        })
        .filter(p =>
            (!filtros.estado || p.estado === filtros.estado) &&
            (!busqueda || p.candidato.nombre.toLowerCase().includes(busqueda)) &&
            p.candidato.aniosExperiencia >= experienciaMinima &&
            p.compatibilidad >= compatibilidadMinima
        );

    if (filtros.orden === 'compatibilidad') {
        resultado.sort((a, b) => b.compatibilidad - a.compatibilidad);
    } else {
        resultado.sort((a, b) => b.fecha - a.fecha);
    }
    return resultado;
}

async function contarPostulacionesPorEstado(vacanteId) {
    const conteo = { Todos: 0 };
    ESTADOS_POSTULACION.forEach(estado => { conteo[estado] = 0; });
    if (!idValido(vacanteId)) return conteo;

    const filas = await consulta(
        'SELECT estado, COUNT(*)::int AS total FROM postulaciones WHERE vacante_id = $1 GROUP BY estado',
        [vacanteId]
    );
    filas.forEach(f => {
        conteo[capitalizar(f.estado)] = f.total;
        conteo.Todos += f.total;
    });
    return conteo;
}

async function obtenerPostulacion(id) {
    if (!idValido(id)) return null;
    const filas = await consulta(
        `SELECT id_postulacion::int AS id, vacante_id::int AS "vacanteId", candidato_id::int AS "candidatoId",
            (fecha_postulacion AT TIME ZONE 'UTC') AS fecha, estado
         FROM postulaciones WHERE id_postulacion = $1`,
        [id]
    );
    if (!filas[0]) return null;

    const postulacion = { ...filas[0], estado: capitalizar(filas[0].estado) };
    const candidato = await obtenerCandidato(postulacion.candidatoId);
    const vacante = await obtenerVacante(postulacion.vacanteId);
    const notas = await consulta(
        `SELECT autor, texto, (fecha AT TIME ZONE 'UTC') AS fecha FROM notas_postulacion WHERE postulacion_id = $1 ORDER BY fecha`,
        [id]
    );

    return { ...postulacion, candidato, vacante, notas, compatibilidad: calcularCompatibilidad(candidato, vacante) };
}

async function cambiarEstadoPostulacion(id, estado) {
    if (!idValido(id) || !ESTADOS_POSTULACION.includes(estado)) return null;
    const filas = await consulta(
        'UPDATE postulaciones SET estado = $2 WHERE id_postulacion = $1 RETURNING id_postulacion::int AS id',
        [id, estado.toLowerCase()]
    );
    return filas[0] || null;
}

async function cambiarEstadoVariasPostulaciones(ids, estado) {
    const lista = [].concat(ids).filter(idValido);
    if (!ESTADOS_POSTULACION.includes(estado) || lista.length === 0) return 0;
    const filas = await consulta(
        'UPDATE postulaciones SET estado = $2 WHERE id_postulacion = ANY($1::bigint[]) RETURNING id_postulacion',
        [lista, estado.toLowerCase()]
    );
    return filas.length;
}

async function agregarNota(postulacionId, textoNota) {
    if (!idValido(postulacionId) || !texto(textoNota)) return null;
    const filas = await consulta(
        `INSERT INTO notas_postulacion (postulacion_id, autor, texto)
         SELECT id_postulacion, $2, $3 FROM postulaciones WHERE id_postulacion = $1
         RETURNING autor, texto, (fecha AT TIME ZONE 'UTC') AS fecha`,
        [postulacionId, empleadorActual.nombre, texto(textoNota)]
    );
    return filas[0] || null;
}

module.exports = {
    empleadorActual,
    ESTADOS_EMPRESA,
    ESTADOS_VACANTE,
    ESTADOS_POSTULACION,
    SECTORES,
    usarConexion,
    listarEmpresas,
    obtenerEmpresa,
    validarEmpresa,
    crearEmpresa,
    actualizarEmpresa,
    cambiarEstadoEmpresa,
    listarVacantes,
    obtenerVacante,
    contarVacantesPorEstado,
    validarBorrador,
    validarVacante,
    crearVacante,
    actualizarVacante,
    cambiarEstadoVacante,
    eliminarVacante,
    obtenerCandidato,
    calcularCompatibilidad,
    habilidadesCoincidentes,
    listarPostulaciones,
    contarPostulacionesPorEstado,
    obtenerPostulacion,
    cambiarEstadoPostulacion,
    cambiarEstadoVariasPostulaciones,
    agregarNota
};
