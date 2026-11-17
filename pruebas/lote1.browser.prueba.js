// Local EJS fixtures only. No app, .env, pg or PostgreSQL.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),ejs=require('ejs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function fixtures(){
 const vacante={id:101,empresaId:10,titulo:'Desarrollador Frontend',empresa:'Estudio Horizonte',logoEmpresa:null,sector:'Tecnologia',ubicacion:'San Salvador',modalidad:'Hibrido',tipoContrato:'Tiempo completo',experiencia:'1-3 anos',salarioMinimo:1200,salarioMaximo:1800,fechaPublicacion:'2026-11-10T12:00:00Z',descripcion:'Construye experiencias digitales accesibles y colabora con un equipo que comparte conocimiento. Buscamos una persona curiosa, con criterio visual y ganas de crecer.',responsabilidades:['Crear interfaces claras y accesibles.','Colaborar con diseno y producto.','Mantener componentes reutilizables.'],requisitos:['JavaScript y HTML semantico','CSS responsive y Git','Comunicacion y trabajo en equipo'],beneficios:['Formacion continua','Horario flexible','Trabajo hibrido'],reclutador:'Equipo de Talento',contacto:'equipo@example.test'};
 const vacantes=[vacante,{...vacante,id:102,titulo:'Analista de datos',empresa:'Nexo Digital',sector:'Finanzas',modalidad:'Remoto'},{...vacante,id:103,titulo:'Disenador de producto',empresa:'Colectivo Prisma',sector:'Diseno',modalidad:'Presencial'}];
 const cover=(color,label)=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="480"><rect width="900" height="480" fill="'+color+'"/><circle cx="740" cy="110" r="200" fill="white" opacity=".09"/><circle cx="170" cy="400" r="220" fill="white" opacity=".06"/><path d="M120 140h180v150H120zM150 170h120M150 200h80M150 230h100" fill="none" stroke="white" stroke-width="8" opacity=".7"/><text x="350" y="240" font-family="Arial" font-size="42" fill="white">'+label+'</text></svg>');
 const recurso={id:201,idCategoria:1,titulo:'Un CV que abre nuevas puertas',resumen:'Aprende a contar tu experiencia con claridad y prepara tu siguiente paso profesional.',tipo:'articulo',categoria:'Desarrollo profesional',autor:'Equipo TalentoHub',tiempoLectura:8,fechaPublicacion:'2026-11-10T12:00:00Z',destacado:true,imagenUrl:cover('#273e80','Tu siguiente paso'),archivoUrl:'https://example.test/material',secciones:[{id:1,titulo:'Empieza por lo que te hace diferente',contenido:'Tu experiencia tiene una historia. Presenta las habilidades y resultados que ayudan a entender tu aporte. Un resumen claro conecta tu recorrido con la oportunidad que buscas.'},{id:2,titulo:'Resultados que se pueden entender',contenido:'Utiliza ejemplos concretos y lenguaje sencillo. Explica el problema, tu contribucion y el resultado. Revisa que tus datos de contacto esten actualizados.'},{id:3,titulo:'Prepara tu siguiente conversacion',contenido:'Adapta tu perfil a cada oportunidad sin perder tu voz. Guarda una copia accesible y pide a otra persona que revise la claridad de tu documento.'}]};
 const recursos=[recurso,{...recurso,id:202,titulo:'Prepara tu proxima entrevista',tipo:'tutorial',destacado:false,imagenUrl:cover('#563b8c','Comparte tu talento')},{...recurso,id:203,titulo:'Habilidades para un mundo digital',tipo:'video',destacado:false,imagenUrl:cover('#24475c','Aprende y crece')}];
 const filtros={q:'',ubicacion:'',orden:'recientes',experiencia:'',sector:'',modalidad:'',tipoContrato:'',salarioMinimo:'',salarioMaximo:'',fechaPublicacion:'',categoria:'',tipo:'',fecha:''};
 const base={titulo:'TalentoHub',csrfToken:'fixture-csrf',usuarioActual:null,mensaje:null,error:null};
 return [
  {name:'inicio',view:'general/inicio',data:{...base,totalVacantes:24,vacantes,recursos}},
  {name:'busqueda',view:'busqueda/index',data:{...base,filtros,vacantes,totalResultados:24,paginaActual:1,totalPaginas:3}},
  {name:'empleo',view:'busqueda/detalle',data:{...base,vacante,vacantesSimilares:vacantes.slice(1),postulacionActual:null,usuarioActual:{id:1,rol:'candidato',candidatoId:1,nombreMostrar:'Andrea',rolEtiqueta:'Aplicante',rutaPanel:'/candidato'}}},
  {name:'recursos',view:'recursos/index',data:{...base,filtros,recursos,categorias:[{id:1,nombre:'Desarrollo profesional'},{id:2,nombre:'Habilidades digitales'}],totalResultados:18,paginaActual:1,totalPaginas:2}},
  {name:'articulo',view:'recursos/detalle',data:{...base,recurso,recursosRelacionados:recursos.slice(1)}}
 ];
}
function renderFixture(fixture){
 const filename=path.join(root,'src/views',fixture.view+'.ejs');
 return ejs.render(fs.readFileSync(filename,'utf8'),fixture.data,{filename}).replace(/(href|src)="(\/(?:css|js)\/[^"<>]+)"/g,(_,attribute,file)=>attribute+'="file:///'+path.join(root,'src/public',file).replace(/\\/g,'/')+'"');
}
async function main(){
 const stage=process.argv.find(a=>a.startsWith('--etapa='))?.slice(8)||'despues';assert.ok(['antes','despues'].includes(stage));
 const executable='C:/Program Files/Google/Chrome/Application/chrome.exe';
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'talentohub-lote1-'));
 const output=path.join(root,'docs/capturas-fase4-lote1',stage);fs.mkdirSync(output,{recursive:true});
 const pages=fixtures();
 if(stage==='despues')for(const name of ['inicio','busqueda','recursos','articulo']){
  const f=pages.find(p=>p.name===name);
  pages.push({...f,name:name+'-vacio',empty:true,data:{...f.data,vacantes:[],recursos:[],totalVacantes:0,totalResultados:0,totalPaginas:1,recursosRelacionados:[],recurso:f.data.recurso?{...f.data.recurso,secciones:[]}:undefined}});
 }
 for(const f of pages)fs.writeFileSync(path.join(temp,f.name+'.html'),renderFixture(f));
 const child=cp.spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--allow-file-access-from-files','--remote-debugging-port=0','--user-data-dir='+path.join(temp,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});let socket;
 try{
 const endpoint=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Chrome timeout')),10000);child.stderr.on('data',d=>{text+=d;const m=text.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.on('error',reject);});
 const targets=await (await fetch('http://'+new URL(endpoint).host+'/json/list')).json();socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 let id=0;const pending=new Map();socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject,timer:setTimeout(()=>reject(Error('Timeout '+method)),8000)});socket.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await send('Network.enable');await send('Network.setBlockedURLs',{urls:['http://*','https://*']});await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const results=[];
 for(const f of pages)for(const width of [320,390,768,1024,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'file:///'+path.join(temp,f.name+'.html').replace(/\\/g,'/')+'?width='+width});
  for(let n=0;n<50;n++){if(await evaluate('document.readyState==="complete" && !!document.querySelector("[data-enhanced]")'))break;await new Promise(r=>setTimeout(r,40));}
  await evaluate('document.fonts.ready');await evaluate('Promise.all([...document.images].map(image=>{image.loading="eager";return image.decode().catch(()=>{});} ))');await new Promise(r=>setTimeout(r,50));
  const data=await evaluate('(()=>{const controls=[...document.querySelectorAll("main input:not([type=hidden]),main select,main textarea")];const visible=e=>!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length);return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,navbar:document.querySelectorAll("[data-site-navigation]").length,h1:document.querySelectorAll("main h1").length,forms:[...document.querySelectorAll("form")].map(f=>({method:f.method,action:f.getAttribute("action"),csrf:!!f.querySelector("[name=_csrf]"),names:[...f.elements].map(e=>e.name).filter(Boolean)})),unlabelled:controls.filter(e=>!e.labels?.length&&!e.getAttribute("aria-label")&&!e.getAttribute("aria-labelledby")).map(e=>e.name),outside:[...document.querySelectorAll("main input:not([type=hidden]),main select,main textarea,main button,main article")].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1||r.left< -1}).map(e=>e.className||e.tagName),cards:document.querySelectorAll(".vacante-card,.job-card,.recurso-card,.recurso-inicio-card").length}})()');
  data.page=f.name;results.push(data);
  if(stage==='despues'){
   const baseline=JSON.parse(fs.readFileSync(path.join(root,'docs/capturas-fase4-lote1/antes/resultados.json'),'utf8')).find(r=>r.page===f.name&&r.width===width);
   if(baseline)assert.deepEqual(data.forms,baseline.forms,f.name+' form contracts/CSRF');
   const contrast=await evaluate('(()=>{const rgb=s=>{const a=s.match(/[\\d.]+/g)?.map(Number);return a&&a.length>=3?a:null;};const luminance=a=>a.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const background=e=>{for(let node=e;node;node=node.parentElement){const style=getComputedStyle(node),color=rgb(style.backgroundColor);if(color&&(color.length===3||color[3]===1))return color;if(style.backgroundImage!=="none")return null;}return [255,255,255];};return [...document.querySelectorAll(".detalle-metadatos span,.job-description,.recurso-resumen,.vacante-modalidad,.job-sector,.detail-publication,.search-button,.details-button,.btn-aplicar")].map(e=>{const fg=rgb(getComputedStyle(e).color),bg=background(e);if(!fg||!bg)return null;const a=luminance(fg),b=luminance(bg);return {element:e.className,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};}).filter(Boolean);})()');
   assert.ok(contrast.every(c=>c.ratio>=4.5),f.name+' contrast '+JSON.stringify(contrast));data.contrast=contrast;
   const controls=await evaluate('([...document.querySelectorAll("main input:not([type=hidden]), main select, main textarea, main button")].filter(e=>e.getClientRects().length).map(e=>({name:e.name||e.className,height:e.getBoundingClientRect().height})))');
   assert.ok(controls.every(c=>c.height>=43),f.name+' touch targets '+JSON.stringify(controls));
   assert.ok(await evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'),'Reduced motion');
   if(width<1200){
    await evaluate('document.querySelector(".th-site-nav__toggle").click()');
    assert.ok(await evaluate('getComputedStyle(document.querySelector(".th-site-nav__panel")).display!=="none" && document.documentElement.scrollWidth<=innerWidth'),'Mobile menu');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
    assert.ok(await evaluate('document.activeElement===document.querySelector(".th-site-nav__toggle")'),'Escape restores focus');
    await evaluate('document.activeElement.blur()');
   }
   await evaluate('window.scrollTo(0,0); document.querySelector(".th-ui-skip").focus({preventScroll:true})');
   await new Promise(r=>setTimeout(r,80));
   assert.ok(await evaluate('document.activeElement.classList.contains("th-ui-skip") && document.activeElement.getBoundingClientRect().top>=0'),'Visible skip link '+JSON.stringify(await evaluate('({top:document.querySelector(".th-ui-skip").getBoundingClientRect().top,scroll:scrollY,active:document.activeElement.className,focus:document.querySelector(".th-ui-skip").matches(":focus"),transition:getComputedStyle(document.querySelector(".th-ui-skip")).transition,transform:getComputedStyle(document.querySelector(".th-ui-skip")).transform})')));
   await evaluate('document.activeElement.blur(); window.scrollTo(0,0)');
   if(f.name==='empleo'){
    const submitted=await evaluate('(()=>{const forms=[...document.querySelectorAll("main form[method=post]")];const results=[];for(const form of forms){form.addEventListener("submit",e=>{e.preventDefault();results.push({action:form.getAttribute("action"),csrf:new FormData(form).get("_csrf")});},{once:true});const reason=form.querySelector("[name=motivo]");if(reason)reason.value=reason.options[1].value;form.requestSubmit();}return results;})()');
    assert.equal(submitted.length,2);assert.ok(submitted.every(f=>f.csrf==='fixture-csrf'),'Submission CSRF preserved');
   }
  }
 assert.equal(data.navbar,1,f.name+' navbar');for(const form of data.forms)if(form.method==='post')assert.ok(form.csrf,f.name+' csrf');
  if(stage==='despues'){assert.ok(!data.overflow,f.name+' '+width+' horizontal overflow '+JSON.stringify(data.outside));assert.equal(data.outside.length,0,f.name+' controls outside viewport');assert.equal(data.unlabelled.length,0,f.name+' labels '+data.unlabelled);}
  if(!f.empty && [390,1440].includes(width)){
   const metrics=await send('Page.getLayoutMetrics');const height=Math.ceil(metrics.cssContentSize.height);
   const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});
   fs.writeFileSync(path.join(output,f.name+'-'+width+'.png'),Buffer.from(image.data,'base64'));
  }
 }
 fs.writeFileSync(path.join(output,'resultados.json'),JSON.stringify(results,null,2));
 console.log(stage+': '+results.length+' casos de paginas reales EJS, 10 capturas locales. '+results.filter(r=>r.overflow).length+' casos con overflow.');
 await send('Browser.close');
 }finally{if(socket)socket.close();child.kill();}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={fixtures,renderFixture};
