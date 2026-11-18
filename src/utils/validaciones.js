// formatos de El Salvador

function texto(valor) {
    return String(valor ?? '').trim();
}

// nit: 14 digitos 0000-000000-000-0
function normalizarNit(valor) {
    const limpio = texto(valor);
    if (!/^[\d-]+$/.test(limpio)) return null;
    const d = limpio.replace(/-/g, '');
    if (d.length !== 14) return null;
    return `${d.slice(0, 4)}-${d.slice(4, 10)}-${d.slice(10, 13)}-${d.slice(13)}`;
}

// tel: 8 digitos, empieza con 2, 6 o 7. vacio = ''
function normalizarTelefono(valor) {
    const limpio = texto(valor);
    if (!limpio) return '';
    if (!/^[\d-]+$/.test(limpio)) return null;
    const d = limpio.replace(/-/g, '');
    if (!/^[267]\d{7}$/.test(d)) return null;
    return `${d.slice(0, 4)}-${d.slice(4)}`;
}

const MENSAJE_NIT = 'El NIT debe tener 14 dígitos con el formato 0000-000000-000-0.';
const MENSAJE_TELEFONO = 'El teléfono debe tener 8 dígitos y empezar con 2, 6 o 7 (ej. 2200-0000).';

module.exports = { normalizarNit, normalizarTelefono, MENSAJE_NIT, MENSAJE_TELEFONO };
