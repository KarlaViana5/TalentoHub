const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const express = require('express');
const { harness } = require('./helpers/cargar-aislado');
const { HttpError, statusOf, messageOf } = require('../src/utils/http-error');
const { registrarError } = require('../src/utils/logger');
const { identificarPeticion, noEncontrado, manejarError } = require('../src/middleware/error.middleware');
const { paginacion } = require('../src/utils/paginacion');
const { arrancar } = require('../src/services/arranque.service');
const migraciones = require('../scripts/migraciones');
const root = path.resolve(__dirname,'..');
async function local(app, tarea) {
    const server = app.listen(0,'127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try { await tarea('http://127.0.0.1:' + server.address().port); }
    finally { await new Promise(resolve => server.close(resolve)); }
}
test('Logger retains only safe diagnostics, never SQL, tokens, URLs or passwords',()=>{
    const secret = 'DATO_SENSIBLE_FICTICIO';
    const error = Object.assign(new Error(secret), { code:'ECONNREFUSED', query:secret, detail:secret });
    const records=[];
    registrarError(error,{scope:'test',status:503,req:{method:'POST',requestId:'id-test',route:{path:'/auth/login'},originalUrl:secret,body:{clave:secret},headers:{cookie:secret}}},r=>records.push(r));
    registrarError(error,{},r=>records.push(r));
    assert.equal(records.length,1);assert.ok(!records[0].includes(secret));
    const record=JSON.parse(records[0]);assert.equal(record.code,'ECONNREFUSED');assert.equal(record.requestId,'id-test');assert.equal(record.status,503);
    assert.equal(messageOf(Object.assign(new Error(secret),{status:500,publicMessage:secret})), 'Error interno. Intenta nuevamente.');
    assert.equal(statusOf({status:302}),500);assert.equal(statusOf({statusCode:400}),400);
});
test('Express 5 rejected promises centralize HTML/JSON errors with 400/401/403/404/500',async()=>{
    const app=express();app.set('view engine','ejs');app.set('views',path.join(root,'src/views'));
    app.use(identificarPeticion);app.use((req,res,next)=>{res.locals.usuarioActual=null;next();});
    app.get('/error/:status',async req=>{throw new HttpError(Number(req.params.status));});
    app.get('/rejected',()=>Promise.reject(Object.assign(new Error('SQL_Y_TOKEN_FICTICIOS'),{code:'23505',query:'PRIVATE'})));
    app.use(noEncontrado);app.use(manejarError);
    await local(app,async base=>{
        for(const status of [400,401,403,404,500]){
            const response=await fetch(base+'/error/'+status,{headers:{accept:'application/json'}});assert.equal(response.status,status);
            const body=await response.json();assert.equal(body.error.status,status);assert.match(body.error.requestId,/^[a-f0-9-]{36}$/);assert.equal(response.headers.get('cache-control'),'no-store');
            const html=await fetch(base+'/error/'+status,{headers:{accept:'text/html'}});assert.equal(html.status,status);const text=await html.text();assert.equal((text.match(/data-site-navigation/g)||[]).length,1);assert.ok(!text.includes(' at '));
        }
        const failure=await fetch(base+'/rejected');assert.equal(failure.status,500);const text=await failure.text();assert.ok(!text.includes('SQL_Y_TOKEN_FICTICIOS'));assert.ok(!text.includes('PRIVATE'));
        const missing=await fetch(base+'/missing?clave=DATO_FICTICIO');assert.equal(missing.status,404);assert.ok(!(await missing.text()).includes('DATO_FICTICIO'));
    });
});
test('Safe fallback if error view fails; headers already sent delegate to Express',()=>{
    const req={get(){return '';},path:'/test',requestId:'test',method:'GET'};
    const res={headersSent:false,set(){},status(n){this.code=n;return this;},render(v,data,cb){cb(new Error('private render diagnostic'));},type(t){this.contentType=t;return this;},send(t){this.text=t;return this;}};
    manejarError(new HttpError(400),req,res,()=>assert.fail());assert.equal(res.code,400);assert.equal(res.contentType,'text/plain');assert.equal(res.text,'Solicitud invalida.');
    const error=new HttpError(403);let delegated; manejarError(error,req,{headersSent:true},e=>delegated=e);assert.equal(delegated,error);
});
test('Public failed queries use centralized 500, protected failed session remains closed',async()=>{
    const pool={query:async()=>{throw Object.assign(new Error('NO_MOSTRAR_CONSULTA'),{code:'ECONNREFUSED'});}};
    const app=harness(pool).load('src/app.js');
    await local(app,async base=>{
        for(const route of ['/','/recursos','/busqueda']){const r=await fetch(base+route);assert.equal(r.status,500);assert.ok(!(await r.text()).includes('NO_MOSTRAR_CONSULTA'));}
        const session=await fetch(base+'/empresarial',{headers:{cookie:'talentohub_sid='+'a'.repeat(64)}});assert.equal(session.status,503);
    });
});
test('Shared pagination preserves valid results, safely normalizes invalid numeric inputs',async()=>{
    assert.deepEqual(paginacion({pagina:3,limite:10}),{pagina:3,limite:10,offset:20});
    assert.deepEqual(paginacion({},9,50),{pagina:1,limite:9,offset:0});
    assert.equal(paginacion({limite:100},9,50).limite,50);
    for(const options of [{pagina:Infinity},{pagina:-2},{pagina:1.9},{limite:Infinity},{limite:-2},{pagina:Number.MAX_VALUE,limite:50}]){
        const p=paginacion(options,9,50);assert.ok(Number.isSafeInteger(p.offset));assert.ok(Number.isSafeInteger(p.limite)&&p.limite>0);assert.ok(p.pagina>0);
    }
    const calls=[];const pool={query:async(sql,values)=>{calls.push({sql,values});return {rows:sql.includes('COUNT(*)')?[{total:'0'}]:[]};}};
    const h=harness(pool);const vacancies=await h.load('src/services/vacantes.service.js').buscarVacantes({},{pagina:3,limite:10});assert.deepEqual(vacancies,{vacantes:[],totalResultados:0});assert.deepEqual(calls[0].values.slice(-2),[10,20]);
    calls.length=0;const resources=await h.load('src/services/recursos.service.js').buscarRecursos({},{pagina:2,limite:9});assert.equal(resources.pagina,2);assert.deepEqual(calls[0].values.slice(-2),[9,9]);
});
test('Resource categories and search launch independently without changing rendered data',async()=>{
    let release;const categories=new Promise(resolve=>release=resolve);const calls=[];
    const pool={query:async(sql)=>{calls.push(sql);
        if(sql.includes('FROM categorias_recursos'))return categories;
        if(sql.includes('FROM recursos r')){release({rows:[{id:1,nombre:'Categoria'}]});return {rows:sql.includes('COUNT(*)')?[{total:'0'}]:[]};}
        throw Error('Unexpected SQL');
    }};
    const controller=harness(pool).load('src/controllers/recursos.controller.js');let rendered;
    const task=controller.mostrarInicio({query:{}},{render(view,data){rendered={view,data};}},error=>{throw error;});
    let timer;try{await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Reads did not launch concurrently')),1000);})]);}finally{clearTimeout(timer);}
    assert.equal(calls.length,3);assert.equal(rendered.view,'recursos/index');assert.deepEqual(rendered.data.categorias,[{id:1,nombre:'Categoria'}]);assert.deepEqual(rendered.data.recursos,[]);
});
test('Bootstrap checks connectivity/schema before listening; failure closes pool and never listens',async()=>{
    const events=[];const pool={end:async()=>events.push('end')};
    const app={listen(port,cb){events.push('listen:'+port);const server=new EventEmitter();process.nextTick(cb);return server;}};
    const server=await arrancar({app,pool,probarConexion:async()=>{events.push('check');return true;},asegurarEsquemaAuth:async()=>events.push('schema'),puerto:3000});assert.ok(server);assert.deepEqual(events,['check','schema','listen:3000']);
    events.length=0;await assert.rejects(arrancar({app,pool,probarConexion:async()=>false,asegurarEsquemaAuth:async()=>events.push('schema'),puerto:3000}),{status:503});assert.deepEqual(events,['end']);
    events.length=0;await assert.rejects(arrancar({app,pool,probarConexion:async()=>true,asegurarEsquemaAuth:async()=>{throw Error('schema missing');},puerto:3000}));assert.deepEqual(events,['end']);
});
test('Migration catalog is offline; apply requires explicit flags and a development/test environment',()=>{
    const plan=migraciones.plan();assert.equal(plan.length,3);assert.ok(plan.every(item=>item.existe));assert.ok(plan.find(m=>m.id==='modulo4-js').tipo.includes('semillas'));
    for(const args of [[],['aplicar'],['aplicar','--id=001','--confirmar=001']])assert.throws(()=>migraciones.validarAplicacion(args,{NODE_ENV:'test'}));
    const args=['aplicar','--id=002','--confirmar=002'];assert.throws(()=>migraciones.validarAplicacion(args,{NODE_ENV:'production'}));assert.throws(()=>migraciones.validarAplicacion(args,{}));assert.doesNotThrow(()=>migraciones.validarAplicacion(args,{NODE_ENV:'test'}));
});
test('Migration application tested ONLY with mock client: dependencies, transaction file and release',async()=>{
    const calls=[];let available=true;const client={query:async sql=>{calls.push(sql);if(sql.startsWith('SELECT'))return {rows:[{cuentas:available?'usuarios_cuenta':null,empresas:'empresas'}]};return {rows:[]};},release(){calls.push('release');}};
    await migraciones.aplicar002({connect:async()=>client});assert.ok(calls[1].includes('BEGIN;'));assert.ok(calls[1].includes('COMMIT;'));assert.equal(calls.at(-1),'release');
    available=false;calls.length=0;await assert.rejects(migraciones.aplicar002({connect:async()=>client}));assert.ok(!calls.some(s=>s.includes('CREATE TABLE')));assert.equal(calls.at(-1),'release');
});
test('Relative module graph has no cycles; literal CSS/JS references exist and head has no duplicates',()=>{
    function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
    const files=walk(path.join(root,'src'));const graph=new Map();
    for(const file of files){const text=fs.readFileSync(file,'utf8');
        if(file.endsWith('.js'))graph.set(file,[...text.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)].map(m=>path.resolve(path.dirname(file),m[1]+(m[1].endsWith('.js')?'':'.js'))));
        if(file.endsWith('.ejs'))for(const m of text.matchAll(/(?:href|src)="(\/(?:css|js)\/[^"<%]+)"/g))assert.ok(fs.existsSync(path.join(root,'src/public',m[1])),file+': '+m[1]);
    }
    const done=new Set();function visit(file,stack=[]){assert.ok(!stack.includes(file),'Cycle: '+[...stack,file].join(' -> '));if(done.has(file))return;for(const child of graph.get(file)||[])visit(child,[...stack,file]);done.add(file);}for(const file of graph.keys())visit(file);
    const head=fs.readFileSync(path.join(root,'src/views/partials/head.ejs'),'utf8');assert.equal((head.match(/href="\/css\/navigation.css"/g)||[]).length,1);
});

test('Linear grouping matches previous nested filtering for database IDs and preserves order',()=>{
    const { agruparPor }=require('../src/utils/colecciones');
    const parents=[{id:1},{id:2},{id:3},{id:'1'}], rows=[{id:10,parentId:2},{id:11,parentId:1},{id:12,parentId:2},{id:13,parentId:'1'}];
    const expected=parents.map(parent=>({...parent,children:rows.filter(row=>row.parentId===parent.id)}));
    const grouped=agruparPor(rows,'parentId');const actual=parents.map(parent=>({...parent,children:grouped.get(parent.id)||[]}));
    assert.deepEqual(actual,expected);assert.equal(actual[0].children[0],rows[1]);
});
test('Foro pagination retains count, clamping and parameterized LIMIT/OFFSET',async()=>{
    const calls=[];const service=harness({query:async(sql,values)=>{calls.push({sql,values});return {rows:sql.includes('SELECT COUNT(*)::int AS total FROM hilos_foro')?[{total:13}]:[]};}}).load('src/services/foros.service.js');
    const result=await service.listarHilosDeForo(1,{}, {pagina:5,limite:8});assert.equal(result.pagina,2);assert.equal(result.totalPaginas,2);assert.equal(result.totalResultados,13);assert.deepEqual(calls.at(-1).values,[1,8,8]);
});
