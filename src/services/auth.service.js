const { createHash, randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { pool } = require('../config/database');

const derivar = promisify(scrypt);
const COOKIE_SESION = 'talentohub_sid';
const DURACION_SESION_MS = 24 * 60 * 60 * 1000; // 24 horas

function texto(valor) {
    return String(valor ?? '').trim();
}

function hashToken(token) {
    return createHash('sha256').update(String(token || '')).digest('hex');
}

async function hashearClave(clave) {
    const sal = randomBytes(16).toString('hex');
    const derivado = await derivar(String(clave), sal, 64);
    return `${sal}:${derivado.toString('hex')}`;
}

async function verificarClave(clave, guardada) {
    if (typeof clave !== 'string' || typeof guardada !== 'string' || !clave || !guardada.includes(':')) return false;
    const [sal, hashHex] = guardada.split(':');
    if (!sal || !/^[a-f0-9]{128}$/.test(hashHex)) return false;
    const calculada = await derivar(String(clave), sal, 64);
    return timingSafeEqual(calculada, Buffer.from(hashHex, 'hex'));
}

function leerCookieSesion(req) {
    const cookies = req.get('cookie') || '';
    if (cookies.split(';').filter(s => s.trim().startsWith(COOKIE_SESION + '=')).length !== 1) return null;
    const match = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE_SESION}=([a-f0-9]{64})(?:;|$)`));
    return match ? match[1] : null;
}

function opcionesCookie() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    };
}

function rutaInicioPorRol(rol) {
    if (rol === 'admin') return '/administrativo';
    if (rol === 'empresa') return '/empresarial';
    if (rol === 'candidato') return '/candidato';
    return '/';
}

function etiquetaRol(rol) {
    if (rol === 'admin') return 'Administrador';
    if (rol === 'empresa') return 'Empresa';
    if (rol === 'candidato') return 'Aplicante';
    return 'Visitante';
}

async function asegurarEsquemaAuth(cliente = pool) {
    // Read-only prerequisite check. Never create accounts or run DDL on normal startup.
    const { rows } = await cliente.query("SELECT to_regclass('public.usuarios_cuenta') AS cuentas, to_regclass('public.sesiones_auth') AS sesiones");
    if (!rows[0]?.cuentas || !rows[0]?.sesiones) {
        const error = new Error('El esquema de autenticacion debe estar preparado por el administrador.');
        error.status = 503; throw error;
    }
}

async function obtenerUsuarioPorToken(token) {
    if (!token) return null;
    const tokenHash = hashToken(token);

    const { rows } = await pool.query(
        `SELECT
            u.id_usuario::int AS id,
            u.nombre,
            u.correo,
            u.rol,
            u.activo,
            u.candidato_id::int AS "candidatoId",
            u.empresa_id::int AS "empresaId",
            c.nombre AS "candidatoNombre",
            c.cargo AS "candidatoCargo",
            COALESCE(c.estado, 'activo') AS "candidatoEstado",
            c.motivo_suspension AS "candidatoMotivoSuspension",
            e.nombre AS "empresaNombre",
            e.sector AS "empresaSector",
            e.estado AS "empresaEstado",
            COALESCE(e.estado_aprobacion, 'aprobada') AS "empresaAprobacion",
            e.motivo_rechazo AS "empresaMotivoRechazo"
         FROM sesiones_auth s
         INNER JOIN usuarios_cuenta u ON u.id_usuario = s.usuario_id
         LEFT JOIN candidatos c ON c.id_candidato = u.candidato_id
         LEFT JOIN empresas e ON e.id_empresa = u.empresa_id
         WHERE s.token_hash = $1
           AND s.vence_en > CURRENT_TIMESTAMP
           AND u.activo = TRUE
         LIMIT 1`,
        [tokenHash]
    );

    const usuario = rows[0];
    if (!usuario || usuario.candidatoEstado === 'suspendido' || usuario.empresaAprobacion === 'suspendida') return null;
    if (usuario.rol === 'candidato' && !usuario.candidatoId) return null;
    if (usuario.rol === 'empresa' && !usuario.empresaId) return null;

    return {
        ...usuario,
        rolEtiqueta: etiquetaRol(usuario.rol),
        rutaPanel: rutaInicioPorRol(usuario.rol),
        nombreMostrar: usuario.rol === 'empresa'
            ? (usuario.empresaNombre || usuario.nombre)
            : (usuario.candidatoNombre || usuario.nombre)
    };
}

async function crearSesionParaUsuario(usuarioId, cliente = pool) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

    await cliente.query('DELETE FROM sesiones_auth WHERE vence_en <= CURRENT_TIMESTAMP');
    await cliente.query(
        `INSERT INTO sesiones_auth (token_hash, usuario_id, vence_en)
         VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
        [tokenHash, Number(usuarioId)]
    );

    return token;
}

async function autenticarCredenciales(correoRaw, claveRaw) {
    const correo = texto(correoRaw).toLowerCase();
    const clave = String(claveRaw ?? '');

    if (typeof correoRaw !== 'string' || typeof claveRaw !== 'string' || !correo || correo.length > 254 || !clave || clave.length > 256) {
        throw new Error('Ingresa tu correo electrónico y contraseña.');
    }

    const { rows } = await pool.query(
        `SELECT
            u.id_usuario::int AS id,
            u.nombre,
            u.correo,
            u.clave_hash AS "claveHash",
            u.rol,
            u.activo,
            u.candidato_id::int AS "candidatoId",
            u.empresa_id::int AS "empresaId",
            e.estado AS "empresaEstado",
            COALESCE(c.estado, 'activo') AS "candidatoEstado",
            COALESCE(e.estado_aprobacion, 'aprobada') AS "empresaAprobacion"
         FROM usuarios_cuenta u
         LEFT JOIN candidatos c ON c.id_candidato = u.candidato_id
         LEFT JOIN empresas e ON e.id_empresa = u.empresa_id
         WHERE LOWER(u.correo) = $1
         LIMIT 1`,
        [correo]
    );

    const usuario = rows[0];
    const claveComparacion = usuario?.claveHash || ('0'.repeat(32) + ':' + '0'.repeat(128));
    const claveCorrecta = await verificarClave(clave, claveComparacion);
    if (!usuario || !claveCorrecta) {
        throw new Error('Correo electrónico o contraseña incorrectos.');
    }

    if (!usuario.activo || usuario.candidatoEstado === 'suspendido' || usuario.empresaAprobacion === 'suspendida') {
        throw new Error('Tu cuenta se encuentra suspendida por administración. Contacta a soporte.');
    }

    const token = await crearSesionParaUsuario(usuario.id);
    return {
        token,
        usuario,
        redireccion: rutaInicioPorRol(usuario.rol)
    };
}

async function autenticarDemoPorUsuarioId() {
    // Kept as a fail-closed compatibility export; a user ID is not authentication.
    const error = new Error('El acceso de demostracion sin credenciales esta deshabilitado.');
    error.status = 403; throw error;
}

async function registrarNuevoUsuario(datos = {}) {
    const rol = datos.rol === 'empresa' ? 'empresa' : 'candidato';
    const nombre = texto(datos.nombre);
    const correo = texto(datos.correo).toLowerCase();
    const clave = String(datos.clave ?? '');
    const confirmarClave = String(datos.confirmarClave ?? '');
    const telefono = texto(datos.telefono);
    const ubicacion = texto(datos.ubicacion) || 'San Salvador, El Salvador';

    if (!['candidato', 'empresa'].includes(datos.rol)) throw new Error('Selecciona un tipo de cuenta valido.');
    if (typeof datos.nombre !== 'string' || typeof datos.correo !== 'string') throw new Error('Datos de registro invalidos.');
    if (!nombre || nombre.length > 150) throw new Error('El nombre completo o de contacto es obligatorio.');
    if (correo.length > 180 || !correo || !/^\S+@\S+\.\S+$/.test(correo)) throw new Error('Ingresa un correo electrónico válido.');
    if (typeof datos.clave !== 'string' || clave.length < 12 || clave.length > 256) throw new Error('La contraseña debe tener entre 12 y 256 caracteres.');
    if (clave !== confirmarClave) throw new Error('Las contraseñas no coinciden.');

    const { rows: existente } = await pool.query(
        'SELECT id_usuario FROM usuarios_cuenta WHERE LOWER(correo) = $1 LIMIT 1',
        [correo]
    );
    if (existente.length > 0) {
        throw new Error('Ya existe una cuenta registrada con ese correo electrónico.');
    }

    const claveHash = await hashearClave(clave);
    const cliente = await pool.connect();

    try {
        await cliente.query('BEGIN');

        let candidatoId = null;
        let empresaId = null;

        if (rol === 'candidato') {
            const cargo = texto(datos.cargo) || 'Profesional en búsqueda activa';
            const empresaActual = texto(datos.empresaActual) || null;
            const aniosExperiencia = Number(datos.aniosExperiencia || 0);
            if (!Number.isInteger(aniosExperiencia) || aniosExperiencia < 0 || aniosExperiencia > 80) throw new Error('Experiencia invalida.');
            const habilidades = texto(datos.habilidades)
                ? texto(datos.habilidades).split(',').map(h => h.trim()).filter(Boolean)
                : ['Comunicación', 'Trabajo en equipo'];

            const { rows: candRows } = await cliente.query(
                `INSERT INTO candidatos (
                    nombre, cargo, empresa_actual, ubicacion, correo, telefono,
                    anios_experiencia, habilidades, estado
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activo')
                 RETURNING id_candidato::int AS id`,
                [nombre, cargo, empresaActual, ubicacion, correo, telefono || null, aniosExperiencia, habilidades]
            );
            candidatoId = candRows[0].id;
        } else {
            const nombreEmpresa = texto(datos.nombreEmpresa) || nombre;
            const sector = texto(datos.sector) || 'Tecnología';
            const nit = texto(datos.nit);
            if (!nit || nit.length > 50) throw new Error('Ingresa el NIT real de la empresa.');
            const razonSocial = texto(datos.razonSocial) || nombreEmpresa;
            const descripcion = texto(datos.descripcion) || 'Empresa registrada en TalentoHub para publicación de oportunidades laborales.';

            const { rows: empRows } = await cliente.query(
                `INSERT INTO empresas (
                    nombre, razon_social, nit, representante, correo, telefono,
                    sector, ubicacion, descripcion, estado, estado_aprobacion, estado_verificacion
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendiente', 'pendiente', 'no_verificada')
                 RETURNING id_empresa::int AS id`,
                [nombreEmpresa, razonSocial, nit, nombre, correo, telefono || null, sector, ubicacion, descripcion]
            );
            empresaId = empRows[0].id;

            await cliente.query(
                `INSERT INTO solicitudes_empresas (empresa_id, documento_url, notas_solicitante, estado)
                 VALUES ($1, NULL, $2, 'pendiente')`,
                [empresaId, `Registro empresarial pendiente de revision: ${nombreEmpresa}`]
            );
        }

        const { rows: usrRows } = await cliente.query(
            `INSERT INTO usuarios_cuenta (nombre, correo, clave_hash, rol, candidato_id, empresa_id, activo)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)
             RETURNING id_usuario::int AS id, nombre, correo, rol`,
            [nombre, correo, claveHash, rol, candidatoId, empresaId]
        );

        const nuevoUsuario = usrRows[0];
        const token = await crearSesionParaUsuario(nuevoUsuario.id, cliente);
        await cliente.query('COMMIT');

        return {
            token,
            usuario: nuevoUsuario,
            redireccion: rutaInicioPorRol(rol)
        };
    } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
    } finally {
        cliente.release();
    }
}

async function destruirSesion(token) {
    if (!token) return;
    await pool.query('DELETE FROM sesiones_auth WHERE token_hash = $1', [hashToken(token)]);
}

async function listarCuentasDemo() {
    const { rows } = await pool.query(`
        SELECT
            u.id_usuario::int AS id,
            u.nombre,
            u.correo,
            u.rol,
            u.candidato_id::int AS "candidatoId",
            u.empresa_id::int AS "empresaId",
            c.cargo AS "candidatoCargo",
            e.nombre AS "empresaNombre",
            e.sector AS "empresaSector"
        FROM usuarios_cuenta u
        LEFT JOIN candidatos c ON c.id_candidato = u.candidato_id
        LEFT JOIN empresas e ON e.id_empresa = u.empresa_id
        WHERE u.activo = TRUE
        ORDER BY
            CASE u.rol WHEN 'admin' THEN 1 WHEN 'candidato' THEN 2 ELSE 3 END,
            u.id_usuario ASC
        LIMIT 12
    `);
    return rows;
}

module.exports = {
    COOKIE_SESION,
    DURACION_SESION_MS,
    opcionesCookie,
    leerCookieSesion,
    rutaInicioPorRol,
    etiquetaRol,
    asegurarEsquemaAuth,
    obtenerUsuarioPorToken,
    autenticarCredenciales,
    autenticarDemoPorUsuarioId,
    registrarNuevoUsuario,
    destruirSesion,
    listarCuentasDemo
};
