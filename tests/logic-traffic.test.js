import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightFor, LIGHT_INFO, WARNING_SIGNS } from '../js/logic/traffic.js';

test('Ampel: 0–3 grün, 4–6 gelb, 7–10 rot', () => {
  for (let p = 0; p <= 3; p++) assert.equal(lightFor(p), 'green');
  for (let p = 4; p <= 6; p++) assert.equal(lightFor(p), 'yellow');
  for (let p = 7; p <= 10; p++) assert.equal(lightFor(p), 'red');
});

test('Ampel: ungültige Werte gelten als grün, Dezimalwerte werden gerundet', () => {
  for (const v of [null, undefined, NaN, 'x']) assert.equal(lightFor(v), 'green');
  assert.equal(lightFor(3.6), 'yellow');
  assert.equal(lightFor(12), 'red');
});

test('Hinweistexte und Warnzeichen', () => {
  assert.equal(LIGHT_INFO.yellow.label, 'Heute sanft');
  assert.equal(LIGHT_INFO.yellow.hint, 'Heute sanft – das hilft auch!');
  assert.equal(LIGHT_INFO.red.hint, 'Wenn das mehrere Tage so bleibt oder Warnzeichen dazukommen, lass es bitte ärztlich anschauen.');
  assert.ok(LIGHT_INFO.green.label && LIGHT_INFO.green.hint);
  const joined = WARNING_SIGNS.join(' ');
  for (const w of ['Arm', 'Kribbeln', 'Schwindel', 'Kopfschmerzen', 'Sturz', 'Fieber', 'Nacht']) assert.match(joined, new RegExp(w));
});
