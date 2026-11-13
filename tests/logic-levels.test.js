import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, nextLevel, effectiveLevel, applyTrainingResult } from '../js/logic/levels.js';
import { defaults, _setNow } from '../js/store.js';
import { mkSession } from './helpers/fixtures-logic.js';

const D = (day, h = 18) => new Date(2026, 10, day, h, 0, 0).toISOString();
const st = (o = {}) => ({ level: 3, levelSince: D(1), trainingsAtLevel: 2, ...o });
const tr = (day, o = {}) => mkSession({ id: `t${day}-${Math.random()}`, date: D(day), ...o });

test('LEVELS: 8 Einträge mit Text „Level n von 8“', () => {
  assert.equal(LEVELS.length, 8);
  LEVELS.forEach((l, i) => { assert.equal(l.n, i + 1); assert.match(l.text, new RegExp(`Level ${i + 1} von 8`)); assert.ok(l.title); });
});

test('Steigern: 2 gute Trainings, Schmerz ok, ≥ 2 Trainings auf Level, ≥ 7 Tage', () => {
  const sessions = [tr(5, { effort: 'leicht', painBefore: 4, painAfter: 3 }), tr(8, { effort: 'richtig', painBefore: 3, painAfter: 4 })];
  const r = nextLevel({ state: st(), sessions, now: new Date(2026, 10, 9) });
  assert.deepEqual([r.level, r.change], [4, 'up']);
});

test('Steigern wird verhindert: zu früh, zu wenige Trainings, Schmerz +2, nur 1 gutes', () => {
  const good = [tr(5, { effort: 'leicht' }), tr(8, { effort: 'richtig' })];
  const now = new Date(2026, 10, 9);
  assert.equal(nextLevel({ state: st({ levelSince: D(4) }), sessions: good, now }).change, 'hold'); // erst 5 Tage
  assert.equal(nextLevel({ state: st({ levelSince: D(2) }), sessions: good, now }).change, 'up');   // genau 7 Tage
  assert.equal(nextLevel({ state: st({ trainingsAtLevel: 1 }), sessions: good, now }).change, 'hold');
  // ein anstrengendes Training unter den letzten zwei → keine Steigerung
  assert.equal(nextLevel({ state: st(), sessions: [tr(5, { effort: 'anstrengend' }), tr(8, { effort: 'richtig' })], now }).change, 'hold');
  // Schmerz +2 beim vorletzten Training verhindert Steigerung (kein Absenken, da letztes gut)
  const pain2 = [tr(5, { effort: 'leicht', painBefore: 2, painAfter: 4 }), tr(8, { effort: 'richtig' })];
  assert.equal(nextLevel({ state: st(), sessions: pain2, now }).change, 'hold');
  // nur 1 Training insgesamt
  assert.equal(nextLevel({ state: st(), sessions: [tr(8, { effort: 'leicht' })], now }).change, 'hold');
  // höchstes Level
  assert.deepEqual(nextLevel({ state: st({ level: 8 }), sessions: good, now }).level, 8);
  assert.equal(nextLevel({ state: st({ level: 8 }), sessions: good, now }).change, 'hold');
});

test('Halten bei anstrengend; zurück bei zu viel oder Schmerzanstieg ≥ 2; nie unter 1', () => {
  const now = new Date(2026, 10, 9);
  assert.deepEqual(pick(nextLevel({ state: st(), sessions: [tr(8, { effort: 'anstrengend' })], now })), [3, 'hold']);
  assert.deepEqual(pick(nextLevel({ state: st(), sessions: [tr(8, { effort: 'zuviel' })], now })), [2, 'down']);
  assert.deepEqual(pick(nextLevel({ state: st(), sessions: [tr(8, { effort: 'richtig', painBefore: 2, painAfter: 4 })], now })), [2, 'down']);
  assert.deepEqual(pick(nextLevel({ state: st({ level: 1 }), sessions: [tr(8, { effort: 'zuviel' })], now })), [1, 'hold']);
  assert.equal(nextLevel({ state: st(), sessions: [], now }).change, null);
});
const pick = (r) => [r.level, r.change];

test('Mini-Pausen zählen nicht für die Level-Regeln', () => {
  const now = new Date(2026, 10, 9);
  const sessions = [tr(5, { effort: 'leicht' }), tr(8, { effort: 'richtig' }), mkSession({ date: D(9), kind: 'reset', effort: null, painBefore: 1, painAfter: 9 })];
  assert.equal(nextLevel({ state: st(), sessions, now }).change, 'up');
});

test('Pause > 14 Tage: ein Level niedriger; genau 14 Tage nicht; Level 1 bleibt; Mini-Pausen zählen nicht', () => {
  const sessions = [tr(1)];
  const r = effectiveLevel({ state: st(), sessions, now: new Date(2026, 10, 16, 8) }); // 15 Tage

  assert.deepEqual(pick2(r), [2, 'pause-down']);
  assert.deepEqual(pick2(effectiveLevel({ state: st(), sessions, now: new Date(2026, 10, 15, 8) })), [3, null]);
  assert.deepEqual(pick2(effectiveLevel({ state: st({ level: 1 }), sessions, now: new Date(2026, 11, 30) })), [1, null]);
  const withBreak = [tr(1), mkSession({ date: D(20), kind: 'evening', effort: null })];
  assert.equal(effectiveLevel({ state: st(), sessions: withBreak, now: new Date(2026, 10, 25) }).change, 'pause-down');
  assert.deepEqual(pick2(effectiveLevel({ state: st(), sessions: [], now: new Date() })), [3, null]);
});
const pick2 = (r) => [r.level, r.change];

function data(over = {}) {
  _setNow(() => new Date(2026, 10, 1));
  const d = defaults();
  d.state.level = 3; d.state.levelSince = D(1); d.state.trainingsAtLevel = 0;
  return { ...d, ...over };
}

test('applyTrainingResult: Sessions, lastUsed, lastExerciseIds; Eingabe bleibt unverändert', () => {
  const d = data();
  const copy = JSON.stringify(d);
  const s = tr(8, { id: 'a', effort: 'richtig', exerciseIds: ['x', 'y', 'z'], skipped: ['y'], level: 3 });
  const out = applyTrainingResult(d, s, new Date(2026, 10, 8, 19));
  assert.equal(JSON.stringify(d), copy);
  assert.equal(out.sessions.length, 1);
  assert.equal(out.sessions[0].id, 'a');
  assert.deepEqual(out.state.lastExerciseIds, ['x', 'z']);
  assert.deepEqual(Object.keys(out.state.lastUsed).sort(), ['x', 'z']);
  assert.equal(out.state.lastUsed.x, s.date);
  assert.equal(out.state.trainingsAtLevel, 1);
  assert.equal(out.sessions[0].levelChange, 'hold');
  assert.equal(out.state.level, 3);
});

test('applyTrainingResult: Steigerung nach 2 guten Trainings, danach Zähler und levelSince zurückgesetzt', () => {
  let d = data();
  const now1 = new Date(2026, 10, 5, 19);
  d = applyTrainingResult(d, tr(5, { id: 'a', effort: 'leicht', level: 3 }), now1);
  assert.equal(d.state.level, 3);
  const now2 = new Date(2026, 10, 9, 19);
  d = applyTrainingResult(d, tr(9, { id: 'b', effort: 'richtig', level: 3 }), now2);
  assert.equal(d.state.level, 4);
  assert.equal(d.sessions[1].levelChange, 'up');
  assert.equal(d.state.trainingsAtLevel, 0);
  assert.equal(d.state.levelSince, now2.toISOString());
  // nächstes Training sofort: höchstens 1 Steigerung pro Woche
  d = applyTrainingResult(d, tr(10, { id: 'c', effort: 'leicht', level: 4 }), new Date(2026, 10, 10, 19));
  d = applyTrainingResult(d, tr(11, { id: 'd', effort: 'leicht', level: 4 }), new Date(2026, 10, 11, 19));
  assert.equal(d.state.level, 4);
  d = applyTrainingResult(d, tr(17, { id: 'e', effort: 'leicht', level: 4 }), new Date(2026, 10, 17, 19));
  assert.equal(d.state.level, 5);
});

test('applyTrainingResult: zurück bei „zu viel“', () => {
  const out = applyTrainingResult(data(), tr(8, { effort: 'zuviel', level: 3 }), new Date(2026, 10, 8, 19));
  assert.equal(out.state.level, 2);
  assert.equal(out.sessions[0].levelChange, 'down');
  assert.equal(out.state.trainingsAtLevel, 0);
});

test('applyTrainingResult: Pausen-Regel setzt Level vor dem Training zurück', () => {
  let d = data();
  d = applyTrainingResult(d, tr(1, { id: 'a', effort: 'richtig', level: 3 }), new Date(2026, 10, 1, 19));
  const late = new Date(2026, 10, 20, 19);
  const out = applyTrainingResult(d, mkSession({ id: 'b', date: late.toISOString(), effort: 'richtig', level: 2 }), late);
  assert.equal(out.state.level, 2);
  assert.equal(out.sessions[1].levelChange, 'pause-down');
  assert.equal(out.state.trainingsAtLevel, 1);
  // zusätzlich „zu viel“ → noch ein Level runter
  const out2 = applyTrainingResult(d, mkSession({ id: 'c', date: late.toISOString(), effort: 'zuviel', level: 2 }), late);
  assert.equal(out2.state.level, 1);
  assert.equal(out2.sessions[1].levelChange, 'down');
});

test('applyTrainingResult: Mini-Pausen ändern Level und Abwechslungs-Daten nicht', () => {
  const d = data();
  d.state.lastExerciseIds = ['q'];
  for (const kind of ['reset', 'evening']) {
    const out = applyTrainingResult(d, mkSession({ id: kind, kind, effort: null, exerciseIds: ['z'], painBefore: 2, painAfter: 9 }), new Date(2026, 10, 8));
    assert.equal(out.state.level, 3);
    assert.equal(out.state.trainingsAtLevel, 0);
    assert.deepEqual(out.state.lastExerciseIds, ['q']);
    assert.deepEqual(out.state.lastUsed, {});
    assert.equal(out.sessions.at(-1).levelChange, null);
  }
});

test('applyTrainingResult: gleiche Session-ID wird ersetzt, nicht doppelt', () => {
  let d = data();
  d = applyTrainingResult(d, tr(5, { id: 'a', effort: 'leicht' }), new Date(2026, 10, 5));
  d = applyTrainingResult(d, tr(5, { id: 'a', effort: 'leicht' }), new Date(2026, 10, 5));
  assert.equal(d.sessions.length, 1);
});
