// usuario simulado
const empleadorActual = {
    nombre: 'María Rodríguez',
    empresaId: 1
};

const ESTADOS_EMPRESA = ['Activa', 'Pendiente', 'Inactiva'];
const ESTADOS_VACANTE = ['Activa', 'Borrador', 'Inactiva', 'Cancelada'];
const ESTADOS_POSTULACION = ['Nuevo', 'Preseleccionado', 'Entrevista', 'Contratado', 'Rechazado'];
const SECTORES = ['Tecnología', 'Investigación', 'Comercio', 'ONG', 'Finanzas', 'Diseño', 'Marketing'];

// datos iniciales

const empresas = [
    {
        id: 1,
        nombre: 'Nexo Digital',
        sector: 'Tecnología',
        ubicacion: 'San Salvador, El Salvador',
        descripcion: 'Estudio de producto digital enfocado en banca y comercio electrónico.',
        estado: 'Activa'
    },
    {
        id: 2,
        nombre: 'Nexo Labs',
        sector: 'Investigación',
        ubicacion: 'Santa Tecla, El Salvador',
        descripcion: 'Laboratorio de innovación y prototipado de nuevas soluciones.',
        estado: 'Activa'
    },
    {
        id: 3,
        nombre: 'Nexo Retail',
        sector: 'Comercio',
        ubicacion: 'San Miguel, El Salvador',
        descripcion: 'Cadena de tiendas y comercio minorista.',
        estado: 'Pendiente'
    },
    {
        id: 4,
        nombre: 'Nexo Foundation',
        sector: 'ONG',
        ubicacion: 'San Salvador, El Salvador',
        descripcion: 'Fundación dedicada a programas de educación tecnológica.',
        estado: 'Inactiva'
    }
];

// ids desde 101
const vacantes = [
    {
        id: 101,
        empresaId: 1,
        titulo: 'Diseñador UX/UI Senior',
        ubicacion: 'San Salvador',
        modalidad: 'Híbrido',
        tipoContrato: 'Tiempo completo',
        experiencia: '3-5 años',
        formacion: 'Universitaria',
        salarioMinimo: 1500,
        salarioMaximo: 2100,
        descripcion: 'Buscamos un diseñador UX/UI con experiencia en productos digitales financieros que lidere la creación de flujos y prototipos.',
        responsabilidades: ['Diseñar flujos y prototipos de alta fidelidad.', 'Conducir pruebas de usabilidad.'],
        habilidades: ['Figma', 'UX Research', 'Design Systems', 'Prototipado'],
        beneficios: ['Trabajo híbrido.', 'Seguro médico.'],
        contacto: 'talento@nexodigital.com',
        reclutador: 'María Rodríguez',
        fechaPublicacion: '2026-10-18',
        fechaCierre: '2026-11-30',
        estado: 'Activa',
        vistas: 1210
    },
    {
        id: 102,
        empresaId: 1,
        titulo: 'Frontend Developer',
        ubicacion: 'San Salvador',
        modalidad: 'Remoto',
        tipoContrato: 'Tiempo completo',
        experiencia: '1-3 años',
        formacion: 'Universitaria',
        salarioMinimo: 1200,
        salarioMaximo: 1800,
        descripcion: 'Desarrollo de interfaces web modernas para nuestros clientes.',
        responsabilidades: ['Maquetar interfaces responsivas.', 'Consumir API REST.'],
        habilidades: ['JavaScript', 'HTML/CSS', 'React', 'Git'],
        beneficios: ['Trabajo remoto.', 'Capacitación continua.'],
        contacto: 'talento@nexodigital.com',
        reclutador: 'María Rodríguez',
        fechaPublicacion: '2026-10-12',
        fechaCierre: '2026-11-25',
        estado: 'Activa',
        vistas: 2034
    },
    {
        id: 103,
        empresaId: 1,
        titulo: 'Data Analyst',
        ubicacion: 'San Salvador',
        modalidad: 'Presencial',
        tipoContrato: 'Tiempo completo',
        experiencia: '1-3 años',
        formacion: 'Universitaria',
        salarioMinimo: 1100,
        salarioMaximo: 1500,
        descripcion: 'Análisis de datos y elaboración de reportes para el área comercial.',
        responsabilidades: ['Preparar reportes semanales.', 'Construir tableros de indicadores.'],
        habilidades: ['SQL', 'Excel', 'Power BI'],
        beneficios: ['Prestaciones de ley.'],
        contacto: 'talento@nexodigital.com',
        reclutador: 'María Rodríguez',
        fechaPublicacion: '2026-10-01',
        fechaCierre: '2026-11-16',
        estado: 'Activa',
        vistas: 860
    }
];

const candidatos = [
    {
        id: 1,
        nombre: 'Alex Moreno',
        cargo: 'Product Designer',
        empresaActual: 'Aster',
        ubicacion: 'San Salvador, El Salvador',
        correo: 'alex.moreno@correo.com',
        telefono: '+503 7012 3456',
        aniosExperiencia: 5,
        habilidades: ['Figma', 'UX Research', 'Design Systems', 'Prototipado', 'HTML/CSS', 'Motion'],
        experiencia: [
            { puesto: 'Product Designer', empresa: 'Aster', periodo: '2023 - Actualidad', descripcion: 'Lideró el rediseño de la app móvil (+35% retención).' },
            { puesto: 'Diseñador UI', empresa: 'Finova', periodo: '2021 - 2023', descripcion: 'Diseño de interfaces para banca en línea.' }
        ],
        formacion: [
            { titulo: 'Lic. en Diseño Gráfico', institucion: 'Universidad', periodo: '2016 - 2020' }
        ],
        cv: 'CV_AlexMoreno_2026.pdf'
    },
    {
        id: 2,
        nombre: 'Karla Rivas',
        cargo: 'UI Designer',
        empresaActual: 'Cloudly',
        ubicacion: 'Santa Tecla, El Salvador',
        correo: 'karla.rivas@correo.com',
        telefono: '+503 7123 4567',
        aniosExperiencia: 4,
        habilidades: ['Figma', 'Design Systems', 'Prototipado', 'Illustrator'],
        experiencia: [
            { puesto: 'UI Designer', empresa: 'Cloudly', periodo: '2022 - Actualidad', descripcion: 'Diseño de componentes para la plataforma SaaS.' }
        ],
        formacion: [
            { titulo: 'Técnico en Diseño Digital', institucion: 'Instituto Técnico', periodo: '2018 - 2020' }
        ],
        cv: 'CV_KarlaRivas.pdf'
    },
    {
        id: 3,
        nombre: 'José Martínez',
        cargo: 'Diseñador Web',
        empresaActual: 'Freelance',
        ubicacion: 'San Miguel, El Salvador',
        correo: 'jose.martinez@correo.com',
        telefono: '+503 7234 5678',
        aniosExperiencia: 3,
        habilidades: ['Figma', 'HTML/CSS', 'JavaScript', 'UX Research'],
        experiencia: [
            { puesto: 'Diseñador Web', empresa: 'Freelance', periodo: '2023 - Actualidad', descripcion: 'Sitios web para pequeñas empresas.' }
        ],
        formacion: [
            { titulo: 'Ing. en Sistemas (en curso)', institucion: 'Universidad', periodo: '2020 - Actualidad' }
        ],
        cv: 'CV_JoseMartinez.pdf'
    },
    {
        id: 4,
        nombre: 'Sofía López',
        cargo: 'Diseñadora gráfica',
        empresaActual: 'Lumen',
        ubicacion: 'San Salvador, El Salvador',
        correo: 'sofia.lopez@correo.com',
        telefono: '+503 7345 6789',
        aniosExperiencia: 1,
        habilidades: ['Illustrator', 'Photoshop', 'Figma'],
        experiencia: [
            { puesto: 'Diseñadora gráfica', empresa: 'Lumen', periodo: '2025 - Actualidad', descripcion: 'Piezas gráficas para redes sociales.' }
        ],
        formacion: [
            { titulo: 'Lic. en Comunicaciones', institucion: 'Universidad', periodo: '2020 - 2024' }
        ],
        cv: 'CV_SofiaLopez.pdf'
    },
    {
        id: 5,
        nombre: 'Daniel Flores',
        cargo: 'Desarrollador Web',
        empresaActual: 'Innovatech',
        ubicacion: 'San Salvador, El Salvador',
        correo: 'daniel.flores@correo.com',
        telefono: '+503 7456 7890',
        aniosExperiencia: 2,
        habilidades: ['JavaScript', 'HTML/CSS', 'Git', 'Node.js'],
        experiencia: [
            { puesto: 'Desarrollador Web', empresa: 'Innovatech', periodo: '2024 - Actualidad', descripcion: 'Mantenimiento de sitios corporativos.' }
        ],
        formacion: [
            { titulo: 'Ing. en Desarrollo de Software', institucion: 'Universidad', periodo: '2019 - 2023' }
        ],
        cv: 'CV_DanielFlores.pdf'
    }
];

const postulaciones = [
    { id: 1, vacanteId: 101, candidatoId: 1, fecha: '2026-11-14T08:00:00', estado: 'Preseleccionado', notas: [{ autor: 'María R.', texto: 'Portafolio sólido. Agendar entrevista técnica esta semana.', fecha: '2026-11-14T09:00:00' }] },
    { id: 2, vacanteId: 101, candidatoId: 2, fecha: '2026-11-13T10:00:00', estado: 'Entrevista', notas: [] },
    { id: 3, vacanteId: 101, candidatoId: 3, fecha: '2026-11-12T15:00:00', estado: 'Nuevo', notas: [] },
    { id: 4, vacanteId: 101, candidatoId: 4, fecha: '2026-11-11T11:00:00', estado: 'Rechazado', notas: [] },
    { id: 5, vacanteId: 102, candidatoId: 5, fecha: '2026-11-13T09:30:00', estado: 'Nuevo', notas: [] },
    { id: 6, vacanteId: 102, candidatoId: 3, fecha: '2026-11-10T14:00:00', estado: 'Nuevo', notas: [] },
    { id: 7, vacanteId: 103, candidatoId: 5, fecha: '2026-11-09T16:00:00', estado: 'Preseleccionado', notas: [] }
];

let siguienteIdEmpresa = 5;
let siguienteIdVacante = 104;

// utilidades

function texto(valor) {
    return (valor || '').toString().trim();
}

function convertirLista(valor) {
    if (Array.isArray(valor)) {
        return valor.map(texto).filter(Boolean);
    }
    return texto(valor).split(/\r?\n/).map(texto).filter(Boolean);
}

function fechaHoy() {
    return new Date().toISOString().slice(0, 10);
}

// empresas

function listarEmpresas(filtros = {}) {
    const busqueda = texto(filtros.q).toLowerCase();

    return empresas.filter(empresa =>
        (!busqueda || empresa.nombre.toLowerCase().includes(busqueda)) &&
        (!filtros.sector || empresa.sector === filtros.sector) &&
        (!filtros.estado || empresa.estado === filtros.estado)
    );
}

function obtenerEmpresa(id) {
    return empresas.find(empresa => empresa.id === Number(id));
}

function validarEmpresa(datos) {
    const errores = [];
    if (!texto(datos.nombre)) errores.push('El nombre es obligatorio.');
    if (!SECTORES.includes(datos.sector)) errores.push('Selecciona un sector válido.');
    if (!texto(datos.ubicacion)) errores.push('La ubicación es obligatoria.');
    return errores;
}

function crearEmpresa(datos) {
    const empresa = {
        id: siguienteIdEmpresa++,
        nombre: texto(datos.nombre),
        sector: datos.sector,
        ubicacion: texto(datos.ubicacion),
        descripcion: texto(datos.descripcion),
        estado: datos.activa ? 'Activa' : 'Inactiva'
    };
    empresas.push(empresa);
    return empresa;
}

function actualizarEmpresa(id, datos) {
    const empresa = obtenerEmpresa(id);
    if (!empresa) return null;

    empresa.nombre = texto(datos.nombre);
    empresa.sector = datos.sector;
    empresa.ubicacion = texto(datos.ubicacion);
    empresa.descripcion = texto(datos.descripcion);
    empresa.estado = datos.activa ? 'Activa' : 'Inactiva';
    return empresa;
}

function cambiarEstadoEmpresa(id, estado) {
    const empresa = obtenerEmpresa(id);
    if (!empresa || !ESTADOS_EMPRESA.includes(estado)) return null;
    empresa.estado = estado;
    return empresa;
}

// vacantes

function listarVacantes(filtros = {}) {
    return vacantes
        .filter(vacante =>
            (!filtros.empresaId || vacante.empresaId === Number(filtros.empresaId)) &&
            (!filtros.estado || vacante.estado === filtros.estado)
        )
        .map(vacante => ({
            ...vacante,
            empresa: obtenerEmpresa(vacante.empresaId),
            totalPostulantes: postulaciones.filter(p => p.vacanteId === vacante.id).length
        }))
        .sort((a, b) => b.fechaPublicacion.localeCompare(a.fechaPublicacion));
}

function obtenerVacante(id) {
    return vacantes.find(vacante => vacante.id === Number(id));
}

function contarVacantesPorEstado() {
    const conteo = { Todas: vacantes.length };
    ESTADOS_VACANTE.forEach(estado => {
        conteo[estado] = vacantes.filter(v => v.estado === estado).length;
    });
    return conteo;
}

function validarBorrador(datos) {
    const errores = [];
    if (!texto(datos.titulo)) errores.push('Para guardar el borrador escribe al menos el título.');
    if (!obtenerEmpresa(datos.empresaId)) errores.push('Selecciona una empresa.');
    return errores;
}

function validarVacante(datos) {
    const errores = [];
    const empresa = obtenerEmpresa(datos.empresaId);
    if (!texto(datos.titulo)) errores.push('El título del puesto es obligatorio.');
    if (!empresa) errores.push('Selecciona una empresa.');
    if (empresa && empresa.estado !== 'Activa') errores.push('La empresa seleccionada no está activa.');
    if (!texto(datos.ubicacion)) errores.push('La ubicación es obligatoria.');
    if (!texto(datos.descripcion)) errores.push('La descripción del puesto es obligatoria.');
    if (texto(datos.descripcion).length > 3000) errores.push('La descripción no puede superar 3000 caracteres.');
    if (convertirLista(datos.habilidades).length === 0) errores.push('Agrega al menos una habilidad.');
    if (!texto(datos.experiencia)) errores.push('El nivel de experiencia es obligatorio.');
    if (!/^\S+@\S+\.\S+$/.test(texto(datos.contacto))) errores.push('Escribe un correo de contacto válido.');

    const minimo = Number(datos.salarioMinimo);
    const maximo = Number(datos.salarioMaximo);
    if (datos.salarioMinimo && datos.salarioMaximo && minimo > maximo) {
        errores.push('El salario mínimo no puede ser mayor que el máximo.');
    }
    return errores;
}

function datosVacante(datos) {
    return {
        empresaId: Number(datos.empresaId),
        titulo: texto(datos.titulo),
        ubicacion: texto(datos.ubicacion),
        modalidad: texto(datos.modalidad),
        tipoContrato: texto(datos.tipoContrato),
        experiencia: texto(datos.experiencia),
        formacion: texto(datos.formacion),
        salarioMinimo: Number(datos.salarioMinimo) || 0,
        salarioMaximo: Number(datos.salarioMaximo) || 0,
        descripcion: texto(datos.descripcion),
        responsabilidades: convertirLista(datos.responsabilidades),
        habilidades: convertirLista(datos.habilidades),
        beneficios: convertirLista(datos.beneficios),
        contacto: texto(datos.contacto),
        fechaCierre: texto(datos.fechaCierre)
    };
}

function crearVacante(datos, estado = 'Activa') {
    const vacante = {
        id: siguienteIdVacante++,
        ...datosVacante(datos),
        reclutador: empleadorActual.nombre,
        fechaPublicacion: fechaHoy(),
        estado,
        vistas: 0
    };
    vacantes.push(vacante);
    return vacante;
}

function actualizarVacante(id, datos, estado) {
    const vacante = obtenerVacante(id);
    if (!vacante) return null;

    Object.assign(vacante, datosVacante(datos));

    // al publicar un borrador cambia la fecha
    if (vacante.estado === 'Borrador' && estado === 'Activa') vacante.fechaPublicacion = fechaHoy();
    if (estado) vacante.estado = estado;
    return vacante;
}

function cambiarEstadoVacante(id, estado) {
    const vacante = obtenerVacante(id);
    if (!vacante || !ESTADOS_VACANTE.includes(estado)) return null;
    vacante.estado = estado;
    return vacante;
}

function eliminarVacante(id) {
    const indice = vacantes.findIndex(vacante => vacante.id === Number(id));
    if (indice === -1) return false;

    vacantes.splice(indice, 1);

    // borra sus postulasiones
    for (let i = postulaciones.length - 1; i >= 0; i--) {
        if (postulaciones[i].vacanteId === Number(id)) postulaciones.splice(i, 1);
    }
    return true;
}

// postulasiones

function obtenerCandidato(id) {
    return candidatos.find(candidato => candidato.id === Number(id));
}

// % compatibilidad
function calcularCompatibilidad(candidato, vacante) {
    if (!candidato || !vacante || vacante.habilidades.length === 0) return 0;

    const delCandidato = candidato.habilidades.map(h => h.toLowerCase());
    const coincidencias = vacante.habilidades.filter(h => delCandidato.includes(h.toLowerCase()));
    return Math.round((coincidencias.length / vacante.habilidades.length) * 100);
}

function completarPostulacion(postulacion) {
    const candidato = obtenerCandidato(postulacion.candidatoId);
    const vacante = obtenerVacante(postulacion.vacanteId);
    return {
        ...postulacion,
        candidato,
        vacante,
        compatibilidad: calcularCompatibilidad(candidato, vacante)
    };
}

function listarPostulaciones(vacanteId, filtros = {}) {
    const busqueda = texto(filtros.q).toLowerCase();
    const experienciaMinima = Number(filtros.experienciaMin) || 0;
    const compatibilidadMinima = Number(filtros.compatibilidadMin) || 0;

    const resultado = postulaciones
        .filter(p => p.vacanteId === Number(vacanteId))
        .map(completarPostulacion)
        .filter(p =>
            (!filtros.estado || p.estado === filtros.estado) &&
            (!busqueda || p.candidato.nombre.toLowerCase().includes(busqueda)) &&
            p.candidato.aniosExperiencia >= experienciaMinima &&
            p.compatibilidad >= compatibilidadMinima
        );

    if (filtros.orden === 'compatibilidad') {
        resultado.sort((a, b) => b.compatibilidad - a.compatibilidad);
    } else {
        resultado.sort((a, b) => b.fecha.localeCompare(a.fecha));
    }
    return resultado;
}

function contarPostulacionesPorEstado(vacanteId) {
    const conteo = { Todos: 0 };
    ESTADOS_POSTULACION.forEach(estado => { conteo[estado] = 0; });

    postulaciones
        .filter(p => p.vacanteId === Number(vacanteId))
        .forEach(p => {
            conteo.Todos++;
            conteo[p.estado]++;
        });
    return conteo;
}

function obtenerPostulacion(id) {
    const postulacion = postulaciones.find(p => p.id === Number(id));
    return postulacion ? completarPostulacion(postulacion) : null;
}

function cambiarEstadoPostulacion(id, estado) {
    const postulacion = postulaciones.find(p => p.id === Number(id));
    if (!postulacion || !ESTADOS_POSTULACION.includes(estado)) return null;
    postulacion.estado = estado;
    return postulacion;
}

function cambiarEstadoVariasPostulaciones(ids, estado) {
    const lista = Array.isArray(ids) ? ids : [ids];
    return lista.map(id => cambiarEstadoPostulacion(id, estado)).filter(Boolean).length;
}

function agregarNota(postulacionId, textoNota) {
    const postulacion = postulaciones.find(p => p.id === Number(postulacionId));
    if (!postulacion || !texto(textoNota)) return null;

    const nota = {
        autor: empleadorActual.nombre,
        texto: texto(textoNota),
        fecha: new Date().toISOString()
    };
    postulacion.notas.push(nota);
    return nota;
}

module.exports = {
    empleadorActual,
    ESTADOS_EMPRESA,
    ESTADOS_VACANTE,
    ESTADOS_POSTULACION,
    SECTORES,
    listarEmpresas,
    obtenerEmpresa,
    validarEmpresa,
    crearEmpresa,
    actualizarEmpresa,
    cambiarEstadoEmpresa,
    listarVacantes,
    obtenerVacante,
    contarVacantesPorEstado,
    validarBorrador,
    validarVacante,
    crearVacante,
    actualizarVacante,
    cambiarEstadoVacante,
    eliminarVacante,
    obtenerCandidato,
    calcularCompatibilidad,
    listarPostulaciones,
    contarPostulacionesPorEstado,
    obtenerPostulacion,
    cambiarEstadoPostulacion,
    cambiarEstadoVariasPostulaciones,
    agregarNota
};
