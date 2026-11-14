

const vacantes = [
    {
        id: 1,
        titulo: 'Desarrollador JavaScript',
        empresa: 'Nexo Digital',
        ubicacion: 'San Salvador',
        sector: 'Tecnología',
        modalidad: 'Remoto',
        tipoContrato: 'Tiempo completo',
        experiencia: '1-3 años',
        salarioMinimo: 1200,
        salarioMaximo: 1800,
        fechaPublicacion: '2026-11-10',
        descripcion: 'Buscamos un desarrollador JavaScript para participar en el desarrollo y mantenimiento de aplicaciones web.',
        responsabilidades: [
            'Desarrollar funcionalidades para aplicaciones web.',
            'Corregir errores y mejorar el rendimiento.',
            'Trabajar junto al equipo de desarrollo.'
        ],
        requisitos: [
            'Conocimientos de JavaScript.',
            'Conocimientos básicos de Node.js.',
            'Manejo de HTML y CSS.',
            'Capacidad para trabajar en equipo.'
        ],
        beneficios: [
            'Capacitación continua.',
            'Horario flexible.',
            'Oportunidad de crecimiento profesional.'
        ],
        contacto: 'talento@nexodigital.com',
        reclutador: 'María Rodríguez',
        postulaciones: 12
    },
    {
        id: 2,
        titulo: 'Diseñador UX/UI',
        empresa: 'Cloudly',
        ubicacion: 'Santa Tecla',
        sector: 'Diseño',
        modalidad: 'Híbrido',
        tipoContrato: 'Tiempo completo',
        experiencia: '1-3 años',
        salarioMinimo: 900,
        salarioMaximo: 1400,
        fechaPublicacion: '2026-11-09',
        descripcion: 'Se busca una persona creativa para diseñar experiencias digitales fáciles de utilizar.',
        responsabilidades: [
            'Diseñar interfaces de usuario.',
            'Crear prototipos y diagramas de navegación.',
            'Colaborar con desarrolladores.'
        ],
        requisitos: [
            'Conocimientos de diseño UX/UI.',
            'Manejo de Figma.',
            'Conocimientos de diseño responsivo.'
        ],
        beneficios: [
            'Trabajo híbrido.',
            'Equipo de trabajo colaborativo.',
            'Desarrollo profesional.'
        ],
        contacto: 'empleos@cloudly.com',
        reclutador: 'Carlos Méndez',
        postulaciones: 8
    },
    {
        id: 3,
        titulo: 'Analista de datos',
        empresa: 'Finova',
        ubicacion: 'San Salvador',
        sector: 'Finanzas',
        modalidad: 'Presencial',
        tipoContrato: 'Tiempo completo',
        experiencia: 'Más de 3 años',
        salarioMinimo: 1500,
        salarioMaximo: 2200,
        fechaPublicacion: '2026-11-08',
        descripcion: 'La empresa busca un analista de datos para interpretar información y elaborar reportes.',
        responsabilidades: [
            'Analizar bases de datos.',
            'Preparar informes para la empresa.',
            'Identificar tendencias y oportunidades.'
        ],
        requisitos: [
            'Conocimientos de Excel.',
            'Conocimientos de SQL.',
            'Capacidad analítica.'
        ],
        beneficios: [
            'Seguro médico.',
            'Prestaciones de ley.',
            'Estabilidad laboral.'
        ],
        contacto: 'rrhh@finova.com',
        reclutador: 'Ana López',
        postulaciones: 15
    },
    {
        id: 4,
        titulo: 'Asistente de recursos humanos',
        empresa: 'Grupo Empresarial SV',
        ubicacion: 'Santa Ana',
        sector: 'Recursos humanos',
        modalidad: 'Presencial',
        tipoContrato: 'Tiempo completo',
        experiencia: 'Sin experiencia',
        salarioMinimo: 500,
        salarioMaximo: 700,
        fechaPublicacion: '2026-11-07',
        descripcion: 'Apoyará en los procesos administrativos y de selección de personal.',
        responsabilidades: [
            'Organizar expedientes.',
            'Apoyar en entrevistas.',
            'Actualizar información del personal.'
        ],
        requisitos: [
            'Estudios en administración o recursos humanos.',
            'Manejo básico de herramientas de oficina.',
            'Buena comunicación.'
        ],
        beneficios: [
            'Capacitación.',
            'Prestaciones de ley.'
        ],
        contacto: 'seleccion@grupoempresarial.com',
        reclutador: 'Pedro Ramírez',
        postulaciones: 6
    },
    {
        id: 5,
        titulo: 'Ingeniero de soporte técnico',
        empresa: 'TecnoSoluciones',
        ubicacion: 'San Miguel',
        sector: 'Tecnología',
        modalidad: 'Presencial',
        tipoContrato: 'Tiempo completo',
        experiencia: '1-3 años',
        salarioMinimo: 700,
        salarioMaximo: 1000,
        fechaPublicacion: '2026-11-06',
        descripcion: 'Responsable de brindar soporte técnico y resolver problemas informáticos.',
        responsabilidades: [
            'Atender solicitudes de soporte.',
            'Instalar y configurar equipos.',
            'Documentar problemas técnicos.'
        ],
        requisitos: [
            'Conocimientos de hardware y software.',
            'Conocimientos de redes.',
            'Atención al cliente.'
        ],
        beneficios: [
            'Capacitación técnica.',
            'Prestaciones de ley.'
        ],
        contacto: 'trabajo@tecnosoluciones.com',
        reclutador: 'Luis Hernández',
        postulaciones: 10
    },
    {
        id: 6,
        titulo: 'Asesor de ventas',
        empresa: 'Comercial La Estrella',
        ubicacion: 'Ahuachapán',
        sector: 'Ventas',
        modalidad: 'Presencial',
        tipoContrato: 'Medio tiempo',
        experiencia: 'Sin experiencia',
        salarioMinimo: 400,
        salarioMaximo: 600,
        fechaPublicacion: '2026-11-05',
        descripcion: 'Se necesita personal para atención al cliente y asesoría de productos.',
        responsabilidades: [
            'Atender a los clientes.',
            'Presentar productos y servicios.',
            'Apoyar en el cumplimiento de metas.'
        ],
        requisitos: [
            'Buena comunicación.',
            'Actitud de servicio.',
            'Disponibilidad de horario.'
        ],
        beneficios: [
            'Comisiones por ventas.',
            'Capacitación.'
        ],
        contacto: 'personal@laestrella.com',
        reclutador: 'Sofía Martínez',
        postulaciones: 4
    },
    {
        id: 7,
        titulo: 'Desarrollador Backend',
        empresa: 'Innovatech',
        ubicacion: 'San Salvador',
        sector: 'Tecnología',
        modalidad: 'Remoto',
        tipoContrato: 'Tiempo completo',
        experiencia: 'Más de 3 años',
        salarioMinimo: 1800,
        salarioMaximo: 2500,
        fechaPublicacion: '2026-11-04',
        descripcion: 'Desarrollo de servicios y funcionalidades del lado del servidor.',
        responsabilidades: [
            'Crear y mantener servicios backend.',
            'Diseñar y consumir API.',
            'Optimizar procesos del servidor.'
        ],
        requisitos: [
            'Experiencia con Node.js.',
            'Conocimientos de Express.',
            'Conocimientos de bases de datos.'
        ],
        beneficios: [
            'Trabajo remoto.',
            'Seguro médico.',
            'Capacitación.'
        ],
        contacto: 'jobs@innovatech.com',
        reclutador: 'Daniel Flores',
        postulaciones: 20
    },
    {
        id: 8,
        titulo: 'Contador general',
        empresa: 'Banco Central',
        ubicacion: 'San Salvador',
        sector: 'Finanzas',
        modalidad: 'Presencial',
        tipoContrato: 'Tiempo completo',
        experiencia: 'Más de 3 años',
        salarioMinimo: 1100,
        salarioMaximo: 1600,
        fechaPublicacion: '2026-11-03',
        descripcion: 'Responsable de los registros contables y elaboración de informes financieros.',
        responsabilidades: [
            'Registrar operaciones contables.',
            'Preparar estados financieros.',
            'Apoyar en procesos de auditoría.'
        ],
        requisitos: [
            'Licenciatura en Contaduría Pública.',
            'Experiencia en procesos contables.',
            'Manejo de Excel.'
        ],
        beneficios: [
            'Prestaciones de ley.',
            'Seguro médico.'
        ],
        contacto: 'rrhh@bancocentral.com',
        reclutador: 'Elena García',
        postulaciones: 9
    },
    {
        id: 9,
        titulo: 'Community Manager',
        empresa: 'Creativa Media',
        ubicacion: 'Santa Tecla',
        sector: 'Marketing',
        modalidad: 'Híbrido',
        tipoContrato: 'Medio tiempo',
        experiencia: '1-3 años',
        salarioMinimo: 600,
        salarioMaximo: 900,
        fechaPublicacion: '2026-11-02',
        descripcion: 'Administración de redes sociales y creación de contenido digital.',
        responsabilidades: [
            'Crear publicaciones.',
            'Administrar redes sociales.',
            'Analizar resultados de campañas.'
        ],
        requisitos: [
            'Conocimientos de marketing digital.',
            'Redacción y creatividad.',
            'Manejo de redes sociales.'
        ],
        beneficios: [
            'Horario flexible.',
            'Trabajo híbrido.'
        ],
        contacto: 'talento@creativamedia.com',
        reclutador: 'Laura Pérez',
        postulaciones: 11
    },
    {
        id: 10,
        titulo: 'Técnico en mantenimiento',
        empresa: 'Industria del Pacífico',
        ubicacion: 'Sonsonate',
        sector: 'Industria',
        modalidad: 'Presencial',
        tipoContrato: 'Tiempo completo',
        experiencia: '1-3 años',
        salarioMinimo: 650,
        salarioMaximo: 850,
        fechaPublicacion: '2026-11-01',
        descripcion: 'Realizar mantenimiento preventivo y correctivo de equipos industriales.',
        responsabilidades: [
            'Revisar equipos industriales.',
            'Realizar mantenimiento preventivo.',
            'Reportar fallas.'
        ],
        requisitos: [
            'Conocimientos técnicos.',
            'Experiencia en mantenimiento.',
            'Responsabilidad y puntualidad.'
        ],
        beneficios: [
            'Prestaciones de ley.',
            'Estabilidad laboral.'
        ],
        contacto: 'empleos@industriapacifico.com',
        reclutador: 'Roberto Díaz',
        postulaciones: 5
    },
    {
        id: 11,
        titulo: 'Diseñador gráfico',
        empresa: 'Pixel Studio',
        ubicacion: 'San Salvador',
        sector: 'Diseño',
        modalidad: 'Remoto',
        tipoContrato: 'Por proyecto',
        experiencia: '1-3 años',
        salarioMinimo: 800,
        salarioMaximo: 1200,
        fechaPublicacion: '2026-10-30',
        descripcion: 'Creación de piezas gráficas para campañas y proyectos digitales.',
        responsabilidades: [
            'Diseñar piezas gráficas.',
            'Preparar materiales para redes sociales.',
            'Trabajar con el equipo creativo.'
        ],
        requisitos: [
            'Manejo de herramientas de diseño.',
            'Creatividad.',
            'Portafolio de trabajos.'
        ],
        beneficios: [
            'Trabajo remoto.',
            'Proyectos variados.'
        ],
        contacto: 'hola@pixelstudio.com',
        reclutador: 'Gabriela Cruz',
        postulaciones: 7
    },
    {
        id: 12,
        titulo: 'Auxiliar administrativo',
        empresa: 'Servicios Integrales',
        ubicacion: 'Ahuachapán',
        sector: 'Administración',
        modalidad: 'Presencial',
        tipoContrato: 'Tiempo completo',
        experiencia: 'Sin experiencia',
        salarioMinimo: 450,
        salarioMaximo: 600,
        fechaPublicacion: '2026-10-28',
        descripcion: 'Apoyo en actividades administrativas, archivo y atención de llamadas.',
        responsabilidades: [
            'Organizar documentos.',
            'Atender llamadas.',
            'Apoyar en tareas administrativas.'
        ],
        requisitos: [
            'Conocimientos básicos de oficina.',
            'Organización.',
            'Buena comunicación.'
        ],
        beneficios: [
            'Prestaciones de ley.',
            'Capacitación.'
        ],
        contacto: 'rrhh@serviciosintegrales.com',
        reclutador: 'Mónica Reyes',
        postulaciones: 3
    }
];

// Busca y filtra las vacantes.
function buscarVacantes(filtros = {}) {
    let resultado = [...vacantes];

    const texto = (filtros.q || '').trim().toLowerCase();
    const ubicacion = (filtros.ubicacion || '').trim().toLowerCase();

    if (texto) {
        resultado = resultado.filter(vacante =>
            vacante.titulo.toLowerCase().includes(texto) ||
            vacante.empresa.toLowerCase().includes(texto) ||
            vacante.sector.toLowerCase().includes(texto) ||
            vacante.descripcion.toLowerCase().includes(texto)
        );
    }

    if (ubicacion) {
        resultado = resultado.filter(vacante =>
            vacante.ubicacion.toLowerCase().includes(ubicacion)
        );
    }

    if (filtros.experiencia) {
        resultado = resultado.filter(vacante =>
            vacante.experiencia === filtros.experiencia
        );
    }

    if (filtros.sector) {
        resultado = resultado.filter(vacante =>
            vacante.sector === filtros.sector
        );
    }

    if (filtros.modalidad) {
        resultado = resultado.filter(vacante =>
            vacante.modalidad === filtros.modalidad
        );
    }

    if (filtros.tipoContrato) {
        resultado = resultado.filter(vacante =>
            vacante.tipoContrato === filtros.tipoContrato
        );
    }

    if (filtros.salarioMinimo) {
        resultado = resultado.filter(vacante =>
            vacante.salarioMaximo >= Number(filtros.salarioMinimo)
        );
    }

    if (filtros.salarioMaximo) {
        resultado = resultado.filter(vacante =>
            vacante.salarioMinimo <= Number(filtros.salarioMaximo)
        );
    }

    if (filtros.fechaPublicacion === '7') {
        resultado = resultado.filter(vacante => {
            const fecha = new Date(`${vacante.fechaPublicacion}T00:00:00`);
            const limite = new Date('2026-11-14T00:00:00');
            const diferencia = (limite - fecha) / (1000 * 60 * 60 * 24);
            return diferencia <= 7;
        });
    }

    if (filtros.fechaPublicacion === '30') {
        resultado = resultado.filter(vacante => {
            const fecha = new Date(`${vacante.fechaPublicacion}T00:00:00`);
            const limite = new Date('2026-11-14T00:00:00');
            const diferencia = (limite - fecha) / (1000 * 60 * 60 * 24);
            return diferencia <= 30;
        });
    }

    switch (filtros.orden) {
        case 'antiguas':
            resultado.sort((a, b) =>
                a.fechaPublicacion.localeCompare(b.fechaPublicacion)
            );
            break;

        case 'salarioMayor':
            resultado.sort((a, b) => b.salarioMaximo - a.salarioMaximo);
            break;

        case 'salarioMenor':
            resultado.sort((a, b) => a.salarioMinimo - b.salarioMinimo);
            break;

        default:
            resultado.sort((a, b) =>
                b.fechaPublicacion.localeCompare(a.fechaPublicacion)
            );
    }

    return resultado;
}

function obtenerVacantePorId(id) {
    return vacantes.find(vacante => vacante.id === Number(id));
}

function obtenerVacantesSimilares(vacanteActual) {
    if (!vacanteActual) return [];

    return vacantes
        .filter(vacante =>
            vacante.id !== vacanteActual.id &&
            vacante.sector === vacanteActual.sector
        )
        .slice(0, 3);
}

module.exports = {
    buscarVacantes,
    obtenerVacantePorId,
    obtenerVacantesSimilares
};
