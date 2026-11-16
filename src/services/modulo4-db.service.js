const { pool } = require('../config/database');

async function filas(sql, valores = [], conexion = pool) {
    return (await conexion.query(sql, valores)).rows;
}

async function primera(sql, valores = [], conexion = pool) {
    return (await filas(sql, valores, conexion))[0];
}

async function transaccion(operacion) {
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const resultado = await operacion(cliente);
        await cliente.query('COMMIT');
        return resultado;
    } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
    } finally {
        cliente.release();
    }
}

function errorHttp(status, mensaje) {
    return Object.assign(new Error(mensaje), { status });
}

function identificador(valor) {
    if (typeof valor !== 'string' || !/^[1-9][0-9]{0,18}$/.test(valor) ||
        BigInt(valor) > 9223372036854775807n) {
        throw errorHttp(404, 'Registro no encontrado.');
    }
    return valor;
}

function texto(valor, etiqueta, maximo, minimo = 1) {
    const limpio = typeof valor === 'string' ? valor.trim() : '';
    if (limpio.length < minimo || limpio.length > maximo) {
        throw errorHttp(422, `${etiqueta} debe tener entre ${minimo} y ${maximo} caracteres.`);
    }
    return limpio;
}

function opcion(valor, permitidas) {
    if (!permitidas.includes(valor)) throw errorHttp(422, 'Selecciona una opción válida.');
    return valor;
}

async function auditar(conexion, adminId, entidad, id, accion, detalle = null) {
    await filas(`INSERT INTO modulo4.auditoria (admin_id, entidad, objetivo_id, accion, detalle)
        VALUES ($1, $2, $3, $4, $5)`, [adminId, entidad, id, accion, detalle], conexion);
}

module.exports = { filas, primera, transaccion, errorHttp, identificador, texto, opcion, auditar };
