// Kleine Fixture-Übungen für die Logik-Tests (unabhängig von data/exercises.json).
const BANDS = ['yellow', 'yellow', 'red', 'red', 'green', 'green', 'blue', 'blue'];

/** 8 Dosen: reps steigen, ab Level 3 mehr Sätze. */
function repsDoses(band = true) {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((l) => ({ sets: l === 1 ? 1 : l < 4 ? 2 : 3, reps: 8 + Math.floor(l / 2), ...(band ? { band: BANDS[l - 1] } : {}), rest: 20 }));
}
const holdDoses = () => [1, 2, 3, 4, 5, 6, 7, 8].map((l) => ({ sets: l < 3 ? 1 : 2, seconds: 10 + l * 2, reps: l > 4 ? 2 : 1, rest: 20 }));
const timedDoses = (s = 30) => [1, 2, 3, 4, 5, 6, 7, 8].map((l) => ({ sets: 1, seconds: s + l * 3 }));

let n = 0;
const ex = (id, role, type, focus, levelRange, extra = {}) => ({
  id, name: id, short: `${id} kurz`, setup: `Aufbau ${id}.`, steps: ['a', 'b', 'c'], feel: 'Du spürst etwas.', category: role,
  type, side: 'both', role, focus, levelRange, gentler: null, gear: 'Matte',
  doses: type === 'reps' ? repsDoses(role === 'kraft') : type === 'hold' ? holdDoses() : timedDoses(), ...extra, _n: n++,
});

export function makeExercises() {
  return [
    // Mobilisation
    ex('mob-schultern', 'mobil', 'timed', ['nacken'], [1, 8], { setupSec: 5 }),
    ex('mob-wirbelsaeule', 'mobil', 'reps', [], [1, 8], { side: 'alternate' }),
    ex('mob-rotation', 'mobil', 'reps', [], [1, 8], { side: 'each' }),
    ex('mob-beckenkippen', 'mobil', 'reps', ['hohlkreuz'], [1, 8]),
    ex('mob-buch', 'mobil', 'timed', [], [1, 8], { side: 'each' }),
    // Kraft
    ex('k-setzen', 'kraft', 'hold', ['row'], [1, 3], { gentler: null }),
    ex('k-pullapart', 'kraft', 'reps', ['row'], [1, 8], { gentler: 'k-setzen' }),
    ex('k-facepull', 'kraft', 'reps', ['row'], [3, 8], { gentler: 'k-pullapart' }),
    ex('k-sling-row', 'kraft', 'reps', ['row'], [5, 8], { gentler: 'k-facepull' }),
    ex('k-er-handtuch', 'kraft', 'reps', ['rot'], [1, 4], { gentler: null }),
    ex('k-er-liegend', 'kraft', 'reps', ['rot'], [2, 8], { side: 'each', gentler: 'k-er-handtuch' }),
    ex('k-wallslide', 'kraft', 'reps', ['rot'], [1, 8]),
    ex('k-ytw', 'kraft', 'reps', ['rot', 'row'], [4, 8]),
    ex('k-serratus', 'kraft', 'reps', [], [1, 8]),
    // Rumpf
    ex('r-deadbug', 'rumpf', 'reps', ['hohlkreuz'], [1, 8], { side: 'alternate' }),
    ex('r-bridge', 'rumpf', 'reps', ['hohlkreuz'], [1, 8]),
    ex('r-seitstuetz', 'rumpf', 'hold', ['hohlkreuz'], [3, 8], { side: 'each' }),
    // Dehnen
    ex('d-nacken', 'dehnen', 'hold', ['nacken'], [1, 8], { side: 'each' }),
    ex('d-levator', 'dehnen', 'hold', ['nacken'], [1, 8], { side: 'each' }),
    ex('d-brust', 'dehnen', 'hold', ['brust'], [1, 8]),
    ex('d-hueftbeuger', 'dehnen', 'hold', ['hohlkreuz'], [1, 8], { side: 'each' }),
    ex('d-hueftbeuger-liegend', 'dehnen', 'hold', ['hohlkreuz'], [1, 8], { side: 'each' }),
    ex('d-seite', 'dehnen', 'hold', [], [1, 8], { side: 'each' }),
    // Atmung
    ex('a-478', 'atmung', 'timed', ['entspannung'], [1, 8]),
    ex('a-bauch', 'atmung', 'timed', ['entspannung'], [1, 8]),
    ex('a-kind', 'atmung', 'timed', ['entspannung', 'nacken'], [1, 8]),
  ].map(({ _n, ...e }) => e);
}

export function makeRoutines() {
  return {
    reset: { name: 'Nacken-Reset', minutes: 2, items: [
      { exerciseId: 'mob-schultern', seconds: 20 }, { exerciseId: 'k-setzen', seconds: 10, sets: 1 }, { exerciseId: 'a-bauch', seconds: 30 },
    ] },
    evening: { name: 'Abend-Entspannung', minutes: 5, items: [
      { exerciseId: 'a-bauch', seconds: 120 }, { exerciseId: 'd-nacken', seconds: 20 }, { exerciseId: 'a-478', seconds: 60 },
    ] },
  };
}

/** Deterministischer Zufall (mulberry32). */
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Minimale gültige Einheit. */
export function mkSession(over = {}) {
  return {
    id: `s-${Math.random().toString(36).slice(2, 8)}`, date: '2026-11-02T18:00:00.000Z', kind: 'training', minutes: 15, level: 1,
    light: 'green', painBefore: 3, painAfter: 3, effort: 'richtig', exerciseIds: [], skipped: [], swaps: [], durationSec: 900, levelChange: null, ...over,
  };
}
