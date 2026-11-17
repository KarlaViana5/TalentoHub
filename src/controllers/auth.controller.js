const { registrarError } = require('../utils/logger');
const authService = require('../services/auth.service');
const empresarialService = require('../services/empresarial.service');

function rutaVolverValida(volver, rol) {
    if (!volver || typeof volver !== 'string' || !volver.startsWith('/') || volver.startsWith('//') || /[\\\x00-\x20]/.test(volver) || /%5c|%0[ad]/i.test(volver)) {
        return null;
    }
    if (volver.startsWith('/administrativo') && rol !== 'admin') return null;
    if (volver.startsWith('/candidato') && !['candidato', 'admin'].includes(rol)) return null;
    if (volver.startsWith('/empresarial') && !['empresa', 'admin'].includes(rol)) return null;
    return volver;
}

const authController = {
    mostrarLogin: async (req, res) => {
        try {
            res.render('auth/login', {
                titulo: 'Iniciar sesión | TalentoHub',
                volver: req.query.volver || '',
                aviso: req.query.aviso || null,
                mensaje: req.query.mensaje || null,
                error: req.query.error || null,
                correoPrevio: req.query.correo || ''
            });
        } catch (error) {
            console.error('Error al mostrar login:');
            throw error;
        }
    },

    procesarLogin: async (req, res) => {
        const volver = req.body.volver || req.query.volver || '';
        try {
            const resultado = await authService.autenticarCredenciales(req.body.correo, req.body.clave);

            res.cookie(authService.COOKIE_SESION, resultado.token, {
                ...authService.opcionesCookie(),
                maxAge: authService.DURACION_SESION_MS
            });

            const destino = rutaVolverValida(volver, resultado.usuario.rol) || resultado.redireccion;
            res.redirect(destino);
        } catch (error) {
            res.status(401).render('auth/login', {
                titulo: 'Iniciar sesión | TalentoHub',
                volver,
                aviso: null,
                mensaje: null,
                error: error.code ? 'No se pudo completar la solicitud. Intenta nuevamente.' : error.message,
                correoPrevio: req.body.correo || ''
            });
        }
    },

    mostrarRegistro: async (req, res) => {
        const rolSeleccionado = req.query.rol === 'empresa' ? 'empresa' : 'candidato';
        res.render('auth/registro', {
            titulo: 'Crear cuenta | TalentoHub',
            rolSeleccionado,
            sectores: empresarialService.SECTORES,
            valores: {},
            error: req.query.error || null
        });
    },

    procesarRegistro: async (req, res) => {
        try {
            const resultado = await authService.registrarNuevoUsuario(req.body);

            res.cookie(authService.COOKIE_SESION, resultado.token, {
                ...authService.opcionesCookie(),
                maxAge: authService.DURACION_SESION_MS
            });

            const separador = resultado.redireccion.includes('?') ? '&' : '?';
            res.redirect(`${resultado.redireccion}${separador}mensaje=${encodeURIComponent('¡Cuenta creada e inicio de sesión exitoso!')}`);
        } catch (error) {
            const rolSeleccionado = req.body.rol === 'empresa' ? 'empresa' : 'candidato';
            res.status(400).render('auth/registro', {
                titulo: 'Crear cuenta | TalentoHub',
                rolSeleccionado,
                sectores: empresarialService.SECTORES,
                valores: Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => !['clave', 'confirmarClave', '_csrf'].includes(key))),
                error: error.message
            });
        }
    },

    cerrarSesion: async (req, res) => {
        try {
            const token = authService.leerCookieSesion(req);
            if (token) {
                await authService.destruirSesion(token);
            }
            res.clearCookie(authService.COOKIE_SESION, authService.opcionesCookie());
            res.redirect('/auth/login?mensaje=' + encodeURIComponent('Has cerrado sesión correctamente.'));
        } catch (error) {
            console.error('Error al cerrar sesión:');
            res.clearCookie(authService.COOKIE_SESION, authService.opcionesCookie());
            res.redirect('/auth/login');
        }
    }
};

module.exports = authController;
