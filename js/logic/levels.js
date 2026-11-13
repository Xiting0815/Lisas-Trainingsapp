// Level 1–8, Steigerungs-Regeln und Verbuchen eines Trainings. PURE (now injizierbar). Siehe docs/SPEC.md §4, Anleitung §5.
import { daysBetween, toISODate } from '../util/date.js';

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 8;
/** Mindestanzahl Trainings auf einem Level, bevor gesteigert wird. */
export const MIN_TRAININGS_PER_LEVEL = 2;
/** Mindestens so viele Tage seit der letzten Level-Änderung bis zur nächsten Steigerung. */
export const MIN_DAYS_BETWEEN_UP = 7;
/** Nach mehr als so vielen Tagen ohne Training startet das nächste Training ein Level niedriger. */
export const PAUSE_DAYS = 14;

export const LEVELS = [
  { n: 1, title: 'Sanfter Start', text: 'Level 1 von 8 – ein ganz sanfter Start. Du lernst die Übungen in Ruhe kennen.' },
  { n: 2, title: 'Gut angekommen', text: 'Level 2 von 8 – du bist gut angekommen, die Bewegungen werden vertrauter.' },
  { n: 3, title: 'Mehr Sicherheit', text: 'Level 3 von 8 – du wirst sicherer, dein Rücken sagt schon danke.' },
  { n: 4, title: 'Kraft wächst', text: 'Level 4 von 8 – deine Kraft wächst spürbar, du bist schon viel stärker als am Anfang.' },
  { n: 5, title: 'Stabil unterwegs', text: 'Level 5 von 8 – du bist stabil unterwegs, Schultern und Rücken arbeiten gut zusammen.' },
  { n: 6, title: 'Richtig stark', text: 'Level 6 von 8 – richtig stark! Deine Haltung trägt dich durch den Alltag.' },
  { n: 7, title: 'Fast ganz oben', text: 'Level 7 von 8 – fast ganz oben, deine Ausdauer und Kraft sind toll.' },
  { n: 8, title: 'Höchstes Level', text: 'Level 8 von 8 – du hast das höchste Level erreicht. Bleib dran, so wie es dir guttut.' },
];

const clampLevel = (n) => Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(Number.isFinite(n) ? n : MIN_LEVEL)));

/** Text zu einem Level. */
export const levelInfo = (n) => LEVELS[clampLevel(n) - 1];

/** Date | Zahl | ISO-String → Date (Standard: jetzt). */
export function toDate(now) {
  if (now instanceof Date) return now;
  if (typeof now === 'number' || typeof now === 'string') {
    const d = new Date(now);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

const dayOf = (v) => toISODate(toDate(v));
const timeOf = (s) => {
  const t = Date.parse(s?.date);
  return Number.isFinite(t) ? t : 0;
};

/** Trainings (kind 'training') in zeitlicher Reihenfolge. */
export function trainingsOf(sessions) {
  return (sessions || []).filter((s) => s && s.kind === 'training').sort((a, b) => timeOf(a) - timeOf(b));
}

const GOOD_EFFORT = new Set(['leicht', 'richtig']);
const painRise = (s) => (Number.isFinite(s?.painBefore) && Number.isFinite(s?.painAfter) ? s.painAfter - s.painBefore : 0);

/**
 * Level, mit dem das nächste Training beginnt. Nach > 14 Tagen ohne Training ein Level niedriger
 * (`pause-down`). Nur Trainings zählen – Mini-Pausen nicht.
 * @returns {{level: number, change: 'pause-down'|null, reason: string}}
 */
export function effectiveLevel({ state, sessions, now } = {}) {
  const level = clampLevel(state?.level);
  const last = trainingsOf(sessions).at(-1);
  if (!last) return { level, change: null, reason: '' };
  const gap = daysBetween(dayOf(last.date), dayOf(now));
  if (gap > PAUSE_DAYS && level > MIN_LEVEL) {
    return { level: level - 1, change: 'pause-down', reason: 'Nach einer längeren Pause starten wir ein Level sanfter.' };
  }
  return { level, change: null, reason: '' };
}

/**
 * Level-Entscheidung NACH einem Training (die Sessions enthalten das neueste Training bereits;
 * `state.trainingsAtLevel` zählt es bereits mit).
 * Regeln: zurück um 1 bei „zu viel“ oder Schmerzanstieg ≥ 2; halten bei „anstrengend“; steigern, wenn die letzten
 * 2 Trainings leicht/richtig waren, der Schmerz danach je ≤ davor + 1 war, ≥ 2 Trainings auf dem Level
 * und ≥ 7 Tage seit der letzten Level-Änderung vergangen sind (kein Eintrag `levelSince` → Tage-Regel erfüllt).
 * @returns {{level: number, change: 'up'|'hold'|'down'|null, reason: string}}
 */
export function nextLevel({ state, sessions, now } = {}) {
  const level = clampLevel(state?.level);
  const trainings = trainingsOf(sessions);
  const last = trainings.at(-1);
  if (!last) return { level, change: null, reason: 'Noch kein Training.' };
  if (last.effort === 'zuviel' || painRise(last) >= 2) {
    if (level === MIN_LEVEL) return { level, change: 'hold', reason: 'Das war zu viel – wir bleiben bei Level 1 und machen es noch sanfter.' };
    return { level: level - 1, change: 'down', reason: 'Das war zu viel – wir gehen ein Level zurück.' };
  }
  if (last.effort === 'anstrengend') return { level, change: 'hold', reason: 'Anstrengend – wir bleiben auf diesem Level.' };
  const lastTwo = trainings.slice(-2);
  const goodTwo = lastTwo.length === 2 && lastTwo.every((s) => GOOD_EFFORT.has(s.effort) && painRise(s) <= 1);
  if (!goodTwo) return { level, change: 'hold', reason: 'Noch etwas Zeit auf diesem Level.' };
  if ((state?.trainingsAtLevel ?? 0) < MIN_TRAININGS_PER_LEVEL) return { level, change: 'hold', reason: 'Mindestens 2 Trainings pro Level.' };
  if (state?.levelSince && daysBetween(dayOf(state.levelSince), dayOf(now)) < MIN_DAYS_BETWEEN_UP) {
    return { level, change: 'hold', reason: 'Höchstens eine Steigerung pro Woche.' };
  }
  if (level >= MAX_LEVEL) return { level, change: 'hold', reason: 'Höchstes Level erreicht.' };
  return { level: level + 1, change: 'up', reason: 'Gut gemacht – ein Level höher!' };
}

const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

/**
 * Verbucht eine abgeschlossene Einheit (pur: gibt neue Daten zurück, Eingabe bleibt unverändert).
 * - Mini-Pausen (reset/evening): Session wird angehängt, Level und Abwechslungs-Daten bleiben unberührt.
 * - Training: Session wird angehängt; Pausen-Regel (vorher), Level-Änderung, `lastUsed`, `lastExerciseIds`.
 * @param {import('../types.js').Data} data
 * @param {Partial<import('../types.js').Session>} session
 * @param {Date|number|string} [now]
 * @returns {import('../types.js').Data}
 */
export function applyTrainingResult(data, session, now) {
  const out = clone(data);
  const nowISO = toDate(now).toISOString();
  const s = { skipped: [], swaps: [], exerciseIds: [], durationSec: 0, painBefore: null, painAfter: null, effort: null, ...clone(session) };
  s.date = s.date || nowISO;
  const state = out.state;
  out.sessions = Array.isArray(out.sessions) ? out.sessions.filter((x) => x.id !== s.id) : [];

  if (s.kind !== 'training') {
    s.levelChange = null;
    s.level = Number.isFinite(s.level) ? s.level : clampLevel(state.level);
    out.sessions.push(s);
    return out;
  }

  const before = out.sessions;
  const eff = effectiveLevel({ state, sessions: before, now });
  if (eff.change === 'pause-down') {
    state.level = eff.level;
    state.levelSince = nowISO;
    state.trainingsAtLevel = 0;
  }
  s.level = Number.isFinite(s.level) ? s.level : state.level;
  state.trainingsAtLevel = (state.trainingsAtLevel || 0) + 1;
  out.sessions.push(s);

  const next = nextLevel({ state, sessions: out.sessions, now });
  if (next.change === 'up' || next.change === 'down') {
    state.level = next.level;
    state.levelSince = nowISO;
    state.trainingsAtLevel = 0;
    s.levelChange = next.change;
  } else {
    s.levelChange = eff.change === 'pause-down' ? 'pause-down' : next.change;
  }

  const done = (s.exerciseIds || []).filter((id) => !s.skipped.includes(id));
  state.lastExerciseIds = [...done];
  state.lastUsed = { ...(state.lastUsed || {}) };
  for (const id of done) state.lastUsed[id] = s.date;
  return out;
}
