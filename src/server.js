require('dotenv').config();

const app = require('./app');
const { probarConexion } = require('./config/database');
const { ejecutarMigracionModulo4 } = require('./config/migracion-modulo4');
const { asegurarEsquemaAuth } = require('./services/auth.service');

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
    await probarConexion();
    try {
        await ejecutarMigracionModulo4();
        await asegurarEsquemaAuth();
    } catch (error) {
        console.error('Aviso al verificar migración inicial:', error.message);
    }

    app.listen(PORT, () => {
        console.log('================================');
        console.log('       TALENTOHUB');
        console.log('================================');
        console.log(`Servidor ejecutándose en el puerto ${PORT}`);
        console.log(`Dirección: http://localhost:${PORT}`);
        console.log('================================');
    });
}

iniciarServidor();
