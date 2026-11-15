
require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,

    // Conexion segura con Supabase
    ssl: {
        rejectUnauthorized: false
    }
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
