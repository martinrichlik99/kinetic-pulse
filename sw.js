// Kinetic Pulse – Service Worker
// Version hochzählen wenn sich Dateien ändern → erzwingt Cache-Update
const CACHE_NAME = 'kinetic-pulse-v1';

// Dateien die offline gecacht werden
const ASSETS = [
  '/index.html',
  '/manifest.json',
  '/sw.js'
];

// Installation: Dateien cachen
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
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

// Fetch: Cache-first für eigene Dateien, Network-first für externe (CDN, Fonts)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Externe Ressourcen (Tailwind CDN, Google Fonts etc.) → immer online holen
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Eigene Dateien → Cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Erfolgreiche Antworten im Cache speichern
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
