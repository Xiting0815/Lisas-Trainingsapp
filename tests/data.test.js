// Datenvalidierung: Übungen, Routinen, Tipps, Sprüche, Posen (docs/SPEC.md §2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readContentFromDisk, readRawFromDisk } from './helpers/content-node.js';

const content = readContentFromDisk();
const raw = readRawFromDisk();
const ex = content.exercises;
const byId = content.byId;
const poses = content.poses.poses;

const ROLES = ['mobil', 'kraft', 'rumpf', 'dehnen', 'atmung'];
const FOCUS = ['row', 'rot', 'hohlkreuz', 'nacken', 'brust', 'entspannung', 'stehend-ohne-geraet'];
const BANDS = ['yellow', 'red', 'green', 'blue', 'loop-orange', 'loop-blue'];
const TYPES = ['reps', 'hold', 'timed'];
const SIDES = ['both', 'each', 'alternate'];
const KEEP_IDS = `shoulder-circles seated-spine-wave seated-thoracic-rotation thoracic-extension-floor band-dislocate hip-circles-standing
scapula-setting band-pull-apart pull-apart-low prone-low-row prone-ytw wall-slide wall-push-up-plus long-sit-row low-row-band low-face-pull face-pull
serratus-punch-low er-towel sidelying-er sling-row sling-face-pull sling-rear-delt-fly sling-t-raise sling-y-raise dead-bug glute-bridge
side-plank-elevated pallof-press sling-plank-forearms neck-side-stretch neck-stretch-low doorway-pec-stretch pec-stretch-low
cross-body-shoulder-stretch lat-side-stretch side-bend-low hip-flexor-stretch-standing hip-flexor-stretch-supine figure-4-stretch-supine
breathing-reset row-technique-warmup`.split(/\s+/);
const NEW_IDS = `chin-tuck-sitting chin-tuck-wall chin-tuck-lying neck-nod-lying shrug-drop levator-stretch cat-cow child-pose-breath open-book
pelvic-tilt-supine massage-stick-neck warmth-relax belly-breathing loop-scap-retraction`.split(/\s+/);

const isStr = (s) => typeof s === 'string' && s.trim().length > 0;
const textsOf = (e) => [e.name, e.short, e.setup, e.feel, e.gear, ...(e.warn ? [e.warn] : []), ...e.steps, ...e.instructions, ...e.mistakes, ...e.cues, ...Object.values(e.cueWords || {}),
  ...(e.figure?.labels || []).map((l) => l.text)];

test('Inhalt: alle Dateien vorhanden, keine Duplikate, Pflicht- und Lisa-Übungen da', () => {
  assert.equal(raw.exercises.version, 1);
  assert.equal(new Set(ex.map((e) => e.id)).size, ex.length, 'doppelte IDs');
  for (const id of [...KEEP_IDS, ...NEW_IDS]) assert.ok(byId.has(id), `Übung fehlt: ${id}`);
  assert.equal(ex.length, KEEP_IDS.length + NEW_IDS.length, 'keine überzähligen Übungen');
  for (const e of ex) assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${e.id}: ID nicht in kebab-case`);
});

test('Jede Übung hat alle Pflichtfelder im richtigen Format', () => {
  for (const e of ex) {
    for (const k of ['id', 'name', 'short', 'setup', 'feel', 'category', 'gear']) assert.ok(isStr(e[k]), `${e.id}.${k}`);
    assert.ok(Array.isArray(e.steps) && e.steps.length >= 3 && e.steps.length <= 4 && e.steps.every(isStr), `${e.id}: 3–4 Schritte`);
    assert.ok(Array.isArray(e.instructions) && e.instructions.length >= 3 && e.instructions.every(isStr), `${e.id}: instructions`);
    assert.ok(Array.isArray(e.mistakes) && e.mistakes.length >= 2 && e.mistakes.every(isStr), `${e.id}: mistakes`);
    assert.ok(Array.isArray(e.cues) && e.cues.length >= 2 && e.cues.every(isStr), `${e.id}: cues`);
    assert.ok(e.cueWords && Object.values(e.cueWords).every(isStr) && Object.keys(e.cueWords).length >= 1, `${e.id}: cueWords`);
    assert.ok(TYPES.includes(e.type), `${e.id}: type`);
    assert.ok(SIDES.includes(e.side), `${e.id}: side`);
    assert.ok(ROLES.includes(e.role), `${e.id}: role`);
    assert.ok(Array.isArray(e.focus) && e.focus.every((f) => FOCUS.includes(f)), `${e.id}: focus ${e.focus}`);
    assert.ok(e.warn === undefined || isStr(e.warn), `${e.id}: warn`);
    assert.ok(e.gentler === null || isStr(e.gentler), `${e.id}: gentler`);
    // veraltete Felder der Vorlage dürfen nicht mehr da sein
    for (const k of ['block', 'equipment', 'kneeNote', 'postOpNote', 'phaseMin', 'levels', 'upgrades', 'setupByEquipment']) assert.equal(e[k], undefined, `${e.id}: veraltetes Feld ${k}`);
    for (const k of Object.keys(e)) assert.ok(!/^shoulder/.test(k), `${e.id}: veraltetes Feld ${k}`);
  }
});

test('Dosierung: 8 Einträge, passend zum Typ, Level 1 sehr leicht', () => {
  for (const e of ex) {
    assert.equal(e.doses.length, 8, `${e.id}: 8 doses`);
    e.doses.forEach((d, i) => {
      const w = `${e.id} L${i + 1}`;
      assert.ok(Number.isInteger(d.sets) && d.sets >= 1 && d.sets <= 4, `${w}: sets`);
      if (e.type === 'reps') assert.ok(Number.isInteger(d.reps) && d.reps >= 3 && d.reps <= 20, `${w}: reps`);
      else assert.ok(Number.isInteger(d.seconds) && d.seconds >= 5, `${w}: seconds`);
      if (e.type === 'hold' && d.reps !== undefined) assert.ok(Number.isInteger(d.reps) && d.reps >= 1, `${w}: Halte-Wiederholungen`);
      if (d.band !== undefined) assert.ok(BANDS.includes(d.band), `${w}: band ${d.band}`);
      if (d.rest !== undefined) assert.ok(d.rest >= 0 && d.rest <= 90, `${w}: rest`);
      assert.ok(!(d.sets > 1 && d.rest === undefined), `${w}: Pause bei mehreren Sätzen`);
    });
    const d1 = e.doses[0];
    assert.ok(d1.sets <= 2, `${e.id}: Level 1 höchstens 2 Sätze`);
    if (e.type === 'reps') assert.ok(d1.reps <= 8, `${e.id}: Level 1 höchstens 8 Wiederholungen`);
    if (d1.band) assert.ok(['yellow', 'loop-orange'].includes(d1.band), `${e.id}: Level 1 mit leichtem Band`);
    if (e.type === 'hold') assert.ok(d1.seconds >= 15 && d1.seconds <= 20, `${e.id}: Level 1 Halten 15–20 s`);
    // Steigerung: nie leichter werden (Sätze × Wiederholungen bzw. Sekunden nehmen nicht ab)
    const load = (d) => d.sets * (d.reps ?? 1) * (d.seconds ?? 1);
    for (let i = 1; i < 8; i++) assert.ok(load(e.doses[i]) >= load(e.doses[i - 1]) * 0.99, `${e.id}: Level ${i + 1} leichter als Level ${i}`);
    const order = BANDS.slice(0, 4);
    const bandIdx = e.doses.map((d) => (order.includes(d.band) ? order.indexOf(d.band) : d.band ? 0 : -1));
    for (let i = 1; i < 8; i++) assert.ok(bandIdx[i] >= bandIdx[i - 1], `${e.id}: Bandfarbe wird leichter bei Level ${i + 1}`);
  }
});

test('levelRange plausibel, gentler gültig', () => {
  for (const e of ex) {
    const [a, b] = e.levelRange;
    assert.ok(Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b <= 8 && a <= b, `${e.id}: levelRange ${e.levelRange}`);
    if (e.gentler !== null) {
      const g = byId.get(e.gentler);
      assert.ok(g, `${e.id}: gentler ${e.gentler} existiert nicht`);
      assert.notEqual(g.id, e.id, `${e.id}: gentler zeigt auf sich selbst`);
      assert.equal(g.role, e.role, `${e.id}: gentler (${g.id}) hat eine andere Rolle`);
      assert.ok(g.levelRange[0] <= a || g.levelRange[0] <= b, `${e.id}: gentler ${g.id} überschneidet sich nicht`);
      assert.ok(Math.max(a, g.levelRange[0]) <= Math.min(b, g.levelRange[1]), `${e.id}: gentler ${g.id} hat keinen gemeinsamen Level`);
      assert.ok(!g.rowWarmup, `${e.id}: gentler darf nicht das Rudern sein`);
      assert.notEqual(g.gentler, e.id, `${e.id}: gentler-Schleife mit ${g.id}`);
    }
  }
  for (const id of ['sling-row', 'sling-face-pull', 'sling-rear-delt-fly', 'sling-t-raise', 'sling-y-raise']) assert.equal(byId.get(id).levelRange[0], 5, `${id}: Sling ab Level 5`);
  for (const id of ['long-sit-row', 'low-row-band']) assert.ok(byId.get(id).levelRange[1] <= 5, `${id}: Rudern mit Band in den unteren Leveln`);
  assert.deepEqual(byId.get('row-technique-warmup').levelRange, [3, 8]);
  assert.equal(byId.get('row-technique-warmup').rowWarmup, true);
  assert.ok(byId.get('massage-stick-neck').warn.includes('Wirbelsäule'));
});

test('Figuren: Posen, Props, Bänder, Pfeile sind gültig', () => {
  const PROPS = ['chair', 'wall', 'door', 'mat', 'step', 'towel', 'cushion', 'stick', 'sling', 'rower'];
  assert.ok(Object.keys(poses).length > 20 && content.poses.segments.trunk > 0);
  for (const e of ex) {
    const f = e.figure;
    assert.ok(f && Array.isArray(f.poses) && f.poses.length >= 1, `${e.id}: figure.poses`);
    for (const id of f.poses) assert.ok(poses[id], `${e.id}: Pose ${id} fehlt in poses.json`);
    for (const p of f.props || []) assert.ok(PROPS.includes(typeof p === 'string' ? p : p.type), `${e.id}: Prop ${JSON.stringify(p)}`);
    if (f.band) assert.ok(f.band.from && f.band.to, `${e.id}: band`);
    for (const a of f.arrows || []) assert.ok(['move', 'rotate', 'push', 'pull', 'arrow'].includes(a.kind), `${e.id}: Pfeil ${a.kind}`);
    const bandUsed = e.doses.some((d) => d.band);
    if (f.band) assert.ok(bandUsed || e.id === 'row-technique-warmup', `${e.id}: Figur zeigt ein Band, die Dosis nennt keins`);
  }
  for (const id of NEW_IDS) assert.ok(byId.get(id).figure.poses.length >= 2, `${id}: neue Figuren zeigen Anfang und Ende`);
});

test('Abdeckung: genug Übungen pro Rolle und Level (Abwechslung)', () => {
  for (let lv = 1; lv <= 8; lv++) {
    const pool = ex.filter((e) => !e.rowWarmup && e.levelRange[0] <= lv && lv <= e.levelRange[1]);
    const n = (role) => pool.filter((e) => e.role === role);
    const kraft = n('kraft');
    assert.ok(n('mobil').length >= 4, `Level ${lv}: mobil ${n('mobil').length} < 4`);
    assert.ok(kraft.length >= 6, `Level ${lv}: kraft ${kraft.length} < 6`);
    assert.ok(kraft.filter((e) => e.focus.includes('row')).length >= 2, `Level ${lv}: kraft/row < 2`);
    assert.ok(kraft.filter((e) => e.focus.includes('rot')).length >= 2, `Level ${lv}: kraft/rot < 2`);
    assert.ok(n('rumpf').length >= 3, `Level ${lv}: rumpf < 3`);
    assert.ok(n('dehnen').length >= 6, `Level ${lv}: dehnen < 6`);
    assert.ok(n('atmung').length >= 2, `Level ${lv}: atmung < 2`);
    assert.ok(pool.some((e) => e.role === 'dehnen' && e.focus.includes('hohlkreuz')), `Level ${lv}: Hüftbeuger-Dehnung fehlt`);
    assert.ok(pool.some((e) => e.focus.includes('hohlkreuz') && e.role !== 'dehnen'), `Level ${lv}: Hohlkreuz-Übung fehlt`);
  }
  // Nacken-Reset: genug Übungen im Stehen ohne Gerät
  const standing = ex.filter((e) => e.focus.includes('stehend-ohne-geraet'));
  assert.ok(standing.length >= 6);
  for (const r of ROLES) assert.ok(ex.some((e) => e.role === r), r);
});

test('Texte: Deutsch, ohne Platzhalter, ohne Inhalte der Vorlage (Knie, Bogen, Krücke, fester Stuhl …)', () => {
  const BANNED = [/Knie/, /Bogen/, /Pfeil/, /Krücke/, /Stuhl-?fest/i, /fester Stuhl/i, /stabile[nr]? Stuhl/i, /chair-fixed/, /Schulterschutz/, /Schießstand/, /Release/, /Phase\b/, /\bOP\b/, /Faszienrolle/, /Massageball/, /Kalorie/];
  const PLACEHOLDER = /TODO|TBD|XXX|lorem|ipsum|\{\{|\}\}|undefined|null|\bNaN\b|\.\.\.\s*$/i;
  for (const e of ex) {
    for (const t of textsOf(e)) {
      assert.ok(isStr(t), `${e.id}: leerer Text`);
      for (const re of BANNED) assert.ok(!re.test(t), `${e.id}: verbotenes Wort ${re} in „${t}“`);
      assert.ok(!PLACEHOLDER.test(t), `${e.id}: Platzhalter in „${t}“`);
      assert.ok(!/ {2,}/.test(t) && t === t.trim(), `${e.id}: Leerzeichen in „${t}“`);
    }
    // deutsch: Umlaute/typische Wörter, keine englischen Satzanfänge
    assert.match(e.short + e.setup + e.feel, /\b(du|dein|deine|deinen|deinem|dir|dich|die|der|das|und)\b/i, `${e.id}: Text wirkt nicht deutsch`);
    assert.ok(!/\b(the|and|your|you|with)\b/i.test(textsOf(e).join(' ')), `${e.id}: englische Wörter`);
    assert.ok(e.short.length >= 25 && e.short.length <= 180, `${e.id}: short Länge ${e.short.length}`);
    assert.ok(e.setup.length >= 25, `${e.id}: setup`);
    assert.ok(/[.!?]$/.test(e.short) && /[.!?]$/.test(e.feel), `${e.id}: Satzzeichen`);
    for (const s of e.steps) assert.ok(s.length >= 10 && s.length <= 200, `${e.id}: Schritt-Länge „${s}“`);
    assert.ok(/^Du /.test(e.feel) || /spür/i.test(e.feel), `${e.id}: feel sollte beschreiben, was Lisa spürt`);
  }
});

test('Ausrüstung: nur Vorhandenes, Stuhl nur als Sofa-/Bettkante', () => {
  const ALLOWED = /Matte|Therabänder|Band|Loop|Massagestab|Wärmekissen|Rudergerät|Sling-Trainer|Türanker|Treppenstufe|Tür|Wand|Handtuch|Kissen|Sofa|Bettkante|Nichts/;
  for (const e of ex) {
    assert.match(e.gear, ALLOWED, `${e.id}: gear „${e.gear}“`);
    assert.ok(!/Stuhl|Bürostuhl/.test(e.gear), `${e.id}: Stuhl in gear`);
    for (const t of [e.setup, ...e.steps, ...e.instructions]) assert.ok(!/\bStuhl\b|Stuhls/.test(t), `${e.id}: „Stuhl“ in „${t}“ – nutze Sofa-/Bettkante`);
  }
});

test('Routinen: Nacken-Reset und Abend-Entspannung laut Auftrag', () => {
  const { reset, evening } = content.routines;
  assert.equal(reset.minutes, 2);
  assert.equal(evening.minutes, 5);
  assert.ok(isStr(reset.name) && isStr(evening.name));
  for (const r of [reset, evening]) {
    for (const it of r.items) {
      const e = byId.get(it.exerciseId);
      assert.ok(e, `Routine: unbekannte Übung ${it.exerciseId}`);
      assert.ok(it.reps || it.seconds, `${it.exerciseId}: reps oder seconds`);
    }
  }
  assert.deepEqual(reset.items.map((i) => i.exerciseId), ['chin-tuck-wall', 'shrug-drop', 'scapula-setting', 'pec-stretch-low', 'belly-breathing']);
  for (const it of reset.items) assert.ok(byId.get(it.exerciseId).focus.includes('stehend-ohne-geraet'), `${it.exerciseId}: Reset im Stehen ohne Geräte`);
  const ev = evening.items.map((i) => i.exerciseId);
  assert.equal(ev[0], 'warmth-relax');
  assert.ok(ev.includes('breathing-reset') && ev.includes('child-pose-breath'));
  assert.ok(ev.some((id) => byId.get(id).focus.includes('nacken') && byId.get(id).role === 'dehnen'));
});

test('Tipps: mindestens 21, alle Themen, Emoji-Icon, warm', () => {
  const tips = content.tips;
  assert.ok(tips.length >= 21);
  assert.equal(new Set(tips.map((t) => t.id)).size, tips.length);
  const topics = new Set(tips.map((t) => t.topic));
  for (const t of ['handtasche', 'buecken', 'wischen', 'ueberkopf', 'tragen', 'mikropause', 'abend']) assert.ok(topics.has(t), `Thema ${t}`);
  const seg = new Intl.Segmenter('de', { granularity: 'grapheme' });
  for (const t of tips) {
    for (const k of ['id', 'topic', 'title', 'text', 'icon']) assert.ok(isStr(t[k]), `${t.id}.${k}`);
    assert.equal([...seg.segment(t.icon)].length, 1, `${t.id}: icon muss genau ein Emoji sein`);
    assert.ok(/\p{Extended_Pictographic}/u.test(t.icon), `${t.id}: icon kein Emoji`);
    assert.ok(t.text.length >= 40 && t.text.length <= 260, `${t.id}: Länge`);
    assert.ok(!/\b(musst|solltest|falsch)\b/i.test(t.text), `${t.id}: zu belehrend`);
  }
});

test('Sprüche: mindestens 30, einzigartig, warm', () => {
  const q = content.quotes;
  assert.ok(q.length >= 30);
  assert.equal(new Set(q).size, q.length);
  for (const s of q) {
    assert.ok(s.length >= 10 && s.length <= 120, `Länge: ${s}`);
    assert.ok(!/\b(musst|sollst|solltest|falsch|faul)\b/i.test(s), `belehrend: ${s}`);
    assert.ok(!/Kalorie|abnehm|Gewicht|Leistung/i.test(s), `kein Fitness-Druck: ${s}`);
  }
  assert.ok(q.some((s) => /Nacken sagt danke/.test(s)));
});
