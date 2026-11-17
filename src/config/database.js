const { registrarError } = require('../utils/logger');

require('dotenv').config();

const { Pool } = require('pg');

const variablesRequeridas = [
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
];

const variablesFaltantes = variablesRequeridas.filter(
    (variable) => !process.env[variable]
);

if (variablesFaltantes.length > 0) {
    throw new Error(
        `Faltan variables de conexión a la base de datos: ${variablesFaltantes.join(', ')}. ` +
        'Copia .env.example como .env y completa sus valores.'
    );
}

const hostLocal = ['localhost', '127.0.0.1', '::1'].includes(
    process.env.DB_HOST.toLowerCase()
);
const usarSsl = process.env.DB_SSL === undefined
    ? !hostLocal
    : process.env.DB_SSL.toLowerCase() === 'true';

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,

    ssl: usarSsl ? {
        rejectUnauthorized: false
    } : false
});

// Read-only connection check. The bootstrap decides whether to start listening.
async function probarConexion() {
    try {
        await pool.query('SELECT NOW()');
        return true;
    } catch (error) {
        registrarError(error, { scope: 'database:check', status: 503 });
        return false;
    }
}

pool.on('error', error => registrarError(error, { scope: 'database:pool', status: 503 }));

module.exports = {
    pool,
    probarConexion
};
