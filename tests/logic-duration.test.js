import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateExerciseSeconds, estimatePlanSeconds, estimatePlanMinutes, setupSeconds } from '../js/logic/duration.js';
import { exerciseCuePlan, cuePlanSeconds, cueWordsFor } from '../js/logic/cues.js';
import { shortFor, stepsFor, setupHeadline, setupFor, gearFor } from '../js/logic/exercise-text.js';

const reps = { id: 'r', role: 'kraft', type: 'reps', side: 'both' };
const hold = { id: 'h', role: 'dehnen', type: 'hold', side: 'each' };
const timed = { id: 't', role: 'atmung', type: 'timed', side: 'both' };

test('reps: 4 s je Wiederholung + 5 s Vorbereitung je Satz + Pausen + Aufbau', () => {
  // 2 Sätze × (8×4 + 5) + 1×20 Pause + 20 Aufbau = 114
  assert.equal(estimateExerciseSeconds({ sets: 2, reps: 8, rest: 20 }, reps), 114);
  assert.equal(estimateExerciseSeconds({ sets: 1, reps: 8 }, reps), 8 * 4 + 5 + 20);
});

test('hold & seitenweise: Halten × 2 Seiten + Seitenwechsel', () => {
  // 1 Satz: (20×2 + 5) + 5 Vorbereitung + 10 Aufbau
  assert.equal(estimateExerciseSeconds({ sets: 1, seconds: 20 }, hold), 40 + 5 + 5 + 10);
  // 2 Halte-Wiederholungen mit 5 s Lösen
  assert.equal(estimateExerciseSeconds({ sets: 1, seconds: 10, reps: 2 }, { ...hold, side: 'both' }), (2 * 10 + 5) + 5 + 10);
});

test('timed, Standardwerte, unbekannte Übung', () => {
  assert.equal(estimateExerciseSeconds({ sets: 1, seconds: 60 }, timed), 60 + 5 + 15);
  assert.equal(estimateExerciseSeconds({}, timed), 30 + 5 + 15);
  assert.equal(estimateExerciseSeconds({ sets: 1 }, undefined), 0);
  assert.equal(setupSeconds({ role: 'kraft', setupSec: 3 }), 3);
});

test('Plan: Summe und Minuten', () => {
  const plan = { items: [{ exerciseId: 'r', sets: 1, reps: 8 }, { exerciseId: 't', sets: 1, seconds: 60 }] };
  const by = new Map([[reps.id, reps], [timed.id, timed]]);
  assert.equal(estimatePlanSeconds(plan, by), 57 + 80);
  assert.equal(estimatePlanSeconds(plan, [reps, timed]), 137);
  assert.equal(estimatePlanSeconds(plan, { r: reps, t: timed }), 137);
  assert.equal(estimatePlanMinutes(plan, by), 3);
  assert.equal(estimatePlanSeconds({ items: [] }, by), 0);
});

test('Ansage-Plan dauert genau so lange wie die Schätzung (ohne Aufbau)', () => {
  const cases = [
    [{ sets: 2, reps: 8, rest: 20 }, reps], [{ sets: 3, reps: 6 }, { ...reps, side: 'alternate' }],
    [{ sets: 2, seconds: 20 }, hold], [{ sets: 2, seconds: 10, reps: 3 }, { ...hold, side: 'both' }],
    [{ sets: 1, seconds: 45 }, timed], [{ sets: 2, seconds: 20 }, { ...timed, side: 'each' }],
  ];
  for (const [item, ex] of cases) {
    const plan = exerciseCuePlan(item, ex);
    assert.equal(cuePlanSeconds(plan), estimateExerciseSeconds(item, ex) - setupSeconds(ex), JSON.stringify(item));
    assert.equal(plan.at(-1).phase, 'exercise-done');
  }
});

test('Ansagen: Wörter je Art, Satzwechsel, Fortsetzen ab Satz', () => {
  const plan = exerciseCuePlan({ sets: 2, reps: 2, band: 'yellow' }, reps);
  assert.equal(plan[0].phase, 'prep');
  assert.match(plan[0].say, /Bereit machen/);
  assert.deepEqual(plan.filter((p) => p.phase === 'rep-up').map((p) => p.say), ['Ziehen', 'Ziehen', 'Ziehen', 'Ziehen']);
  assert.ok(plan.some((p) => p.phase === 'rest' && p.seconds === 20));
  assert.ok(plan.some((p) => /Satz 1 geschafft/.test(p.say)));
  const resumed = exerciseCuePlan({ sets: 3, reps: 2 }, reps, null, { fromSet: 2 });
  assert.ok(resumed.every((p) => p.setIndex == null || p.setIndex === 2));
  assert.equal(cueWordsFor(hold).hold, 'Dehnen');
  assert.equal(cueWordsFor({ ...hold, cueWords: { hold: 'Spüren' } }).hold, 'Spüren');
  assert.deepEqual(exerciseCuePlan({}, null), []);
});

test('Übungstexte', () => {
  const ex = { short: 'Kurz', steps: ['a', 'b'], setup: 'Setz dich hin. Dann weiter.', gear: 'Matte' };
  assert.equal(shortFor(ex), 'Kurz');
  assert.deepEqual(stepsFor(ex), ['a', 'b']);
  assert.deepEqual(stepsFor({ instructions: ['1', '2', '3', '4', '5'] }), ['1', '2', '3', '4']);
  assert.equal(setupHeadline(ex), 'Setz dich hin.');
  assert.deepEqual(setupFor(ex), ['Setz dich hin. Dann weiter.']);
  assert.equal(gearFor(ex), 'Matte');
  assert.equal(setupHeadline(null), '');
});
