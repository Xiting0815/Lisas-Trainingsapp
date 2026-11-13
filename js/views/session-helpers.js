// Hilfsfunktionen für Heute/Training: Start einer Einheit, Dosis-Texte, Abschluss. Ohne DOM (Node-testbar).
import { composePlan, routinePlan } from '../logic/compose.js';
import { effectiveLevel } from '../logic/levels.js';
import { lightFor } from '../logic/traffic.js';
import { exerciseCuePlan } from '../logic/cues.js';

export const BLOCK_LABELS = { mobil: 'Beweglich werden', kraft: 'Kraft & Haltung', dehnen: 'Dehnen', atmung: 'Atmen & Entspannen' };
export const BAND_LABELS = {
  yellow: 'gelbes Band', red: 'rotes Band', green: 'grünes Band', blue: 'blaues Band',
  'loop-orange': 'orangener Loop', 'loop-blue': 'blauer Loop',
};
export const BAND_COLORS = {
  yellow: '#F2D43D', red: '#D9443B', green: '#3BA55C', blue: '#2F6FD6', 'loop-orange': '#F08A24', 'loop-blue': '#2456B8',
};
/** Ein aktives Training gilt nach so vielen Stunden Pause als „liegen geblieben“ (nur für den Hinweistext). */
export const STALE_SESSION_MS = 12 * 3600e3;
/** Maximal so viele Millisekunden pro Speicherung zählen als aktive Zeit. */
const MAX_BEAT_MS = 60e3;

/** „2 Sätze · 8 Wiederholungen“, „3 × 20 Sek. halten“, „1 Min. 30 Sek.“ */
export function doseText(item, exercise) {
  if (!item) return '';
  const sets = Math.max(1, item.sets || 1);
  const each = item.side === 'each' || exercise?.side === 'each';
  const per = each ? ' pro Seite' : '';
  const sec = (s) => (s >= 60 ? `${Math.floor(s / 60)} Min.${s % 60 ? ` ${s % 60} Sek.` : ''}` : `${s} Sek.`);
  if (exercise?.type === 'reps' || (item.reps && !item.seconds)) {
    return sets > 1 ? `${sets} Sätze · ${item.reps} Wiederholungen${per}` : `${item.reps} Wiederholungen${per}`;
  }
  if (exercise?.type === 'hold') {
    const reps = item.reps > 1 ? `${item.reps} × ` : '';
    const one = `${reps}${sec(item.seconds || 20)} halten`;
    return sets > 1 ? `${sets} Sätze · ${one}${per}` : `${one}${per}`;
  }
  const one = sec(item.seconds || 30);
  return sets > 1 ? `${sets} Sätze · ${one}${per}` : `${one}${per}`;
}

/** Ansagen-/Timer-Plan einer Übung. */
export function timerPlanFor(item, exercise) {
  try {
    const plan = exerciseCuePlan(item, exercise, null, {});
    return Array.isArray(plan) ? plan : [];
  } catch (e) {
    console.error('Ansage-Plan fehlgeschlagen', e);
    return [];
  }
}

/** Gesamtdauer des Timer-Plans in Sekunden. */
export const planSeconds = (cue) => (cue || []).reduce((a, p) => a + (Number(p.seconds) || 0), 0);

const uid = (kind, now) => `${kind}-${now.getTime().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/**
 * Neue Einheit zusammenstellen und als `state.activeSession` speichern.
 * @param {{store: any, content: any}} ctx
 * @param {{kind: 'training'|'reset'|'evening', minutes?: 10|15|20, pain?: number|null, now?: Date}} o
 * @returns {object} die aktive Session
 */
export function startSession({ store, content }, { kind, minutes = 15, pain = null, now = new Date() }) {
  const data = store.get();
  const state = data.state || {};
  const sessions = data.sessions || [];
  const level = effectiveLevel({ state, sessions, now }).level ?? state.level ?? 1;
  const light = pain == null ? 'green' : lightFor(pain);
  let plan;
  if (kind === 'training') {
    plan = composePlan({
      minutes, level, pain: pain ?? 0, exercises: content.exercises, routines: content.routines,
      lastExerciseIds: state.lastExerciseIds || [], lastUsed: state.lastUsed || {}, now,
    });
  } else {
    plan = routinePlan(kind, { routines: content.routines, exercises: content.exercises, level, light, now });
  }
  const stamp = now.toISOString();
  const active = {
    id: plan.id || uid(plan.kind || kind, now),
    kind: plan.kind || kind, // Rot → „evening“ statt „training“
    minutes: plan.minutes,
    level: plan.level ?? level,
    light: plan.light || light,
    painBefore: pain,
    plan,
    index: 0,
    step: 'ex',
    skipped: [],
    swaps: [],
    effort: null,
    painAfter: null,
    startedAt: stamp,
    lastActiveAt: stamp,
    activeMs: 0,
  };
  store.update((d) => { d.state.activeSession = active; });
  return active;
}

/** Aktive Zeit fortschreiben (jede Speicherung zählt höchstens eine Minute). */
export function beat(active, now = Date.now()) {
  const last = Date.parse(active.lastActiveAt);
  if (Number.isFinite(last)) active.activeMs = (active.activeMs || 0) + Math.max(0, Math.min(MAX_BEAT_MS, now - last));
  active.lastActiveAt = new Date(now).toISOString();
  return active;
}

/** Ist die aktive Session brauchbar? (Schutz vor kaputten Daten) */
export function validActive(a, content) {
  if (!a || typeof a !== 'object' || !a.plan || !Array.isArray(a.plan.items)) return false;
  if (!a.plan.items.length) return false;
  const known = new Set(content.exercises.map((e) => e.id));
  return a.plan.items.every((it) => it && known.has(it.exerciseId)) && Number.isInteger(a.index) && a.index >= 0;
}

/** Fertige Session-Daten (für `applyTrainingResult`). */
export function finishedSession(active, { effort = null, painAfter = null, now = new Date() } = {}) {
  const ids = active.plan.items.map((it) => it.exerciseId);
  const skipped = (active.skipped || []).filter((id) => ids.includes(id));
  const total = active.plan.items.length || 1;
  return {
    id: active.id,
    date: active.startedAt || now.toISOString(),
    kind: active.kind,
    minutes: active.minutes,
    level: active.level,
    light: active.light,
    painBefore: active.painBefore ?? null,
    painAfter: painAfter ?? null,
    effort: active.kind === 'training' ? effort : null,
    exerciseIds: ids,
    skipped,
    swaps: active.swaps || [],
    durationSec: Math.round((active.activeMs || 0) / 1000),
    levelChange: null,
    completed: Math.max(0, total - skipped.length),
  };
}

/** Fortschritt „2 von 8“. */
export const positionText = (active) => `Übung ${Math.min(active.index + 1, active.plan.items.length)} von ${active.plan.items.length}`;

/** Tage-/Wochenpunkte für die Wochenübersicht: 7 Einträge Mo–So mit Art der Einheiten. */
export function weekDots(sessions, now = new Date()) {
  const d = new Date(now);
  const dow = (d.getDay() + 6) % 7; // Montag = 0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
  const key = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const names = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const days = names.map((name, i) => {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return { name, key: key(day), training: false, mini: false, today: key(day) === key(d) };
  });
  for (const s of sessions || []) {
    const t = new Date(s.date);
    if (Number.isNaN(+t)) continue;
    const e = days.find((x) => x.key === key(t));
    if (!e) continue;
    if (s.kind === 'training') e.training = true; else e.mini = true;
  }
  return days;
}
