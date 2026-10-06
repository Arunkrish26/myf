self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const reminders = clients.find(client => client.url.includes('reminders.html'));
    const target = reminders || clients.find(client => 'focus' in client);
    if (target) return target.focus();
    return self.clients.openWindow('reminders.html');
  }));
});
