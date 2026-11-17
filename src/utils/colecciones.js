// Preserve row order, object references and numeric/string key distinctions.
function agruparPor(filas, clave) {
    const grupos = new Map();
    for (const fila of filas) {
        const valor = fila[clave];
        if (!grupos.has(valor)) grupos.set(valor, []);
        grupos.get(valor).push(fila);
    }
    return grupos;
}
module.exports = { agruparPor };
