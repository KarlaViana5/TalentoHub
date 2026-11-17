const seen = new WeakSet();
const CODES = new Set(['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','EADDRINUSE','EACCES','ENOENT']);
function registrarError(error, { scope = 'application', req, status } = {}, sink = console.error) {
    if (error && typeof error === 'object') {
        if (seen.has(error)) return;
        seen.add(error);
    }
    const record = { event: 'application_error', time: new Date().toISOString(), scope, status: status || 500 };
    if (req?.requestId) record.requestId = req.requestId;
    if (['GET','HEAD','OPTIONS','POST','PUT','PATCH','DELETE'].includes(req?.method)) record.method = req.method;
    if (typeof req?.route?.path === 'string') record.route = req.route.path;
    if (typeof error?.code === 'string' && (CODES.has(error.code) || /^[0-9][0-9A-Z]{4}$/.test(error.code))) record.code = error.code;
    // Deliberately exclude message, stack, query, params, URL, headers and request bodies.
    sink(JSON.stringify(record));
}
module.exports = { registrarError };
