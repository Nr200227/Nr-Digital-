/* NR Digital · Service worker (app instalable)
   - Las páginas se piden a internet primero (versión más nueva). Si la señal tarda más de 4 s,
     se muestra la copia guardada y la nueva se guarda para la próxima vez.
   - Firebase y las fuentes se guardan en el teléfono: no se vuelven a descargar en cada visita. */
const CACHE = 'nr-app-v2', LIBS = 'nr-libs-v1';
const BASICS = ['./', './index.html', './icon-192.png', './icon-512.png', './panel-icon-192.png', './panel-icon-512.png'];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(BASICS.map(u => c.add(u).catch(() => {})))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== LIBS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const save = (name, req, res) => { if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(name).then(c => c.put(req, cp)); } return res; };
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
    const net = fetch(r).then(res => save(CACHE, r, res));
    const old = () => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('./index.html'));
    e.respondWith(new Promise(resolve => {
      let done = false;
      const t = setTimeout(() => old().then(m => { if (m && !done) { done = true; resolve(m); } }), 4000);
      net.then(res => { if (!done) { done = true; clearTimeout(t); resolve(res); } })
         .catch(() => old().then(m => { if (!done) { done = true; clearTimeout(t); resolve(m || Response.error()); } }));
    }));
    return;
  }
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => save(CACHE, r, res))));
});
