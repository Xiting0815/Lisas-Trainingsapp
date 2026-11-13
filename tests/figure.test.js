// <pt-figure>: reine Hilfsfunktionen + Plausibilitätsprüfung aller Figuren/Posen in data/poses.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePoints, interpolatePose, parseTempo, poseAt, figureSvg, buildScene, poseBounds,
  bandColor, normalizeHighlight, autoArrowPoints, FLOOR, MAT_H,
} from '../js/components/pt-figure.js';
import { readContentFromDisk, readRawFromDisk } from './helpers/content-node.js';

const content = readContentFromDisk();
const raw = readRawFromDisk();
const { poses, segments } = content.poses;
const exercises = content.exercises; // Figuren-Overrides sind schon eingerechnet
const overrides = content.figureOverrides;
const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;
const framesOf = (e) => (e.figure.poses || []).map((id) => poses[id]);
const specOf = (e) => ({ ...e.figure, poses: framesOf(e), segments, bandColor: '#D9443B' });

test('computePoints: Stehen – Geometrie', () => {
  const P = computePoints(poses.stand, segments);
  assert.deepEqual(P.hip, poses.stand.root);
  assert.ok(near(P.neck.y, P.hip.y - segments.trunk));
  assert.ok(near(P.kneeL.y, P.hip.y + segments.thigh));
  assert.ok(P.toeR.x > P.footR.x, 'Seitenansicht schaut nach rechts');
  assert.ok(P.head.y < P.neck.y);
  for (const k of ['hip', 'neck', 'head', 'elbowL', 'elbowR', 'handL', 'handR', 'kneeL', 'kneeR', 'footL', 'footR', 'shoulderL']) {
    assert.ok(Number.isFinite(P[k].x) && Number.isFinite(P[k].y), k);
  }
});

test('computePoints: Vorderansicht – linke Gliedmaßen rechts im Bild', () => {
  const P = computePoints(poses['front-arms-apart'], segments);
  assert.ok(P.handL.x > P.hip.x && P.handR.x < P.hip.x);
});

test('interpolatePose / parseTempo / poseAt', () => {
  const a = poses['bridge-down'];
  const b = poses['bridge-up'];
  assert.equal(interpolatePose(a, b, 0).hipL, a.hipL);
  assert.equal(interpolatePose(a, b, 1).hipL, b.hipL);
  assert.ok(near(interpolatePose(a, b, 0.5).hipL, (a.hipL + b.hipL) / 2));
  assert.deepEqual(parseTempo('3-1-1'), { ecc: 3000, pause: 1000, con: 1000 });
  assert.deepEqual(parseTempo(null), { ecc: 2000, pause: 0, con: 2000 });
  const k = [a, b];
  assert.equal(poseAt(k, '2-1-2', 0).hipL, a.hipL);
  assert.equal(poseAt(k, '2-1-2', 2500).hipL, b.hipL, 'hält die Endpose während der Pause');
  assert.equal(poseAt([a], '2-1-2', 1234), a);
});

test('figureSvg: einzelne und gepaarte Figur, Bandfarbe', () => {
  const svg = figureSvg({ poses: [poses['front-arms-forward'], poses['front-arms-apart']], segments, band: { from: 'handL', to: 'handR' }, bandColor: '#3BA55C' }, { pair: true });
  assert.match(svg, /^<svg/);
  assert.match(svg, /#3BA55C/);
  assert.equal((svg.match(/class="fig-frame"/g) || []).length, 2);
  assert.equal(bandColor('blue', [{ id: 'blue', color: '#123456' }]), '#123456');
  assert.equal(bandColor('loop-orange', []), '#F08A24');
  assert.deepEqual([...normalizeHighlight('legs,armR')], ['legL', 'legR', 'armR']);
});

test('Overrides: bekannte Übungen, Posen vorhanden, bereits in exercises[].figure eingerechnet', () => {
  const ids = new Set(exercises.map((e) => e.id));
  for (const [id, ov] of Object.entries(overrides)) {
    assert.ok(ids.has(id), `Override für unbekannte Übung ${id}`);
    for (const p of ov.poses || []) assert.ok(poses[p], `${id}: Pose ${p} fehlt`);
    if (ov.poses) assert.deepEqual(content.byId.get(id).figure.poses, ov.poses, `${id}: Override wirksam`);
  }
});

test('Jede Übung hat eine renderbare Figur (Posen, Band, Labels, kein NaN)', () => {
  for (const e of exercises) {
    const k = framesOf(e);
    assert.ok(k.length >= 1 && k.every(Boolean), `${e.id}: unbekannte Pose in ${JSON.stringify(e.figure.poses)}`);
    const svg = figureSvg(specOf(e), { pair: k.length > 1 });
    assert.ok(!/NaN|undefined/.test(svg), `${e.id}: kaputtes SVG`);
    if (e.figure.band) assert.match(svg, /fig-band/, `${e.id}: Band-Endpunkte müssen auflösen`);
    for (const l of e.figure.labels || []) assert.ok(svg.includes(`>${l.text}</text>`), `${e.id}: Label „${l.text}“ fehlt`);
  }
});

test('Bewegungspfeile: jede bewegte Figur (außer Rudern-Schleife) hat einen Pfeil', () => {
  for (const e of exercises) {
    const k = framesOf(e);
    const explicitNone = Array.isArray(e.figure.arrows) && e.figure.arrows.length === 0;
    if (k.length < 2 || e.figure.loop || explicitNone) continue;
    const sc = buildScene(specOf(e));
    assert.ok(sc.hasArrows, `${e.id}: kein Bewegungspfeil`);
  }
  const pick = (a, b) => autoArrowPoints([poses[a], poses[b]], segments).map((x) => x.point);
  assert.deepEqual(pick('bridge-down', 'bridge-up'), ['hip']);
  assert.deepEqual(pick('front-arms-forward', 'front-arms-apart').sort(), ['handL', 'handR']);
});

test('Auto-Rahmen: Liegeposen liegen im Bild', () => {
  for (const id of ['lying-supine', 'bridge-up', 'lying-chin-tuck', 'quad-cat', 'child-out', 'open-book-open']) {
    if (!poses[id]) continue;
    const sc = buildScene({ poses: [poses[id]], segments, props: ['mat'] });
    const b = poseBounds(poses[id], segments);
    assert.ok(b.minY >= sc.frame.y - 1 && b.maxY <= sc.frame.y + sc.frame.h + 1, `${id} im Bild`);
  }
});

// ---------------------------------------------------------------- neue Posen

test('Kinn zurück: der Kopf wandert nach hinten (sitzend, an der Wand)', () => {
  for (const [a, b] of [['sit-chin-forward', 'sit-chin-tuck'], ['stand-wall-chin-forward', 'stand-wall-chin-tuck']]) {
    const A = computePoints(poses[a], segments);
    const B = computePoints(poses[b], segments);
    assert.ok(B.head.x < A.head.x - 3, `${b}: Kopf ${A.head.x} → ${B.head.x}`);
    assert.ok(near(A.hip.x, B.hip.x), 'Rumpf bleibt');
  }
});

test('Vierfüßlerstand und Kindhaltung: Hände und Knie auf der Matte', () => {
  const MATY = FLOOR - MAT_H;
  for (const id of ['quad-neutral', 'quad-cat', 'quad-cow']) {
    const P = computePoints(poses[id], segments);
    assert.ok(P.handR.y >= MATY - 8 && P.handR.y <= FLOOR, `${id}: Hand auf der Matte (${P.handR.y})`);
    assert.ok(P.kneeL.y >= MATY - 8, `${id}: Knie am Boden (${P.kneeL.y})`);
  }
  const cat = computePoints(poses['quad-cat'], segments);
  const cow = computePoints(poses['quad-cow'], segments);
  assert.ok(cat.head.y > cow.head.y, 'Katze: Kopf tiefer als bei der Kuh');
  for (const id of ['child-out', 'child-in']) {
    const P = computePoints(poses[id], segments);
    assert.ok(P.hip.y > FLOOR - 40, `${id}: Gesäß nah an den Fersen`);
    assert.ok(P.handR.x > P.neck.x, `${id}: Arme nach vorn`);
  }
});

test('Schultern hochziehen: die Hände wandern mit hoch', () => {
  const a = computePoints(poses['front-shrug-down'], segments);
  const b = computePoints(poses['front-shrug-up'], segments);
  assert.ok(b.handL.y < a.handL.y - 5);
});

// ---------------------------------------------------------------- Anatomie der Posen

const SUPPORT_TOL = 2.5;
function lowestBody(p) {
  const P = computePoints(p, segments);
  const ys = [P.head.y + 9.5, P.kneeL.y + 4.25, P.kneeR.y + 4.25, P.footL.y + 4.25, P.footR.y + 4.25, P.toeL.y + 3, P.toeR.y + 3,
    P.handL.y + 3.25, P.handR.y + 3.25, P.elbowL.y + 3.25, P.elbowR.y + 3.25];
  if (p.view === 'front') ys.push(P.shoulderL.y + 5, P.shoulderR.y + 5, P.hipJL.y + 5, P.hipJR.y + 5); else ys.push(P.hip.y + 6.5, P.neck.y + 6.5);
  return Math.max(...ys);
}
const viewed = Object.entries(poses).filter(([, p]) => p.camera !== 'top' && p.camera !== 'above');

test('Posen: nichts geht durch den Boden', () => {
  for (const [id, p] of viewed) assert.ok(lowestBody(p) <= FLOOR + SUPPORT_TOL, `${id} unter dem Boden (${lowestBody(p).toFixed(1)})`);
});

test('Posen: Stehende berühren Boden/Stufe, Liegende die Matte', () => {
  for (const [id, p] of viewed) {
    const low = lowestBody(p);
    if (p.ground === 'lying') {
      const supported = low >= FLOOR - MAT_H - SUPPORT_TOL || (p.props || []).some((x) => x.type === 'step' || x.type === 'chair');
      assert.ok(supported, `${id} schwebt über der Matte (${low.toFixed(1)})`);
    } else if (p.ground === 'standing') {
      const P = computePoints(p, segments);
      const soles = ['L', 'R'].map((s) => Math.max(P['foot' + s].y + 4.25, P['toe' + s].y + 3));
      assert.ok(soles.some((y) => Math.abs(y - FLOOR) <= SUPPORT_TOL), `${id} schwebt (Sohlen ${soles.map((y) => y.toFixed(1))})`);
    }
  }
});

test('Posen: optionale Werte sind endlich, Längen plausibel', () => {
  for (const [id, p] of Object.entries(poses)) {
    for (const [k, v] of Object.entries(p)) {
      if (/Len[LR]$/.test(k)) assert.ok(v > 0 && v <= 1.2, `${id}.${k}`);
      else if (typeof v === 'number') assert.ok(Number.isFinite(v), `${id}.${k}`);
    }
  }
});

test('poses.json enthält nur Posen, die eine Übung braucht (und umgekehrt)', () => {
  const used = new Set();
  for (const e of raw.exercises.exercises) for (const id of e.figure.poses || []) used.add(id);
  for (const ov of Object.values(raw.figureOverrides?.overrides || {})) for (const id of ov.poses || []) used.add(id);
  for (const id of used) assert.ok(poses[id], `Pose ${id} fehlt`);
  for (const id of Object.keys(poses)) assert.ok(used.has(id), `Pose ${id} wird nicht benutzt`);
});
