import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekSummary, daysSinceLast, needsNudge, needsExportHint, painSeries } from '../js/logic/week.js';
import { tipOfDay } from '../js/logic/tips.js';
import { mkSession } from './helpers/fixtures-logic.js';

const at = (m, d, h = 12) => new Date(2026, m - 1, d, h, 0, 0).toISOString();
// Freitag, 13.11.2026 → Woche Mo 9.11. – So 15.11.
const NOW = new Date(2026, 10, 13, 9, 0, 0);

test('weekSummary: Woche beginnt Montag, zählt Trainings und Mini-Pausen', () => {
  const s = [
    mkSession({ date: at(11, 8, 23) }), // Sonntag davor → nicht dabei
    mkSession({ date: at(11, 9) }), mkSession({ date: at(11, 12) }),
    mkSession({ kind: 'reset', date: at(11, 10) }), mkSession({ kind: 'reset', date: at(11, 11) }),
    mkSession({ kind: 'evening', date: at(11, 12) }), mkSession({ kind: 'reset', date: at(11, 13, 8) }),
  ];
  const w = weekSummary(s, NOW);
  assert.deepEqual([w.trainings, w.breaks], [2, 4]);
  assert.equal(w.text, 'Diese Woche: 2 Trainings, 4 Mini-Pausen 💗');
});

test('weekSummary: Einzahl, nur eine Sorte, leer – nie vorwurfsvoll', () => {
  assert.equal(weekSummary([mkSession({ date: at(11, 10) })], NOW).text, 'Diese Woche: 1 Training 💗');
  assert.equal(weekSummary([mkSession({ kind: 'evening', date: at(11, 10) })], NOW).text, 'Diese Woche: 1 Mini-Pause 💗');
  const e = weekSummary([], NOW);
  assert.deepEqual([e.trainings, e.breaks], [0, 0]);
  assert.match(e.text, /ohne Druck/);
  // Montag früh: Vorwoche zählt nicht
  assert.equal(weekSummary([mkSession({ date: at(11, 8) })], new Date(2026, 10, 9, 7)).trainings, 0);
  assert.equal(weekSummary(null, NOW).trainings, 0);
});

test('daysSinceLast / needsNudge: ab 3 Tagen, ohne Einheiten kein Hinweis', () => {
  assert.equal(daysSinceLast([], NOW), null);
  assert.equal(needsNudge([], NOW), false);
  assert.equal(daysSinceLast([mkSession({ date: at(11, 13, 7) })], NOW), 0);
  assert.equal(daysSinceLast([mkSession({ date: at(11, 10, 23) }), mkSession({ kind: 'reset', date: at(11, 11, 1) })], NOW), 2);
  assert.equal(needsNudge([mkSession({ date: at(11, 11) })], NOW), false);
  assert.equal(needsNudge([mkSession({ date: at(11, 10) })], NOW), true);
  assert.equal(needsNudge([mkSession({ kind: 'reset', date: at(11, 3) })], NOW), true);
});

test('needsExportHint: alle 14 Tage seit Export bzw. weggeklicktem Hinweis', () => {
  const s = (o) => ({ lastExportAt: null, exportHintDismissedAt: null, ...o });
  assert.equal(needsExportHint(s(), NOW), false); // kein Bezugspunkt
  assert.equal(needsExportHint(s(), NOW, { firstRunAt: at(10, 30) }), true); // 14 Tage seit erstem Start
  assert.equal(needsExportHint(s(), NOW, { firstRunAt: at(11, 1) }), false);
  assert.equal(needsExportHint(s({ lastExportAt: at(10, 30) }), NOW), true);
  assert.equal(needsExportHint(s({ lastExportAt: at(10, 31) }), NOW), false);
  assert.equal(needsExportHint(s({ lastExportAt: at(9, 1), exportHintDismissedAt: at(11, 10) }), NOW), false);
});

test('painSeries: chronologisch, nur mit Schmerzwerten', () => {
  const ser = painSeries([
    mkSession({ date: at(11, 10), painBefore: 5, painAfter: 3 }),
    mkSession({ date: at(11, 8), painBefore: 6, painAfter: null }),
    mkSession({ date: at(11, 9), painBefore: null, painAfter: null }),
    mkSession({ kind: 'evening', date: at(11, 11), painBefore: 4, painAfter: 2 }),
  ]);
  assert.deepEqual(ser.map((p) => [p.before, p.after]), [[6, null], [5, 3], [4, 2]]);
  assert.ok(ser[0].date < ser[1].date);
});

test('tipOfDay: rotiert deterministisch nach Tag', () => {
  const tips = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const d = (day, h = 8) => new Date(2026, 10, day, h);
  assert.equal(tipOfDay(tips, d(13)).id, tipOfDay(tips, d(13, 22)).id);
  const seq = [13, 14, 15, 16].map((x) => tipOfDay(tips, d(x)).id);
  assert.notEqual(seq[0], seq[1]);
  assert.equal(seq[0], seq[3]);
  assert.deepEqual(new Set([13, 14, 15].map((x) => tipOfDay(tips, d(x)).id)).size, 3);
  assert.equal(tipOfDay([], d(1)), null);
  assert.equal(tipOfDay(null, d(1)), null);
});
