const { createHash } = require('node:crypto');
const windowMs = 15 * 60 * 1000;
const attempts = new Map();
const MAX_BUCKETS = 10000;
function limitarLogin(req, res, next) {
    const now = Date.now();
    for (const [key, record] of attempts) if (record.until <= now) attempts.delete(key);
    const email = typeof req.body?.correo === 'string' ? req.body.correo.trim().toLowerCase().slice(0,254) : '';
    const account = createHash('sha256').update(email).digest('hex');
    const buckets = [[String(req.ip || 'unknown'), 30], ['cuenta:' + account, 10]];
    for (const [key, max] of buckets) {
        const record = attempts.get(key);
        if ((record && record.count >= max) || (!record && attempts.size >= MAX_BUCKETS)) {
            res.set('Retry-After', String(Math.max(1, Math.ceil(((record?.until || now + windowMs) - now) / 1000))));
            return res.status(429).send('Demasiados intentos. Intenta nuevamente mas tarde.');
        }
    }
    for (const [key] of buckets) {
        const record = attempts.get(key) || { count: 0, until: now + windowMs };
        record.count++; attempts.set(key, record);
    }
    next();
}
module.exports = { limitarLogin };
