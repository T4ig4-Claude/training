/* Service Worker: speichert die App-Dateien auf dem Handy,
   damit die App auch ohne Internet (z. B. im Gym-Keller) startet.

   So funktioniert es:
   - Die App startet immer sofort aus dem Speicher (schnell + offline).
   - Gleichzeitig wird im Hintergrund die neueste Version geladen.
   - Nach einem Update auf GitHub siehst du die neue Version also
     beim übernächsten Öffnen der App.
*/

const CACHE = 'trainings-tracker-v1';

const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const fromNetwork = fetch(event.request)
        .then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached);

      if (cached) {
        event.waitUntil(fromNetwork);   // im Hintergrund aktualisieren
        return cached;
      }
      return fromNetwork;
    })
  );
});
