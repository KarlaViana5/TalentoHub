require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('================================');
    console.log('       TALENTOHUB');
    console.log('================================');
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
    console.log(`Dirección: http://localhost:${PORT}`);
    console.log('================================');
});
