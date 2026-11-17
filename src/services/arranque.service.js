const { HttpError } = require('../utils/http-error');
// Inject dependencies so startup sequencing can be checked without loading .env/pg.
async function arrancar({ app, pool, probarConexion, asegurarEsquemaAuth, puerto }) {
    try {
        const disponible = await probarConexion();
        if (disponible === false) throw new HttpError(503);
        await asegurarEsquemaAuth();
        return await new Promise((resolve, reject) => {
            const server = app.listen(puerto, () => { server.removeListener('error', reject); resolve(server); });
            server.once('error', reject);
        });
    } catch (error) {
        try { await pool.end(); } catch { /* Preserve the initial startup error. */ }
        throw error;
    }
}
module.exports = { arrancar };
