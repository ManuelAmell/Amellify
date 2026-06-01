const CACHE = 'amellify-v4';
const API_CACHE = 'amellify-api-v1';
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
  '/src/js/productivity.js',
  '/src/js/ics.js',
  '/src/js/notifications.js',
  '/src/js/features-advanced.js',
  '/src/js/grid-dnd.js',
  '/src/js/api.js',
  '/src/js/auth-ui.js',
  '/vendor/socket.io.min.js',
  '/favicon.svg',
];

const API_CACHE_PATHS = ['/api/courses', '/api/tasks', '/api/exams', '/api/stats'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== API_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function shouldCacheApi(url) {
  return API_CACHE_PATHS.some((p) => url.pathname === p || url.pathname.endsWith(p));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.pathname.startsWith('/api/') && shouldCacheApi(url)) {
    e.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        const networkFetch = fetch(e.request)
          .then((res) => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  if (url.pathname.startsWith('/api/') || url.pathname.includes('/socket.io')) return;

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});

self.addEventListener('push', (e) => {
  let data = { title: 'Amellify', body: 'Recordatorio' };
  try {
    data = e.data?.json() || data;
  } catch {
    data.body = e.data?.text() || data.body;
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Amellify', {
      body: data.body || '',
      icon: '/favicon.svg',
      tag: data.tag || 'amellify-push',
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});
