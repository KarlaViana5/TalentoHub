const todos = document.getElementById('seleccionar-todos');
const casillas = document.querySelectorAll('.seleccion');
const contadorSeleccion = document.getElementById('contador-seleccion');
const botonesMasivos = document.querySelectorAll('#form-masivo button');

function seleccionadas() {
    return [...casillas].filter(c => c.checked);
}

function actualizarSeleccion() {
    const total = seleccionadas().length;
    contadorSeleccion.textContent = `${total} ${total === 1 ? 'seleccionado' : 'seleccionados'} · ${casillas.length} candidatos`;
    botonesMasivos.forEach(b => { b.disabled = total === 0; });
    if (todos) todos.checked = total > 0 && total === casillas.length;
}

if (todos) {
    todos.addEventListener('change', () => {
        casillas.forEach(c => { c.checked = todos.checked; });
        actualizarSeleccion();
    });
}

casillas.forEach(c => c.addEventListener('change', actualizarSeleccion));

// correo a varios
document.getElementById('btn-contactar').addEventListener('click', () => {
    const correos = seleccionadas().map(c => c.dataset.correo).join(',');
    window.location.href = `mailto:?bcc=${correos}`;
});

actualizarSeleccion();
