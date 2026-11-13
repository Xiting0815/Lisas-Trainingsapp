// Service Worker – Offline-Betrieb für „Lisas Trainings-App“.
// Nur relative URLs: die App liegt unter /Lisas-Trainingsapp/ (GitHub Pages), alles wird gegen den SW-Scope aufgelöst.
//
// Strategie
//   - install: die komplette App (PRECACHE, generiert) in einen versionierten Cache legen.
//   - Navigationen + App-Shell + data/*.json: Cache zuerst, Netz als Rückfall (Code und Inhalte kommen immer aus EINER Version).
//   - activate: Caches älterer Versionen löschen, Clients übernehmen.
//   - Updates: Der neue Worker wartet; die Seite zeigt „Es gibt eine neue Version“ (nie während eines Trainings) und
//     schickt {type: 'SKIP_WAITING'}, wenn Lisa „Neu laden“ tippt.
//
// CACHE_VERSION und PRECACHE schreibt `node tools/gen-precache.mjs` neu (Inhalts-Hash). Nach jeder Änderung an
// App-Dateien ausführen; `--check` prüft, ob alles aktuell ist.

// <precache-version>
const CACHE_VERSION = 'c250dbea0b';
// </precache-version>
const CACHE_PREFIX = 'lisa-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// <precache>
const PRECACHE = [
  'css/base.css',
  'css/components.css',
  'css/tokens.css',
  'data/exercises.json',
  'data/figure-overrides.json',
  'data/poses.json',
  'data/quotes.json',
  'data/routines.json',
  'data/tips.json',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/icon-maskable.svg',
  'icons/icon.svg',
  'index.html',
  'js/app.js',
  'js/components/celebrate.js',
  'js/components/charts.js',
  'js/components/pt-figure.js',
  'js/components/pt-pain-scale.js',
  'js/components/pt-timer.js',
  'js/content.js',
  'js/logic/compose.js',
  'js/logic/cues.js',
  'js/logic/duration.js',
  'js/logic/exercise-text.js',
  'js/logic/levels.js',
  'js/logic/reminders.js',
  'js/logic/tips.js',
  'js/logic/traffic.js',
  'js/logic/week.js',
  'js/render.js',
  'js/router.js',
  'js/store.js',
  'js/types.js',
  'js/util/audio.js',
  'js/util/date.js',
  'js/util/export-import.js',
  'js/util/voice.js',
  'js/views/history.js',
  'js/views/info.js',
  'js/views/install.js',
  'js/views/session-helpers.js',
  'js/views/session.js',
  'js/views/settings.js',
  'js/views/summary.js',
  'js/views/today.js',
  'js/views/ui.js',
  'manifest.webmanifest',
];
// </precache>

const scopeUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE.map((p) => new Request(scopeUrl(p), { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  else if (type === 'GET_VERSION' && event.ports && event.ports[0]) event.ports[0].postMessage(CACHE_VERSION);
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(appShell(req));
    return;
  }
  // data/*.json is precached → cacheFirst like the app shell (no version skew between JS and content)
  event.respondWith(cacheFirst(req));
});

async function appShell(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(scopeUrl('index.html'));
  if (cached) return cached;
  try {
    return await fetch(req);
  } catch {
    return new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><p>Offline – bitte öffne die App einmal mit Internet.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req) || await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}
