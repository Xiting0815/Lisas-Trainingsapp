// Hash-Router. Routen: #/ (Heute), #/session, #/summary/<id>, #/history, #/settings, #/info, #/install.

/** @type {{pattern: string, view: string, tab: string|null, title: string, hideTabs?: boolean}[]} */
export const routes = [
  { pattern: '/', view: 'today', tab: 'heute', title: 'Heute' },
  { pattern: '/session', view: 'session', tab: null, title: 'Training', hideTabs: true },
  { pattern: '/summary/:id', view: 'summary', tab: 'heute', title: 'Geschafft' },
  { pattern: '/history', view: 'history', tab: 'verlauf', title: 'Verlauf' },
  { pattern: '/settings', view: 'settings', tab: 'einstellungen', title: 'Einstellungen' },
  { pattern: '/info', view: 'info', tab: 'einstellungen', title: 'Gut zu wissen' },
  { pattern: '/install', view: 'install', tab: 'einstellungen', title: 'App installieren' },
];

export const DEFAULT_PATH = '/';

/**
 * Reiner Routen-Matcher.
 * @param {string} hash z. B. "#/summary/abc?x=1"
 */
export function matchRoute(hash) {
  let h = String(hash || '').replace(/^#/, '');
  if (!h.startsWith('/')) h = '/' + h;
  const [pathPart, queryPart = ''] = h.split('?');
  const path = pathPart.replace(/\/+$/, '') || '/';
  const query = {};
  for (const pair of queryPart.split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    try { query[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch { /* kaputte Kodierung ignorieren */ }
  }
  const segs = path.split('/').filter(Boolean);
  for (const route of routes) {
    const rsegs = route.pattern.split('/').filter(Boolean);
    if (rsegs.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < rsegs.length; i++) {
      if (rsegs[i].startsWith(':')) { try { params[rsegs[i].slice(1)] = decodeURIComponent(segs[i]); } catch { params[rsegs[i].slice(1)] = segs[i]; } }
      else if (rsegs[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return { route, params, query, path };
  }
  return { route: routes[0], params: {}, query, path: DEFAULT_PATH };
}

/** @param {string} path z. B. "/session?kind=reset" */
export function navigate(path) {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

/** Fehlerkarte mit „Neu laden“; bei /session zusätzlich „Training verwerfen“, damit kaputte Daten die App nie blockieren. */
export function renderErrorCard(root, ctx, m) {
  let hasActive = false;
  try { hasActive = m.route.view === 'session' && !!ctx?.store?.get?.()?.state?.activeSession; } catch { hasActive = false; }
  root.innerHTML = '<div class="card" role="alert"><h2>Hoppla</h2><p>Diese Seite konnte nicht geladen werden.</p>'
    + '<div class="btn-row"><button type="button" class="btn btn--primary" data-err-reload>Neu laden</button>'
    + '<a class="btn" href="#/">Zur Startseite</a></div>'
    + (hasActive ? '<p>Bleibt das Training immer wieder hängen, kannst du es verwerfen. Dein bisheriger Verlauf bleibt erhalten.</p>'
      + '<button type="button" class="btn btn--danger" data-err-discard>Training verwerfen</button>' : '')
    + '</div>';
  root.querySelector('[data-err-reload]')?.addEventListener('click', () => location.reload());
  root.querySelector('[data-err-discard]')?.addEventListener('click', () => {
    const ok = typeof window.confirm === 'function' ? window.confirm('Das laufende Training wirklich verwerfen?') : true;
    if (!ok) return;
    try { ctx.store.update((d) => { d.state.activeSession = null; }); } catch (e) { console.error(e); }
    navigate('/');
  });
}

/**
 * @param {{root: HTMLElement, ctx: object, onRoute?: (m: ReturnType<typeof matchRoute>) => void}} opts
 */
export function startRouter({ root, ctx, onRoute }) {
  let cleanup = null;
  let token = 0;

  async function handle() {
    const m = matchRoute(location.hash);
    const my = ++token;
    if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.error(e); } }
    cleanup = null;

    document.body.classList.toggle('is-session', !!m.route.hideTabs);
    for (const a of document.querySelectorAll('.tabbar [data-tab]')) {
      if (a.getAttribute('data-tab') === m.route.tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }

    try {
      const mod = await import(`./views/${m.route.view}.js`);
      if (my !== token) return;
      document.title = `${mod.title || m.route.title} · Lisas Training`;
      const result = await mod.render(root, { ...ctx, params: m.params, query: m.query, navigate });
      if (my !== token) { if (typeof result === 'function') result(); return; }
      cleanup = typeof result === 'function' ? result : null;
    } catch (err) {
      console.error('Seite konnte nicht aufgebaut werden', err);
      if (my === token) renderErrorCard(root, ctx, m);
    }
    window.scrollTo(0, 0);
    root.focus({ preventScroll: true });
    onRoute?.(m);
  }

  window.addEventListener('hashchange', handle);
  handle();
  return () => window.removeEventListener('hashchange', handle);
}
