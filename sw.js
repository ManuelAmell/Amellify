const CACHE = 'amellify-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/css/variables.css',
  '/src/css/base.css',
  '/src/css/layout.css',
  '/src/css/components.css',
  '/src/css/schedule.css',
  '/src/css/colors.css',
  '/src/css/glass.css',
  '/src/css/features.css',
  '/src/css/themes-extra.css',
  '/src/js/app.js',
  '/src/js/utils.js',
  '/src/js/features.js',
  '/src/js/ics.js',
  '/src/js/notifications.js',
  '/src/js/features-advanced.js',
  '/src/js/grid-dnd.js',
  '/src/js/api.js',
  '/src/js/auth-ui.js',
  '/vendor/socket.io.min.js',
  '/favicon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/') || e.request.url.includes('/socket.io')) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
