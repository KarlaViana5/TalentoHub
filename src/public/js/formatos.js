// mascaras nit y telefono
const formatos = {
    nit: { grupos: [4, 6, 3, 1], mensaje: 'El NIT debe tener 14 dígitos: 0000-000000-000-0.' },
    telefono: { grupos: [4, 4], mensaje: 'El teléfono debe tener 8 dígitos y empezar con 2, 6 o 7: 0000-0000.' }
};

function aplicarFormato(valor, grupos) {
    const total = grupos.reduce((a, b) => a + b, 0);
    let digitos = valor.replace(/\D/g, '');
    // quita el +503 si lo pegan
    if (total === 8 && digitos.length > 8 && digitos.startsWith('503')) digitos = digitos.slice(3);
    digitos = digitos.slice(0, total);
    const partes = [];
    let inicio = 0;
    for (const largo of grupos) {
        if (inicio >= digitos.length) break;
        partes.push(digitos.slice(inicio, inicio + largo));
        inicio += largo;
    }
    return partes.join('-');
}

function validar(input, tipo) {
    const digitos = input.value.replace(/\D/g, '');
    const total = formatos[tipo].grupos.reduce((a, b) => a + b, 0);
    let valido = digitos.length === total || (!input.required && digitos.length === 0);
    if (tipo === 'telefono' && digitos.length === total && !/^[267]/.test(digitos)) valido = false;
    input.setCustomValidity(valido ? '' : formatos[tipo].mensaje);
}

document.querySelectorAll('[data-formato]').forEach(input => {
    const tipo = input.dataset.formato;
    const { grupos } = formatos[tipo];

    // bloquea letras
    input.addEventListener('keydown', e => {
        const permitidas = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'];
        if (e.ctrlKey || e.metaKey || permitidas.includes(e.key)) return;
        if (!/^\d$/.test(e.key)) return e.preventDefault();
        // tel empieza con 2, 6 o 7
        const sinDigitos = input.value.replace(/\D/g, '').length === 0 || input.selectionStart === 0;
        if (tipo === 'telefono' && sinDigitos && !'267'.includes(e.key)) e.preventDefault();
    });

    input.addEventListener('input', () => {
        input.value = aplicarFormato(input.value, grupos);
        validar(input, tipo);
    });

    input.addEventListener('blur', () => {
        validar(input, tipo);
        if (input.value) input.reportValidity();
    });

    input.value = aplicarFormato(input.value, grupos);
    validar(input, tipo);
});
