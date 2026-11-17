const { randomBytes, createHmac, timingSafeEqual } = require('node:crypto');
// Process-local signing key: no credential or schema change. Restart invalidates forms.
const configuredKey = process.env.CSRF_SIGNING_KEY;
if (configuredKey !== undefined && (typeof configuredKey !== 'string' || Buffer.byteLength(configuredKey) < 32)) {
    throw new Error('CSRF_SIGNING_KEY debe tener al menos 32 bytes aleatorios.');
}
const signingKey = configuredKey || randomBytes(32);
const lifetime = 8 * 60 * 60 * 1000;
function cookie(req, name) {
    const entries = (req.get('cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(name + '='));
    return entries.length === 1 ? entries[0].slice(name.length + 1) : '';
}
function cookieName() { return process.env.NODE_ENV === 'production' ? '__Host-talentohub_csrf' : 'talentohub_csrf'; }
function signature(session, nonce, issued) {
    return createHmac('sha256', signingKey).update(JSON.stringify([session, nonce, issued])).digest('hex');
}
function csrfProtection(req, res, next) {
    const name = cookieName();
    const received = cookie(req, name);
    const nonce = /^[a-f0-9]{64}$/.test(received) ? received : randomBytes(32).toString('hex');
    const session = cookie(req, 'talentohub_sid');
    const issued = String(Date.now());
    res.locals.csrfToken = issued + '.' + nonce + '.' + signature(session, nonce, issued);
    res.locals.csrf = res.locals.csrfToken; // Compatibility with older EJS fragments.
    res.set('Cache-Control', 'no-store');
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        if (nonce !== received) res.cookie(name, nonce, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: lifetime });
        return next();
    }
    const supplied = req.get('x-csrf-token') || req.body?._csrf;
    const parts = typeof supplied === 'string' ? supplied.split('.') : [];
    const [time, tokenNonce, mac] = parts;
    const age = Date.now() - Number(time);
    const origin = req.get('origin');
    const crossSite = req.get('sec-fetch-site') === 'cross-site';
    let validOrigin = true;
    if (origin) {
        try { const parsed = new URL(origin); validOrigin = ['http:', 'https:'].includes(parsed.protocol) && parsed.host === req.get('host'); }
        catch { validOrigin = false; }
    }
    const valid = !crossSite && validOrigin && parts.length === 3 && /^\d{13}$/.test(time || '') &&
        age >= 0 && age <= lifetime && /^[a-f0-9]{64}$/.test(received) && tokenNonce === received &&
        /^[a-f0-9]{64}$/.test(mac || '') && timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature(session, tokenNonce, time), 'hex'));
    if (!valid) return res.status(403).send('Formulario no autorizado o vencido. Recarga la pagina e intenta de nuevo.');
    next();
}
module.exports = { csrfProtection };
