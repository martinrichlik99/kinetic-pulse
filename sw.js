// Kinetic Pulse – Service Worker
// Version hochzählen wenn sich Dateien ändern → erzwingt Cache-Update
const CACHE_NAME = 'kinetic-pulse-v5';

// Alle Pfade RELATIV — damit der Worker in jedem Unterordner funktioniert.
// (v1 cachte '/index.html' in der Server-Wurzel. Die gibt es nicht, addAll schlug
//  fehl, die Installation brach ab → der Offline-Cache hat nie funktioniert.)
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'assets/fonts.css',
  'assets/tailwind-base.css',
  'assets/html2canvas.min.js',
  'assets/fonts/Archivo-italic-100-900-latin-ext.woff2',
  'assets/fonts/Archivo-italic-100-900-latin.woff2',
  'assets/fonts/Archivo-normal-100-900-latin-ext.woff2',
  'assets/fonts/Archivo-normal-100-900-latin.woff2',
  'assets/fonts/JetBrainsMono-normal-600-latin-ext.woff2',
  'assets/fonts/JetBrainsMono-normal-600-latin.woff2',
  'assets/fonts/MaterialSymbolsOutlined-normal-100-700-latin.woff2'
];

// Installation: jede Datei einzeln cachen. Ein Fehlschlag darf nicht die
// komplette Installation kippen — sonst steht die App wieder ohne Cache da.
// cache:'reload' ist Pflicht: sonst holt der Worker die Dateien aus dem
// HTTP-Cache des Browsers und friert eine veraltete Version für offline ein.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(ASSETS.map(a =>
        cache.add(new Request(a, { cache: 'reload' })).catch(() => {})
      ))
    )
  );
  self.skipWaiting();
});

// Aktivierung: Alte Caches löschen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // HTML network-first: sonst bleibt eine einmal gecachte index.html für immer
  // hängen und Updates kommen am Handy nie an.
  const istSeite = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (istSeite) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
    );
    return;
  }

  // Alles andere (Fonts, CSS, JS, Icons) cache-first — ändert sich nur mit neuer Version.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
