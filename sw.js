self.addEventListener('install', (event) => { self.skipWaiting(); });
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.includes('question-bank')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', () => {});
