const form = document.getElementById('form-vacante');
const pasos = document.querySelectorAll('.emp-paso');
const itemsStepper = document.querySelectorAll('#stepper li');
const btnAnterior = document.getElementById('btn-anterior');
const btnSiguiente = document.getElementById('btn-siguiente');
const btnPublicar = document.getElementById('btn-publicar');
const totalPasos = pasos.length;

let pasoActual = window.pasoInicial || 1;
let pasoMaximo = pasoActual;

function mostrarPaso(numero) {
    pasoActual = numero;
    pasoMaximo = Math.max(pasoMaximo, numero);

    pasos.forEach(p => { p.hidden = Number(p.dataset.paso) !== numero; });

    itemsStepper.forEach(li => {
        const n = Number(li.dataset.paso);
        li.classList.toggle('actual', n === numero);
        li.classList.toggle('completo', n < numero);
        li.classList.toggle('disponible', n <= pasoMaximo);
    });

    btnAnterior.hidden = numero === 1;
    btnSiguiente.hidden = numero === totalPasos;
    btnPublicar.hidden = numero !== totalPasos;

    if (numero === totalPasos) armarResumen();
}

// valida el paso actual
function pasoValido() {
    const seccion = document.querySelector(`.emp-paso[data-paso="${pasoActual}"]`);
    const campos = seccion.querySelectorAll('input[required], select[required], textarea[required]');

    for (const campo of campos) {
        if (!campo.checkValidity()) {
            campo.reportValidity();
            return false;
        }
    }

    if (pasoActual === 2 && obtenerHabilidades().length === 0) {
        inputHabilidad.setCustomValidity('Agrega al menos una habilidad.');
        inputHabilidad.reportValidity();
        inputHabilidad.setCustomValidity('');
        return false;
    }

    if (pasoActual === 3) {
        const min = Number(form.salarioMinimo.value);
        const max = Number(form.salarioMaximo.value);
        if (min && max && min > max) {
            form.salarioMinimo.setCustomValidity('El mínimo no puede ser mayor que el máximo.');
            form.salarioMinimo.reportValidity();
            form.salarioMinimo.setCustomValidity('');
            return false;
        }
    }
    return true;
}

btnSiguiente.addEventListener('click', () => {
    if (pasoValido()) mostrarPaso(pasoActual + 1);
});

btnAnterior.addEventListener('click', () => mostrarPaso(pasoActual - 1));

itemsStepper.forEach(li => {
    li.addEventListener('click', () => {
        const n = Number(li.dataset.paso);
        if (n <= pasoMaximo) mostrarPaso(n);
    });
});

// responsabilidades
const listaResp = document.getElementById('lista-responsabilidades');

function agregarResponsabilidad(valor = '') {
    const fila = document.createElement('div');
    fila.className = 'emp-lista-item';
    fila.innerHTML = '<input name="responsabilidades"><button type="button" class="emp-quitar" title="Quitar">✕</button>';
    fila.querySelector('input').value = valor;
    listaResp.appendChild(fila);
    fila.querySelector('input').focus();
}

document.getElementById('agregar-responsabilidad').addEventListener('click', () => agregarResponsabilidad());

listaResp.addEventListener('click', e => {
    if (e.target.classList.contains('emp-quitar')) {
        e.target.parentElement.remove();
        actualizarPreview();
    }
});

if (listaResp.children.length === 0) agregarResponsabilidad();

// habilidades
const contenedorTags = document.getElementById('etiquetas');
const inputHabilidad = document.getElementById('habilidad-input');

function obtenerHabilidades() {
    return [...contenedorTags.querySelectorAll('input[type="hidden"]')].map(i => i.value);
}

function agregarHabilidad(valor) {
    const limpio = valor.trim();
    const yaExiste = obtenerHabilidades().some(h => h.toLowerCase() === limpio.toLowerCase());
    if (!limpio || yaExiste) return;

    const tag = document.createElement('span');
    tag.className = 'emp-tag';
    tag.textContent = limpio;

    const oculto = document.createElement('input');
    oculto.type = 'hidden';
    oculto.name = 'habilidades';
    oculto.value = limpio;

    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.textContent = '×';

    tag.append(oculto, quitar);
    contenedorTags.insertBefore(tag, inputHabilidad);
    actualizarPreview();
}

inputHabilidad.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        agregarHabilidad(inputHabilidad.value);
        inputHabilidad.value = '';
    }
});

inputHabilidad.addEventListener('change', () => {
    agregarHabilidad(inputHabilidad.value);
    inputHabilidad.value = '';
});

contenedorTags.addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON') {
        e.target.parentElement.remove();
        actualizarPreview();
    }
});

const descripcion = document.getElementById('descripcion');
const contador = document.getElementById('contador');

// vista previa
function el(id) {
    return document.getElementById(id);
}

function chip(valor) {
    const span = document.createElement('span');
    span.className = 'emp-chip';
    span.textContent = valor;
    return span;
}

function nombreEmpresa() {
    const sel = form.empresaId;
    return sel.value ? sel.options[sel.selectedIndex].text : 'Empresa';
}

function actualizarPreview() {
    contador.textContent = descripcion.value.length;

    const empresa = nombreEmpresa();
    el('pv-inicial').textContent = empresa.charAt(0);
    el('pv-titulo').textContent = form.titulo.value || 'Título del puesto';
    el('pv-empresa').textContent = `${empresa} · ${form.ubicacion.value || 'Ubicación'}`;

    const desc = descripcion.value;
    el('pv-descripcion').textContent = desc.length > 120 ? desc.slice(0, 120) + '...' : desc;

    const chips = el('pv-chips');
    chips.replaceChildren(chip(form.modalidad.value), chip(form.tipoContrato.value));
    if (form.experiencia.value) chips.append(chip(form.experiencia.value));

    el('pv-habilidades').replaceChildren(...obtenerHabilidades().map(chip));

    calcularCalidad();
}

function calcularCalidad() {
    const responsabilidades = [...form.querySelectorAll('input[name="responsabilidades"]')].filter(i => i.value.trim());
    const tieneSalario = Number(form.salarioMinimo.value) > 0 || Number(form.salarioMaximo.value) > 0;

    const puntos = [
        form.titulo.value.trim() !== '',
        descripcion.value.length >= 100,
        responsabilidades.length >= 2,
        obtenerHabilidades().length >= 3,
        tieneSalario,
        form.beneficios.value.trim() !== ''
    ].filter(Boolean).length;

    const porcentaje = Math.round((puntos / 6) * 100);
    const nivel = porcentaje >= 80 ? 'Buena' : porcentaje >= 50 ? 'Media' : 'Baja';

    el('pv-calidad').textContent = nivel;
    el('pv-barra').style.width = porcentaje + '%';
    el('pv-barra').className = 'nivel-' + nivel.toLowerCase();
    el('pv-consejo').textContent = tieneSalario
        ? 'Completa todos los campos para atraer mejores candidatos.'
        : 'Agrega el salario para recibir hasta 30% más postulaciones.';
}

function fila(nombre, valor) {
    const dt = document.createElement('dt');
    dt.textContent = nombre;
    const dd = document.createElement('dd');
    dd.textContent = valor || '-';
    return [dt, dd];
}

function armarResumen() {
    const responsabilidades = [...form.querySelectorAll('input[name="responsabilidades"]')]
        .map(i => i.value.trim()).filter(Boolean);
    const min = form.salarioMinimo.value;
    const max = form.salarioMaximo.value;
    const salario = min || max ? `$${min || 0} - $${max || 0}` : 'No especificado';

    const dl = document.createElement('dl');
    dl.className = 'emp-detalle';
    dl.append(
        ...fila('Puesto', form.titulo.value),
        ...fila('Empresa', nombreEmpresa()),
        ...fila('Ubicación', `${form.ubicacion.value} · ${form.modalidad.value} · ${form.tipoContrato.value}`),
        ...fila('Descripción', descripcion.value),
        ...fila('Responsabilidades', responsabilidades.join(' · ')),
        ...fila('Habilidades', obtenerHabilidades().join(', ')),
        ...fila('Experiencia y formación', `${form.experiencia.value} · ${form.formacion.value}`),
        ...fila('Salario', salario),
        ...fila('Beneficios', form.beneficios.value.split('\n').filter(Boolean).join(' · ')),
        ...fila('Fecha de cierre', form.fechaCierre.value),
        ...fila('Contacto', form.contacto.value)
    );
    el('resumen').replaceChildren(dl);
}

form.addEventListener('input', actualizarPreview);
form.addEventListener('change', actualizarPreview);

form.addEventListener('submit', e => {
    if (e.submitter && e.submitter.value === 'publicar' && !pasoValido()) e.preventDefault();
});

actualizarPreview();
mostrarPaso(pasoActual);
