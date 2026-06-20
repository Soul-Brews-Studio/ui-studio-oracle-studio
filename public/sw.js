// Fleet Town service worker — PWA install + Web Push display.
// Kept tiny: no offline caching (the town is a live mirror, always needs network);
// a pass-through fetch handler is present only so the app is installable.
/* eslint-disable no-restricted-globals */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Installability only — don't intercept/transform live data requests.
self.addEventListener('fetch', () => {});

// A push arrived from the fleet-server → show a notification.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  const title = d.title || 'Fleet Town';
  const options = {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || 'fleet',           // same tag collapses repeats
    renotify: !!d.renotify,
    data: { url: d.url || '/town' },
    requireInteraction: !!d.sticky,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking a notification focuses an open town tab, or opens one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/town';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('/town') && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
