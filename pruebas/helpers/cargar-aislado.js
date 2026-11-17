// Shared mock-only module loader. Never imports the real database/configuration.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
function harness(pool = { query: async () => { throw Error('Unexpected DB query'); } }) {
    const cache = new Map();
    function load(relative) {
        const file = path.resolve(root, relative);
        if (file.endsWith(path.join('config','database.js'))) return { pool };
        assert.ok(!/migracion|server\.js$/.test(file), 'No migration/startup in tests');
        if (cache.has(file)) return cache.get(file).exports;
        const module = { exports: {} }; cache.set(file, module);
        const native = createRequire(file);
        function requireSafe(name) {
            assert.ok(!['pg','dotenv'].includes(name), 'No real database/environment dependency');
            if (name.startsWith('.')) { let target = path.resolve(path.dirname(file), name); if (!target.endsWith('.js')) target += '.js'; return load(target); }
            return native(name);
        }
        const fn = vm.runInThisContext('(function(require,module,exports,__filename,__dirname){' + fs.readFileSync(file,'utf8') + '\n})', { filename:file });
        fn(requireSafe, module, module.exports, file, path.dirname(file));
        return module.exports;
    }
    return { load };
}
module.exports = { harness };
