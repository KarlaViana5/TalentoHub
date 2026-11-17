function validarParametros(req, res, next) {
    for (const [name,value] of Object.entries(req.params)) {
        if (/^(id.*|hilo|comentario)$/i.test(name) && (!/^[1-9]\d{0,14}$/.test(String(value)) || !Number.isSafeInteger(Number(value)))) {
            return res.status(400).send('Identificador invalido.');
        }
    }
    next();
}
module.exports = { validarParametros };

function validarCuerpo(req, res, next) {
    if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
    if (req.body === undefined) req.body = {};
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).send('Formulario invalido.');
    const arrays = new Set(['ids','habilidades','responsabilidades','beneficios','etiquetas','opciones','correctas']);
    for (const [name,value] of Object.entries(body)) {
        if (value && typeof value === 'object') {
            const allowed = arrays.has(name) || /^pregunta_\d+$/.test(name);
            if (!Array.isArray(value) || !allowed || value.length > 200 || value.some(v => typeof v !== 'string' && typeof v !== 'number')) return res.status(400).send('Entrada invalida.');
        }
        if (typeof value === 'string' && value.length > 30000) return res.status(400).send('Entrada demasiado larga.');
    }
    next();
}
module.exports.validarCuerpo = validarCuerpo;

const PARAMETROS = Object.freeze(['id','idModulo','idInscripcion','idLeccion','hilo','comentario','idPostulacion','idAlerta','idValoracion','idCurso']);
function registrarValidacionParametros(router) {
    router.use(validarParametros);
    for (const nombre of PARAMETROS) router.param(nombre, validarParametros);
    return router;
}
module.exports.registrarValidacionParametros = registrarValidacionParametros;
