/* Minimal service worker: cache core static assets for offline install.
   Feature 19: bump CACHE version to force a new SW install + update prompt. */
const CACHE = 'nexus-bdix-v2';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './all_servers.txt',
    './manifest.json',
    './icon.svg'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE).then(function (cache) {
            return cache.addAll(ASSETS);
        }).then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) {
                if (k !== CACHE) return caches.delete(k);
            }));
        }).then(function () { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function (event) {
    const req = event.request;
    if (req.method !== 'GET') return;
    event.respondWith(
        caches.match(req).then(function (cached) {
            if (cached) return cached;
            return fetch(req).then(function (resp) {
                if (resp && resp.status === 200 && resp.type === 'basic') {
                    const copy = resp.clone();
                    caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
                }
                return resp;
            }).catch(function () { return cached; });
        })
    );
});
