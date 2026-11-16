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
    if (!clave || !guardada || !guardada.includes(':')) return false;
    const [sal, hashHex] = guardada.split(':');
    if (!sal || !/^[a-f0-9]{128}$/.test(hashHex)) return false;
    const calculada = await derivar(String(clave), sal, 64);
    return timingSafeEqual(calculada, Buffer.from(hashHex, 'hex'));
}

function leerCookieSesion(req) {
    const cookies = req.get('cookie') || '';
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
    await cliente.query(`
        CREATE TABLE IF NOT EXISTS usuarios_cuenta (
            id_usuario BIGSERIAL PRIMARY KEY,
            nombre VARCHAR(150) NOT NULL,
            correo VARCHAR(180) UNIQUE NOT NULL,
            clave_hash TEXT NOT NULL,
            rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'candidato', 'empresa')),
            candidato_id BIGINT UNIQUE REFERENCES candidatos(id_candidato) ON DELETE CASCADE,
            empresa_id BIGINT REFERENCES empresas(id_empresa) ON DELETE CASCADE,
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sesiones_auth (
            token_hash VARCHAR(128) PRIMARY KEY,
            usuario_id BIGINT NOT NULL REFERENCES usuarios_cuenta(id_usuario) ON DELETE CASCADE,
            vence_en TIMESTAMP NOT NULL,
            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const { rows: conteo } = await cliente.query('SELECT COUNT(*)::int AS total FROM usuarios_cuenta');
    if (conteo[0].total === 0) {
        const [hashAdmin, hashCandidato, hashEmpresa] = await Promise.all([
            hashearClave('Admin123!'),
            hashearClave('Candidato123!'),
            hashearClave('Empresa123!')
        ]);

        // 1. Cuenta Administrador Principal
        await cliente.query(
            `INSERT INTO usuarios_cuenta (nombre, correo, clave_hash, rol, activo)
             VALUES ($1, $2, $3, 'admin', TRUE)
             ON CONFLICT (correo) DO NOTHING`,
            ['Administrador Principal', 'admin@talentohub.edu.sv', hashAdmin]
        );

        // 2. Cuentas para candidatos existentes
        const { rows: candidatos } = await cliente.query(
            'SELECT id_candidato, nombre, correo FROM candidatos ORDER BY id_candidato ASC'
        );
        for (const cand of candidatos) {
            const correoLimpio = (cand.correo || `candidato${cand.id_candidato}@talentohub.edu.sv`).trim().toLowerCase();
            await cliente.query(
                `INSERT INTO usuarios_cuenta (nombre, correo, clave_hash, rol, candidato_id, activo)
                 VALUES ($1, $2, $3, 'candidato', $4, TRUE)
                 ON CONFLICT (correo) DO NOTHING`,
                [cand.nombre, correoLimpio, hashCandidato, cand.id_candidato]
            );
        }

        // 3. Cuentas para empresas existentes
        const { rows: empresas } = await cliente.query(
            'SELECT id_empresa, nombre, representante, correo FROM empresas ORDER BY id_empresa ASC'
        );
        for (const emp of empresas) {
            const correoLimpio = (emp.correo || `contacto@empresa${emp.id_empresa}.com.sv`).trim().toLowerCase();
            await cliente.query(
                `INSERT INTO usuarios_cuenta (nombre, correo, clave_hash, rol, empresa_id, activo)
                 VALUES ($1, $2, $3, 'empresa', $4, TRUE)
                 ON CONFLICT (correo) DO NOTHING`,
                [emp.representante || emp.nombre, correoLimpio, hashEmpresa, emp.id_empresa]
            );
        }
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
    if (!usuario) return null;

    return {
        ...usuario,
        rolEtiqueta: etiquetaRol(usuario.rol),
        rutaPanel: rutaInicioPorRol(usuario.rol),
        nombreMostrar: usuario.rol === 'empresa'
            ? (usuario.empresaNombre || usuario.nombre)
            : (usuario.candidatoNombre || usuario.nombre)
    };
}

async function crearSesionParaUsuario(usuarioId) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

    await pool.query('DELETE FROM sesiones_auth WHERE vence_en <= CURRENT_TIMESTAMP');
    await pool.query(
        `INSERT INTO sesiones_auth (token_hash, usuario_id, vence_en)
         VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
        [tokenHash, Number(usuarioId)]
    );

    return token;
}

async function autenticarCredenciales(correoRaw, claveRaw) {
    const correo = texto(correoRaw).toLowerCase();
    const clave = String(claveRaw ?? '');

    if (!correo || !clave) {
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
    if (!usuario || !await verificarClave(clave, usuario.claveHash)) {
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

async function autenticarDemoPorUsuarioId(usuarioId) {
    const { rows } = await pool.query(
        `SELECT id_usuario::int AS id, nombre, correo, rol, activo
         FROM usuarios_cuenta
         WHERE id_usuario = $1 AND activo = TRUE
         LIMIT 1`,
        [Number(usuarioId)]
    );
    const usuario = rows[0];
    if (!usuario) {
        throw new Error('La cuenta de demostración seleccionada no está disponible.');
    }
    const token = await crearSesionParaUsuario(usuario.id);
    return {
        token,
        usuario,
        redireccion: rutaInicioPorRol(usuario.rol)
    };
}

async function registrarNuevoUsuario(datos = {}) {
    const rol = datos.rol === 'empresa' ? 'empresa' : 'candidato';
    const nombre = texto(datos.nombre);
    const correo = texto(datos.correo).toLowerCase();
    const clave = String(datos.clave ?? '');
    const confirmarClave = String(datos.confirmarClave ?? '');
    const telefono = texto(datos.telefono);
    const ubicacion = texto(datos.ubicacion) || 'San Salvador, El Salvador';

    if (!nombre) throw new Error('El nombre completo o de contacto es obligatorio.');
    if (!correo || !/^\S+@\S+\.\S+$/.test(correo)) throw new Error('Ingresa un correo electrónico válido.');
    if (clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    if (confirmarClave && clave !== confirmarClave) throw new Error('Las contraseñas no coinciden.');

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
            const aniosExperiencia = Math.max(0, Number(datos.aniosExperiencia) || 0);
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
            const nit = texto(datos.nit) || '0614-100226-101-1';
            const razonSocial = texto(datos.razonSocial) || `${nombreEmpresa}, S.A. de C.V.`;
            const descripcion = texto(datos.descripcion) || 'Empresa registrada en TalentoHub para publicación de oportunidades laborales.';

            const { rows: empRows } = await cliente.query(
                `INSERT INTO empresas (
                    nombre, razon_social, nit, representante, correo, telefono,
                    sector, ubicacion, descripcion, estado, estado_aprobacion, estado_verificacion,
                    aprobada_en, aprobada_por
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'activa', 'aprobada', 'verificada', CURRENT_TIMESTAMP, 'Registro Verificado')
                 RETURNING id_empresa::int AS id`,
                [nombreEmpresa, razonSocial, nit, nombre, correo, telefono || null, sector, ubicacion, descripcion]
            );
            empresaId = empRows[0].id;

            await cliente.query(
                `INSERT INTO solicitudes_empresas (empresa_id, documento_url, notas_solicitante, estado, motivo_decision, revisado_por, fecha_revision)
                 VALUES ($1, $2, $3, 'aprobada', 'Registro empresarial verificado inicialmente.', 'Sistema TalentoHub', CURRENT_TIMESTAMP)`,
                [empresaId, `https://talentohub.edu.sv/docs/registro-mercantil-${empresaId}.pdf`, `Registro de empresa ${nombreEmpresa}`]
            );
        }

        const { rows: usrRows } = await cliente.query(
            `INSERT INTO usuarios_cuenta (nombre, correo, clave_hash, rol, candidato_id, empresa_id, activo)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)
             RETURNING id_usuario::int AS id, nombre, correo, rol`,
            [nombre, correo, claveHash, rol, candidatoId, empresaId]
        );

        await cliente.query('COMMIT');

        const nuevoUsuario = usrRows[0];
        const token = await crearSesionParaUsuario(nuevoUsuario.id);

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
