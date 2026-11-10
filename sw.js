/* Offline-first service worker. Everything in ASSETS is cached on install. */
importScripts('js/version.js');

const CACHE = 'ielts-' + self.APP_VERSION;
const ASSETS = [
  './', 'index.html', 'manifest.json', 'css/styles.css',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/version.js', 'js/app.js', 'js/ui.js', 'js/store.js', 'js/data.js', 'js/questions.js',
  'js/lessons.js', 'js/review.js', 'js/writing.js', 'js/api.js', 'js/charts.js',
  'js/reading.js', 'js/progress.js', 'js/settings.js',
  'data/lessons.json', 'data/reading.json', 'data/writing.json',
  'data/drills/1.json', 'data/drills/2.json', 'data/drills/3.json', 'data/drills/4.json',
  'data/drills/5.json', 'data/drills/6.json', 'data/drills/7.json', 'data/drills/8.json',
  'data/drills/9.json', 'data/drills/10.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ielts-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // Only same-origin GETs are served from cache. API calls to api.anthropic.com are never touched.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error());
    })
  );
});
