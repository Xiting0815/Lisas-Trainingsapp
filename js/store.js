// Das EINZIGE Modul, das localStorage anfasst. Schlüssel `lisa.v1`, Schema-Version 1. Siehe docs/SPEC.md §3.
// Läuft auch in Node (Tests) mit einem Speicher-Ersatz.

export const STORAGE_KEY = 'lisa.v1';
export const SCHEMA_VERSION = 1;
export const CORRUPT_PREFIX = `${STORAGE_KEY}.corrupt-`;
export const BEFORE_IMPORT_KEY = `${STORAGE_KEY}.before-import`;
/** Kennung in Export-Dateien. */
export const APP_ID = 'lisas-trainingsapp';
const MAX_CORRUPT_COPIES = 2;
const MAX_SESSIONS = 2000;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
const clampInt = (v, lo, hi, dflt) => (isNum(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : dflt);
const isoOrNull = (v) => (typeof v === 'string' && v.length >= 10 && Number.isFinite(Date.parse(v)) ? v : null);

// ------------------------------------------------------------------------------------------------ Speicher / Zeit

class MemoryStorage {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

let storage = null;
let nowFn = () => new Date();

function getStorage() {
  if (storage) return storage;
  try {
    if (typeof globalThis.localStorage !== 'undefined' && globalThis.localStorage) {
      const probe = `${STORAGE_KEY}.probe`;
      globalThis.localStorage.setItem(probe, '1');
      globalThis.localStorage.removeItem(probe);
      storage = globalThis.localStorage;
      return storage;
    }
  } catch { /* privater Modus o. Ä. → Speicher im Arbeitsspeicher */ }
  storage = new MemoryStorage();
  return storage;
}

/** Nur für Tests: Speicher-Ersatz mit getItem/setItem/removeItem (optional key/length) setzen und den Zustand verwerfen. */
export function _setStorage(fake) {
  storage = fake || null;
  current = null;
  issues = freshIssues();
  saveOk = true;
}

/** Nur für Tests: Uhr setzen (`fn` liefert Date oder Millisekunden). */
export function _setNow(fn) {
  nowFn = typeof fn === 'function' ? fn : () => new Date();
}

const nowDate = () => {
  const v = nowFn();
  return v instanceof Date ? v : new Date(v);
};
/** Jetzt als ISO-Zeitstempel. */
export const nowISO = () => nowDate().toISOString();

// ------------------------------------------------------------------------------------------------ Standardwerte

/** @returns {import('./types.js').Data} */
export function defaults() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      voice: true,
      volume: 0.8,
      theme: 'auto',
      reminder: { days: [1, 3, 5], time: '18:30', reset: false, resetTime: '12:30' },
      lastExportAt: null,
      exportHintDismissedAt: null,
    },
    state: {
      level: 1,
      levelSince: null,
      trainingsAtLevel: 0,
      lastExerciseIds: [],
      lastUsed: {},
      firstRunAt: nowISO(),
      installHintDismissed: false,
      activeSession: null,
    },
    sessions: [],
  };
}

// ------------------------------------------------------------------------------------------------ Sanitize

const KINDS = ['training', 'reset', 'evening'];
const LIGHTS = ['green', 'yellow', 'red'];
const EFFORTS = ['leicht', 'richtig', 'anstrengend', 'zuviel'];
const CHANGES = ['up', 'down', 'hold', 'pause-down'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const pain = (v) => (isNum(v) ? clampInt(v, 0, 10, null) : null);
const strList = (v, max = 200) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x).slice(0, max) : []);

/** Eine Einheit prüfen/reparieren; `null` = unbrauchbar (wird verworfen). */
export function sanitizeSession(s) {
  if (!isObj(s) || typeof s.id !== 'string' || !s.id) return null;
  const date = isoOrNull(s.date);
  if (!date) return null;
  const kind = KINDS.includes(s.kind) ? s.kind : 'training';
  return {
    id: s.id,
    date,
    kind,
    minutes: clampInt(s.minutes, 0, 120, 0),
    level: clampInt(s.level, 1, 8, 1),
    light: LIGHTS.includes(s.light) ? s.light : 'green',
    painBefore: pain(s.painBefore),
    painAfter: pain(s.painAfter),
    effort: kind === 'training' && EFFORTS.includes(s.effort) ? s.effort : null,
    exerciseIds: strList(s.exerciseIds),
    skipped: strList(s.skipped),
    swaps: Array.isArray(s.swaps)
      ? s.swaps.filter((w) => isObj(w) && typeof w.from === 'string').slice(0, 50).map((w) => ({ from: w.from, to: typeof w.to === 'string' ? w.to : null }))
      : [],
    durationSec: clampInt(s.durationSec, 0, 6 * 3600, 0),
    levelChange: CHANGES.includes(s.levelChange) ? s.levelChange : null,
  };
}

/**
 * Macht aus beliebigen Eingaben gültige Daten (fehlende Teile aus den Standardwerten, falsche Typen repariert,
 * unbrauchbare Einheiten verworfen). Wirft nie.
 * @param {any} data
 * @returns {import('./types.js').Data}
 */
export function sanitize(data) {
  return sanitizeWithReport(data).data;
}

function sanitizeWithReport(data) {
  const fixes = [];
  const def = defaults();
  const d = isObj(data) ? data : {};
  const st = isObj(d.settings) ? d.settings : {};
  const rem = isObj(st.reminder) ? st.reminder : {};
  const days = Array.isArray(rem.days)
    ? [...new Set(rem.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort((a, b) => a - b)
    : def.settings.reminder.days;
  const settings = {
    voice: typeof st.voice === 'boolean' ? st.voice : def.settings.voice,
    volume: isNum(st.volume) ? Math.max(0, Math.min(1, st.volume)) : def.settings.volume,
    theme: ['auto', 'light', 'dark'].includes(st.theme) ? st.theme : def.settings.theme,
    reminder: {
      days,
      time: typeof rem.time === 'string' && TIME_RE.test(rem.time) ? rem.time : def.settings.reminder.time,
      reset: typeof rem.reset === 'boolean' ? rem.reset : def.settings.reminder.reset,
      resetTime: typeof rem.resetTime === 'string' && TIME_RE.test(rem.resetTime) ? rem.resetTime : def.settings.reminder.resetTime,
    },
    lastExportAt: isoOrNull(st.lastExportAt),
    exportHintDismissedAt: isoOrNull(st.exportHintDismissedAt),
  };

  const ss = isObj(d.state) ? d.state : {};
  const lastUsed = {};
  if (isObj(ss.lastUsed)) for (const [k, v] of Object.entries(ss.lastUsed)) if (isoOrNull(v)) lastUsed[k] = v;
  const state = {
    level: clampInt(ss.level, 1, 8, 1),
    levelSince: isoOrNull(ss.levelSince),
    trainingsAtLevel: clampInt(ss.trainingsAtLevel, 0, 100000, 0),
    lastExerciseIds: strList(ss.lastExerciseIds, 50),
    lastUsed,
    firstRunAt: isoOrNull(ss.firstRunAt) || def.state.firstRunAt,
    installHintDismissed: typeof ss.installHintDismissed === 'boolean' ? ss.installHintDismissed : false,
    activeSession: isObj(ss.activeSession) ? clone(ss.activeSession) : null,
  };
  if (ss.activeSession != null && !isObj(ss.activeSession)) fixes.push('activeSession');

  const seen = new Set();
  const sessions = [];
  for (const raw of Array.isArray(d.sessions) ? d.sessions : []) {
    const s = sanitizeSession(raw);
    if (!s || seen.has(s.id)) { fixes.push('session'); continue; }
    seen.add(s.id);
    sessions.push(s);
  }
  sessions.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (sessions.length > MAX_SESSIONS) sessions.splice(0, sessions.length - MAX_SESSIONS);

  return { data: { schemaVersion: SCHEMA_VERSION, settings, state, sessions }, fixes };
}

// ------------------------------------------------------------------------------------------------ Migration

/** Migrationen: Schlüssel = Version, VON der migriert wird (nach Schlüssel + 1). */
export const migrations = {
  // 1: (data) => { /* v1 → v2 */ return data; },
};

/**
 * Bringt Daten auf die aktuelle Schema-Version und sanitized sie. Fehlende `schemaVersion` gilt als 1.
 * Wirft bei neueren Versionen (`err.newerVersion`).
 */
export function migrate(data) {
  let d = isObj(data) ? clone(data) : {};
  let v = Number.isInteger(d.schemaVersion) && d.schemaVersion >= 1 ? d.schemaVersion : 1;
  if (v > SCHEMA_VERSION) {
    const err = new Error('Die Daten stammen aus einer neueren App-Version.');
    err.newerVersion = v;
    throw err;
  }
  while (v < SCHEMA_VERSION) {
    const fn = migrations[v];
    if (fn) d = fn(d) ?? d;
    v += 1;
    d.schemaVersion = v;
  }
  return sanitize(d);
}

// ------------------------------------------------------------------------------------------------ Zustand

const freshIssues = () => ({ corrupt: null, newerVersion: null, readOnly: false });
let issues = freshIssues();
let current = null;
let saveOk = true;
let persistAsked = false;
const subscribers = new Set();
const errorHandlers = new Set();

/** Was load() gefunden hat: `corrupt` (Sicherungskopie-Schlüssel), `newerVersion`, `readOnly`. */
export const getIssues = () => ({ ...issues });
export const lastSaveOk = () => saveOk;

/** Rohtext, wie er gespeichert ist (oder null). */
export function rawSnapshot() {
  try { return getStorage().getItem(STORAGE_KEY); } catch { return null; }
}

function storageKeys() {
  const s = getStorage();
  const out = [];
  try {
    if (typeof s.length === 'number' && typeof s.key === 'function') for (let i = 0; i < s.length; i++) out.push(s.key(i));
    else if (isObj(s)) out.push(...Object.keys(s));
  } catch { /* ignorieren */ }
  return out;
}

/** Schlüssel der aufbewahrten Kopien kaputter Daten, älteste zuerst. */
export const corruptBackupKeys = () => storageKeys().filter((k) => typeof k === 'string' && k.startsWith(CORRUPT_PREFIX)).sort();

function preserveCorrupt(raw, err) {
  const key = `${CORRUPT_PREFIX}${nowISO()}`;
  let preserved = false;
  const s = getStorage();
  const prune = () => { for (const k of corruptBackupKeys().slice(0, Math.max(0, corruptBackupKeys().length - (MAX_CORRUPT_COPIES - 1)))) { try { s.removeItem(k); } catch { /* */ } } };
  try { prune(); s.setItem(key, raw); preserved = true; } catch { /* Speicher voll → ohne Kopie weiter */ }
  issues.corrupt = { key: preserved ? key : null, preserved, at: nowISO(), error: String(err?.message || err) };
}

/** Liest die gespeicherten Daten (legt Standardwerte an, sichert Kaputtes unter `lisa.v1.corrupt-<ts>`). */
export function load() {
  issues = freshIssues();
  const s = getStorage();
  let raw = null;
  try { raw = s.getItem(STORAGE_KEY); } catch { raw = null; }
  let data;
  let needsSave = false;
  if (raw == null) {
    data = defaults();
    needsSave = true;
  } else {
    let parsed;
    let bad = null;
    try { parsed = JSON.parse(raw); } catch (e) { bad = e; }
    if (!bad && !isObj(parsed)) bad = new Error('Gespeicherte Daten sind kein Objekt.');
    if (bad) {
      preserveCorrupt(raw, bad);
      data = defaults();
      needsSave = true;
    } else {
      try {
        const { data: clean, fixes } = sanitizeWithReport(migrate(parsed));
        data = clean;
        needsSave = fixes.length > 0 || JSON.stringify(clean) !== JSON.stringify(parsed);
      } catch (e) {
        if (e?.newerVersion) {
          issues.newerVersion = e.newerVersion;
          issues.readOnly = true;
          data = sanitize(parsed);
          needsSave = false;
        } else {
          preserveCorrupt(raw, e);
          data = defaults();
          needsSave = true;
        }
      }
    }
  }
  current = data;
  if (needsSave && !issues.readOnly) save();
  return current;
}

/** Aktuelle Daten (live, nicht verändern – dafür `update`). */
export function get() {
  if (!current) load();
  return current;
}
export const getSettings = () => get().settings;
export const getState = () => get().state;
export const getSessions = () => get().sessions;

/** Schreibt die aktuellen Daten. @returns {boolean} Erfolg */
export function save() {
  if (!current || issues.readOnly) return false;
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(current));
    saveOk = true;
    return true;
  } catch (e) {
    saveOk = false;
    for (const cb of [...errorHandlers]) { try { cb(e); } catch { /* */ } }
    return false;
  }
}

function notify() {
  for (const fn of [...subscribers]) { try { fn(current); } catch { /* ein kaputter Abonnent stoppt nichts */ } }
}

/**
 * `fn` bekommt eine veränderbare Kopie (oder gibt neue Daten zurück); das Ergebnis wird bereinigt, gespeichert
 * und die Abonnenten werden benachrichtigt.
 * @param {(draft: import('./types.js').Data) => any} fn
 */
export function update(fn) {
  const draft = clone(get());
  const r = fn(draft);
  current = sanitize(isObj(r) ? r : draft);
  save();
  notify();
  return current;
}

/** @param {(data: import('./types.js').Data) => void} fn @returns {() => void} */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Callback, wenn das Speichern scheitert (z. B. Speicher voll). */
export function onSaveError(cb) {
  errorHandlers.add(cb);
  return () => errorHandlers.delete(cb);
}

/** Alles auf Anfang. */
export function reset() {
  current = defaults();
  issues = freshIssues();
  save();
  notify();
  return current;
}

// ------------------------------------------------------------------------------------------------ Export / Import

/** Sicherung als JSON-Text (ohne laufendes Training). */
export function exportData() {
  const d = clone(get());
  d.state.activeSession = null;
  return JSON.stringify({ app: APP_ID, exportedAt: nowISO(), ...d }, null, 2);
}

/**
 * Prüft, ob `obj` eine Sicherung von Lisas Trainings-App ist.
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateImport(obj) {
  const errors = [];
  if (!isObj(obj)) return { ok: false, errors: ['Die Datei ist keine gültige Sicherung.'] };
  const physio = isObj(obj.settings) && ('bands' in obj.settings || 'surgeryDate' in obj.settings || 'ownedEquipment' in obj.settings)
    || (isObj(obj.state) && ('phaseId' in obj.state || 'exerciseLevels' in obj.state));
  if (physio || (obj.app !== undefined && obj.app !== APP_ID)) return { ok: false, errors: ['Diese Datei gehört nicht zu Lisas Trainings-App.'] };
  if (!Number.isInteger(obj.schemaVersion) || obj.schemaVersion < 1) errors.push('Die Datenversion fehlt oder ist ungültig.');
  else if (obj.schemaVersion > SCHEMA_VERSION) errors.push('Die Sicherung stammt aus einer neueren App-Version.');
  if (!isObj(obj.settings)) errors.push('Einstellungen fehlen.');
  if (!isObj(obj.state)) errors.push('Der Trainingsstand fehlt.');
  if (!Array.isArray(obj.sessions)) errors.push('Der Trainingsverlauf fehlt.');
  else {
    const ids = new Set();
    obj.sessions.forEach((s, i) => {
      if (!isObj(s) || typeof s.id !== 'string' || !s.id) errors.push(`Einheit ${i + 1} hat keine gültige ID.`);
      else if (ids.has(s.id)) errors.push(`Einheit ${s.id} ist doppelt vorhanden.`);
      else {
        ids.add(s.id);
        if (!isoOrNull(s.date)) errors.push(`Einheit ${i + 1} hat kein gültiges Datum.`);
      }
    });
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Ersetzt alle Daten durch eine Sicherung (JSON-Text oder Objekt). Vorher wird der alte Stand unter
 * `lisa.v1.before-import` abgelegt.
 * @returns {{ok: boolean, error?: string, sessions?: number}}
 */
export function importData(input) {
  let obj = input;
  if (typeof input === 'string') {
    try { obj = JSON.parse(input); } catch { return { ok: false, error: 'Die Datei ist kein gültiges JSON.' }; }
  }
  const v = validateImport(obj);
  if (!v.ok) return { ok: false, error: v.errors[0] };
  let clean;
  try { clean = migrate(obj); } catch (e) { return { ok: false, error: String(e?.message || e) }; }
  const prev = rawSnapshot();
  if (prev) { try { getStorage().setItem(BEFORE_IMPORT_KEY, prev); } catch { /* */ } }
  current = clean;
  issues = freshIssues();
  if (!save()) return { ok: false, error: 'Speichern nicht möglich (Speicher voll?).' };
  notify();
  return { ok: true, sessions: clean.sessions.length };
}

// ------------------------------------------------------------------------------------------------ Dauerhafter Speicher

/** Fragt (einmal) beim Browser dauerhaften Speicher an. @returns {Promise<boolean>} */
export async function requestPersistentStorage() {
  if (persistAsked) return false;
  persistAsked = true;
  try {
    const sm = globalThis.navigator?.storage;
    if (!sm?.persist) return false;
    if (await sm.persisted?.()) return true;
    return !!(await sm.persist());
  } catch {
    return false;
  }
}
