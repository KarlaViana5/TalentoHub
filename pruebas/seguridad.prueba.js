// node --test pruebas/seguridad.prueba.js. No .env, pg, migrations or external DB.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { promisify } = require('node:util');
const { scrypt } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const { harness } = require('./helpers/cargar-aislado');
function response() {
    return { locals:{}, statusCode:200, headers:{}, cookies:[], status(n){this.statusCode=n;return this;}, set(k,v){this.headers[k]=v;return this;}, cookie(...v){this.cookies.push(v);return this;}, send(v){this.body=v;return this;}, render(view,data){this.view=view;this.data=data;return this;}, redirect(v){this.location=v;return this;} };
}
function request(method='GET', cookie='', body={}, headers={}) {
    const h={host:'localhost:3000',cookie,...headers};return {method,body,params:{},query:{},ip:'127.0.0.1',get(k){return h[k.toLowerCase()];}};
}
test('CSRF: anonymous/login and session binding, missing/forged/cross-origin tokens', () => {
    const {csrfProtection}=harness().load('src/middleware/csrf.middleware.js');
    const get=response();csrfProtection(request(),get,()=>{});
    const cookie=get.cookies[0][0]+'='+get.cookies[0][1]; const token=get.locals.csrfToken;
    for(const header of [{}, {'origin':'https://attacker.test'},{'sec-fetch-site':'cross-site'}]){
        const res=response();let next=false;csrfProtection(request('POST',cookie,{_csrf:token},header),res,()=>next=true);
        assert.equal(next,Object.keys(header).length===0);
    }
    for(const value of [undefined,token+'0',[],{},token.replace(/^\d+/, '1000000000000')]){const res=response();csrfProtection(request('POST',cookie,{_csrf:value}),res,()=>assert.fail('Token accepted'));assert.equal(res.statusCode,403);}
    let next=false;csrfProtection(request('POST',cookie,{}, {'x-csrf-token':token}),response(),()=>next=true);assert.ok(next);
    csrfProtection(request('POST',cookie+'; talentohub_sid='+'a'.repeat(64),{_csrf:token}),response(),()=>assert.fail('Token from different session'));
    const a=response();csrfProtection(request('GET',cookie+'; talentohub_sid='+'a'.repeat(64)),a,()=>{});
    let legitimate=false;csrfProtection(request('POST',cookie+'; talentohub_sid='+'a'.repeat(64),{_csrf:a.locals.csrfToken}),response(),()=>legitimate=true);assert.ok(legitimate);
});
test('Login throttle limits one account even across IPs, separate accounts remain available',()=>{
 const {limitarLogin}=harness().load('src/middleware/login-limit.middleware.js');
 for(let i=0;i<10;i++){const req=request('POST','',{correo:'A@EXAMPLE.TEST'});req.ip='client-'+i;let next=false;limitarLogin(req,response(),()=>next=true);assert.ok(next);}
 const blocked=response();limitarLogin(request('POST','',{correo:'a@example.test'}),blocked,()=>assert.fail());assert.equal(blocked.statusCode,429);assert.ok(blocked.headers['Retry-After']);
 let allowed=false;limitarLogin(request('POST','',{correo:'other@example.test'}),response(),()=>allowed=true);assert.ok(allowed);
});
test('Foros ignores query/body identities; active session is the only actor',async()=>{
 const pool={query:async(sql,values)=>({rows:sql.includes('FROM candidatos')?[{id:values[0],nombre:'Ana',estado:'activo',cargo:'Dev'}]:[]})};
 const h=harness(pool),c=h.load('src/controllers/foros.controller.js');
 const req={query:{actor:'admin',rol:'admin'},body:{actor:'admin',usuario:{rol:'admin'}}};const res=response();await c.cargarContextoActor(req,res,()=>{});assert.equal(req.actorForo.tipo,'visitante');assert.equal(req.actorForo.esAdmin,false);
 req.usuario={id:10,rol:'candidato',candidatoId:7};await c.cargarContextoActor(req,res,()=>{});assert.equal(req.actorForo.tipo,'candidato');assert.equal(req.actorForo.id,7);assert.equal(req.actorForo.esAdmin,false);
 const service=h.load('src/services/foros.service.js');await assert.rejects(service.eliminarHiloPropio(1,{tipo:'admin',esAdmin:true,puedeParticipar:true}),{status:403});
});
test('Foros prevents editing/deleting another author; permits own edit and admin',async()=>{
 const writes=[];const pool={query:async(sql,values)=>{
  if(sql.includes('FROM candidatos'))return {rows:[{id:values[0],nombre:'Ana',estado:'activo',cargo:'Dev'}]};
  if(sql.startsWith('SELECT id_hilo'))return {rows:[{id:5,autorTipo:'candidato',autorId:8}]};
  if(sql.includes('UPDATE hilos_foro')){writes.push(values);return {rows:[{id:5}]};}return {rows:[]};
 }};const service=harness(pool).load('src/services/foros.service.js');const actor=await service.resolverActor({id:10,rol:'candidato',candidatoId:7});
 await assert.rejects(service.editarHiloPropio(5,actor,{titulo:'Titulo valido',contenido:'Contenido suficientemente largo'}));await assert.rejects(service.eliminarHiloPropio(5,actor));assert.equal(writes.length,0);
 const own=await service.resolverActor({id:11,rol:'candidato',candidatoId:8});await service.editarHiloPropio(5,own,{titulo:'Titulo valido',contenido:'Contenido suficientemente largo'});assert.equal(writes.length,1);
 const admin=await service.resolverActor({id:2,rol:'admin',nombre:'Admin'});await service.editarHiloPropio(5,admin,{titulo:'Titulo valido',contenido:'Contenido suficientemente largo'});assert.equal(writes.length,2);
});
function companyPool(mapping=false) {
 const queries=[];
 const empresas=[{id:1,nombre:'Uno',estado:'activa'},{id:2,nombre:'Dos',estado:'activa'}];
 const vacantes=[{id:11,empresaId:1,empresaNombre:'Uno',estado:'publicada',habilidades:[],vistas:0,totalPostulantes:1,titulo:'Vacante de prueba'},{id:22,empresaId:2,empresaNombre:'Dos',estado:'publicada',habilidades:[],vistas:0,totalPostulantes:1,titulo:'Vacante de prueba'}];
 const postulaciones=[{id:111,vacanteId:11,candidatoId:10,estado:'nuevo'},{id:222,vacanteId:22,candidatoId:20,estado:'nuevo'}];
 const pool={queries,async query(sql,values=[]){queries.push({sql,values});
  const placeholders=[...sql.matchAll(/\$(\d+)/g)].map(m=>Number(m[1]));assert.equal(Math.max(0,...placeholders),values.length,'SQL parameters must match');
  if(sql.includes('to_regclass'))return {rows:[{propiedad:mapping?'empresas_propietarios':null}]};
  if(sql.includes('FROM public.empresas_propietarios'))return {rows:[]};
  if(sql.includes('ANY('))assert.ok(values.some(Array.isArray),'Owner scope parameters required');
  const ids=values.find(Array.isArray)||[];
  const owns=p=>vacantes.some(v=>v.id===p.vacanteId&&ids.includes(v.empresaId));
  if(sql.startsWith('UPDATE postulaciones')){const selected=Array.isArray(values[0])?values[0].map(Number):[Number(values[0])];const scoped=values[2]||[];assert.ok(sql.includes('ANY($3::bigint[])'),'Ownership predicate missing');const allowed=postulaciones.filter(p=>selected.includes(p.id)&&vacantes.some(v=>v.id===p.vacanteId&&scoped.includes(v.empresaId)));return {rows:selected.length>1&&allowed.length!==selected.length?[]:allowed};}
  if(sql.includes('INSERT INTO notas_postulacion')){assert.ok(sql.includes('ANY($4::bigint[])'));return {rows:postulaciones.filter(p=>p.id===Number(values[0])&&vacantes.some(v=>v.id===p.vacanteId&&values[3].includes(v.empresaId))).map(()=>({texto:values[2]}))};}
  if(sql.startsWith('DELETE FROM vacantes'))return {rows:vacantes.filter(v=>v.id===Number(values[0])&&ids.includes(v.empresaId))};
  if(sql.includes('FROM vacantes v') && sql.includes('v.id_vacante = $1') && sql.includes('SELECT\n'))return {rows:vacantes.filter(v=>v.id===Number(values[0])&&ids.includes(v.empresaId))};
  if(sql.includes('FROM vacantes v') && sql.includes('ORDER BY v.fecha_publicacion')){assert.ok(sql.includes('v.empresa_id = ANY('));return {rows:vacantes.filter(v=>ids.includes(v.empresaId))};}
  if(sql.includes('FROM empresas') && sql.includes('id_empresa = $1'))return {rows:empresas.filter(e=>e.id===Number(values[0])&&ids.includes(e.id))};
  if(sql.includes('FROM postulaciones WHERE id_postulacion'))return {rows:postulaciones.filter(p=>p.id===Number(values[0])&&owns(p))};
  return {rows:[]};
 }};return pool;
}
test('Enterprise: no context fails closed; cross-company reads/writes/notes/batches blocked',async()=>{
 const pool=companyPool(),service=harness(pool).load('src/services/empresarial.service.js');
 await assert.rejects(service.listarVacantes(),{status:403});
 await service.conContextoEmpresa({id:100,rol:'empresa',empresaId:1},async()=>{
  assert.deepEqual((await service.listarVacantes()).map(v=>v.id),[11]);
  assert.equal(await service.obtenerEmpresa(2),null);assert.equal(await service.obtenerVacante(22),null);assert.equal(await service.obtenerPostulacion(222),null);
  assert.equal(await service.cambiarEstadoPostulacion(222,'Entrevista'),null);assert.equal(await service.eliminarVacante(22),false);assert.equal(await service.agregarNota(222,'Privada'),null);
  assert.equal((await service.obtenerVacante(11)).id,11);assert.equal((await service.cambiarEstadoPostulacion(111,'Entrevista')).id,111);assert.equal((await service.agregarNota(111,'Valida')).texto,'Valida');
  await assert.rejects(service.cambiarEstadoVariasPostulaciones([111,222],'Entrevista'),{status:403});assert.equal(await service.cambiarEstadoVariasPostulaciones([111],'Entrevista'),1);
  await assert.rejects(service.crearVacante({empresaId:2},'Borrador'),{status:403});assert.equal(service.crearEmpresa,undefined);assert.equal(service.cambiarEstadoEmpresa,undefined);
 },pool);
});
test('Enterprise request contexts remain isolated under concurrent async work',async()=>{
 const pool=companyPool(),service=harness(pool).load('src/services/empresarial.service.js');
 const results=await Promise.all([1,2].map(id=>service.conContextoEmpresa({id:100+id,rol:'empresa',empresaId:id},async()=>{await new Promise(r=>setTimeout(r,id===1?10:1));return {context:service.obtenerContexto().empresaId,ids:(await service.listarVacantes()).map(v=>v.id)};},pool)));
 assert.deepEqual(results,[{context:1,ids:[11]},{context:2,ids:[22]}]);
});
test('Registration pending, no fabricated document, no password seeding/DDL or demo login',async()=>{
 const queries=[];const client={release(){},async query(sql,values){queries.push({sql,values});if(sql.includes('INSERT INTO empresas'))return {rows:[{id:9}]};if(sql.includes('INSERT INTO usuarios_cuenta'))return {rows:[{id:20,rol:'empresa'}]};return {rows:[]};}};
 const pool={connect:async()=>client,async query(sql,values){queries.push({sql,values});if(sql.includes('to_regclass'))return {rows:[{cuentas:'usuarios_cuenta',sesiones:'sesiones_auth'}]};return {rows:[]};}};
 const auth=harness(pool).load('src/services/auth.service.js');await auth.asegurarEsquemaAuth();assert.equal(queries.length,1);assert.ok(queries[0].sql.startsWith('SELECT'));
 await assert.rejects(auth.autenticarDemoPorUsuarioId(1),{status:403});
 const result=await auth.registrarNuevoUsuario({rol:'empresa',nombre:'Empresa prueba',correo:'empresa@example.test',clave:'UnaClaveDePruebaLarga',confirmarClave:'UnaClaveDePruebaLarga',nit:'06141503221010',telefono:'22000000'});assert.equal(result.usuario.id,20);
 const datosEmpresa={rol:'empresa',nombre:'Empresa prueba',correo:'otra@example.test',clave:'UnaClaveDePruebaLarga',confirmarClave:'UnaClaveDePruebaLarga'};
 for(const nit of ['NIT-DE-PRUEBA','0614-150322-101','0614-150322-101-00','0614-15032a-101-0',''])await assert.rejects(auth.registrarNuevoUsuario({...datosEmpresa,nit}),/NIT/);
 for(const telefono of ['2200-000','2200-00000','8200-0000','2200-00a0'])await assert.rejects(auth.registrarNuevoUsuario({...datosEmpresa,nit:'0614-150322-101-0',telefono}),/teléfono/);
 const insert=queries.find(q=>q.sql.includes('INSERT INTO empresas'));assert.equal(insert.values[2],'0614-150322-101-0');assert.equal(insert.values[5],'2200-0000');assert.ok(insert.sql.includes("'pendiente', 'pendiente', 'no_verificada'"));assert.ok(!insert.sql.includes('aprobada'));
 const sol=queries.find(q=>q.sql.includes('INSERT INTO solicitudes_empresas'));assert.ok(sol.sql.includes("NULL, $2, 'pendiente'"));assert.ok(!sol.values.some(v=>String(v).includes('https://')));
 assert.ok(!queries.some(q=>/CREATE |ALTER |UPDATE empresas/.test(q.sql)));
});
test('Existing password hashes still authenticate; suspended session is rejected',async()=>{
 const salt='a'.repeat(32),hash=(await promisify(scrypt)('ClaveExistente',salt,64)).toString('hex');let suspended=false;
 const pool={async query(sql){if(sql.includes('FROM usuarios_cuenta u'))return {rows:[{id:1,rol:'candidato',activo:true,candidatoId:7,claveHash:salt+':'+hash}]};if(sql.includes('FROM sesiones_auth s'))return {rows:[{id:1,rol:'candidato',candidatoId:7,candidatoEstado:suspended?'suspendido':'activo'}]};return {rows:[]};}};
 const auth=harness(pool).load('src/services/auth.service.js');assert.equal((await auth.autenticarCredenciales('a@example.test','ClaveExistente')).usuario.id,1);const token='f'.repeat(64);assert.ok(await auth.obtenerUsuarioPorToken(token));suspended=true;assert.equal(await auth.obtenerUsuarioPorToken(token),null);
 assert.deepEqual(auth.opcionesCookie(),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'});
});
test('GET details are read-only; view counters have separate POST handlers',async()=>{
 const calls=[];const pool={query:async(sql)=>{calls.push(sql);return {rows:[]};}};const h=harness(pool);
 await h.load('src/services/vacantes.service.js').obtenerVacantePorId(1);await h.load('src/services/foros.service.js').obtenerHiloDetalle(1);
 assert.ok(calls.length>=2);assert.ok(calls.every(s=>!/^\s*(UPDATE|INSERT|DELETE|ALTER|CREATE)/i.test(s)));
});
test('HTTP route protection with mocked PostgreSQL: public GET, roles, CSRF, logout confirmation',async()=>{
 const calls=[];const pool={query:async(sql)=>{calls.push(sql);return {rows:[]};}};const app=harness(pool).load('src/app.js');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const login=await fetch(base+'/auth/login');assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];const html=await login.text();const token=html.match(/name="csrf-token" content="([^"]+)"/)[1];
  assert.equal((html.match(/data-site-navigation/g)||[]).length,1);
  for(const route of ['/administrativo','/empresarial','/candidato','/foros/mis-solicitudes']){const r=await fetch(base+route,{redirect:'manual'});assert.equal(r.status,302);assert.ok(r.headers.get('location').startsWith('/auth/login'));}
  for(const route of ['/auth/logout','/auth/registro','/foros/solicitudes','/empresarial/postulaciones/estado','/administrativo/configuracion','/candidato/alertas','/busqueda/empleo/1/postular']){assert.equal((await fetch(base+route,{method:'POST'})).status,403);}
  const logout=await fetch(base+'/auth/logout');assert.equal(logout.status,200);assert.ok((await logout.text()).includes('action="/auth/logout"'));
  const forum=await fetch(base+'/foros/solicitudes',{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:token,actor:'admin'}),redirect:'manual'});assert.equal(forum.status,302);
  const malicious=await fetch(base+'/empresarial?rol=admin',{redirect:'manual'});assert.equal(malicious.status,302);
  assert.equal(calls.length,0,'Anonymous invalid writes must not touch DB');
  const vista=await fetch(base+'/busqueda/empleo/1/vista',{method:'POST',headers:{cookie,'x-csrf-token':token}});assert.equal(vista.status,204);assert.ok(calls.at(-1).startsWith('UPDATE vacantes'));
  const structured=await fetch(base+'/auth/registro',{method:'POST',headers:{cookie,'content-type':'application/json','x-csrf-token':token},body:JSON.stringify({nombre:{rol:'admin'}})});assert.equal(structured.status,400);
 }finally{await new Promise(r=>server.close(r));}
});

test('Company profile edits only the session company; NIT, status and approval are immutable',async()=>{
 const seen=[];
 const pool={async query(sql,values=[]){seen.push({sql,values});
  if(sql.includes('to_regclass'))return {rows:[{propiedad:'empresas_propietarios'}]};
  if(sql.includes('FROM public.empresas_propietarios'))return {rows:[{id:7}]};
  if(sql.includes('FROM empresas'))return {rows:[{id:Number(values[0]),nombre:'Uno',estado:'pendiente',estadoAprobacion:'pendiente',nit:'0614-150322-101-0'}]};
  return {rows:[]};
 }};
 const service=harness(pool).load('src/services/empresarial.service.js');
 await service.conContextoEmpresa({id:100,rol:'empresa',empresaId:1},async()=>{
  const perfil=await service.obtenerPerfilEmpresa();assert.equal(perfil.id,1);assert.equal(perfil.estadoAprobacion,'Pendiente');
  await service.actualizarPerfilEmpresa({id:7,nombre:'Nuevo',sector:service.SECTORES[0],ubicacion:'San Salvador',telefono:'22000000',nit:'9999-999999-999-9',estado:'activa',estado_aprobacion:'aprobada'});
  const update=seen.find(q=>q.sql.startsWith('UPDATE empresas'));
  assert.equal(update.values[0],1,'Uses session company, never a submitted id');
  assert.ok(!/nit|estado/.test(update.sql.split('WHERE')[0]),'NIT/status/approval are not writable');
  assert.ok(update.sql.includes('ANY($2::bigint[])'));assert.equal(update.values[6],'2200-0000');
  await assert.rejects(service.actualizarPerfilEmpresa({nombre:'X',sector:service.SECTORES[0],ubicacion:'SV',telefono:'1234'}),{status:422});
 },pool);
 assert.equal(service.crearEmpresa,undefined);assert.equal(service.cambiarEstadoEmpresa,undefined);
});
test('Enterprise aggregates and every protected query retain owner predicate',async()=>{
 const seen=[];
 const pool={async query(sql,values=[]){seen.push(sql);
  if(sql.includes('to_regclass'))return {rows:[{propiedad:null}]};
  const placeholders=[...sql.matchAll(/\$(\d+)/g)].map(m=>Number(m[1]));assert.equal(Math.max(0,...placeholders),values.length);
  assert.ok(/ANY\(\$\d+::bigint\[\]\)/.test(sql),'Unscoped SQL: '+sql.slice(0,80));
  assert.ok(values.some(v=>Array.isArray(v)&&v.length===1&&v[0]===1));
  if(sql.includes('COUNT(*) FILTER'))return {rows:[{activas:0,activasMes:0,vistas:0,total:0,totalMes:0,respondidas:0}]};
  return {rows:[]};
 }};
 const service=harness(pool).load('src/services/empresarial.service.js');
 await service.conContextoEmpresa({id:100,rol:'empresa',empresaId:1},async()=>{
  await service.obtenerPanel();await service.listarEmpresas();await service.contarVacantesPorEstado();await service.contarPostulacionesPorEstado(11);await service.obtenerCandidato(10);
  await service.obtenerPerfilEmpresa();await service.actualizarPerfilEmpresa({nombre:'Test',ubicacion:'SV',sector:service.SECTORES[0]});
 },pool);assert.ok(seen.length>=12);
});
test('Authenticated HTTP role checks and forged company IDs never write foreign records',async()=>{
 const pool=companyPool();const baseQuery=pool.query.bind(pool);let role='empresa';
 pool.query=async(sql,values)=>sql.includes('FROM sesiones_auth s')?{rows:[{id:100,rol:role,empresaId:1,candidatoId:role==='candidato'?10:null,nombre:'Test',empresaNombre:'Uno',candidatoNombre:'Test',candidatoEstado:'activo'}]}:baseQuery(sql,values);
 const app=harness(pool).load('src/app.js');const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const session='talentohub_sid='+'c'.repeat(64);
 try{
  const login=await fetch(base+'/auth/login',{headers:{cookie:session}});const cookie=login.headers.get('set-cookie').split(';')[0]+'; '+session;const html=await login.text();const token=html.match(/name="csrf-token" content="([^"]+)"/)[1];
  assert.equal((await fetch(base+'/administrativo?rol=admin',{headers:{cookie},redirect:'manual'})).status,403);
  const vacancies=await fetch(base+'/empresarial/vacantes',{headers:{cookie}});assert.equal(vacancies.status,200);const page=await vacancies.text();assert.ok(page.includes('/empresarial/vacantes/11'));assert.ok(!page.includes('/empresarial/vacantes/22'));
  const form=data=>({method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:token,...data}),redirect:'manual'});
  assert.equal((await fetch(base+'/empresarial/vacantes/22/eliminar',form({}))).status,404);
  assert.equal((await fetch(base+'/empresarial/empresas',form({nombre:'Otra',sector:'Tecnología',ubicacion:'SV'}))).status,404);
  assert.equal((await fetch(base+'/empresarial/empresas/2/estado',form({estado:'Activa'}))).status,404);
  assert.equal((await fetch(base+'/empresarial/empresas',{headers:{cookie},redirect:'manual'})).headers.get('location'),'/empresarial/perfil');
  assert.equal((await fetch(base+'/empresarial/postulaciones/222/estado',form({estado:'Entrevista'}))).status,404);
  assert.equal((await fetch(base+'/empresarial/vacantes/abc/eliminar',form({}))).status,400);
  role='candidato';assert.equal((await fetch(base+'/administrativo',{headers:{cookie},redirect:'manual'})).status,403);assert.equal((await fetch(base+'/empresarial/vacantes',{headers:{cookie},redirect:'manual'})).status,403);
 }finally{await new Promise(r=>server.close(r));}
});
test('Production CSRF cookie is Secure, HttpOnly and host-only',()=>{
 const old=process.env.NODE_ENV;try{process.env.NODE_ENV='production';const {csrfProtection}=harness().load('src/middleware/csrf.middleware.js');const res=response();csrfProtection(request(),res,()=>{});const [name,,options]=res.cookies[0];assert.ok(name.startsWith('__Host-'));assert.equal(options.secure,true);assert.equal(options.httpOnly,true);assert.equal(options.path,'/');assert.equal(options.domain,undefined);}finally{if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;}
});

test('All source JS/EJS compile; POST forms have CSRF; relative imports and includes resolve',()=>{
 const ejs=require('ejs');
 function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?walk(path.join(dir,f.name)):[path.join(dir,f.name)]);}
 for(const file of walk(path.join(root,'src'))){
  const source=fs.readFileSync(file,'utf8');
  if(file.endsWith('.js')){
   new vm.Script(source,{filename:file});
   for(const m of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)){let target=path.resolve(path.dirname(file),m[1]);if(!target.endsWith('.js'))target+='.js';assert.ok(fs.existsSync(target),'Missing import: '+file);}
  }
  if(file.endsWith('.ejs')){
   ejs.compile(source,{filename:file});
   for(const m of source.matchAll(/include\(['"]([^'"]+)['"]/g)){let target=path.resolve(path.dirname(file),m[1]);if(!target.endsWith('.ejs'))target+='.ejs';assert.ok(fs.existsSync(target),'Missing include: '+file);}
   for(const m of source.matchAll(/<form\b/g)){
    const closing=source.indexOf('</form>',m.index);const form=source.slice(m.index,closing);
    if(/method="post"/i.test(form))assert.ok(form.includes('name="_csrf"'),'Missing CSRF in '+file);
   }
  }
 }
 const server=fs.readFileSync(path.join(root,'src/server.js'),'utf8');assert.ok(!server.includes('ejecutarMigracionModulo4'));
});

test('Company application inbox: empty/drafts return 200; unauthorized explicit offer remains 404',async()=>{
 for(const scenario of ['empty','drafts','published']){
  const queries=[];
  const offer={id:11,empresaId:1,empresaNombre:'Empresa de prueba',titulo:'Vacante de prueba',estado:scenario==='drafts'?'borrador':'publicada',habilidades:[]};
  const pool={async query(sql,values=[]){queries.push(sql);
   if(sql.includes('FROM sesiones_auth s'))return {rows:[{id:100,rol:'empresa',empresaId:1,nombre:'Empresa de prueba',empresaNombre:'Empresa de prueba',activo:true,empresaAprobacion:'aprobada'}]};
   if(sql.includes('to_regclass'))return {rows:[{propiedad:null}]};
   if(sql.includes('FROM empresas')&&sql.includes('id_empresa = $1'))return {rows:[{id:1,nombre:'Empresa de prueba',estado:'activa'}]};
   if(sql.includes('FROM vacantes v')){
    if(sql.includes('v.id_vacante = $1'))return {rows:scenario!=='empty'&&Number(values[0])===11?[offer]:[]};
    if(sql.includes('ORDER BY v.fecha_publicacion'))return {rows:scenario==='empty'?[]:[offer]};
   }
   return {rows:[]};
  }};
  const app=harness(pool).load('src/app.js');const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
  const headers={cookie:'talentohub_sid='+'e'.repeat(64)};
  try{
   const response=await fetch(base+'/empresarial/postulaciones',{headers});assert.equal(response.status,200,scenario);const html=await response.text();
   assert.equal((html.match(/data-site-navigation/g)||[]).length,1);
   if(scenario==='published')assert.ok(html.includes('id="form-masivo"'));
   else {assert.ok(html.includes('href="/empresarial/publicar"'));assert.ok(html.includes('href="/empresarial/vacantes"'));assert.ok(!html.includes('src="/js/postulaciones.js"'));assert.ok(!html.includes('id="form-masivo"'));}
   assert.equal((await fetch(base+'/empresarial/postulaciones?vacante=22',{headers})).status,404);
   assert.equal((await fetch(base+'/empresarial/postulaciones?vacante=11',{headers})).status,scenario==='published'?200:404);
   assert.ok(queries.every(sql=>!/^\s*(INSERT|UPDATE|DELETE|ALTER|CREATE)/i.test(sql)));
  }finally{await new Promise(r=>server.close(r));}
 }
});
