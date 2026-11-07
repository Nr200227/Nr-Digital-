/* NR Digital · Service worker (app instalable)
   - Las páginas se piden a internet primero (versión más nueva). Si la señal tarda más de 4 s,
     se muestra la copia guardada y la nueva se guarda para la próxima vez.
   - Íconos y demás archivos: se muestra la copia guardada al instante y se actualiza por detrás,
     así un ícono nuevo llega solo en la siguiente visita (ya no hay que cambiar la versión).
   - Firebase y las fuentes se guardan en el teléfono: no se vuelven a descargar en cada visita. */
const CACHE = 'nr-app-v3', LIBS = 'nr-libs-v1';
const BASICS = ['./', './index.html', './icon-192.png', './icon-512.png', './panel-icon-192.png', './panel-icon-512.png'];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(BASICS.map(u => c.add(u).catch(() => {})))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== LIBS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const save = (name, req, res) => { if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(name).then(c => c.put(req, cp)); } return res; };
// Página sencilla para cuando no hay internet y esa página nunca se guardó
const OFFLINE = () => new Response(
  '<!DOCTYPE html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title>'
  + '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050A16;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px">'
  + '<div><p style="font-size:48px;margin:0">📡</p><h1 style="font-size:20px">Sin conexión</h1><p style="color:#9aa3b2">Revisa tu internet y vuelve a intentarlo.</p>'
  + '<button onclick="location.reload()" style="margin-top:12px;padding:12px 22px;border:0;border-radius:12px;background:#0066FF;color:#fff;font-weight:600">Reintentar</button></div></body></html>',
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // Librerías con versión fija (Firebase) y fuentes: del teléfono primero
  if ((u.host === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/')) || u.host === 'fonts.gstatic.com' || u.host === 'fonts.googleapis.com') {
    e.respondWith(caches.open(LIBS).then(c => c.match(r)).then(m => m || fetch(r).then(res => save(LIBS, r, res))));
    return;
  }
  if (u.origin !== self.location.origin) return;
  if (r.mode === 'navigate' || r.destination === 'document') {
    // Solo la tienda usa index.html como respaldo; el panel (u otra página) nunca muestra la tienda por error
    const isStore = /\/(index\.html)?$/.test(u.pathname);
    const net = fetch(r).then(res => save(CACHE, r, res));
    const old = () => caches.match(r, { ignoreSearch: true }).then(m => m || (isStore ? caches.match('./index.html') : null));
    e.respondWith(new Promise(resolve => {
      let done = false;
      const t = setTimeout(() => old().then(m => { if (m && !done) { done = true; resolve(m); } }), 4000);
      net.then(res => { if (!done) { done = true; clearTimeout(t); resolve(res); } })
         .catch(() => old().then(m => { if (!done) { done = true; clearTimeout(t); resolve(m || OFFLINE()); } }));
    }));
    return;
  }
  // Archivos con "?v=..." (siempre distintos) van directo a internet y no llenan la memoria del teléfono
  if (u.search) return;
  // Resto (íconos, imágenes, manifiesto): copia guardada al instante + actualización por detrás
  e.respondWith(caches.open(CACHE).then(c => c.match(r).then(m => {
    const fresh = fetch(r).then(res => save(CACHE, r, res)).catch(() => m);
    if (m) { e.waitUntil(fresh.catch(() => {})); return m; }
    return fresh.then(res => res || Response.error());
  })));
});
