// Ejecutar: node pruebas/navigation.prueba.js. No carga app.js ni accede a PostgreSQL.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ejs = require('ejs');
const root = path.resolve(__dirname, '..');
const views = path.join(root, 'src/views');
const navFile = path.join(views, 'partials/navigation.ejs');
const source = fs.readFileSync(navFile, 'utf8');
const users = {
    visitante: null,
    candidato: { rol: 'candidato', nombreMostrar: 'Ana <script>alert(1)</script>', rolEtiqueta: 'Aplicante' },
    empresa: { rol: 'empresa', nombreMostrar: 'Mi empresa', rolEtiqueta: 'Empresa' },
    admin: { rol: 'admin', nombreMostrar: 'Administradora', rolEtiqueta: 'Administrador' }
};
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(f => f.isDirectory() ? walk(path.join(dir, f.name)) : [path.join(dir, f.name)]); }
const files = walk(views).filter(f => f.endsWith('.ejs'));
const includes = new Map();
for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    ejs.compile(text, { filename: f }); checks++;
    includes.set(f, [...text.matchAll(/include\(['"]([^'"]+)['"]/g)].map(m => {
        const target = path.resolve(path.dirname(f), m[1] + (path.extname(m[1]) ? '' : '.ejs'));
        check(fs.existsSync(target), 'Include inexistente: ' + target);
        return target;
    }));
}
function navbarCount(f, stack = []) {
    check(!stack.includes(f), 'Ciclo de includes: ' + f);
    return (f === navFile ? 1 : 0) + (includes.get(f) || []).reduce((n, child) => n + navbarCount(child, [...stack, f]), 0);
}
for (const f of files) {
    if (/<body\b/.test(fs.readFileSync(f, 'utf8'))) check(navbarCount(f) === 1, 'Debe incluir exactamente un navbar: ' + f);
}
const realRoutes = new Set(['/', '/busqueda', '/recursos', '/foros', '/candidato', '/empresarial', '/administrativo', '/auth/login', '/auth/registro', '/auth/logout']);
for (const [role, user] of Object.entries(users)) {
    const active = role === 'admin' ? 'admin' : role === 'empresa' ? 'empresa' : role === 'candidato' ? 'candidato' : 'inicio';
    const html = ejs.render(source, { usuarioActual: user, activo: active }, { filename: navFile });
    const main = html.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/)[1];
    const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    check((html.match(/data-site-navigation/g) || []).length === 1, role + ': navbar ?nico');
    check((main.match(/aria-current="page"/g) || []).length === 1, role + ': p?gina activa');
    check(links.every(link => realRoutes.has(link)), role + ': rutas existentes');
    check(main.includes('href="/administrativo"') === (role === 'admin'), role + ': administraci?n seg?n rol');
    check(main.includes('href="/candidato"') === ['visitante','candidato'].includes(role), role + ': candidato seg?n rol');
    check(main.includes('href="/empresarial"') === ['visitante','empresa'].includes(role), role + ': empresa seg?n rol');
    check(html.includes('Cerrar sesión') === Boolean(user), role + ': sesión');
    check(html.includes('Registrarse') === !user, role + ': registro');
    if (user) check(html.includes('>Perfil</strong>'), role + ': perfil');
    check(!html.includes('<script>alert(1)</script>'), 'Nombre escapado');
}
// Interacci?n sin navegador: bot?n, Escape, clic exterior, enlace y cambio de tama?o.
let expanded = 'false', focused = false;
const handlers = {}, documentHandlers = {}, mediaHandlers = {}, panelHandlers = {};
const toggle = { hidden: true, setAttribute(k,v) { if(k==='aria-expanded')expanded=v; }, getAttribute() {return expanded;}, addEventListener(k,v){handlers[k]=v;}, focus(){focused=true;} };
const panel = { addEventListener(k,v){panelHandlers[k]=v;}, contains(){return false;} };
const element = { dataset: {}, querySelector(s){return s.includes('toggle')?toggle:panel;}, contains(t){return t===toggle;} };
const media = { matches: true, addEventListener(k,v){mediaHandlers[k]=v;} };
vm.runInNewContext(fs.readFileSync(path.join(root,'src/public/js/navigation.js'),'utf8'), {
    document: { querySelector(){return element;}, addEventListener(k,v){documentHandlers[k]=v;} },
    window: { matchMedia(){return media;} }
});
check(element.dataset.open === 'false' && !toggle.hidden, 'Inicializaci?n m?vil');
handlers.click(); check(expanded === 'true' && element.dataset.open === 'true', 'Abrir men?');
documentHandlers.keydown({key:'Escape'}); check(expanded==='false' && focused, 'Escape cierra y devuelve foco');
handlers.click(); documentHandlers.click({target:{}}); check(expanded==='false', 'Clic exterior cierra');
handlers.click(); panelHandlers.click({target:{closest(){return {};}}}); check(expanded==='false', 'Enlace cierra');
handlers.click(); mediaHandlers.change(); check(expanded==='false', 'Cambio de tama?o restablece men?');
console.log(checks + ' comprobaciones correctas; ' + files.length + ' EJS válidos. Sin acceso a PostgreSQL.');
