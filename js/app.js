// Bootstrap für „Lisas Trainings-App“.
//  - Crash-Handler werden VOR allen App-Modulen installiert (alle Imports sind dynamisch): ein kaputtes Modul oder
//    kaputte Daten zeigen die Fehlerkarte „Da ist etwas schiefgelaufen“ (mit Rohdaten-Export) statt eines weißen Bildschirms.
//  - Hinweise (Notices) über #pt-notices: Speichern fehlgeschlagen, beschädigte Daten, Änderung in anderem Fenster.
//  - Das Update-Toast des Service Workers erscheint nie während eines Trainings (body.is-session).

/** @type {typeof import('./store.js')|null} */
let storeMod = null;
let booted = false;

const KEY_PREFIX = 'lisa.';
const THEME_COLORS = { light: '#FBF5F0', dark: '#1C121A' };

// ---- kleine DOM-Helfer ---------------------------------------------------------------------------

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Datei herunterladen. */
function downloadText(text, filename, type = 'application/json') {
  try {
    const blob = new Blob([text ?? ''], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (e) { console.error('Download fehlgeschlagen', e); }
}

/** Rohdaten aus dem Browser-Speicher – funktioniert auch, wenn das Store-Modul nicht geladen werden konnte (nur lesen). */
function rawDump() {
  try {
    const snap = storeMod?.rawSnapshot?.();
    if (snap && typeof snap === 'object') return snap;
  } catch { /* weiter */ }
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) out[k] = localStorage.getItem(k);
    }
  } catch { /* gesperrt */ }
  return out;
}

/** Rohdaten sichern: `lisa.v1` unverändert (wenn gültiges JSON), sonst alle lisa.*-Schlüssel in einer Datei. */
function downloadRawData() {
  const dump = rawDump();
  const main = typeof dump['lisa.v1'] === 'string' ? dump['lisa.v1'] : null;
  let valid = false;
  try { valid = !!main && typeof JSON.parse(main) === 'object'; } catch { valid = false; }
  const others = Object.keys(dump).filter((k) => k !== 'lisa.v1' && dump[k] != null);
  if (valid && !others.length) downloadText(main, `lisa-rohdaten-${stamp()}.json`);
  else downloadText(JSON.stringify({ note: 'Rohdaten aus dem Browser-Speicher (localStorage)', exportedAt: new Date().toISOString(), keys: dump }, null, 2), `lisa-rohdaten-${stamp()}.json`);
}

async function exportBackup() {
  try {
    const m = await import('./views/ui.js');
    await m.exportBackup(storeMod);
  } catch (e) {
    console.error(e);
    downloadRawData();
  }
}

// ---- Hinweise ----------------------------------------------------------------------------------

function noticeHost() {
  let host = document.getElementById('pt-notices');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'pt-notices';
  host.className = 'notices';
  host.setAttribute('role', 'region');
  host.setAttribute('aria-label', 'Hinweise');
  const app = document.getElementById('app');
  if (app?.parentNode) app.parentNode.insertBefore(host, app);
  else document.body.prepend(host);
  return host;
}

/**
 * Hinweis-Karte zeigen (gleiche id → nicht doppelt).
 * @param {string} id
 * @param {{tone?: 'error'|'warn'|'info', title?: string, text: string, actions?: {label: string, onClick?: () => void, href?: string, primary?: boolean, close?: boolean}[], onClose?: () => void, closeLabel?: string|null}} o
 */
function showNotice(id, { tone = 'warn', title = '', text, actions = [], onClose, closeLabel = 'Schließen' }) {
  const host = noticeHost();
  const existing = host.querySelector(`[data-notice="${id}"]`);
  if (existing) return existing;
  const el = document.createElement('div');
  el.className = `notice notice--${tone}`;
  el.dataset.notice = id;
  el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  const btns = actions.map((a, i) => (a.href
    ? `<a class="btn${a.primary ? ' btn--primary' : ''}" href="${esc(a.href)}" data-i="${i}">${esc(a.label)}</a>`
    : `<button type="button" class="btn${a.primary ? ' btn--primary' : ''}" data-i="${i}">${esc(a.label)}</button>`)).join('');
  el.innerHTML = `${title ? `<h2 class="notice__title">${esc(title)}</h2>` : ''}<p class="notice__text">${esc(text)}</p>`
    + `<div class="notice__actions">${btns}${closeLabel ? `<button type="button" class="btn btn--ghost" data-close>${esc(closeLabel)}</button>` : ''}</div>`;
  const close = () => { el.remove(); try { onClose?.(); } catch (e) { console.error(e); } };
  el.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target).closest?.('[data-i],[data-close]');
    if (!t) return;
    if (t.hasAttribute('data-close')) { close(); return; }
    const a = actions[Number(t.getAttribute('data-i'))];
    if (!a) return;
    if (a.onClick) { e.preventDefault(); a.onClick(); }
    if (a.close) close();
  });
  host.appendChild(el);
  return el;
}

const removeNotice = (id) => document.querySelector(`#pt-notices [data-notice="${id}"]`)?.remove();

// ---- Fehlerkarte (Fallback ohne CSS-Abhängigkeit) -------------------------------------------------

const fatalCardHtml = (msg) => `<div role="alert" data-fatal style="margin:16px;padding:20px;border-radius:24px;border:2px solid #A61E4D;background:#fff;color:#2B1F27;font-family:system-ui,sans-serif;font-size:18px;line-height:1.5">
  <h2 style="margin:0 0 8px;font-size:24px">Da ist etwas schiefgelaufen</h2>
  <p style="margin:0 0 12px">Die App konnte nicht richtig starten. Deine Daten sind noch auf dem Handy gespeichert. Lade die App neu – hilft das nicht, sichere zuerst deine Daten und schick sie Marc.</p>
  ${msg ? `<p style="margin:0 0 12px;color:#65525D;overflow-wrap:anywhere">Fehler: ${esc(msg)}</p>` : ''}
  <div style="display:flex;flex-wrap:wrap;gap:8px">
    <button type="button" data-fatal-reload style="min-height:56px;padding:0 20px;border:0;border-radius:28px;background:#A61E4D;color:#fff;font:inherit;font-weight:700">Neu laden</button>
    <button type="button" data-fatal-save style="min-height:56px;padding:0 20px;border:2px solid #A61E4D;border-radius:28px;background:#fff;color:#A61E4D;font:inherit;font-weight:700">Daten sichern</button>
  </div>
</div>`;

function showFatal(err) {
  console.error('Fataler Fehler', err);
  const msg = err?.message || (typeof err === 'string' ? err : '');
  const root = document.getElementById('app');
  if (!root || root.querySelector('[data-fatal]')) return;
  root.innerHTML = fatalCardHtml(msg);
  root.querySelector('[data-fatal-reload]')?.addEventListener('click', () => location.reload());
  root.querySelector('[data-fatal-save]')?.addEventListener('click', () => downloadRawData());
}

/** Harmlose Fehler (Layout-Schleifen, Medien/Wake-Lock/Sprache-Berechtigungen) – kein Alarm. */
function benign(reason) {
  const name = reason?.name || '';
  const msg = String(reason?.message || reason || '');
  if (['AbortError', 'NotAllowedError', 'NotSupportedError', 'InvalidStateError'].includes(name)) return true;
  return /ResizeObserver loop|^Script error\.?$/i.test(msg);
}

let lastRuntimeNotice = 0;
function onRuntimeError(reason) {
  if (benign(reason)) return;
  if (!booted) { showFatal(reason); return; }
  console.error('Unerwarteter Fehler', reason);
  const now = Date.now();
  if (now - lastRuntimeNotice < 60_000) return;
  lastRuntimeNotice = now;
  showNotice('runtime-error', {
    tone: 'error',
    title: 'Da ist etwas schiefgelaufen',
    text: 'Ein unerwarteter Fehler ist aufgetreten. Lade die App neu – hilft das nicht, sichere deine Daten.',
    actions: [
      { label: 'Neu laden', primary: true, onClick: () => location.reload() },
      { label: 'Daten sichern', onClick: () => downloadRawData() },
    ],
  });
}

function installCrashHandlers() {
  window.addEventListener('error', (e) => {
    if (!e.error && !e.message) return; // Ressourcen-Ladefehler (img/script) tragen keinen `error`
    onRuntimeError(e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => onRuntimeError(e.reason));
}

// ---- Theme (hell / dunkel / automatisch) -------------------------------------------------------

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    const media = m.getAttribute('media') || '';
    const sys = media.includes('dark') ? 'dark' : 'light';
    m.setAttribute('content', THEME_COLORS[theme === 'light' || theme === 'dark' ? theme : sys]);
  }
}

// ---- Hinweise zum Speicher -------------------------------------------------------------------------

const SAVE_NOTICE_MIN_GAP_MS = 2 * 60_000;

function wireStoreNotices(store) {
  let saveDismissedAt = 0;
  const showSaveError = () => {
    if (Date.now() - saveDismissedAt < SAVE_NOTICE_MIN_GAP_MS) return;
    showNotice('save-error', {
      tone: 'error',
      text: 'Speichern hat nicht geklappt – vielleicht ist der Speicher voll oder gesperrt. Bitte sichere jetzt deine Daten.',
      actions: [
        { label: 'Daten sichern', primary: true, onClick: () => exportBackup() },
        { label: 'Einstellungen', href: '#/settings' },
      ],
      onClose: () => { saveDismissedAt = Date.now(); },
    });
  };
  store.onSaveError?.(showSaveError);
  store.subscribe?.(() => { if (store.lastSaveOk?.()) removeNotice('save-error'); });
  if (store.lastSaveOk && !store.lastSaveOk()) showSaveError();

  // Beschädigte Daten: das Store-Modul hat eine Kopie unter lisa.v1.corrupt-<ts> abgelegt
  try {
    const issues = store.loadIssues?.();
    if (issues?.corrupt) {
      showNotice('corrupt', {
        tone: 'error',
        text: 'Deine gespeicherten Daten waren beschädigt. Eine Kopie wurde aufbewahrt, die App startet neu.',
        actions: [{ label: 'Kopie herunterladen', primary: true, onClick: () => downloadRawData() }],
      });
    }
    if (issues?.newerVersion) {
      showNotice('newer', { tone: 'error', text: 'Diese Daten stammen aus einer neueren App-Version. Bitte lade die App neu.', actions: [{ label: 'Neu laden', primary: true, onClick: () => location.reload() }] });
    }
  } catch (e) { console.warn(e); }

  // Daten in einem anderen Fenster geändert
  window.addEventListener('storage', (e) => {
    if (e.key && !e.key.startsWith(KEY_PREFIX)) return;
    if (document.body.classList.contains('is-session')) {
      showNotice('external', {
        tone: 'warn',
        text: 'Deine Daten wurden in einem anderen Fenster geändert. Bitte nach dem Training neu laden, damit nichts überschrieben wird.',
        actions: [{ label: 'Neu laden', onClick: () => location.reload() }],
      });
    }
  });
}

// ---- Start ---------------------------------------------------------------------------------------

async function main() {
  const root = document.getElementById('app');
  try {
    const [store, contentMod, routerMod] = await Promise.all([
      import('./store.js'), import('./content.js'), import('./router.js'),
    ]);
    storeMod = store;
    // optionale Module: eine fehlende Komponente darf die App nicht stoppen
    const [audio] = await Promise.all([
      import('./util/audio.js').catch((e) => { console.error(e); return null; }),
      ...['./components/pt-timer.js', './components/pt-figure.js', './components/pt-pain-scale.js']
        .map((p) => import(p).catch((e) => console.error(`${p} nicht geladen`, e))),
    ]);

    const data = store.load();
    applyTheme(data?.settings?.theme);
    store.subscribe((d) => applyTheme(d?.settings?.theme));
    try { store.requestPersistentStorage?.(); } catch (e) { console.warn(e); }
    wireStoreNotices(store);

    // Audio beim ersten Tipp entsperren (iOS/Safari-Anforderung)
    if (audio?.unlock) window.addEventListener('pointerdown', () => audio.unlock(), { once: true, capture: true });

    let content;
    try {
      content = await contentMod.loadContent();
    } catch (err) {
      console.error(err);
      root.innerHTML = '<div class="card"><h2>Die Übungen konnten nicht geladen werden</h2><p>Bitte prüfe die Internetverbindung und lade neu.</p>'
        + '<button type="button" class="btn btn--primary" data-reload>Neu laden</button></div>';
      root.querySelector('[data-reload]')?.addEventListener('click', () => location.reload());
      booted = true;
      return;
    }
    routerMod.startRouter({ root, ctx: { store, content, notify: showNotice, exportBackup } });
    booted = true;
  } catch (err) {
    showFatal(err);
  }
}

// ---- Service Worker + Update-Hinweis ---------------------------------------------------------------
// Ein neuer Worker wartet, bis Lisa im Hinweis „Neu laden“ tippt (dann {type:'SKIP_WAITING'}); danach lädt die Seite
// genau einmal neu. Nie während eines Trainings: der Hinweis wartet, bis body.is-session verschwindet.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const sw = navigator.serviceWorker;
  let reloading = false;
  let userAccepted = false;
  let deferred = null;
  let observer = null;
  sw.addEventListener('controllerchange', () => {
    if (!userAccepted || reloading) return;
    reloading = true;
    location.reload();
  });
  const inSession = () => document.body.classList.contains('is-session');
  const flushDeferred = () => {
    if (!deferred || inSession()) return;
    const w = deferred;
    deferred = null;
    observer?.disconnect();
    observer = null;
    showUpdateToast(w);
  };
  const showUpdateToast = (worker) => {
    if (!worker || document.querySelector('.toast--update')) return;
    if (inSession()) {
      deferred = worker;
      if (!observer && typeof MutationObserver === 'function') {
        observer = new MutationObserver(flushDeferred);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      }
      return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast toast--update';
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<span>Es gibt eine neue Version.</span><button type="button" class="btn btn--primary" data-sw-reload>Neu laden</button>';
    toast.querySelector('[data-sw-reload]').addEventListener('click', () => {
      userAccepted = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
    document.body.appendChild(toast);
  };
  window.addEventListener('hashchange', () => setTimeout(flushDeferred, 0));
  sw.register('./sw.js').then((reg) => {
    if (!reg) return;
    if (reg.waiting && sw.controller) showUpdateToast(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && sw.controller) showUpdateToast(nw);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((e) => console.warn('Service Worker nicht registriert', e));
}

installCrashHandlers();
registerServiceWorker();
main();
