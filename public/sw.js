/* CIFRA service worker: receives Web Push and shows the notification, also when the app is closed (iPhone home-screen app, 16.4+). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'CIFRA', body: event.data ? event.data.text() : '' }; }
  event.waitUntil((async () => {
    // Safari requires every push to show a notification, even when the app is open.
    await self.registration.showNotification(d.title || 'CIFRA', {
      body: d.body || '', icon: d.icon || '/icon-192.png', badge: '/icon-192.png', tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || '/' },
    });
    // icon badge = notifications still waiting in the notification centre
    try { const n = (await self.registration.getNotifications()).length; if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(n); } catch (e) { /* badges are optional */ }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) { await w.focus(); w.postMessage({ type: 'cifra-open', url }); return; }
    }
    await self.clients.openWindow(url);
  })());
});
