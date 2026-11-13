// Zeitschätzung für Übungen und Pläne. PURE. Siehe docs/SPEC.md §4.
//
// Modell (pro Plan-Eintrag `item` = {sets, reps?, seconds?, rest?} + Übung `exercise`):
//   reps   : Arbeit pro Satz = reps × REP_SEC (2 s hoch + 2 s runter)
//   hold   : Arbeit pro Satz = reps(≥1) × seconds + (reps−1) × HOLD_RELAX_SEC
//   timed  : Arbeit pro Satz = seconds
//   side 'each' → Arbeit × 2 + SIDE_SWITCH_SEC je Satz ('both' und 'alternate' → einmal)
//   prep   = PREP_SEC je Satz („Bereit machen“)
//   Pause  = (sets − 1) × rest (Standard DEFAULT_REST_SEC)
//   Aufbau = exercise.setupSec ?? SETUP_BY_ROLE[role] je Übung
// estSec = Summe, auf ganze Sekunden gerundet. Die Ansagen in cues.js laufen exakt dieselbe Zeit (ohne Aufbau).

export const REP_SEC = 4;
export const REP_UP_SEC = 2;
export const REP_DOWN_SEC = 2;
export const PREP_SEC = 5;
export const HOLD_RELAX_SEC = 5;
export const SIDE_SWITCH_SEC = 5;
export const DEFAULT_REST_SEC = 20;
export const SETUP_BY_ROLE = { mobil: 10, kraft: 20, rumpf: 20, dehnen: 10, atmung: 15 };
export const DEFAULT_SETUP_SEC = 15;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Aufbauzeit einer Übung in Sekunden. */
export function setupSeconds(exercise) {
  if (isNum(exercise?.setupSec) && exercise.setupSec >= 0) return exercise.setupSec;
  return SETUP_BY_ROLE[exercise?.role] ?? DEFAULT_SETUP_SEC;
}

/** Wirksame Dosis eines Plan-Eintrags (mit Standardwerten). */
export function effectiveDose(item, exercise) {
  const sets = Math.max(1, Math.round(isNum(item?.sets) ? item.sets : 1));
  const type = exercise?.type || 'reps';
  const reps = isNum(item?.reps) ? Math.max(1, Math.round(item.reps)) : null;
  const seconds = isNum(item?.seconds) ? Math.max(1, Math.round(item.seconds)) : null;
  return {
    type,
    sets,
    reps: type === 'reps' ? reps ?? 8 : type === 'hold' ? reps ?? 1 : reps,
    seconds: type === 'hold' ? seconds ?? 10 : type === 'timed' ? seconds ?? 30 : seconds,
    rest: isNum(item?.rest) && item.rest >= 0 ? item.rest : DEFAULT_REST_SEC,
    sides: exercise?.side === 'each' ? 2 : 1,
  };
}

/** Arbeitszeit eines Satzes (eine Seite). */
export function workSecondsPerSide(d) {
  if (d.type === 'hold') return d.reps * d.seconds + (d.reps - 1) * HOLD_RELAX_SEC;
  if (d.type === 'timed') return d.seconds;
  return d.reps * REP_SEC;
}

/**
 * Geschätzte Sekunden für einen Plan-Eintrag.
 * @param {{sets?: number, reps?: number, seconds?: number, rest?: number}|null} item
 * @param {import('../types.js').Exercise} exercise
 * @returns {number} 0 bei unbekannter Übung
 */
export function estimateExerciseSeconds(item, exercise) {
  if (!exercise) return 0;
  const d = effectiveDose(item, exercise);
  const work = workSecondsPerSide(d);
  const perSet = (d.sides === 2 ? work * 2 + SIDE_SWITCH_SEC : work) + PREP_SEC;
  return Math.round(d.sets * perSet + (d.sets - 1) * d.rest + setupSeconds(exercise));
}

/** Übungen als Map (akzeptiert Map, Array oder Objekt id → Übung). */
export function toExerciseMap(src) {
  if (src instanceof Map) return src;
  if (Array.isArray(src)) return new Map(src.map((e) => [e.id, e]));
  if (src && typeof src === 'object') return new Map(Object.entries(src));
  return new Map();
}

/**
 * Geschätzte Sekunden eines Plans (Summe der Einträge).
 * @param {{items: any[]}} plan
 * @param {Map|Array|Object} exerciseById
 */
export function estimatePlanSeconds(plan, exerciseById) {
  const map = toExerciseMap(exerciseById);
  return (plan?.items || []).reduce((a, it) => a + estimateExerciseSeconds(it, map.get(it.exerciseId)), 0);
}

/** Minuten (aufgerundet) eines Plans. */
export const estimatePlanMinutes = (plan, exerciseById) => Math.ceil(estimatePlanSeconds(plan, exerciseById) / 60);
