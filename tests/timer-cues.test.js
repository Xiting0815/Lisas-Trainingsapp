// Ansage-Plan (logic/cues.js) → Timer-Zeitleiste (components/pt-timer.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phasesFromPlan, totalMs } from '../js/components/pt-timer.js';
import { exerciseCuePlan, cuePlanSeconds } from '../js/logic/cues.js';
import { doseText, timerPlanFor, planSeconds, weekDots } from '../js/views/session-helpers.js';

const HOLD = { id: 'h', name: 'Halten', type: 'hold', role: 'dehnen', side: 'each' };
const REPS = { id: 'r', name: 'Rudern', type: 'reps', role: 'kraft', side: 'both' };
const TIMED = { id: 't', name: 'Atmen', type: 'timed', role: 'atmung', side: 'both' };

test('Halteübung: Vorbereitung, Halten, Seitenwechsel – Timer-Dauer = Plan-Dauer', () => {
  const item = { sets: 2, seconds: 20, rest: 15, side: 'each' };
  const plan = exerciseCuePlan(item, HOLD, null, {});
  assert.ok(plan.some((s) => s.phase === 'prep'));
  assert.ok(plan.some((s) => s.phase === 'switch'));
  assert.equal(plan.at(-1).phase, 'exercise-done');
  assert.equal(totalMs(phasesFromPlan(plan)) / 1000, cuePlanSeconds(plan));
});

test('Wiederholungen: hoch/runter je Wiederholung', () => {
  const plan = timerPlanFor({ sets: 1, reps: 6, side: 'both' }, REPS);
  assert.equal(plan.filter((s) => s.phase === 'rep-up').length, 6);
  assert.equal(planSeconds(plan), cuePlanSeconds(plan));
  const ph = phasesFromPlan(plan);
  assert.ok(ph.some((p) => p.totalReps === 6));
});

test('Zeit-Übung und kaputte Eingaben', () => {
  assert.ok(planSeconds(timerPlanFor({ sets: 1, seconds: 60, side: 'both' }, TIMED)) >= 60);
  assert.deepEqual(timerPlanFor({ sets: 1 }, null), []);
});

test('Dosis-Texte', () => {
  assert.equal(doseText({ sets: 2, reps: 8, side: 'both' }, REPS), '2 Sätze · 8 Wiederholungen');
  assert.equal(doseText({ sets: 1, seconds: 90, side: 'both' }, TIMED), '1 Min. 30 Sek.');
  assert.match(doseText({ sets: 1, seconds: 30, side: 'each' }, HOLD), /30 Sek\. halten pro Seite/);
});

test('Wochenpunkte: Montag bis Sonntag, Training vs. Mini-Pause', () => {
  const now = new Date(2026, 10, 13, 12); // Freitag
  const d = weekDots([{ date: new Date(2026, 10, 9, 18).toISOString(), kind: 'training' }, { date: new Date(2026, 10, 13, 9).toISOString(), kind: 'reset' }], now);
  assert.equal(d.length, 7);
  assert.equal(d[0].training, true);
  assert.equal(d[4].mini, true);
  assert.equal(d[4].today, true);
});
