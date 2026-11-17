const MESSAGES = Object.freeze({
    400: 'Solicitud invalida.', 401: 'Inicia sesion para continuar.',
    403: 'No tienes permisos para esta accion.', 404: 'Pagina no encontrada.',
    409: 'La solicitud entra en conflicto con el estado actual.',
    413: 'La solicitud supera el tamano permitido.', 422: 'Los datos enviados no son validos.',
    429: 'Demasiadas solicitudes. Intenta nuevamente mas tarde.',
    500: 'Error interno. Intenta nuevamente.', 503: 'Servicio no disponible temporalmente.'
});
function statusOf(error) {
    const status = Number(error?.status || error?.statusCode);
    return Object.hasOwn(MESSAGES, status) ? status : 500;
}
function messageOf(error, status = statusOf(error)) {
    return status !== 500 && typeof error?.publicMessage === 'string' && error.publicMessage.length <= 500
        ? error.publicMessage : MESSAGES[status];
}
class HttpError extends Error {
    constructor(status, publicMessage) {
        super(MESSAGES[status] || MESSAGES[500]);
        this.status = Object.hasOwn(MESSAGES, status) ? status : 500;
        if (publicMessage && this.status < 500) this.publicMessage = publicMessage;
    }
}
module.exports = { HttpError, statusOf, messageOf };
