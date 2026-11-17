// Optional: node pruebas/navigation.browser.prueba.js [absolute Chrome/Edge executable]
// Local HTML fixtures only. No app, environment file, network service or PostgreSQL.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict'),ejs=require('ejs');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const executable=process.argv[2]||'C:/Program Files/Google/Chrome/Application/chrome.exe';
 if(!fs.existsSync(executable))throw Error('Provide a Chrome/Edge executable path.');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'talentohub-security-nav-'));
 const css=['design-system','navigation','recursos','empresarial','administrativo','foros'].map(n=>fs.readFileSync(path.join(root,'src/public/css',n+'.css'),'utf8')).join('\n');
 const script=fs.readFileSync(path.join(root,'src/public/js/navigation.js'),'utf8');
 const template=fs.readFileSync(path.join(root,'src/views/partials/navigation.ejs'),'utf8');
 for(const role of ['visitante','candidato','empresa','admin']){
  const html=ejs.render(template,{activo:role==='admin'?'admin':role==='empresa'?'empresa':role==='candidato'?'candidato':'inicio',usuarioActual:role==='visitante'?null:{rol:role,nombreMostrar:'Nombre para comprobar el navbar',rolEtiqueta:role},csrfToken:'fixture-csrf'}).replace(/<script[^>]*><\/script>/g,'');
  fs.writeFileSync(path.join(dir,role+'.html'),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body>'+html+'<script>'+script+'</script></body></html>');
 }
 const child=cp.spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+path.join(dir,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});let socket;
 try{
  const endpoint=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error('Browser startup timeout')),10000);child.stderr.on('data',d=>{log+=d;const m=log.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.on('error',reject);});
  const targets=await (await fetch('http://'+new URL(endpoint).host+'/json/list')).json();socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});let id=0;const pending=new Map();
  socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject,timer:setTimeout(()=>reject(Error('Timeout '+method)),5000)});socket.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
  let checks=0;const check=(condition,message)=>{assert.ok(condition,message);checks++;};
  for(const role of ['visitante','candidato','empresa','admin'])for(const width of [320,375,768,1199,1200,1440]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
   await send('Page.navigate',{url:'file:///'+path.join(dir,role+'.html').replace(/\\/g,'/')+'?w='+width});
   for(let n=0;n<30;n++){if(await evaluate('!!document.querySelector("[data-enhanced]")'))break;await new Promise(r=>setTimeout(r,50));}
   const state=await evaluate('(()=>{const n=document.querySelector(".th-site-nav"),p=n.querySelector(".th-site-nav__panel"),b=n.querySelector(".th-site-nav__toggle"),f=n.querySelector("form");return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,padding:getComputedStyle(n).padding,panel:getComputedStyle(p).display,toggle:getComputedStyle(b).display,count:document.querySelectorAll("[data-site-navigation]").length,current:n.querySelectorAll("[aria-current=page]").length,logout:f?{method:f.method,action:f.getAttribute("action"),token:f.querySelector("[name=_csrf]").value}:null}})()');
   check(state.width===width&&!state.overflow,role+' '+width+' width/overflow');check(state.count===1&&state.current===1,'Single navbar/current');check(state.padding==='0px','Isolated CSS');
   if(role!=='visitante')check(state.logout.method==='post'&&state.logout.action==='/auth/logout'&&state.logout.token==='fixture-csrf','Protected logout');
   if(width<1200){check(state.panel==='none'&&state.toggle!=='none','Mobile closed');await evaluate('document.querySelector(".th-site-nav__toggle").click()');check(await evaluate('getComputedStyle(document.querySelector(".th-site-nav__panel")).display!=="none" && document.documentElement.scrollWidth<=innerWidth'),'Mobile opened');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});check(await evaluate('document.activeElement===document.querySelector(".th-site-nav__toggle") && document.activeElement.getAttribute("aria-expanded")==="false"'),'Escape/focus');}
   else check(state.panel!=='none'&&state.toggle==='none','Desktop');
  }
  await send('Emulation.setEmulatedMedia',{media:'print'});check(await evaluate('getComputedStyle(document.querySelector(".th-site-nav")).display==="none"'),'Print');
  console.log(checks+' browser checks passed; 4 roles, 6 widths (320-1440px), POST logout, mobile and print.');await send('Browser.close');
 }finally{if(socket)socket.close();child.kill();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
