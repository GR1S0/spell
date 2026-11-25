// Spell: il guscio dell'app resta disponibile offline; i pensieri li tiene data.js (IndexedDB).
const C = 'spell-v9';
const SHELL = ['./', 'index.html', 'icon-192.png', 'favicon-32.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
// "Condividi" da un'altra app (il registratore): il file arriva qui, va in IndexedDB e l'app lo importa all'apertura (data.js)
const idb = () => new Promise((res, rej) => {
  const r = indexedDB.open('spell', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function condiviso(req) {
  let n = 0;
  try {
    const fd = await req.formData(), files = fd.getAll('audio').filter(f => f && f.size);
    // testo condiviso (la trascrizione del registratore): solo se non c'è un file, o se è lungo (non la frase "condiviso da…")
    const testo = String(fd.get('text') || '').trim(), titolo = String(fd.get('title') || '').trim();
    const voci = files.map(f => ({file: f, nome: f.name || '', tipo: f.type || '', quando: f.lastModified || Date.now()}));
    if (testo && (!files.length || testo.length >= 200)) voci.push({testo, nome: titolo, quando: Date.now()});
    const db = await idb();
    await new Promise((res, rej) => {
      const t = db.transaction('kv', 'readwrite'), kv = t.objectStore('kv');
      for (const v of voci) kv.put(v, 'condiviso:' + Date.now() + '-' + (n++) + '-' + Math.random().toString(36).slice(2, 6));
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  } catch (e) { n = -1; }
  return Response.redirect(new URL('./?condiviso=' + n, self.registration.scope).href, 303);
}
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method === 'POST' && u.origin === location.origin && u.pathname.endsWith('/condividi')) return e.respondWith(condiviso(e.request));
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('accesso.json')) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
