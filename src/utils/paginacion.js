function enteroPositivo(valor, defecto, maximo = Number.MAX_SAFE_INTEGER) {
    const numero = Number(valor);
    const entero = Number.isFinite(numero) && numero !== 0 ? Math.trunc(numero) : defecto;
    return Math.min(maximo, Math.max(1, entero));
}
function paginacion(opciones = {}, limitePredeterminado = 10, limiteMaximo = Number.MAX_SAFE_INTEGER) {
    const limite = enteroPositivo(opciones.limite, limitePredeterminado, limiteMaximo);
    const pagina = enteroPositivo(opciones.pagina, 1, Math.floor(Number.MAX_SAFE_INTEGER / limite));
    return { limite, pagina, offset: (pagina - 1) * limite };
}
module.exports = { enteroPositivo, paginacion };
