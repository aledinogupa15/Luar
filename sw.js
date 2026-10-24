/* Service worker de Luar Mind: guarda la app para usarla sin internet. Sube VERSION cuando publiques cambios. */
const VERSION='luar-v9';
const CORE=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png','icons/favicon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION&&k!=='luar-data').map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(r.mode==='navigate'){ /* red primero para recibir actualizaciones; sin red, la copia guardada */
    e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(VERSION).then(c=>c.put('index.html',cp));return res}).catch(()=>caches.match('index.html')));return}
  if(u.origin===location.origin||/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){
    e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const cp=res.clone();caches.open(VERSION).then(c=>c.put(r,cp))}return res}).catch(()=>hit)))}
});

/* ---- notificaciones ---- */
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if('focus' in c)return c.focus()}return self.clients.openWindow('./')}))});
/* Aviso en segundo plano (si el navegador lo permite): lee los recordatorios que la app guardó y avisa los que ya tocan */
async function checkDue(){
  const c=await caches.open('luar-data');const r=await c.match('reminders.json');if(!r)return;
  const d=await r.json();if(!d.on)return;
  const now=new Date(),t=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  if(d.date!==t)return;
  const m=now.getHours()*60+now.getMinutes();if(d.quiet&&(m>=22*60+30||m<7*60))return;
  const hm=s=>{const p=(s||'').split(':');return (+p[0]||0)*60+(+p[1]||0)};
  const out=[];
  if(d.checkin&&!d.hasEntry&&m>=hm(d.checkin)&&m<hm(d.checkin)+120)out.push({k:'ci-'+t,tag:'luar-checkin',title:'Luar Mind',body:'¿Cómo te sientes hoy? Luar te espera un ratito.'+(d.streak>=2?' Tu racha es de '+d.streak+' días.':'')});
  (d.tasks||[]).forEach(x=>{const tm=hm(x.time);if(m>=tm&&m<tm+60)out.push({k:'tk-'+x.id+'-'+t,tag:'luar-task-'+x.id,title:x.tpl?'Autocuidado':'Recordatorio',body:x.text})});
  for(const n of out){if((d.sent||[]).includes(n.k))continue;d.sent=(d.sent||[]).concat(n.k);
    await self.registration.showNotification(n.title,{body:n.body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:n.tag,silent:false,vibrate:d.vib?[180,90,180]:undefined,data:{url:'./'}})}
  await c.put('reminders.json',new Response(JSON.stringify(d),{headers:{'content-type':'application/json'}}));
}
self.addEventListener('periodicsync',e=>{if(e.tag==='luar-reminders')e.waitUntil(checkDue())});
