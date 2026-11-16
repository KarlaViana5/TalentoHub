const { guardarClave } = require('../src/middleware/modulo4-auth');
const { pool } = require('../src/config/database');

async function ejecutar() {
    const [, , rol, correoIngresado, nombre, vinculo] = process.argv;
    const correo = correoIngresado?.trim().toLowerCase();
    const clave = process.env.MODULO4_CLAVE;
    const administrador = rol === 'admin';

    if (!['admin', 'candidato', 'empresa'].includes(rol) ||
        !correo || correo.length > 254 || !/^\S+@\S+\.\S+$/.test(correo) ||
        !nombre?.trim() || nombre.trim().length > 150 ||
        (administrador ? vinculo !== undefined : !/^[1-9][0-9]{0,18}$/.test(vinculo || '')) ||
        !clave || clave.length < 12 || clave.length > 256) {
        throw new Error('Uso: define MODULO4_CLAVE (12–256 caracteres) y ejecuta node scripts/modulo4-usuario.js <admin|candidato|empresa> <correo> "<nombre>" [ID vinculado]');
    }
    const resultado = await pool.query(`INSERT INTO modulo4.usuarios (nombre, correo, clave_hash, rol, candidato_id, empresa_id)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [nombre.trim(), correo, await guardarClave(clave), rol, rol === 'candidato' ? vinculo : null, rol === 'empresa' ? vinculo : null]);
    console.log(`Cuenta creada con ID ${resultado.rows[0].id}.`);
}

ejecutar().catch(error => {
    const mensajes = { '23503': 'El candidato o empresa con ese ID no existe.', '23505': 'El correo o candidato ya tiene una cuenta.' };
    console.error(mensajes[error.code] || (error.code ? 'No se pudo crear la cuenta. Revisa la conexión, migración e identificador.' : error.message));
    process.exitCode = 1;
}).finally(() => pool.end());
