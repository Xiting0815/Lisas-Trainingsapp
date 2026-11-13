// Lädt die statischen Inhalte aus data/*.json. Siehe docs/SPEC.md §2.
// Content = { exercises, byId (Map), routines, tips, quotes, poses, figureOverrides }

const dataUrl = (name) => new URL(`../data/${name}.json`, import.meta.url).href;

/** @type {import('./types.js').Content|null} */
let content = null;
/** @type {Promise<import('./types.js').Content>|null} */
let pending = null;

async function fetchJson(name) {
  const res = await fetch(dataUrl(name));
  if (!res.ok) throw new Error(`${name}.json: HTTP ${res.status}`);
  return res.json();
}

async function fetchOptional(name) {
  try { return await fetchJson(name); } catch { return null; }
}

/** `{version, <key>: [...]}` → Array (oder ein nacktes Array akzeptieren). */
function unwrap(json, key) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json[key])) return json[key];
  return [];
}

/** data/figure-overrides.json (optional): jeder angegebene Schlüssel ersetzt den der Übungsfigur. */
const FIGURE_OVERRIDE_KEYS = ['poses', 'view', 'props', 'band', 'arrows', 'labels', 'mirror', 'tempo', 'loop', 'highlight'];
function withFigureOverride(ex, ov) {
  if (!ex || !ov || typeof ov !== 'object') return ex;
  const figure = { ...(ex.figure || {}) };
  for (const k of FIGURE_OVERRIDE_KEYS) if (ov[k] !== undefined) figure[k] = ov[k];
  return { ...ex, figure };
}

/**
 * Baut das Content-Objekt aus den rohen JSON-Dateien (rein, ohne Netzwerk).
 * @param {{exercises?: any, routines?: any, tips?: any, quotes?: any, poses?: any, figureOverrides?: any}} raw
 * @returns {import('./types.js').Content}
 */
export function buildContent(raw = {}) {
  const ov = raw.figureOverrides;
  const figureOverrides = (ov && typeof ov.overrides === 'object' && ov.overrides) || (ov && !Array.isArray(ov) && !ov.version && typeof ov === 'object' ? ov : {});
  const exercises = unwrap(raw.exercises, 'exercises').map((e) => withFigureOverride(e, figureOverrides[e?.id]));
  const routines = raw.routines && typeof raw.routines === 'object' ? raw.routines : {};
  return {
    exercises,
    byId: new Map(exercises.map((e) => [e.id, e])),
    routines,
    tips: unwrap(raw.tips, 'tips').filter((t) => t && typeof t.text === 'string' && t.text.trim()),
    quotes: unwrap(raw.quotes, 'quotes').filter((q) => typeof q === 'string' && q.trim()),
    poses: raw.poses && typeof raw.poses === 'object' ? raw.poses : { segments: {}, poses: {} },
    figureOverrides,
  };
}

/** @param {{force?: boolean}} [opts] @returns {Promise<import('./types.js').Content>} */
export function loadContent({ force = false } = {}) {
  if (content && !force) return Promise.resolve(content);
  if (pending && !force) return pending;
  pending = (async () => {
    const [exercises, routines, tips, quotes, poses] = await Promise.all(
      ['exercises', 'routines', 'tips', 'quotes', 'poses'].map(fetchJson),
    );
    const figureOverrides = await fetchOptional('figure-overrides');
    content = buildContent({ exercises, routines, tips, quotes, poses, figureOverrides });
    return content;
  })();
  pending.catch(() => { pending = null; });
  return pending;
}

/** Test-Hook: fertiges Content-Objekt direkt setzen. @param {import('./types.js').Content} c */
export function _setContent(c) { content = c; }

/** Test-Hook: rohe JSON-Objekte (z. B. aus Dateien gelesen) laden und setzen. */
export function loadContentSync(raw) {
  content = buildContent(raw);
  return content;
}

export const getContent = () => content;
/** @param {string} id */
export const getExercise = (id) => content?.byId?.get(id) ?? content?.exercises.find((e) => e.id === id);
/** @param {string} id */
export const getPose = (id) => content?.poses?.poses?.[id];
