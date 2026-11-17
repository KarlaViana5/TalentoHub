const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ejs = require('ejs');
const { fixtures, renderFixture } = require('./lote1.browser.prueba');
const root = path.resolve(__dirname, '..');
test('Public design is opt-in and preserves all preexisting shared CSS', () => {
    const css = fs.readFileSync(path.join(root,'src/public/css/design-system.css'),'utf8');
    const marker = '\n\n/* =============================================================\n   FASE 4 / LOTE 1';
    const index = css.indexOf(marker); assert.ok(index > 0);
    assert.equal(crypto.createHash('sha256').update(css.slice(0,index)).digest('hex'), '95b7cd02b3370bb4c21b62018f188711b06068e091d92d6a9175a57e45036b38');
    const additions = css.slice(index).replace(/\/\*[\s\S]*?\*\//g,'');
    for (const line of additions.split('\n')) {
        if (!line.includes('{') || line.trim().startsWith('@')) continue;
        const selector = line.slice(0,line.indexOf('{')).trim();
        assert.ok(selector === ':root' || selector.includes('body.th-public'), 'Unscoped public selector: '+selector);
    }
    const tokens = [...additions.matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1]);
    assert.ok(tokens.length > 15); assert.ok(tokens.every(token=>token.startsWith('--th-ui-')));
});
test('Public EJS render retains real form contracts, CSRF and exactly one navbar', () => {
    for (const fixture of fixtures()) {
        const html = renderFixture(fixture);
        assert.equal((html.match(/data-site-navigation/g)||[]).length,1);
        assert.ok(html.includes('th-public')); assert.ok(html.includes('id="contenido-principal"'));
        for (const form of html.matchAll(/<form\b([\s\S]*?)<\/form>/g)) {
            if (/method="post"/i.test(form[1])) assert.ok(form[1].includes('name="_csrf"'));
        }
    }
    const fixture = fixtures().find(f=>f.name==='empleo');
    const html = renderFixture(fixture);
    assert.ok(html.includes('/busqueda/empleo/101/postular'));
    assert.ok(html.includes('/busqueda/empleo/101/reportar'));
    assert.ok(html.includes('Responsabilidades'));assert.ok(html.includes('Beneficios'));
});
test('New public styles are not enabled on modules reserved for later lots', () => {
    for(const directory of ['candidato','empresarial','foros','administrativo','auth']) {
        for(const file of fs.readdirSync(path.join(root,'src/views',directory)).filter(f=>f.endsWith('.ejs'))) {
            assert.ok(!fs.readFileSync(path.join(root,'src/views',directory,file),'utf8').includes('th-public'), directory+'/'+file);
        }
    }
});
test('All EJS syntax and literal includes remain valid', () => {
    function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
    for(const file of walk(path.join(root,'src/views')).filter(f=>f.endsWith('.ejs'))){
        const html=fs.readFileSync(file,'utf8');ejs.compile(html,{filename:file});
        for(const m of html.matchAll(/include\(['"]([^'"]+)['"]/g)){
            const target=path.resolve(path.dirname(file),m[1]+(m[1].endsWith('.ejs')?'':'.ejs'));
            assert.ok(fs.existsSync(target),file);
        }
    }
});

