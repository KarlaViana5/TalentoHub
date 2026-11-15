
require('dotenv').config();

const app = require('./app');
const { probarConexion } = require('./config/database');

const PORT = process.env.PORT || 3000;

// Comprobar la conexion con Supabase
probarConexion();

// Iniciar el servidor
app.listen(PORT, () => {
    console.log('================================');
    console.log('       TALENTOHUB');
    console.log('================================');
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
    console.log(`Dirección: http://localhost:${PORT}`);
    console.log('================================');
});
