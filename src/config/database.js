
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

// Verificar conexion con Supabase
async function probarConexion() {
    try {
        const resultado = await pool.query('SELECT NOW()');

        console.log('================================');
        console.log('CONEXION A SUPABASE EXITOSA');
        console.log('Fecha del servidor:', resultado.rows[0].now);
        console.log('================================');

    } catch (error) {
        console.error('ERROR AL CONECTAR CON SUPABASE:');
        console.error(error.message);
    }
}

// Manejar errores inesperados del pool
pool.on('error', (error) => {
    console.error('ERROR INESPERADO EN LA CONEXION:');
    console.error(error.message);
});

module.exports = {
    pool,
    probarConexion
};
