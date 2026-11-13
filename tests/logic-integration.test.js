// Integrationstest mit den echten Übungsdaten (data/*.json). Wird übersprungen, solange sie nicht im neuen Schema vorliegen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { composePlan, routinePlan } from '../js/logic/compose.js';
import { estimatePlanSeconds } from '../js/logic/duration.js';
import { seeded } from './helpers/fixtures-logic.js';

const read = (f) => (existsSync(new URL(`../data/${f}`, import.meta.url)) ? JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8')) : null);
const exData = read('exercises.json');
const EX = exData?.exercises || [];
const ready = EX.length > 0 && EX.every((e) => e.role && Array.isArray(e.doses) && e.doses.length === 8 && Array.isArray(e.levelRange));
const skip = ready ? false : 'data/exercises.json liegt noch nicht im neuen Schema vor';
const BY = new Map(EX.map((e) => [e.id, e]));
const routines = read('routines.json');

test('echte Daten: Zeitbudget ±1 Min für alle Level × 10/15/20 × Ampel grün/gelb', { skip }, () => {
  for (const minutes of [10, 15, 20]) for (let level = 1; level <= 8; level++) for (const pain of [0, 5]) for (let seed = 1; seed <= 5; seed++) {
    const p = composePlan({ minutes, level, pain, exercises: EX, rng: seeded(seed), now: new Date(2026, 10, 13), routines });
    assert.ok(Math.abs(p.estSec - minutes * 60) <= 60, `${minutes} Min L${level} pain${pain} seed${seed}: ${p.estSec}s`);
    assert.equal(p.estSec, estimatePlanSeconds(p, BY));
    const kraft = p.items.filter((i) => i.block === 'kraft').map((i) => BY.get(i.exerciseId));
    assert.ok(kraft.some((e) => e.focus.includes('row')) && kraft.some((e) => e.focus.includes('rot')), 'row + rot');
    for (const it of p.items) {
      const e = BY.get(it.exerciseId);
      const lv = it.block === 'kraft' ? p.kraftLevel ?? level : level;
      assert.ok(lv >= e.levelRange[0] && lv <= e.levelRange[1], `${e.id} L${lv}`);
    }
    if (minutes >= 15) assert.ok(p.items.some((i) => BY.get(i.exerciseId).focus.includes('hohlkreuz')), 'Hohlkreuz');
  }
});

test('echte Daten: Abwechslung über viele Trainings, rot = Abend-Entspannung, Routinen', { skip }, () => {
  let last = [];
  const lastUsed = {};
  for (let i = 0; i < 10; i++) {
    const p = composePlan({ minutes: 15, level: 4, exercises: EX, lastExerciseIds: last, lastUsed, rng: seeded(i + 1), now: new Date(2026, 10, 1 + i) });
    assert.deepEqual(p.items.filter((it) => last.includes(it.exerciseId)), []);
    last = p.items.map((it) => it.exerciseId);
    last.forEach((id) => { lastUsed[id] = new Date(2026, 10, 1 + i).toISOString(); });
  }
  const red = composePlan({ minutes: 20, level: 4, pain: 8, exercises: EX, routines });
  assert.equal(red.kind, 'evening');
  for (const kind of ['reset', 'evening']) {
    const r = routinePlan(kind, { routines, exercises: EX, level: 2 });
    assert.ok(r.items.length >= 3, kind);
    assert.ok(Math.abs(r.estSec / 60 - routines[kind].minutes) <= 2, `${kind}: ${r.estSec}s`);
  }
});
