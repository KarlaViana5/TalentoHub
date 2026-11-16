const authService = require('../services/auth.service');

let esquemaVerificado = false;

async function cargarSesionGlobal(req, res, next) {
    try {
        if (!esquemaVerificado) {
            await authService.asegurarEsquemaAuth();
            esquemaVerificado = true;
        }

        const token = authService.leerCookieSesion(req);
        const usuario = token ? await authService.obtenerUsuarioPorToken(token) : null;

        req.usuario = usuario;
        res.locals.usuarioActual = usuario;
        next();
    } catch (error) {
        console.error('Error al cargar sesión global:', error);
        req.usuario = null;
        res.locals.usuarioActual = null;
        next();
    }
}

function exigirAutenticacion(req, res, next) {
    if (req.usuario) return next();
    const volver = encodeURIComponent(req.originalUrl || '/');
    const aviso = encodeURIComponent('Inicia sesión para continuar.');
    return res.redirect(`/auth/login?volver=${volver}&aviso=${aviso}`);
}

function exigirRol(...rolesPermitidos) {
    return (req, res, next) => {
        // Permite probar bloqueo explícito si se envía ?rol=otroRol en /administrativo
        if (req.query.rol && !rolesPermitidos.includes(String(req.query.rol).toLowerCase())) {
            return res.status(403).render('administrativo/acceso-denegado', {
                titulo: 'Acceso restringido por Rol | TalentoHub',
                rolIntentado: req.query.rol,
                rolesRequeridos: rolesPermitidos.map(authService.etiquetaRol).join(' o '),
                ruta: req.originalUrl
            });
        }

        if (!req.usuario) {
            const nombresRoles = rolesPermitidos.map(authService.etiquetaRol).join(' o ');
            const volver = encodeURIComponent(req.originalUrl || '/');
            const aviso = encodeURIComponent(`Inicia sesión como ${nombresRoles} para acceder a este módulo.`);
            return res.redirect(`/auth/login?volver=${volver}&aviso=${aviso}`);
        }

        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).render('administrativo/acceso-denegado', {
                titulo: 'Acceso restringido por Rol | TalentoHub',
                rolIntentado: `${req.usuario.rolEtiqueta} (${req.usuario.nombreMostrar})`,
                rolesRequeridos: rolesPermitidos.map(authService.etiquetaRol).join(' o '),
                ruta: req.originalUrl
            });
        }

        next();
    };
}

module.exports = {
    cargarSesionGlobal,
    exigirAutenticacion,
    exigirRol
};
