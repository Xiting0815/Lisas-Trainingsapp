import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composePlan, routinePlan, swapExercise, BLOCK_MINUTES, BLOCK_COUNTS } from '../js/logic/compose.js';
import { estimatePlanSeconds } from '../js/logic/duration.js';
import { makeExercises, makeRoutines, seeded } from './helpers/fixtures-logic.js';

const EX = makeExercises();
const BY = new Map(EX.map((e) => [e.id, e]));
const NOW = new Date(2026, 10, 13, 10, 0, 0);
const plan = (o = {}) => composePlan({ minutes: 15, level: 1, pain: 0, exercises: EX, rng: seeded(7), now: NOW, ...o });
const ids = (p) => p.items.map((i) => i.exerciseId);
const exs = (p) => p.items.map((i) => BY.get(i.exerciseId));
const blocks = (p, b) => p.items.filter((i) => i.block === b);

test('Zeitbudget: alle Level × 10/15/20 × Ampel grün/gelb liegen im Rahmen von ±1 Min', () => {
  for (const minutes of [10, 15, 20]) {
    for (let level = 1; level <= 8; level++) {
      for (const pain of [0, 5]) {
        for (let seed = 1; seed <= 6; seed++) {
          const p = plan({ minutes, level, pain, rng: seeded(seed) });
          assert.ok(Math.abs(p.estSec - minutes * 60) <= 60, `${minutes} Min L${level} pain${pain} seed${seed}: ${p.estSec}s`);
          assert.equal(p.estSec, estimatePlanSeconds(p, BY));
          assert.equal(p.items.reduce((a, i) => a + i.estSec, 0), p.estSec);
        }
      }
    }
  }
});

test('Aufbau: Blöcke in Reihenfolge, Anzahl je Block, 20 Min = 3 Kraft + genau 1 Rumpf', () => {
  for (const minutes of [10, 15, 20]) {
    const p = plan({ minutes, level: 4 });
    const order = p.items.map((i) => i.block);
    assert.deepEqual([...new Set(order)], ['mobil', 'kraft', 'dehnen', 'atmung']);
    assert.deepEqual(order, [...order].sort((a, b) => ['mobil', 'kraft', 'dehnen', 'atmung'].indexOf(a) - ['mobil', 'kraft', 'dehnen', 'atmung'].indexOf(b)));
    for (const b of Object.keys(BLOCK_COUNTS[minutes])) assert.equal(blocks(p, b).length, BLOCK_COUNTS[minutes][b], `${minutes} ${b}`);
    assert.equal(blocks(p, 'kraft').length, { 10: 2, 15: 3, 20: 4 }[minutes]);
  }
  const p20 = plan({ minutes: 20, level: 5 });
  assert.equal(p20.items.filter((i) => i.role === 'rumpf').length, 1);
  assert.equal(BLOCK_MINUTES[20].kraft, 9);
});

test('Kraftblock enthält Schulterblatt-Rückzug (row) und Außenrotation (rot)', () => {
  for (const minutes of [10, 15, 20]) for (let level = 1; level <= 8; level++) for (let seed = 1; seed <= 5; seed++) {
    const kraft = exs(plan({ minutes, level, rng: seeded(seed) })).filter((e) => e.role === 'kraft' || e.role === 'rumpf');
    assert.ok(kraft.some((e) => e.focus.includes('row')), `row ${minutes}/${level}/${seed}`);
    assert.ok(kraft.some((e) => e.focus.includes('rot')), `rot ${minutes}/${level}/${seed}`);
  }
});

test('Level-Range: nur passende Übungen', () => {
  for (let level = 1; level <= 8; level++) {
    for (const e of exs(plan({ minutes: 20, level }))) assert.ok(level >= e.levelRange[0] && level <= e.levelRange[1], `${e.id} @L${level}`);
  }
});

test('Abwechslung: Übungen des letzten Trainings werden nicht wiederholt, solange der Pool reicht', () => {
  let last = [];
  const lastUsed = {};
  for (let i = 0; i < 6; i++) {
    const p = plan({ minutes: 15, level: 4, lastExerciseIds: last, lastUsed, rng: seeded(100 + i) });
    const overlap = ids(p).filter((id) => last.includes(id));
    assert.deepEqual(overlap, [], `Training ${i}`);
    last = ids(p);
    ids(p).forEach((id) => { lastUsed[id] = new Date(2026, 10, 1 + i).toISOString(); });
  }
});

test('Abwechslung: am längsten nicht dran kommt zuerst', () => {
  const lastUsed = { 'a-478': '2026-11-10T10:00:00Z', 'a-bauch': '2026-11-11T10:00:00Z' }; // a-kind nie → zuerst
  assert.ok(ids(plan({ lastUsed })).includes('a-kind'));
  const lu2 = { 'a-kind': '2026-11-10T10:00:00Z', 'a-bauch': '2026-11-11T10:00:00Z', 'a-478': '2026-09-01T10:00:00Z' };
  assert.ok(ids(plan({ lastUsed: lu2 })).includes('a-478'));
});

test('Determinismus: gleicher rng/now → gleicher Plan; anderer Seed darf abweichen', () => {
  assert.deepEqual(plan({ rng: seeded(5) }), plan({ rng: seeded(5) }));
});

test('Hohlkreuz: 15/20 Min enthalten immer eine Hohlkreuz-Übung; Hüftbeuger-Dehnung im Wechsel', () => {
  for (const minutes of [15, 20]) for (let seed = 1; seed <= 8; seed++) {
    assert.ok(exs(plan({ minutes, level: 3, rng: seeded(seed) })).some((e) => e.focus.includes('hohlkreuz')));
  }
  const hip = (p) => exs(p).some((e) => e.role === 'dehnen' && e.focus.includes('hohlkreuz'));
  // kein Hüftbeuger im letzten Training → jetzt einer (auch bei 10 Min)
  assert.ok(hip(plan({ minutes: 10, lastExerciseIds: ['d-nacken', 'd-brust'] })));
  // letztes Training hatte einen → Wechsel erlaubt
  const prev = plan({ minutes: 15, rng: seeded(3) });
  const p2 = plan({ minutes: 15, lastExerciseIds: ids(prev), rng: seeded(4) });
  assert.ok(ids(p2).every((id) => !ids(prev).includes(id)));
});

test('Ampel gelb: Kraft höchstens Level 2, Notiz, mehr Mobilisation/Atmung, Budget bleibt', () => {
  const g = plan({ minutes: 20, level: 7, pain: 0 });
  const y = plan({ minutes: 20, level: 7, pain: 5 });
  assert.equal(y.light, 'yellow');
  assert.equal(y.kraftLevel, 2);
  assert.ok(y.notes.includes('Heute sanft – das hilft auch!'));
  for (const it of y.items.filter((i) => i.block === 'kraft')) {
    const e = BY.get(it.exerciseId);
    assert.ok(e.levelRange[0] <= 2, `${e.id} darf bei Level 2 vorkommen`);
    assert.ok(it.sets <= e.doses[1].sets);
    assert.ok((it.reps ?? 0) <= (e.doses[1].reps ?? 99));
  }
  const sec = (p, b) => blocks(p, b).reduce((a, i) => a + i.estSec, 0);
  assert.ok(sec(y, 'mobil') + sec(y, 'atmung') > sec(g, 'mobil') + sec(g, 'atmung'));
  assert.ok(sec(y, 'kraft') < sec(g, 'kraft'));
  assert.equal(g.notes.length, 0);
});

test('Ampel rot: liefert Abend-Entspannung mit Rot-Hinweis (mit und ohne Routine)', () => {
  const r = plan({ pain: 8, routines: makeRoutines() });
  assert.equal(r.kind, 'evening');
  assert.equal(r.light, 'red');
  assert.match(r.notes[0], /ärztlich anschauen/);
  assert.ok(r.items.length >= 2);
  const r2 = plan({ pain: 7 });
  assert.equal(r2.kind, 'evening');
  assert.ok(r2.items.length >= 2);
  assert.ok(r2.items.every((i) => ['atmung', 'dehnen'].includes(BY.get(i.exerciseId).role)));
  assert.ok(Math.abs(r2.estSec - 300) <= 60);
});

test('rowWarmup nur bei 20 Min ab Level 3 (grün)', () => {
  assert.equal(plan({ minutes: 20, level: 3 }).rowWarmup, true);
  assert.equal(plan({ minutes: 20, level: 2 }).rowWarmup, undefined);
  assert.equal(plan({ minutes: 15, level: 5 }).rowWarmup, undefined);
  assert.equal(plan({ minutes: 20, level: 5, pain: 5 }).rowWarmup, undefined);
});

test('Dosen: Level 1 sehr leicht (gelbes Band, wenig Sätze), höhere Level steigern', () => {
  const l1 = plan({ minutes: 15, level: 1 });
  for (const it of blocks(l1, 'kraft')) { assert.ok(it.sets <= 2); if (it.band) assert.equal(it.band, 'yellow'); }
  const l8 = plan({ minutes: 20, level: 8 });
  assert.ok(l8.items.some((i) => i.band === 'blue'));
});

test('routinePlan: Nacken-Reset und Abend-Entspannung', () => {
  const reset = routinePlan('reset', { routines: makeRoutines(), exercises: EX, level: 3, rng: seeded(1), now: NOW });
  assert.equal(reset.kind, 'reset');
  assert.equal(reset.minutes, 2);
  assert.deepEqual(ids(reset), ['mob-schultern', 'k-setzen', 'a-bauch']);
  assert.equal(reset.items[0].seconds, 20);
  assert.ok(reset.estSec > 0 && reset.estSec === estimatePlanSeconds(reset, BY));
  const ev = routinePlan('evening', { routines: makeRoutines(), exercises: EX });
  assert.equal(ev.kind, 'evening');
  assert.equal(ev.minutes, 5);
  assert.equal(ev.items.length, 3);
  // unbekannte Übungen werden übersprungen
  const odd = routinePlan('reset', { routines: { reset: { minutes: 2, items: [{ exerciseId: 'gibts-nicht' }] } }, exercises: EX });
  assert.deepEqual(odd.items, []);
});

test('swapExercise: gentler, sonst gleiche Rolle, sonst entfernen', () => {
  const p = plan({ minutes: 15, level: 5, rng: seeded(2) });
  // Übung mit gentler
  const withG = { ...p, items: [{ ...p.items[0] }, ...p.items.slice(1)] };
  const idx = withG.items.findIndex((i) => BY.get(i.exerciseId).gentler && !ids(withG).includes(BY.get(i.exerciseId).gentler));
  const target = idx >= 0 ? idx : null;
  if (target != null) {
    const r = swapExercise(withG, target, { exercises: EX, level: 5, rng: seeded(1) });
    assert.equal(r.replacement, BY.get(withG.items[target].exerciseId).gentler);
    assert.equal(r.plan.items[target].exerciseId, r.replacement);
    assert.equal(withG.items[target].exerciseId !== r.replacement, true, 'Original unverändert');
  }
  // erzwungen: gentler vorhanden → verwendet
  const forced = { ...p, level: 5, items: [{ exerciseId: 'k-facepull', block: 'kraft', role: 'kraft', sets: 2, reps: 10, side: 'both', estSec: 100 }] };
  const r1 = swapExercise(forced, 0, { exercises: EX, level: 5, rng: seeded(1) });
  assert.equal(r1.replacement, 'k-pullapart');
  assert.equal(r1.plan.items[0].role, 'kraft');
  assert.equal(r1.plan.estSec, r1.plan.items[0].estSec);
  // gentler schon im Plan → andere Übung gleicher Rolle mit gleichem/niedrigerem Anspruch
  const two = { ...forced, items: [forced.items[0], { exerciseId: 'k-pullapart', block: 'kraft', role: 'kraft', sets: 2, reps: 10, side: 'both', estSec: 100 }] };
  const r2 = swapExercise(two, 0, { exercises: EX, level: 5, rng: seeded(1) });
  assert.ok(r2.replacement);
  assert.notEqual(r2.replacement, 'k-pullapart');
  assert.equal(BY.get(r2.replacement).role, 'kraft');
  assert.ok(BY.get(r2.replacement).levelRange[0] <= BY.get('k-facepull').levelRange[0]);
  // kein Ersatz möglich → entfernt
  const solo = [BY.get('d-nacken')];
  const sp = { id: 'x', kind: 'training', minutes: 10, level: 1, light: 'green', notes: [], items: [{ exerciseId: 'd-nacken', block: 'dehnen', role: 'dehnen', sets: 1, seconds: 20, side: 'each', estSec: 70 }], estSec: 70 };
  const r3 = swapExercise(sp, 0, { exercises: solo, level: 1 });
  assert.equal(r3.replacement, null);
  assert.deepEqual(r3.plan.items, []);
  assert.equal(r3.plan.estSec, 0);
  // ungültiger Index
  assert.equal(swapExercise(sp, 5, { exercises: solo, level: 1 }).replacement, null);
});

test('swapExercise erhält row/rot-Fokus im Kraftblock, wenn möglich', () => {
  const pl = { id: 'x', kind: 'training', minutes: 15, level: 4, light: 'green', notes: [], estSec: 100,
    items: [{ exerciseId: 'k-ytw', block: 'kraft', role: 'kraft', sets: 2, reps: 10, side: 'both', estSec: 100 }] };
  const r = swapExercise(pl, 0, { exercises: EX, level: 4, rng: seeded(3) });
  const e = BY.get(r.replacement);
  assert.ok(e.focus.includes('rot') || e.focus.includes('row'));
});
