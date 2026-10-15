/* Spinach OS push service worker — N4.24.
 * Receives gate-event pushes (new approval, stuck stage, @founder mention)
 * and shows a notification. Click opens/focuses the deep link.
 * Payload contract: { title, body, link }.
 */

self.addEventListener('push', (event) => {
  let data = { title: 'Spinach OS', body: 'Something needs you.', link: '/approvals' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* keep defaults on malformed payloads */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      tag: 'spinach-gate', // collapse repeat buzzes into one
      data: { link: data.link || '/approvals' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/approvals';
  const url = new URL(link, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin)) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
