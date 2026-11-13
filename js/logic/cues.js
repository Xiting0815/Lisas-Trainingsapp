// Ansage-Pläne (Sprachführung) für einen Plan-Eintrag. PURE.
//
// exerciseCuePlan(item, exercise, settings?, opts?) → CuePhase[] in zeitlicher Reihenfolge. Die Timer-/Sprachschicht
// geht die Liste durch, spricht `say` zu BEGINN jeder Phase ('' = still) und wartet `seconds` (0 = nur Marke).
// Die Phasendauern ergeben zusammen estimateExerciseSeconds() minus Aufbauzeit (im Test geprüft).
import {
  effectiveDose, PREP_SEC, REP_UP_SEC, REP_DOWN_SEC, HOLD_RELAX_SEC, SIDE_SWITCH_SEC,
} from './duration.js';

export const CUE_PHASES = ['prep', 'work', 'hold', 'relax', 'switch', 'rep-up', 'rep-down', 'rest', 'set-done', 'exercise-done'];

/** Standard-Ansagewörter je Übungsart (pro Übung durch `exercise.cueWords` überschreibbar). */
export const DEFAULT_CUE_WORDS = {
  reps: { up: 'Hoch', down: 'Runter', hold: 'Halten', work: 'Los', switch: 'Seite wechseln', release: '' },
  band: { up: 'Ziehen', down: 'Zurück', hold: 'Halten', work: 'Los', switch: 'Seite wechseln', release: '' },
  isometric: { hold: 'Anspannen', release: 'Loslassen', switch: 'Seite wechseln', work: 'Los', up: 'Hoch', down: 'Runter' },
  stretch: { hold: 'Dehnen', release: 'Lösen', switch: 'Seite wechseln', work: 'Los', up: 'Hoch', down: 'Runter' },
  timed: { work: 'Los', switch: 'Seite wechseln', release: '', hold: 'Halten', up: 'Hoch', down: 'Runter' },
  breath: { work: 'Ruhig atmen', switch: 'Seite wechseln', release: '', hold: 'Halten', up: 'Einatmen', down: 'Ausatmen' },
};

/** Welcher Standard-Wortsatz gilt. */
export function cueKind(exercise, item) {
  if (!exercise) return 'reps';
  if (exercise.type === 'hold') return exercise.role === 'dehnen' ? 'stretch' : 'isometric';
  if (exercise.type === 'timed') return exercise.role === 'atmung' ? 'breath' : 'timed';
  const banded = item?.band || exercise.figure?.band;
  return banded ? 'band' : 'reps';
}

/** Wirksame Ansagewörter: Standard der Art + `exercise.cueWords`. */
export function cueWordsFor(exercise, item) {
  return { ...DEFAULT_CUE_WORDS[cueKind(exercise, item)], ...(exercise?.cueWords || {}) };
}

const join = (...parts) => parts.filter(Boolean).join('. ');

/**
 * @param {import('../types.js').PlanItem|null} item
 * @param {import('../types.js').Exercise} exercise
 * @param {object} [settings] (derzeit ungenutzt, für Kompatibilität)
 * @param {{prep?: boolean, fromSet?: number}} [opts] `prep` (Standard true) = „Bereit machen“ vor jedem Satz;
 *   `fromSet` (0-basiert) startet bei einem späteren Satz (Fortsetzen).
 * @returns {import('../types.js').CuePhase[]}
 */
export function exerciseCuePlan(item, exercise, settings, opts = {}) {
  if (!exercise) return [];
  const d = effectiveDose(item, exercise);
  const w = cueWordsFor(exercise, item);
  const out = [];
  const name = exercise.name;
  const push = (phase, seconds, say, extra = {}) =>
    out.push({ phase, seconds: Math.max(0, Math.round(seconds)), say: say || '', setIndex: null, repIndex: null, side: null, ...extra });
  const prep = opts.prep ?? true;
  const from = Math.max(0, Math.min(d.sets - 1, opts.fromSet ?? 0));
  const isHold = d.type === 'hold';
  for (let s = from; s < d.sets; s++) {
    const base = { setIndex: s, sets: d.sets };
    if (prep) push('prep', PREP_SEC, s === 0 ? `Bereit machen: ${name}` : `Bereit machen. Satz ${s + 1} von ${d.sets}`, base);
    for (let side = 1; side <= d.sides; side++) {
      const sb = { ...base, side: d.sides > 1 ? side : null };
      if (side === 2) push('switch', SIDE_SWITCH_SEC, isHold ? join(w.release, w.switch) : w.switch, sb);
      if (isHold) {
        for (let r = 0; r < d.reps; r++) {
          if (r > 0) push('relax', HOLD_RELAX_SEC, w.release, { ...sb, repIndex: r - 1 });
          push('hold', d.seconds, w.hold, { ...sb, repIndex: r, reps: d.reps });
        }
      } else if (d.type === 'timed') {
        push('work', d.seconds, w.work, sb);
      } else {
        for (let r = 0; r < d.reps; r++) {
          const rb = { ...sb, repIndex: r, reps: d.reps };
          push('rep-up', REP_UP_SEC, w.up, rb);
          push('rep-down', REP_DOWN_SEC, w.down, rb);
        }
      }
    }
    const last = s === d.sets - 1;
    push('set-done', 0, last ? '' : join(isHold ? w.release : '', `Satz ${s + 1} geschafft`), base);
    if (!last && d.rest > 0) push('rest', d.rest, 'Pause', base);
  }
  push('exercise-done', 0, join(isHold ? w.release : '', 'Übung geschafft'), { sets: d.sets });
  return out;
}

/** Gesamtsekunden eines Ansage-Plans. */
export const cuePlanSeconds = (plan) => (plan || []).reduce((a, p) => a + (p.seconds || 0), 0);
