const { createHash, randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { filas, primera, transaccion, errorHttp } = require('../services/modulo4-db.service');

const derivar = promisify(scrypt);
const cookie = 'talentohub_comunidad';
const vigenciaMs = 12 * 60 * 60 * 1000;
const intentos = new Map();

function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

async function guardarClave(clave) {
    const sal = randomBytes(16).toString('hex');
    return `${sal}:${(await derivar(clave, sal, 64)).toString('hex')}`;
}

async function claveValida(clave, guardada) {
    const [sal, hash] = (guardada || '').split(':');
    const calculada = await derivar(clave, sal || 'talentohub-comunidad', 64);
    return Boolean(hash && /^[a-f0-9]{128}$/.test(hash) &&
        timingSafeEqual(calculada, Buffer.from(hash, 'hex')));
}

function leerToken(req) {
    const cookies = req.get('cookie') || '';
    return cookies.match(/(?:^|;\s*)talentohub_comunidad=([a-f0-9]{64})(?:;|$)/)?.[1];
}

function opcionesCookie() {
    return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
}

async function cargarSesion(req, res, next) {
    res.locals.usuario = null;
    res.locals.csrf = '';
    res.set('Cache-Control', 'no-store');

    const token = leerToken(req);
    if (token) {
        const usuario = await primera(`SELECT u.id, u.nombre, u.rol, s.csrf
            FROM modulo4.sesiones s JOIN modulo4.usuarios u ON u.id = s.usuario_id
            LEFT JOIN public.empresas e ON e.id_empresa = u.empresa_id
            WHERE s.token_hash = $1 AND s.vence > now() AND u.activo
              AND (u.rol <> 'empresa' OR e.estado = 'activa')`, [hashToken(token)]);
        if (usuario) {
            res.locals.usuario = usuario;
            res.locals.csrf = usuario.csrf;
        }
    }
    next();
}

function exigirSesion(req, res, next) {
    if (res.locals.usuario) return next();
    if (req.method === 'GET') return res.redirect('/foros/ingresar');
    throw errorHttp(401, 'Inicia sesión para continuar.');
}

function exigirAdmin(req, res, next) {
    if (res.locals.usuario?.rol !== 'admin') throw errorHttp(403, 'Acceso reservado a administradores.');
    next();
}

function verificarFormulario(req, res, next) {
    if (req.method !== 'POST') return next();
    const token = req.body?._csrf;
    if (!res.locals.csrf || token !== res.locals.csrf) throw errorHttp(403, 'El formulario venció. Recarga la página.');
    next();
}

function verificarOrigen(req, res, next) {
    const sitio = req.get('sec-fetch-site');
    const origen = req.get('origin');
    if (sitio === 'cross-site' || (origen && !['http', 'https'].some(
        protocolo => origen === `${protocolo}://${req.get('host')}`
    ))) throw errorHttp(403, 'Formulario de origen inválido.');
    next();
}

async function iniciarSesion(req, res) {
    const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim().toLowerCase() : '';
    const clave = req.body?.clave;
    if (!correo || correo.length > 254 || typeof clave !== 'string' || clave.length > 256) {
        throw errorHttp(401, 'Credenciales inválidas.');
    }

    const ahora = Date.now();
    const ip = req.ip;
    for (const [origen, registro] of intentos) {
        if (registro.vence < ahora) intentos.delete(origen);
    }
    if (!intentos.has(ip) && intentos.size >= 2048) throw errorHttp(429, 'Intenta nuevamente más tarde.');
    const registro = intentos.get(ip) || { cantidad: 0, vence: ahora + 5 * 60 * 1000 };
    if (registro.cantidad >= 10) throw errorHttp(429, 'Demasiados intentos. Intenta en cinco minutos.');
    registro.cantidad++;
    intentos.set(ip, registro);

    const usuario = await primera(`SELECT u.id, u.rol, u.clave_hash
        FROM modulo4.usuarios u LEFT JOIN public.empresas e ON e.id_empresa = u.empresa_id
        WHERE u.correo = $1 AND u.activo AND (u.rol <> 'empresa' OR e.estado = 'activa')`, [correo]);
    if (!await claveValida(clave, usuario?.clave_hash)) throw errorHttp(401, 'Credenciales inválidas.');
    const token = randomBytes(32).toString('hex');
    await transaccion(async cliente => {
        const vigente = await primera(`SELECT id FROM modulo4.usuarios u
            WHERE u.id = $1 AND u.correo = $2 AND u.clave_hash = $3 AND u.activo
              AND (u.rol <> 'empresa' OR EXISTS (
                  SELECT 1 FROM public.empresas e WHERE e.id_empresa = u.empresa_id AND e.estado = 'activa' FOR SHARE
              )) FOR SHARE`, [usuario.id, correo, usuario.clave_hash], cliente);
        if (!vigente) throw errorHttp(401, 'Credenciales inválidas.');
        await filas('DELETE FROM modulo4.sesiones WHERE vence <= now()', [], cliente);
        await filas(`INSERT INTO modulo4.sesiones (token_hash, usuario_id, csrf) VALUES ($1, $2, $3)`,
            [hashToken(token), usuario.id, randomBytes(32).toString('hex')], cliente);
    });
    res.cookie(cookie, token, { ...opcionesCookie(), maxAge: vigenciaMs });
    res.redirect(303, usuario.rol === 'admin' ? '/administrativo' : '/foros');
}

async function cerrarSesion(req, res) {
    await filas('DELETE FROM modulo4.sesiones WHERE token_hash = $1', [hashToken(leerToken(req))]);
    res.clearCookie(cookie, opcionesCookie());
    res.redirect(303, '/foros');
}

module.exports = {
    guardarClave, cargarSesion, exigirSesion, exigirAdmin, verificarFormulario,
    verificarOrigen, iniciarSesion, cerrarSesion
};
