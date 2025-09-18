/* Service Worker v1.2.3 */
const APP_VERSION = '1.2.3';
const CACHE_NAME = 'app-shell-v' + APP_VERSION;
const APP_SHELL = [
  '/', '/index.html', '/manifest.json?v=1.2.3',
  '/assets/css/styles.css?v=1.2.3',
  '/assets/js/app.js?v=1.2.3','/assets/js/db.js?v=1.2.3','/assets/js/scanner.js?v=1.2.3','/assets/js/labels.js?v=1.2.3','/assets/js/reports.js?v=1.2.3','/assets/js/tests.js?v=1.2.3',
  '/assets/lib/dexie.min.js','/assets/lib/html5-qrcode.min.js','/assets/lib/JsBarcode.all.min.js','/assets/lib/qrcode.min.js',
  '/print/label-templates.html','/sample-data/sample.csv'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({type:'SW_ACTIVATED', version: APP_VERSION}));
  })());
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (APP_SHELL.includes(url.pathname) || APP_SHELL.some(p => url.pathname + url.search === p)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      try {
        const fresh = await fetch(e.request);
        const cache = await caches.open('runtime-v'+APP_VERSION); cache.put(e.request, fresh.clone());
        return fresh;
      } catch { return caches.match('/index.html'); }
    })());
  }
});
