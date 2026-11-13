// Zusammenstellung eines Trainings. PURE: kein DOM, kein Speicher; `rng` und `now` sind injizierbar.
// Siehe docs/SPEC.md §4 und Anleitung §4/§5.
import { estimateExerciseSeconds, estimatePlanSeconds, toExerciseMap } from './duration.js';
import { lightFor, LIGHT_INFO } from './traffic.js';
import { toDate } from './levels.js';

export const BLOCKS = ['mobil', 'kraft', 'dehnen', 'atmung'];
/** Block-Zeiten in Minuten laut Anleitung §4. */
export const BLOCK_MINUTES = {
  10: { mobil: 2, kraft: 4, dehnen: 2, atmung: 2 },
  15: { mobil: 3, kraft: 6, dehnen: 3, atmung: 3 },
  20: { mobil: 3, kraft: 9, dehnen: 4, atmung: 4 },
};
/** Block-Zeiten bei Ampel Gelb (in Sekunden): weniger Kraft, mehr Mobilisation und Atmung. */
export const YELLOW_BLOCK_SECONDS = {
  10: { mobil: 150, kraft: 180, dehnen: 120, atmung: 150 },
  15: { mobil: 240, kraft: 300, dehnen: 150, atmung: 210 },
  20: { mobil: 270, kraft: 420, dehnen: 210, atmung: 300 },
};
/** Anzahl Übungen je Block. Beim Kraftblock zählt der Rumpf mit (20 Min: 3 Kraft + 1 Rumpf). */
export const BLOCK_COUNTS = {
  10: { mobil: 1, kraft: 2, dehnen: 1, atmung: 1 },
  15: { mobil: 2, kraft: 3, dehnen: 2, atmung: 1 },
  20: { mobil: 2, kraft: 4, dehnen: 2, atmung: 1 },
};
export const YELLOW_MAX_KRAFT_LEVEL = 2;
export const TOLERANCE_SEC = 60;

const blockOf = (role) => (role === 'rumpf' ? 'kraft' : role);
const lvlClamp = (n) => Math.max(1, Math.min(8, Math.round(Number.isFinite(n) ? n : 1)));
const inRange = (ex, level) => {
  const r = ex?.levelRange;
  return !Array.isArray(r) || (level >= r[0] && level <= r[1]);
};
const rangeDistance = (ex, level) => {
  const r = ex?.levelRange;
  if (!Array.isArray(r)) return 0;
  return level < r[0] ? r[0] - level : level > r[1] ? level - r[1] : 0;
};
const hasFocus = (ex, f) => Array.isArray(ex?.focus) && ex.focus.includes(f);
const timeOfISO = (v) => {
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : -Infinity;
};

/** Dosis einer Übung für ein Level (mit Rückfall, falls `doses` unvollständig ist). */
export function doseFor(ex, level) {
  const doses = Array.isArray(ex?.doses) ? ex.doses : [];
  const d = doses[lvlClamp(level) - 1] ?? doses[doses.length - 1];
  if (d && typeof d === 'object') return d;
  return ex?.type === 'reps' ? { sets: 1, reps: 8 } : { sets: 1, seconds: 30 };
}

/** Plan-Eintrag aus Übung + Level. */
export function makeItem(ex, level) {
  const d = doseFor(ex, level);
  const item = { exerciseId: ex.id, block: blockOf(ex.role), role: ex.role, sets: Math.max(1, d.sets ?? 1) };
  if (ex.type === 'reps') item.reps = d.reps ?? 8;
  else {
    item.seconds = d.seconds ?? 30;
    if (ex.type === 'hold' && Number.isFinite(d.reps) && d.reps > 1) item.reps = d.reps;
  }
  if (d.band) item.band = d.band;
  if (Number.isFinite(d.rest)) item.rest = d.rest;
  item.side = ex.side || 'both';
  item.estSec = estimateExerciseSeconds(item, ex);
  return item;
}

/** Zufällig gemischt (Fisher-Yates mit `rng`), dann stabil nach „am längsten nicht dran“ sortiert. */
function rank(list, lastUsed, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a
    .map((ex, i) => ({ ex, i, t: timeOfISO(lastUsed?.[ex.id]) }))
    .sort((x, y) => x.t - y.t || x.i - y.i)
    .map((x) => x.ex);
}

/**
 * Wählt `n` Übungen aus `pool`: zuerst die geforderten Schwerpunkte (je einer), dann Rest.
 * Übungen aus `avoid` (letztes Training) nur, wenn der Pool sonst nicht reicht.
 */
function pick({ pool, n, require = [], avoid, used, lastUsed, rng }) {
  const chosen = [];
  const free = () => pool.filter((e) => !used.has(e.id) && !chosen.includes(e));
  const choose = (list) => {
    const pref = list.filter((e) => !avoid.has(e.id));
    return rank(pref.length ? pref : list, lastUsed, rng)[0];
  };
  for (const f of require) {
    if (chosen.length >= n) break;
    if (chosen.some((e) => hasFocus(e, f))) continue;
    const c = free().filter((e) => hasFocus(e, f));
    if (c.length) chosen.push(choose(c));
  }
  while (chosen.length < n) {
    const c = free();
    if (!c.length) break;
    chosen.push(choose(c));
  }
  chosen.forEach((e) => used.add(e.id));
  return chosen;
}

/** Pool einer Rolle für ein Level; bei zu wenigen Treffern werden die nächstliegenden Level-Bereiche ergänzt. */
function poolFor(exercises, role, level, need) {
  const all = exercises.filter((e) => e.role === role && !e.rowWarmup);
  const exact = all.filter((e) => inRange(e, level));
  if (exact.length >= need) return exact;
  const rest = all.filter((e) => !exact.includes(e)).sort((a, b) => rangeDistance(a, level) - rangeDistance(b, level));
  return [...exact, ...rest.slice(0, Math.max(0, need - exact.length))];
}

// ---------------------------------------------------------------------------------------------- Zeit anpassen

const MIN_REPS = 6;
const minSeconds = (ex) => (ex.role === 'atmung' ? 20 : ex.type === 'hold' ? 8 : 10);

function shrinkStep(it, ex) {
  if (it.sets > 2) return { ...it, sets: it.sets - 1 };
  if (ex.type === 'reps' && it.reps > MIN_REPS) return { ...it, reps: Math.max(MIN_REPS, it.reps - 2) };
  if (ex.type !== 'reps' && it.seconds > minSeconds(ex)) return { ...it, seconds: Math.max(minSeconds(ex), it.seconds - 5) };
  if (it.sets > 1) return { ...it, sets: it.sets - 1 };
  return null;
}

function growStep(it, ex, base) {
  const strict = ex.role === 'kraft' || ex.role === 'rumpf';
  if (ex.type === 'reps') {
    const cap = strict ? base.reps : Math.min(20, base.reps * 2);
    if (it.reps < cap) return { ...it, reps: Math.min(cap, it.reps + 2) };
  } else {
    const cap = strict ? base.seconds : Math.min(300, Math.max(base.seconds * 2, base.seconds + 60));
    if (it.seconds < cap) return { ...it, seconds: Math.min(cap, it.seconds + 5) };
  }
  if (it.sets < base.sets) return { ...it, sets: it.sets + 1 };
  return null;
}

/**
 * Passt Einträge an ein Zeitbudget an: erst kürzen (Sätze/Wdh./Sekunden), dann – nur im Rahmen der Dosis bzw.
 * bei Mobilisation/Dehnen/Atmung großzügiger – verlängern. Gibt neue Einträge zurück (gleiche Reihenfolge).
 */
export function fitItems(items, targetSec, byId) {
  const map = toExerciseMap(byId);
  const base = new Map(items.map((it) => [it.exerciseId, { sets: it.sets, reps: it.reps, seconds: it.seconds }]));
  let cur = items.map((it) => ({ ...it }));
  const est = (it) => estimateExerciseSeconds(it, map.get(it.exerciseId));
  const total = () => cur.reduce((a, it) => a + est(it), 0);
  let guard = 600;
  while (total() > targetSec && guard-- > 0) {
    const order = cur.map((it, i) => ({ i, e: est(it) })).sort((a, b) => b.e - a.e);
    let done = false;
    for (const { i } of order) {
      const next = shrinkStep(cur[i], map.get(cur[i].exerciseId));
      if (next) { cur[i] = next; done = true; break; }
    }
    if (!done) break;
  }
  guard = 600;
  while (guard-- > 0) {
    const t = total();
    const order = cur.map((it, i) => ({ i, e: est(it) })).sort((a, b) => a.e - b.e);
    let done = false;
    for (const { i } of order) {
      const ex = map.get(cur[i].exerciseId);
      const next = growStep(cur[i], ex, base.get(cur[i].exerciseId));
      if (next && t - est(cur[i]) + est(next) <= targetSec + 10) { cur[i] = next; done = true; break; }
    }
    if (!done) break;
  }
  return cur.map((it) => ({ ...it, estSec: est(it) }));
}

// ---------------------------------------------------------------------------------------------- Pläne

const newId = (kind, now, rng) => `plan-${kind}-${toDate(now).getTime()}-${Math.floor(rng() * 1e6)}`;

const sumSec = (items) => items.reduce((a, it) => a + it.estSec, 0);

/**
 * Trainingsplan für 10, 15 oder 20 Minuten.
 * - Ampel rot (Schmerz 7–10) → Abend-Entspannung (`kind: 'evening'`, mit Hinweis); dafür optional `routines` übergeben
 *   (sonst wird sie aus Übungen mit Schwerpunkt „entspannung“ gebaut).
 * - Gelb → Kraft-Level höchstens 2, mehr Mobilisation/Atmung, Notiz „Heute sanft – das hilft auch!“.
 * @param {{minutes?: 10|15|20, level?: number, pain?: number, exercises: import('../types.js').Exercise[],
 *   lastExerciseIds?: string[], lastUsed?: Record<string,string>, rng?: () => number, now?: Date|number|string,
 *   routines?: any}} args
 * @returns {import('../types.js').Plan}
 */
export function composePlan({ minutes = 15, level = 1, pain = 0, exercises, lastExerciseIds = [], lastUsed = {}, rng = Math.random, now, routines } = {}) {
  const exs = Array.isArray(exercises) ? exercises : [];
  const mins = [10, 15, 20].includes(minutes) ? minutes : 15;
  const lvl = lvlClamp(level);
  const light = lightFor(pain);
  if (light === 'red') return eveningFallbackPlan({ routines, exercises: exs, level: lvl, rng, now, lastUsed, light });

  const byId = new Map(exs.map((e) => [e.id, e]));
  const yellow = light === 'yellow';
  const kraftLevel = yellow ? Math.min(lvl, YELLOW_MAX_KRAFT_LEVEL) : lvl;
  const counts = BLOCK_COUNTS[mins];
  const budgets = yellow
    ? YELLOW_BLOCK_SECONDS[mins]
    : Object.fromEntries(Object.entries(BLOCK_MINUTES[mins]).map(([k, m]) => [k, m * 60]));
  const avoid = new Set(lastExerciseIds || []);
  const used = new Set();
  const sel = { mobil: [], kraft: [], dehnen: [], atmung: [] };
  const hasHip = (ids) => ids.some((id) => { const e = byId.get(id); return e && e.role === 'dehnen' && hasFocus(e, 'hohlkreuz'); });
  const hasHohl = (ids) => ids.some((id) => hasFocus(byId.get(id), 'hohlkreuz'));
  const needHip = !hasHip(lastExerciseIds || []); // Hüftbeuger-Dehnung im Wechsel mit jedem 2. Training

  // Kraftblock: ≥1 row, ≥1 rot; bei 20 Min genau 1 Rumpf (3 Kraft + 1 Rumpf), bei 15 Min 2 Kraft + 1 Rumpf (Hohlkreuz).
  const nKraft = counts.kraft;
  const nRumpf = mins === 20 ? 1 : mins === 15 ? 1 : 0;
  const kraftPool = poolFor(exs, 'kraft', kraftLevel, nKraft - nRumpf);
  sel.kraft = pick({ pool: kraftPool, n: nKraft - nRumpf, require: ['row', 'rot'], avoid, used, lastUsed, rng });
  if (nRumpf) {
    const rumpfPool = poolFor(exs, 'rumpf', kraftLevel, nRumpf);
    const r = pick({ pool: rumpfPool, n: nRumpf, require: ['hohlkreuz'], avoid, used, lastUsed, rng });
    sel.kraft.push(...r);
    if (r.length < nRumpf) { // kein Rumpf-Pool → weitere Kraftübung
      sel.kraft.push(...pick({ pool: kraftPool, n: nRumpf - r.length, avoid, used, lastUsed, rng }));
    }
  }
  // Mobilisation. Bei 15/20 Min ohne Hohlkreuz-Übung bisher → Beckenkippen o. Ä. bevorzugt, falls vorhanden.
  const mobilPool = poolFor(exs, 'mobil', lvl, counts.mobil);
  const hohlSoFar = () => hasHohl([...sel.kraft.map((e) => e.id)]);
  const dehnenPool = poolFor(exs, 'dehnen', lvl, counts.dehnen);
  const dehnenReq = [];
  if (needHip || (mins >= 15 && !hohlSoFar())) dehnenReq.push('hohlkreuz');
  sel.dehnen = pick({ pool: dehnenPool, n: counts.dehnen, require: dehnenReq, avoid, used, lastUsed, rng });
  const mobilReq = mins >= 15 && !hohlSoFar() && !hasHohl(sel.dehnen.map((e) => e.id)) ? ['hohlkreuz'] : [];
  sel.mobil = pick({ pool: mobilPool, n: counts.mobil, require: mobilReq, avoid, used, lastUsed, rng });
  const atmungPool = poolFor(exs, 'atmung', lvl, counts.atmung);
  sel.atmung = pick({ pool: atmungPool, n: counts.atmung, require: yellow ? ['entspannung'] : [], avoid, used, lastUsed, rng });

  // Einträge je Block, an das Block-Budget angepasst.
  const items = [];
  for (const block of BLOCKS) {
    const raw = sel[block].map((e) => makeItem(e, e.role === 'kraft' || e.role === 'rumpf' ? kraftLevel : lvl));
    items.push(...fitItems(raw, budgets[block], byId));
  }
  // Gesamtanpassung (Ziel = Gesamtbudget): fehlende Zeit auf die flexiblen Blöcke verteilen.
  const targetTotal = BLOCKS.reduce((a, b) => a + budgets[b], 0);
  let fitted = fitTotal(items, targetTotal, byId);
  // Bleibt Zeit übrig (z. B. Level 1: sehr leichte Kraft-Dosen), kommt eine weitere sanfte Übung dazu
  // (Mobilisation, dann Atmung, dann Dehnen) – „viel Mobilisation und Atmung“ am Anfang.
  const extraRoles = [['mobil', mobilPool], ['atmung', atmungPool], ['dehnen', dehnenPool]];
  for (let k = 0; k < 4 && targetTotal - sumSec(fitted) > TOLERANCE_SEC * 0.75; k++) {
    const [block, pool] = extraRoles[k % extraRoles.length];
    const more = pick({ pool, n: 1, avoid, used, lastUsed, rng });
    if (!more.length) continue;
    const added = [...fitted, makeItem(more[0], lvl)]
      .map((it, i) => ({ it, i }))
      .sort((a, b) => BLOCKS.indexOf(a.it.block) - BLOCKS.indexOf(b.it.block) || a.i - b.i)
      .map((x) => x.it);
    fitted = fitItems(added, targetTotal, byId);
  }

  const notes = [];
  if (yellow) notes.push(LIGHT_INFO.yellow.hint);
  /** @type {import('../types.js').Plan} */
  const plan = {
    id: newId('training', now, rng),
    kind: 'training',
    minutes: mins,
    level: lvl,
    light,
    notes,
    items: fitted,
    estSec: sumSec(fitted),
  };
  if (yellow) plan.kraftLevel = kraftLevel;
  if (mins === 20 && lvl >= 3 && !yellow) plan.rowWarmup = true;
  return plan;
}

/** Zweite Anpassung über alle Einträge (Reihenfolge bleibt): kürzen oder verlängern auf das Gesamtbudget. */
function fitTotal(items, targetTotal, byId) {
  const total = sumSec(items);
  if (Math.abs(total - targetTotal) <= 10) return items;
  return fitItems(items, targetTotal, byId);
}

// Abend-Entspannung aus Routine oder (Rückfall) aus passenden Übungen.
function eveningFallbackPlan({ routines, exercises, level, rng, now, lastUsed, light }) {
  if (routines?.evening?.items?.length) {
    const p = routinePlan('evening', { routines, exercises, level });
    if (p.items.length) return finishRed(p, now, rng, light);
  }
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const used = new Set();
  const avoid = new Set();
  const calm = exercises.filter((e) => hasFocus(e, 'entspannung'));
  const pick1 = (pool, require = []) => pick({ pool, n: 1, require, avoid, used, lastUsed, rng })[0];
  const sel = [
    pick1(calm.filter((e) => e.role === 'atmung')),
    pick1(exercises.filter((e) => e.role === 'dehnen' && hasFocus(e, 'nacken'))),
    pick1(calm.filter((e) => e.role !== 'atmung' && e.role !== 'dehnen')) || pick1(exercises.filter((e) => e.role === 'atmung')),
  ].filter(Boolean);
  const items = fitItems(sel.map((e) => makeItem(e, level)), 300, byId);
  const plan = { id: '', kind: 'evening', minutes: 5, level, light, notes: [], items, estSec: sumSec(items) };
  return finishRed(plan, now, rng, light);
}

function finishRed(plan, now, rng, light) {
  return { ...plan, id: newId('evening', now, rng), light, notes: [LIGHT_INFO.red.hint, ...plan.notes.filter((n) => n !== LIGHT_INFO.red.hint)] };
}

/**
 * Plan einer Mini-Routine (`reset` = Nacken-Reset 2 Min, `evening` = Abend-Entspannung 5 Min) aus data/routines.json.
 * @param {'reset'|'evening'} kind
 * @param {{routines: any, exercises: import('../types.js').Exercise[], level?: number, rng?: () => number, now?: any, light?: string}} args
 * @returns {import('../types.js').Plan}
 */
export function routinePlan(kind, { routines, exercises, level = 1, rng = Math.random, now, light = 'green' } = {}) {
  const routine = routines?.[kind];
  const byId = toExerciseMap(exercises);
  const lvl = lvlClamp(level);
  const items = [];
  for (const r of routine?.items || []) {
    const ex = byId.get(r.exerciseId);
    if (!ex) continue;
    const item = makeItem(ex, lvl);
    if (Number.isFinite(r.sets)) item.sets = Math.max(1, Math.round(r.sets));
    if (ex.type === 'reps') {
      if (Number.isFinite(r.reps)) item.reps = r.reps;
      else if (Number.isFinite(r.seconds)) { item.reps = Math.max(1, Math.round(r.seconds / 4)); }
    } else {
      if (Number.isFinite(r.seconds)) item.seconds = r.seconds;
      else if (Number.isFinite(r.reps) && ex.type === 'timed') item.seconds = r.reps * 4;
      if (ex.type === 'hold' && Number.isFinite(r.reps) && r.reps > 1) item.reps = r.reps;
    }
    item.estSec = estimateExerciseSeconds(item, ex);
    items.push(item);
  }
  const notes = kind === 'reset'
    ? ['Im Stehen, ohne Geräte – ganz unauffällig, zum Beispiel am Arbeitsplatz.']
    : ['Leg dein Wärmekissen bereit und nimm dir einen ruhigen Platz.'];
  if (light === 'red') notes.unshift(LIGHT_INFO.red.hint);
  return {
    id: newId(kind, now, rng),
    kind,
    minutes: routine?.minutes ?? (kind === 'reset' ? 2 : 5),
    level: lvl,
    light,
    notes,
    items,
    estSec: sumSec(items),
  };
}

/**
 * „Das tut weh“: tauscht den Eintrag `index` gegen die sanftere Variante (`gentler`), sonst gegen eine andere Übung
 * derselben Rolle mit gleichem oder niedrigerem Anspruch; gibt es keine, wird der Eintrag entfernt.
 * Pur: gibt einen neuen Plan zurück.
 * @returns {{plan: import('../types.js').Plan, replacement: string|null}}
 */
export function swapExercise(plan, index, { exercises, level, lastUsed = {}, rng = Math.random } = {}) {
  const items = plan?.items || [];
  const old = items[index];
  if (!old) return { plan, replacement: null };
  const byId = toExerciseMap(exercises);
  const oldEx = byId.get(old.exerciseId);
  const lvl = lvlClamp(level ?? plan.level);
  const doseLevel = old.role === 'kraft' || old.role === 'rumpf' ? plan.kraftLevel ?? lvl : lvl;
  const inPlan = new Set(items.map((it) => it.exerciseId));
  const allList = [...byId.values()];

  let repl = null;
  const g = oldEx?.gentler ? byId.get(oldEx.gentler) : null;
  if (g && !inPlan.has(g.id)) repl = g;
  if (!repl && oldEx) {
    const myMin = Array.isArray(oldEx.levelRange) ? oldEx.levelRange[0] : 1;
    const cands = allList.filter((e) => e.role === oldEx.role && !inPlan.has(e.id) && inRange(e, doseLevel)
      && (Array.isArray(e.levelRange) ? e.levelRange[0] : 1) <= myMin);
    const keep = ['row', 'rot', 'hohlkreuz'].filter((f) => hasFocus(oldEx, f));
    const shared = (e) => keep.filter((f) => hasFocus(e, f)).length;
    const best = Math.max(0, ...cands.map(shared));
    repl = rank(cands.filter((e) => shared(e) === best), lastUsed, rng)[0] || null;
  }
  const rest = items.filter((_, i) => i !== index);
  if (!repl) {
    const next = { ...plan, items: rest };
    next.estSec = sumSec(rest);
    return { plan: next, replacement: null };
  }
  const [fitted] = fitItems([makeItem(repl, doseLevel)], old.estSec, byId);
  const newItems = [...items];
  newItems[index] = fitted;
  return { plan: { ...plan, items: newItems, estSec: sumSec(newItems) }, replacement: repl.id };
}

export { estimatePlanSeconds };
