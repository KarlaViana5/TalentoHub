require('dotenv').config();
const app = require('./app');
const { probarConexion, pool } = require('./config/database');
const { asegurarEsquemaAuth } = require('./services/auth.service');
const { arrancar } = require('./services/arranque.service');
const { registrarError } = require('./utils/logger');

async function iniciarServidor() {
    const puerto = process.env.PORT || 3000;
    const server = await arrancar({ app, pool, probarConexion, asegurarEsquemaAuth, puerto });
    console.log('TalentoHub iniciado en el puerto ' + puerto);
    return server;
}

if (require.main === module) {
    iniciarServidor().catch(error => {
        registrarError(error, { scope: 'startup', status: 503 });
        process.exitCode = 1;
    });
}
module.exports = { iniciarServidor };
