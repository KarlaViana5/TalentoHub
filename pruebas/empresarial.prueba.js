// node pruebas/empresarial.prueba.js

const servicio = require('../src/services/empresarial.service');

let aprobadas = 0;
let fallidas = 0;

function prueba(nombre, condicion) {
    if (condicion) {
        aprobadas++;
        console.log(`  ✔ ${nombre}`);
    } else {
        fallidas++;
        console.log(`  ✘ ${nombre}`);
    }
}

console.log('\nEmpresas');
prueba('Lista las 4 empresas iniciales', servicio.listarEmpresas().length === 4);
prueba('Filtra por sector "Tecnología"', servicio.listarEmpresas({ sector: 'Tecnología' }).length === 1);
prueba('Valida campos obligatorios', servicio.validarEmpresa({}).length === 3);
const nueva = servicio.crearEmpresa({ nombre: 'Empresa Prueba', sector: 'Finanzas', ubicacion: 'Santa Ana', activa: true });
prueba('Crea una empresa nueva', servicio.obtenerEmpresa(nueva.id).nombre === 'Empresa Prueba');
servicio.cambiarEstadoEmpresa(nueva.id, 'Inactiva');
prueba('Desactiva la empresa', servicio.obtenerEmpresa(nueva.id).estado === 'Inactiva');

console.log('\nVacantes');
prueba('Lista las vacantes de Nexo Digital', servicio.listarVacantes({ empresaId: 1 }).length === 3);
prueba('Rechaza salario mínimo mayor al máximo',
    servicio.validarVacante({ salarioMinimo: 2000, salarioMaximo: 1000 }).includes('El salario mínimo no puede ser mayor que el máximo.'));
const vacante = servicio.crearVacante({
    empresaId: 1, titulo: 'QA Tester', ubicacion: 'San Salvador', descripcion: 'Pruebas de software.',
    habilidades: ['Testing', 'Selenium'], experiencia: '1-3 años'
});
prueba('Publica una vacante nueva', servicio.obtenerVacante(vacante.id).estado === 'Activa');
prueba('Convierte las habilidades en lista', vacante.habilidades.length === 2);
prueba('Valida borrador sin titulo', servicio.validarBorrador({ empresaId: 1 }).length === 1);
prueba('No publica con empresa inactiva',
    servicio.validarVacante({ empresaId: 4 }).includes('La empresa seleccionada no está activa.'));
const borrador = servicio.crearVacante({ empresaId: 1, titulo: 'Borrador QA' }, 'Borrador');
prueba('Guarda un borrador', servicio.obtenerVacante(borrador.id).estado === 'Borrador');
servicio.actualizarVacante(borrador.id, { empresaId: 1, titulo: 'QA Senior', habilidades: ['Testing'] }, 'Activa');
prueba('Publica el borrador', servicio.obtenerVacante(borrador.id).estado === 'Activa' &&
    servicio.obtenerVacante(borrador.id).titulo === 'QA Senior');
servicio.cambiarEstadoVacante(borrador.id, 'Cancelada');
prueba('Cancela una vacante', servicio.obtenerVacante(borrador.id).estado === 'Cancelada');
servicio.cambiarEstadoVacante(vacante.id, 'Inactiva');
prueba('Inactiva la vacante', servicio.obtenerVacante(vacante.id).estado === 'Inactiva');
servicio.eliminarVacante(vacante.id);
prueba('Elimina la vacante', servicio.obtenerVacante(vacante.id) === undefined);

console.log('\nPostulaciones');
prueba('Lista 4 postulaciones de "Diseñador UX/UI Senior"', servicio.listarPostulaciones(101).length === 4);
prueba('Cuenta postulaciones por estado', servicio.contarPostulacionesPorEstado(101).Nuevo === 1);
prueba('Calcula compatibilidad de Alex Moreno (100%)', servicio.obtenerPostulacion(1).compatibilidad === 100);
servicio.cambiarEstadoPostulacion(3, 'Contratado');
prueba('Acepta (contrata) a un candidato', servicio.obtenerPostulacion(3).estado === 'Contratado');
servicio.cambiarEstadoPostulacion(2, 'Rechazado');
prueba('Rechaza a un candidato', servicio.obtenerPostulacion(2).estado === 'Rechazado');
prueba('No acepta estados inválidos', servicio.cambiarEstadoPostulacion(1, 'Inventado') === null);
servicio.agregarNota(1, 'Nota de prueba');
prueba('Agrega una nota interna', servicio.obtenerPostulacion(1).notas.length === 2);

console.log(`\nResultado: ${aprobadas} aprobadas, ${fallidas} fallidas\n`);
process.exitCode = fallidas > 0 ? 1 : 0;
