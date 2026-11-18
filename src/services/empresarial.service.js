const { pool } = require('../config/database');
const { normalizarTelefono, MENSAJE_TELEFONO } = require('../utils/validaciones');

const { AsyncLocalStorage } = require('node:async_hooks');
const contexto = new AsyncLocalStorage();
function errorAcceso(message = 'Operacion no autorizada.', status = 403) {
    const error = new Error(message); error.status = status; error.publicMessage = message; return error;
}
function obtenerContexto() {
    const actual = contexto.getStore();
    if (!actual) throw errorAcceso();
    return actual;
}
async function conContextoEmpresa(usuario, tarea, conexion = pool) {
    if (usuario?.rol !== 'empresa' || !/^[1-9]\d{0,14}$/.test(String(usuario.empresaId)) || !/^[1-9]\d{0,14}$/.test(String(usuario.id))) throw errorAcceso();
    const { rows: tablas } = await conexion.query("SELECT to_regclass('public.empresas_propietarios') AS propiedad");
    const extendida = Boolean(tablas[0]?.propiedad);
    const ids = [Number(usuario.empresaId)];
    if (extendida) {
        const { rows } = await conexion.query('SELECT empresa_id AS id FROM public.empresas_propietarios WHERE usuario_id = $1', [usuario.id]);
        for (const row of rows) if (!ids.includes(Number(row.id))) ids.push(Number(row.id));
    }
    const actual = Object.freeze({ usuarioId: Number(usuario.id), empresaId: Number(usuario.empresaId), nombre: usuario.nombre || usuario.nombreMostrar || 'Empresa', ids: Object.freeze(ids), extendida, conexion });
    return contexto.run(actual, tarea);
}
function propias() { return obtenerContexto().ids; }
async function exigirEmpresaAprobada(id) {
    const rows = await consulta("SELECT id_empresa FROM empresas WHERE id_empresa = $1 AND id_empresa = ANY($2::bigint[]) AND estado = 'activa' AND estado_aprobacion = 'aprobada'", [id, propias()]);
    if (!rows.length) throw errorAcceso('La empresa debe estar activa y aprobada para esta accion.');
}

const ESTADOS_EMPRESA = ['Activa', 'Pendiente', 'Inactiva'];
const ESTADOS_VACANTE = ['Activa', 'Borrador', 'Inactiva', 'Cancelada'];
const ESTADOS_POSTULACION = ['Nuevo', 'Preseleccionado', 'Entrevista', 'Contratado', 'Rechazado'];
const SECTORES = ['Tecnología', 'Logística', 'Diseño y Marketing', 'Finanzas', 'Salud', 'Educación', 'Comercio', 'ONG'];

// estados en la bd
const ESTADO_VACANTE_BD = { Activa: 'publicada', Inactiva: 'pausada', Cancelada: 'cerrada', Borrador: 'borrador' };
const ESTADO_VACANTE_APP = { publicada: 'Activa', pausada: 'Inactiva', cerrada: 'Cancelada', borrador: 'Borrador' };

// Database and identity are request-scoped; no mutable shared employer.
function usarConexion(conexion, tarea) {
    if (typeof tarea !== 'function') throw errorAcceso('Usa conContextoEmpresa(usuario, tarea, conexion) para pruebas aisladas.', 422);
    const actual = obtenerContexto();
    return conContextoEmpresa({ id: actual.usuarioId, rol: 'empresa', empresaId: actual.empresaId, nombre: actual.nombre }, tarea, conexion);
}
async function consulta(sql, valores = []) {
    const resultado = await obtenerContexto().conexion.query(sql, valores);
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
    return /^[1-9]\d{0,14}$/.test(String(id)) && Number.isSafeInteger(Number(id));
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
    const condiciones = ['id_empresa = ANY($1::bigint[])'];
    const valores = [propias()];

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
    const filas = await consulta(`${SELECT_EMPRESAS} WHERE id_empresa = $1 AND id_empresa = ANY($2::bigint[])`, [id, propias()]);
    return mapearEmpresa(filas[0]);
}

function validarEmpresa(datos) {
    const errores = [];
    if (!texto(datos.nombre) || texto(datos.nombre).length > 150) errores.push('El nombre de la empresa es obligatorio.');
    if (!SECTORES.includes(datos.sector)) errores.push('Selecciona un sector válido.');
    if (!texto(datos.ubicacion) || texto(datos.ubicacion).length > 180) errores.push('La ubicación es obligatoria.');
    return errores;
}

// perfil: solo la empresa de la sesion
const SELECT_PERFIL = `
    SELECT id_empresa::int AS id, nombre, sector, ubicacion, descripcion, telefono, nit, correo,
        representante, estado, estado_aprobacion AS "estadoAprobacion"
    FROM empresas
`;

async function obtenerPerfilEmpresa() {
    const actual = obtenerContexto();
    const filas = await consulta(`${SELECT_PERFIL} WHERE id_empresa = $1 AND id_empresa = ANY($2::bigint[])`, [actual.empresaId, propias()]);
    return filas[0] ? { ...filas[0], estado: capitalizar(filas[0].estado), estadoAprobacion: capitalizar(filas[0].estadoAprobacion) } : null;
}

function validarPerfilEmpresa(datos) {
    const errores = validarEmpresa(datos);
    if (texto(datos.descripcion).length > 1000) errores.push('La descripción no puede superar 1000 caracteres.');
    if (normalizarTelefono(datos.telefono) === null) errores.push(MENSAJE_TELEFONO);
    return errores;
}

// nit, estado y aprobacion no se tocan
async function actualizarPerfilEmpresa(datos) {
    const actual = obtenerContexto();
    const errores = validarPerfilEmpresa(datos);
    if (errores.length) throw errorAcceso(errores.join(' '), 422);
    await consulta(
        `UPDATE empresas SET nombre = $3, sector = $4, ubicacion = $5, descripcion = $6, telefono = $7
         WHERE id_empresa = $1 AND id_empresa = ANY($2::bigint[])`,
        [actual.empresaId, propias(), texto(datos.nombre), datos.sector, texto(datos.ubicacion), texto(datos.descripcion), normalizarTelefono(datos.telefono) || null]
    );
    return obtenerPerfilEmpresa();
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
    const condiciones = ['v.empresa_id = ANY($1::bigint[])'];
    const valores = [propias()];

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
    const filas = await consulta(`${SELECT_VACANTES} WHERE v.id_vacante = $1 AND v.empresa_id = ANY($2::bigint[])`, [id, propias()]);
    return mapearVacante(filas[0]);
}

async function contarVacantesPorEstado() {
    const filas = await consulta('SELECT estado, COUNT(*)::int AS total FROM vacantes WHERE empresa_id = ANY($1::bigint[]) GROUP BY estado', [propias()]);
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
    if (!texto(datos.titulo) || texto(datos.titulo).length > 200) errores.push('El titulo del puesto debe tener entre 1 y 200 caracteres.');
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
    if (![minimo, maximo].every(n => Number.isFinite(n) && n >= 0)) errores.push('El salario debe ser un numero positivo.');
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
    if (!propias().includes(Number(datos.empresaId))) throw errorAcceso();
    if (!ESTADOS_VACANTE.includes(estado)) throw errorAcceso('Estado invalido.', 422);
    if (estado === 'Activa') await exigirEmpresaAprobada(datos.empresaId);
    // sector = el d la empresa
    const filas = await consulta(
        `INSERT INTO vacantes (empresa_id, titulo, ubicacion, modalidad, tipo_contrato, experiencia, formacion,
            salario_minimo, salario_maximo, descripcion, responsabilidades, requisitos, beneficios,
            correo_contacto, fecha_cierre, nombre_reclutador, estado, sector)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            (SELECT sector FROM empresas WHERE id_empresa = $1)
         WHERE $1::bigint = ANY($18::bigint[])
           AND EXISTS (SELECT 1 FROM empresas e WHERE e.id_empresa = $1 AND ($17 <> 'publicada' OR (e.estado = 'activa' AND e.estado_aprobacion = 'aprobada')))
         RETURNING id_vacante::int AS id`,
        [...valoresVacante(datos), obtenerContexto().nombre, ESTADO_VACANTE_BD[estado], propias()]
    );
    if (!filas[0]) throw errorAcceso();
    return obtenerVacante(filas[0].id);
}

async function actualizarVacante(id, datos, estado) {
    const vacante = await obtenerVacante(id);
    if (!vacante) return null;

    if (!propias().includes(Number(datos.empresaId))) throw errorAcceso();
    const nuevoEstado = estado || vacante.estado;
    if (!ESTADOS_VACANTE.includes(nuevoEstado)) throw errorAcceso('Estado invalido.', 422);
    if (nuevoEstado === 'Activa') await exigirEmpresaAprobada(datos.empresaId);
    // al publicar un borrador cambia la fecha
    const publicaBorrador = vacante.estado === 'Borrador' && nuevoEstado === 'Activa';

    await consulta(
        `UPDATE vacantes SET empresa_id = $2, titulo = $3, ubicacion = $4, modalidad = $5, tipo_contrato = $6,
            experiencia = $7, formacion = $8, salario_minimo = $9, salario_maximo = $10, descripcion = $11,
            responsabilidades = $12, requisitos = $13, beneficios = $14, correo_contacto = $15, fecha_cierre = $16,
            estado = $17,
            sector = (SELECT sector FROM empresas WHERE id_empresa = $2),
            fecha_publicacion = CASE WHEN $18 THEN CURRENT_TIMESTAMP ELSE fecha_publicacion END
         WHERE id_vacante = $1 AND empresa_id = ANY($19::bigint[]) AND $2::bigint = ANY($19::bigint[])
           AND EXISTS (SELECT 1 FROM empresas e WHERE e.id_empresa = $2 AND ($17 <> 'publicada' OR (e.estado = 'activa' AND e.estado_aprobacion = 'aprobada')))`,
        [id, ...valoresVacante(datos), ESTADO_VACANTE_BD[nuevoEstado], publicaBorrador, propias()]
    );
    return obtenerVacante(id);
}

async function cambiarEstadoVacante(id, estado) {
    if (!idValido(id) || !ESTADOS_VACANTE.includes(estado)) return null;
    const vacante = await obtenerVacante(id);
    if (!vacante) return null;
    if (estado === 'Activa') await exigirEmpresaAprobada(vacante.empresaId);
    await consulta('UPDATE vacantes SET estado = $2 WHERE id_vacante = $1 AND empresa_id = ANY($3::bigint[])', [id, ESTADO_VACANTE_BD[estado], propias()]);
    return obtenerVacante(id);
}

async function eliminarVacante(id) {
    if (!idValido(id)) return false;
    // cascada borra postulasiones
    const filas = await consulta('DELETE FROM vacantes WHERE id_vacante = $1 AND empresa_id = ANY($2::bigint[]) RETURNING id_vacante', [id, propias()]);
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
    const filas = await consulta(`SELECT ${SELECT_CANDIDATO} FROM candidatos c WHERE c.id_candidato = $1 AND EXISTS (SELECT 1 FROM postulaciones p JOIN vacantes v ON v.id_vacante = p.vacante_id WHERE p.candidato_id = c.id_candidato AND v.empresa_id = ANY($2::bigint[]))`, [id, propias()]);
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
         WHERE p.vacante_id = $1 AND EXISTS (SELECT 1 FROM vacantes v WHERE v.id_vacante = p.vacante_id AND v.empresa_id = ANY($2::bigint[]))`,
        [vacanteId, propias()]
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
        'SELECT estado, COUNT(*)::int AS total FROM postulaciones WHERE vacante_id = $1 AND EXISTS (SELECT 1 FROM vacantes v WHERE v.id_vacante = postulaciones.vacante_id AND v.empresa_id = ANY($2::bigint[])) GROUP BY estado',
        [vacanteId, propias()]
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
         FROM postulaciones WHERE id_postulacion = $1 AND EXISTS (SELECT 1 FROM vacantes v WHERE v.id_vacante = postulaciones.vacante_id AND v.empresa_id = ANY($2::bigint[]))`,
        [id, propias()]
    );
    if (!filas[0]) return null;

    const postulacion = { ...filas[0], estado: capitalizar(filas[0].estado) };
    const [candidato, vacante, notas] = await Promise.all([
        obtenerCandidato(postulacion.candidatoId),
        obtenerVacante(postulacion.vacanteId),
        consulta(
        `SELECT autor, texto, (fecha AT TIME ZONE 'UTC') AS fecha FROM notas_postulacion n WHERE postulacion_id = $1 AND EXISTS (SELECT 1 FROM postulaciones p JOIN vacantes v ON v.id_vacante = p.vacante_id WHERE p.id_postulacion = n.postulacion_id AND v.empresa_id = ANY($2::bigint[])) ORDER BY fecha`,
        [id, propias()]
        )
    ]);

    return { ...postulacion, candidato, vacante, notas, compatibilidad: calcularCompatibilidad(candidato, vacante) };
}

async function cambiarEstadoPostulacion(id, estado) {
    if (!idValido(id) || !ESTADOS_POSTULACION.includes(estado)) return null;
    const filas = await consulta(
        'UPDATE postulaciones SET estado = $2 WHERE id_postulacion = $1 AND EXISTS (SELECT 1 FROM vacantes v WHERE v.id_vacante = postulaciones.vacante_id AND v.empresa_id = ANY($3::bigint[])) RETURNING id_postulacion::int AS id',
        [id, estado.toLowerCase(), propias()]
    );
    return filas[0] || null;
}

async function cambiarEstadoVariasPostulaciones(ids, estado) {
    const raw = [].concat(ids);
    if (raw.length > 200 || raw.some(id => !idValido(id))) throw errorAcceso('Seleccion invalida.', 422);
    const lista = [...new Set(raw.map(String))];
    if (!ESTADOS_POSTULACION.includes(estado) || lista.length === 0) return 0;
    const filas = await consulta(
        'UPDATE postulaciones SET estado = $2 WHERE id_postulacion = ANY($1::bigint[]) AND EXISTS (SELECT 1 FROM vacantes v WHERE v.id_vacante = postulaciones.vacante_id AND v.empresa_id = ANY($3::bigint[])) AND NOT EXISTS (SELECT 1 FROM unnest($1::bigint[]) AS seleccion(id) LEFT JOIN postulaciones p ON p.id_postulacion = seleccion.id LEFT JOIN vacantes v ON v.id_vacante = p.vacante_id WHERE p.id_postulacion IS NULL OR NOT (v.empresa_id = ANY($3::bigint[]))) RETURNING id_postulacion',
        [lista, estado.toLowerCase(), propias()]
    );
    if (filas.length !== lista.length) throw errorAcceso();
    return filas.length;
}

async function agregarNota(postulacionId, textoNota) {
    if (!idValido(postulacionId) || !texto(textoNota)) return null;
    const filas = await consulta(
        `INSERT INTO notas_postulacion (postulacion_id, autor, texto)
         SELECT id_postulacion, $2, $3 FROM postulaciones p WHERE id_postulacion = $1 AND EXISTS (SELECT 1 FROM vacantes v WHERE v.id_vacante = p.vacante_id AND v.empresa_id = ANY($4::bigint[]))
         RETURNING autor, texto, (fecha AT TIME ZONE 'UTC') AS fecha`,
        [postulacionId, obtenerContexto().nombre, texto(textoNota), propias()]
    );
    return filas[0] || null;
}

// panel EMP-01

const DIA = 24 * 60 * 60 * 1000;

async function obtenerIndicadores() {
    const [vacantes] = await consulta(
        `SELECT
            COUNT(*) FILTER (WHERE estado = 'publicada')::int AS activas,
            COUNT(*) FILTER (WHERE estado = 'publicada' AND fecha_publicacion >= CURRENT_DATE - 30)::int AS "activasMes",
            COALESCE(SUM(vistas), 0)::int AS vistas
         FROM vacantes WHERE empresa_id = ANY($1::bigint[])`, [propias()]
    );
    const [postulaciones] = await consulta(
        `SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE fecha_postulacion >= CURRENT_DATE - 30)::int AS "totalMes",
            COUNT(*) FILTER (WHERE estado <> 'nuevo')::int AS respondidas
         FROM postulaciones WHERE EXISTS (SELECT 1 FROM vacantes v WHERE v.id_vacante = postulaciones.vacante_id AND v.empresa_id = ANY($1::bigint[]))`, [propias()]
    );

    return {
        vacantesActivas: vacantes.activas,
        vacantesMes: vacantes.activasMes,
        postulaciones: postulaciones.total,
        postulacionesMes: postulaciones.totalMes,
        visualizaciones: vacantes.vistas,
        // % q ya tuvieron respuesta
        tasaRespuesta: postulaciones.total ? Math.round((postulaciones.respondidas / postulaciones.total) * 100) : 0
    };
}

// 7 dias x dia, resto x semana
function armarGrafica(fechas, rango, hoy = new Date()) {
    const porDia = rango === 7;
    const tamano = porDia ? DIA : 7 * DIA;
    const cantidad = porDia ? 7 : Math.ceil(rango / 7);
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1).getTime();
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const barras = Array.from({ length: cantidad }, (_, i) => {
        const desde = fin - (cantidad - i) * tamano;
        return {
            etiqueta: porDia ? dias[new Date(desde).getDay()] : `Sem ${i + 1}`,
            desde,
            total: 0
        };
    });

    fechas.forEach(fecha => {
        const indice = Math.floor((new Date(fecha).getTime() - (fin - cantidad * tamano)) / tamano);
        if (indice >= 0 && indice < cantidad) barras[indice].total++;
    });

    const maximo = Math.max(1, ...barras.map(b => b.total));
    return barras.map(b => ({ etiqueta: b.etiqueta, total: b.total, altura: Math.round((b.total / maximo) * 100) }));
}

async function obtenerGrafica(rango) {
    const filas = await consulta(
        `SELECT (fecha_postulacion AT TIME ZONE 'UTC') AS fecha FROM postulaciones
         WHERE fecha_postulacion >= CURRENT_DATE - $1::int - 1 AND EXISTS (SELECT 1 FROM vacantes v WHERE v.id_vacante = postulaciones.vacante_id AND v.empresa_id = ANY($2::bigint[]))`,
        [rango, propias()]
    );
    return armarGrafica(filas.map(f => f.fecha), rango);
}

async function obtenerActividad(limite = 6) {
    const postulaciones = await consulta(
        `SELECT 'postulacion' AS tipo, c.nombre, v.titulo AS vacante, p.estado,
            p.id_postulacion::int AS "postulacionId", (p.fecha_postulacion AT TIME ZONE 'UTC') AS fecha
         FROM postulaciones p
         JOIN candidatos c ON c.id_candidato = p.candidato_id
         JOIN vacantes v ON v.id_vacante = p.vacante_id
         WHERE v.empresa_id = ANY($2::bigint[])
         ORDER BY p.fecha_postulacion DESC LIMIT $1`,
        [limite, propias()]
    );
    const notas = await consulta(
        `SELECT 'nota' AS tipo, n.autor AS nombre, c.nombre AS candidato, n.texto,
            n.postulacion_id::int AS "postulacionId", (n.fecha AT TIME ZONE 'UTC') AS fecha
         FROM notas_postulacion n
         JOIN postulaciones p ON p.id_postulacion = n.postulacion_id
         JOIN candidatos c ON c.id_candidato = p.candidato_id
         JOIN vacantes v ON v.id_vacante = p.vacante_id
         WHERE v.empresa_id = ANY($2::bigint[])
         ORDER BY n.fecha DESC LIMIT $1`,
        [limite, propias()]
    );
    const porCerrar = await consulta(
        `SELECT 'cierre' AS tipo, titulo AS vacante, id_vacante::int AS "vacanteId",
            (fecha_cierre - CURRENT_DATE)::int AS dias
         FROM vacantes
         WHERE empresa_id = ANY($1::bigint[]) AND estado = 'publicada' AND fecha_cierre BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
         ORDER BY fecha_cierre`, [propias()]
    );

    const actividad = [...postulaciones, ...notas]
        .map(a => ({ ...a, estado: capitalizar(a.estado) }))
        .sort((a, b) => b.fecha - a.fecha)
        .slice(0, limite);

    // los cierres van primero
    return [...porCerrar, ...actividad].slice(0, limite);
}

async function obtenerPanel(rango = 30) {
    const rangoValido = [7, 30, 90].includes(Number(rango)) ? Number(rango) : 30;
    const [vacantesActivas, indicadores, grafica, actividad] = await Promise.all([
        listarVacantes({ estado: 'Activa' }), obtenerIndicadores(), obtenerGrafica(rangoValido), obtenerActividad()
    ]);
    const hoy = new Date();

    return {
        rango: rangoValido,
        indicadores,
        grafica,
        actividad,
        vacantes: vacantesActivas.slice(0, 5).map(v => {
            const dias = v.fechaCierre ? Math.ceil((new Date(v.fechaCierre + 'T23:59:59') - hoy) / DIA) : null;
            return { ...v, porCerrar: dias !== null && dias >= 0 && dias <= 7 };
        }),
        totalVacantesActivas: vacantesActivas.length
    };
}

module.exports = {
    conContextoEmpresa,
    obtenerContexto,
    obtenerPanel,
    armarGrafica,
    ESTADOS_EMPRESA,
    ESTADOS_VACANTE,
    ESTADOS_POSTULACION,
    SECTORES,
    usarConexion,
    listarEmpresas,
    obtenerEmpresa,
    validarEmpresa,
    obtenerPerfilEmpresa,
    validarPerfilEmpresa,
    actualizarPerfilEmpresa,
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
