// node pruebas/empresarial.prueba.js
// todo se deshace al final (rollback)

require('dotenv').config();
const { pool } = require('../src/config/database');
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

async function crearCandidato(conexion, nombre, correo, anios, habilidades) {
    const { rows } = await conexion.query(
        `INSERT INTO candidatos (nombre, cargo, empresa_actual, correo, anios_experiencia, habilidades)
         VALUES ($1, 'Tester', 'Prueba', $2, $3, $4) RETURNING id_candidato::int AS id`,
        [nombre, correo, anios, habilidades]
    );
    return rows[0].id;
}

async function postular(conexion, vacanteId, candidatoId, fecha) {
    const { rows } = await conexion.query(
        `INSERT INTO postulaciones (vacante_id, candidato_id, fecha_postulacion)
         VALUES ($1, $2, $3) RETURNING id_postulacion::int AS id`,
        [vacanteId, candidatoId, fecha]
    );
    return rows[0].id;
}

async function ejecutar(conexion) {
    console.log('\nEmpresas');
    const totalEmpresas = (await servicio.listarEmpresas()).length;
    prueba('Lista las empresas de Supabase', totalEmpresas > 0);
    prueba('Valida campos obligatorios', servicio.validarEmpresa({}).length === 3);
    const empresa = await servicio.crearEmpresa({ nombre: 'Empresa Prueba', sector: 'Finanzas', ubicacion: 'Santa Ana', activa: true });
    prueba('Crea una empresa nueva', (await servicio.obtenerEmpresa(empresa.id)).nombre === 'Empresa Prueba');
    prueba('Filtra por sector "Finanzas"', (await servicio.listarEmpresas({ sector: 'Finanzas', q: 'Empresa Prueba' })).length === 1);
    await servicio.actualizarEmpresa(empresa.id, { nombre: 'Empresa Editada', sector: 'Finanzas', ubicacion: 'Santa Ana', activa: true });
    prueba('Edita la empresa', (await servicio.obtenerEmpresa(empresa.id)).nombre === 'Empresa Editada');
    const inactiva = await servicio.crearEmpresa({ nombre: 'Empresa Inactiva', sector: 'ONG', ubicacion: 'San Miguel' });
    prueba('Crea empresa inactiva', inactiva.estado === 'Inactiva');

    console.log('\nVacantes');
    prueba('Rechaza salario mínimo mayor al máximo',
        (await servicio.validarVacante({ salarioMinimo: 2000, salarioMaximo: 1000 })).includes('El salario mínimo no puede ser mayor que el máximo.'));
    prueba('Valida vacante vacía', (await servicio.validarVacante({})).length >= 6);
    prueba('No publica con empresa inactiva',
        (await servicio.validarVacante({ empresaId: inactiva.id })).includes('La empresa seleccionada no está activa.'));
    prueba('Valida borrador sin titulo', (await servicio.validarBorrador({ empresaId: empresa.id })).length === 1);

    const vacante = await servicio.crearVacante({
        empresaId: empresa.id, titulo: 'QA Tester', ubicacion: 'Santa Ana', modalidad: 'Remoto',
        descripcion: 'Pruebas de software.', habilidades: ['Testing', 'Selenium', 'SQL'],
        responsabilidades: ['Probar, documentar y reportar'], experiencia: '1-3 años', contacto: 'qa@prueba.com'
    });
    prueba('Publica una vacante', vacante.estado === 'Activa' && vacante.empresa.nombre === 'Empresa Editada');
    prueba('Guarda habilidades como lista', vacante.habilidades.length === 3);
    prueba('Respeta comas dentro de un item', vacante.responsabilidades[0] === 'Probar, documentar y reportar');

    const { rows } = await conexion.query('SELECT estado, sector FROM vacantes WHERE id_vacante = $1', [vacante.id]);
    prueba('En la bd queda como "publicada" (la ve búsqueda)', rows[0].estado === 'publicada');
    prueba('Toma el sector de la empresa', rows[0].sector === 'Finanzas');

    const borrador = await servicio.crearVacante({ empresaId: empresa.id, titulo: 'Borrador QA' }, 'Borrador');
    prueba('Guarda un borrador', (await servicio.obtenerVacante(borrador.id)).estado === 'Borrador');
    await servicio.actualizarVacante(borrador.id, { empresaId: empresa.id, titulo: 'QA Senior', habilidades: ['Testing'] }, 'Activa');
    const publicado = await servicio.obtenerVacante(borrador.id);
    prueba('Publica el borrador', publicado.estado === 'Activa' && publicado.titulo === 'QA Senior');
    await servicio.cambiarEstadoVacante(borrador.id, 'Inactiva');
    prueba('Inactiva una vacante', (await servicio.obtenerVacante(borrador.id)).estado === 'Inactiva');
    await servicio.cambiarEstadoVacante(borrador.id, 'Cancelada');
    prueba('Cancela una vacante', (await servicio.obtenerVacante(borrador.id)).estado === 'Cancelada');
    const conteo = await servicio.contarVacantesPorEstado();
    prueba('Cuenta vacantes por estado', conteo.Cancelada >= 1 && conteo.Todas >= 2);

    console.log('\nPostulaciones');
    const ana = await crearCandidato(conexion, 'Ana Prueba', 'ana@prueba.com', 5, ['Testing', 'Selenium', 'SQL']);
    const beto = await crearCandidato(conexion, 'Beto Prueba', 'beto@prueba.com', 2, ['Testing']);
    const caro = await crearCandidato(conexion, 'Caro Prueba', 'caro@prueba.com', 1, ['Excel']);
    const pAna = await postular(conexion, vacante.id, ana, '2026-11-10 08:00');
    const pBeto = await postular(conexion, vacante.id, beto, '2026-11-12 08:00');
    const pCaro = await postular(conexion, vacante.id, caro, '2026-11-11 08:00');

    prueba('Lista 3 postulaciones de la vacante', (await servicio.listarPostulaciones(vacante.id)).length === 3);
    prueba('Ordena por más recientes', (await servicio.listarPostulaciones(vacante.id))[0].candidato.nombre === 'Beto Prueba');
    prueba('Calcula compatibilidad (100%)', (await servicio.obtenerPostulacion(pAna)).compatibilidad === 100);
    prueba('Calcula compatibilidad (33%)', (await servicio.obtenerPostulacion(pBeto)).compatibilidad === 33);
    prueba('Compatibilidad con requisitos en frase',
        servicio.calcularCompatibilidad({ habilidades: ['Figma'] }, { habilidades: ['Dominio de Figma o Adobe XD'] }) === 100);
    prueba('Ordena por compatibilidad',
        (await servicio.listarPostulaciones(vacante.id, { orden: 'compatibilidad' }))[0].candidato.nombre === 'Ana Prueba');
    prueba('Busca candidato por nombre', (await servicio.listarPostulaciones(vacante.id, { q: 'beto' })).length === 1);
    prueba('Filtra por experiencia minima', (await servicio.listarPostulaciones(vacante.id, { experienciaMin: 2 })).length === 2);
    prueba('Filtra por compatibilidad minima', (await servicio.listarPostulaciones(vacante.id, { compatibilidadMin: 50 })).length === 1);

    await servicio.cambiarEstadoPostulacion(pAna, 'Contratado');
    prueba('Acepta (contrata) a un candidato', (await servicio.obtenerPostulacion(pAna)).estado === 'Contratado');
    await servicio.cambiarEstadoPostulacion(pCaro, 'Rechazado');
    prueba('Rechaza a un candidato', (await servicio.obtenerPostulacion(pCaro)).estado === 'Rechazado');
    prueba('No acepta estados inválidos', (await servicio.cambiarEstadoPostulacion(pAna, 'Inventado')) === null);
    prueba('Cambia estado a varios a la vez',
        (await servicio.cambiarEstadoVariasPostulaciones([String(pBeto), String(pCaro)], 'Preseleccionado')) === 2);
    const porEstado = await servicio.contarPostulacionesPorEstado(vacante.id);
    prueba('Cuenta postulaciones por estado', porEstado.Preseleccionado === 2 && porEstado.Contratado === 1 && porEstado.Todos === 3);
    prueba('Filtra por estado', (await servicio.listarPostulaciones(vacante.id, { estado: 'Preseleccionado' })).length === 2);

    await servicio.agregarNota(pAna, 'Nota de prueba');
    prueba('Agrega una nota interna', (await servicio.obtenerPostulacion(pAna)).notas.length === 1);

    let duplicada = false;
    try {
        await conexion.query('SAVEPOINT dup');
        await postular(conexion, vacante.id, ana, '2026-11-13 08:00');
    } catch {
        duplicada = true;
        await conexion.query('ROLLBACK TO SAVEPOINT dup');
    }
    prueba('No deja postular dos veces a la misma vacante', duplicada);

    await servicio.eliminarVacante(vacante.id);
    prueba('Elimina la vacante', (await servicio.obtenerVacante(vacante.id)) === null);
    prueba('Al eliminar vacante borra sus postulaciones', (await servicio.obtenerPostulacion(pBeto)) === null);
}

async function main() {
    const conexion = await pool.connect();
    try {
        await conexion.query('BEGIN');
        servicio.usarConexion(conexion);
        await ejecutar(conexion);
    } catch (error) {
        fallidas++;
        console.error('\nError:', error.message);
    } finally {
        await conexion.query('ROLLBACK');
        conexion.release();
        await pool.end();
    }

    console.log(`\nResultado: ${aprobadas} aprobadas, ${fallidas} fallidas`);
    console.log('(los datos de prueba se deshicieron, la bd queda igual)\n');
    process.exitCode = fallidas > 0 ? 1 : 0;
}

main();
