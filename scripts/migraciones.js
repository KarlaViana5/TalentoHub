// Default and `plan` are offline: no .env, pg or application import.
const fs = require('node:fs');
const path = require('node:path');
const { registrarError } = require('../src/utils/logger');
const ROOT = path.resolve(__dirname, '..');
const CATALOGO = Object.freeze([
    { id: '001', file: 'database/001_foros_administracion.sql', tipo: 'legado', requisito: 'Tablas publicas originales; crea esquema modulo4, NO autenticacion actual.' },
    { id: 'modulo4-js', file: 'src/config/migracion-modulo4.js', tipo: 'legado-con-semillas', requisito: 'Tablas base publicas. Contiene ALTER/CREATE/UPDATE/INSERT y datos demo.' },
    { id: '002', file: 'database/002_propiedad_empresarial.sql', tipo: 'aditiva', requisito: 'public.usuarios_cuenta y public.empresas; revisar permisos del rol backend.' }
]);
function plan() { return CATALOGO.map(entry => ({ ...entry, existe: fs.existsSync(path.join(ROOT, entry.file)) })); }
function validarAplicacion(args, env = process.env) {
    if (args.length !== 3 || args[0] !== 'aplicar' || args[1] !== '--id=002' || args[2] !== '--confirmar=002') {
        throw new Error('Uso explicito: aplicar --id=002 --confirmar=002. plan nunca se conecta a PostgreSQL.');
    }
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
        throw new Error('Solo se permite este comando con NODE_ENV=development o test. No usar una base real/produccion.');
    }
}
async function aplicar002(pool) {
    const cliente = await pool.connect();
    try {
        const { rows } = await cliente.query("SELECT to_regclass('public.usuarios_cuenta') AS cuentas, to_regclass('public.empresas') AS empresas");
        if (!rows[0]?.cuentas || !rows[0]?.empresas) throw new Error('Faltan tablas prerrequisito para 002.');
        // The SQL file owns BEGIN/COMMIT. Never combine it with demo seeds.
        await cliente.query(fs.readFileSync(path.join(ROOT, 'database/002_propiedad_empresarial.sql'), 'utf8'));
    } catch (error) {
        try { await cliente.query('ROLLBACK'); } catch { /* Keep original failure. */ }
        throw error;
    } finally { cliente.release(); }
}
async function main(args = process.argv.slice(2)) {
    if (!args.length || (args.length === 1 && args[0] === 'plan')) {
        for (const entry of plan()) console.log(entry.id + ' | ' + entry.tipo + ' | ' + entry.file + ' | ' + entry.requisito);
        console.log('Inventario offline: no verifica estado aplicado ni ejecuta migraciones.');
        return;
    }
    validarAplicacion(args);
    // Loaded only after explicit command/environment confirmation. Never log configuration.
    const { pool } = require('../src/config/database');
    try { await aplicar002(pool); console.log('002 completada en la base configurada.'); }
    finally { await pool.end(); }
}
if (require.main === module) main().catch(error => {
    registrarError(error, { scope: 'migration-command' });
    console.error('No se ejecuto o no se completo el comando. Revisa argumentos, entorno, permisos y prerrequisitos segun README.');
    process.exitCode = 1;
});
module.exports = { plan, validarAplicacion, aplicar002, main };
