import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/store.js';
import { backupFilename, parseBackup, validateBackup, buildBackup, importFromText } from '../js/util/export-import.js';
import { mkSession } from './helpers/fixtures-logic.js';

class Mem {
  constructor() { this.m = new Map(); this.failWrites = false; }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.failWrites) throw new Error('QuotaExceededError'); this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
let mem;
beforeEach(() => { mem = new Mem(); store._setStorage(mem); store._setNow(() => new Date('2026-11-13T10:00:00Z')); });

test('Schlüssel und Version', () => {
  assert.equal(store.STORAGE_KEY, 'lisa.v1');
  assert.equal(store.SCHEMA_VERSION, 1);
});

test('Erststart: Standardwerte laut SPEC werden angelegt und gespeichert', () => {
  const d = store.load();
  assert.equal(d.schemaVersion, 1);
  assert.deepEqual(d.settings, { voice: true, volume: 0.8, theme: 'auto', reminder: { days: [1, 3, 5], time: '18:30', reset: false, resetTime: '12:30' }, lastExportAt: null, exportHintDismissedAt: null });
  assert.deepEqual(Object.keys(d.state).sort(), ['activeSession', 'firstRunAt', 'installHintDismissed', 'lastExerciseIds', 'lastUsed', 'level', 'levelSince', 'trainingsAtLevel']);
  assert.equal(d.state.level, 1);
  assert.equal(d.state.firstRunAt, '2026-11-13T10:00:00.000Z');
  assert.deepEqual(d.sessions, []);
  assert.ok(mem.getItem('lisa.v1'));
  assert.equal(store.get(), d);
  // nichts aus der Vorlage: keine Sync-/Ausrüstungs-/Phasen-Felder
  assert.ok(!/sync|equipment|phase|weight|badge|"xp"/i.test(JSON.stringify(d)));
});

test('update: Kopie, speichert, benachrichtigt, bereinigt', () => {
  const seen = [];
  const unsub = store.subscribe((d) => seen.push(d.state.level));
  const before = store.get();
  store.update((d) => { d.state.level = 4; d.sessions.push(mkSession({ id: 'a' })); });
  assert.equal(before.state.level, 1, 'alte Referenz bleibt unverändert');
  assert.equal(store.get().state.level, 4);
  assert.deepEqual(seen, [4]);
  assert.equal(JSON.parse(mem.getItem('lisa.v1')).state.level, 4);
  store.update((d) => { d.state.level = 99; });
  assert.equal(store.get().state.level, 8);
  store.update(() => ({ ...store.get(), settings: { ...store.get().settings, theme: 'dark' } }));
  assert.equal(store.get().settings.theme, 'dark');
  unsub();
  store.update((d) => { d.state.level = 2; });
  assert.equal(seen.length, 3);
  store.subscribe(() => { throw new Error('boom'); });
  assert.doesNotThrow(() => store.update((d) => { d.state.level = 3; }));
});

test('Persistenz: neu laden liefert dieselben Daten', () => {
  store.update((d) => { d.state.level = 5; d.sessions.push(mkSession({ id: 'x', exerciseIds: ['a'] })); });
  store._setStorage(mem);
  const d = store.load();
  assert.equal(d.state.level, 5);
  assert.equal(d.sessions[0].id, 'x');
});

test('Sanitize: kaputte Werte werden repariert, Unbrauchbares verworfen', () => {
  const d = store.sanitize({
    schemaVersion: 1,
    settings: { voice: 'ja', volume: 7, theme: 'neon', reminder: { days: [1, 1, 9, 'x', 0], time: '25:00', reset: 1, resetTime: '07:15' }, lastExportAt: 'kaputt' },
    state: { level: 12, levelSince: 'x', trainingsAtLevel: -3, lastExerciseIds: ['a', 7, null], lastUsed: { a: '2026-11-01T10:00:00Z', b: 'x' }, activeSession: 'x', ekelFeld: 1 },
    sessions: [
      mkSession({ id: 'ok', painBefore: 11, painAfter: -2, effort: 'riesig', light: 'blau', kind: 'evening' }),
      mkSession({ id: 'ok', date: '2026-11-03T10:00:00Z' }),
      { id: 'kein-datum' }, null, 5, mkSession({ id: 'frueh', date: '2026-10-01T10:00:00Z', effort: 'leicht' }),
    ],
    sync: { a: 1 },
  });
  assert.equal(d.settings.voice, true);
  assert.equal(d.settings.volume, 1);
  assert.equal(d.settings.theme, 'auto');
  assert.deepEqual(d.settings.reminder.days, [0, 1]);
  assert.equal(d.settings.reminder.time, '18:30');
  assert.equal(d.settings.reminder.reset, false);
  assert.equal(d.settings.reminder.resetTime, '07:15');
  assert.equal(d.settings.lastExportAt, null);
  assert.equal(d.state.level, 8);
  assert.equal(d.state.levelSince, null);
  assert.equal(d.state.trainingsAtLevel, 0);
  assert.deepEqual(d.state.lastExerciseIds, ['a']);
  assert.deepEqual(Object.keys(d.state.lastUsed), ['a']);
  assert.equal(d.state.activeSession, null);
  assert.ok(!('ekelFeld' in d.state) && !('sync' in d));
  assert.deepEqual(d.sessions.map((s) => s.id), ['frueh', 'ok'], 'doppelte ID und Unbrauchbares verworfen, nach Datum sortiert');
  const ok = d.sessions[1];
  assert.deepEqual([ok.painBefore, ok.painAfter, ok.effort, ok.light, ok.kind], [10, 0, null, 'green', 'evening']);
  for (const junk of [null, undefined, 5, 'x', [], { settings: 3, state: [], sessions: 'x' }]) {
    const s = store.sanitize(junk);
    assert.equal(s.state.level, 1);
    assert.deepEqual(s.sessions, []);
  }
});

test('Sanitize: Mini-Pausen haben kein effort', () => {
  const s = store.sanitize({ sessions: [mkSession({ id: 'r', kind: 'reset', effort: 'leicht' })] });
  assert.equal(s.sessions[0].effort, null);
});

test('Migration: fehlende Version gilt als 1, neuere Version wirft', () => {
  assert.equal(store.migrate({ settings: {}, state: { level: 3 }, sessions: [] }).state.level, 3);
  assert.equal(store.migrate({ schemaVersion: 1 }).schemaVersion, 1);
  assert.throws(() => store.migrate({ schemaVersion: 2 }), (e) => e.newerVersion === 2);
  const saved = { ...store.defaults(), schemaVersion: 1 };
  assert.deepEqual(store.migrate(saved).settings, saved.settings);
});

test('Neuere Version im Speicher: nur lesen, nicht überschreiben', () => {
  const raw = JSON.stringify({ schemaVersion: 7, state: { level: 6 }, settings: {}, sessions: [] });
  mem.setItem('lisa.v1', raw);
  const d = store.load();
  assert.equal(d.state.level, 6);
  assert.equal(store.getIssues().newerVersion, 7);
  assert.equal(store.getIssues().readOnly, true);
  store.update((x) => { x.state.level = 2; });
  assert.equal(mem.getItem('lisa.v1'), raw);
});

test('Korruption: Kopie unter lisa.v1.corrupt-<ts>, Standardwerte, max. 2 Kopien', () => {
  mem.setItem('lisa.v1', '{kaputt');
  const d = store.load();
  assert.equal(d.state.level, 1);
  const keys = store.corruptBackupKeys();
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^lisa\.v1\.corrupt-/);
  assert.equal(mem.getItem(keys[0]), '{kaputt');
  assert.equal(store.getIssues().corrupt.preserved, true);
  assert.equal(JSON.parse(mem.getItem('lisa.v1')).schemaVersion, 1, 'Standardwerte ersetzen die kaputte Version');
  for (let i = 0; i < 3; i++) {
    store._setNow(() => new Date(Date.UTC(2026, 10, 14 + i)));
    mem.setItem('lisa.v1', i === 0 ? '[1,2]' : 'nope');
    store.load();
  }
  assert.equal(store.corruptBackupKeys().length, 2);
  // JSON ok, aber kein Objekt
  mem.setItem('lisa.v1', '42');
  store.load();
  assert.equal(store.getIssues().corrupt.preserved, true);
});

test('Teilweise kaputte Daten werden repariert und zurückgeschrieben (ohne Korrupt-Kopie)', () => {
  mem.setItem('lisa.v1', JSON.stringify({ schemaVersion: 1, settings: { volume: 'laut' }, state: { level: 'x' }, sessions: [{ id: 1 }] }));
  const d = store.load();
  assert.equal(d.settings.volume, 0.8);
  assert.equal(d.state.level, 1);
  assert.deepEqual(d.sessions, []);
  assert.equal(store.corruptBackupKeys().length, 0);
  assert.equal(JSON.parse(mem.getItem('lisa.v1')).settings.volume, 0.8);
});

test('Speicherfehler: lastSaveOk false, Callback, App läuft weiter', () => {
  store.load();
  const errs = [];
  const off = store.onSaveError((e) => errs.push(e.message));
  mem.failWrites = true;
  assert.doesNotThrow(() => store.update((d) => { d.state.level = 3; }));
  assert.equal(store.lastSaveOk(), false);
  assert.equal(errs.length, 1);
  assert.equal(store.get().state.level, 3, 'Daten bleiben im Speicher');
  mem.failWrites = false;
  store.update((d) => { d.state.level = 4; });
  assert.equal(store.lastSaveOk(), true);
  off();
});

test('Ohne localStorage (Node/privater Modus) läuft der Speicher im Arbeitsspeicher', () => {
  store._setStorage(null);
  const d = store.load();
  assert.equal(d.state.level, 1);
  store.update((x) => { x.state.level = 2; });
  assert.equal(store.get().state.level, 2);
});

test('reset: zurück auf Standardwerte', () => {
  store.update((d) => { d.state.level = 6; d.sessions.push(mkSession({ id: 'z' })); });
  store.reset();
  assert.equal(store.get().state.level, 1);
  assert.deepEqual(store.get().sessions, []);
  assert.equal(JSON.parse(store.rawSnapshot()).state.level, 1);
});

test('Export: JSON mit Kennung, ohne laufendes Training; Import-Rundreise', () => {
  store.update((d) => {
    d.state.level = 4; d.state.activeSession = { foo: 1 };
    d.sessions.push(mkSession({ id: 'a', exerciseIds: ['x'] }), mkSession({ id: 'b', date: '2026-11-05T10:00:00Z', kind: 'reset', effort: null }));
  });
  const txt = store.exportData();
  const obj = JSON.parse(txt);
  assert.equal(obj.app, 'lisas-trainingsapp');
  assert.equal(obj.schemaVersion, 1);
  assert.equal(obj.state.activeSession, null);
  assert.equal(obj.sessions.length, 2);
  assert.ok(obj.exportedAt);
  const b = buildBackup('2026-11-13');
  assert.equal(b.filename, 'lisa-training-sicherung-2026-11-13.json');
  assert.equal(backupFilename('2026-01-02'), 'lisa-training-sicherung-2026-01-02.json');
  store.reset();
  const r = store.importData(txt);
  assert.deepEqual([r.ok, r.sessions], [true, 2]);
  assert.equal(store.get().state.level, 4);
  assert.deepEqual(store.get().sessions.map((s) => s.id), ['a', 'b']);
  assert.equal(JSON.parse(mem.getItem('lisa.v1')).state.level, 4);
  // Objekt statt String
  assert.equal(store.importData(obj).ok, true);
});

test('Import: Validierung – nur Lisa-Daten, lisa.v1', () => {
  store.update((d) => { d.state.level = 3; });
  const fail = (input, re) => {
    const r = store.importData(input);
    assert.equal(r.ok, false);
    assert.match(r.error, re);
    assert.equal(store.get().state.level, 3, 'Daten bleiben unverändert');
  };
  const good = JSON.parse(store.exportData());
  fail('kein json', /JSON/);
  fail('null', /gültige Sicherung/);
  fail('[]', /gültige Sicherung/);
  fail({ ...good, schemaVersion: 2 }, /neueren/);
  fail({ ...good, schemaVersion: undefined }, /Datenversion/);
  fail({ ...good, settings: undefined }, /Einstellungen/);
  fail({ ...good, state: 5 }, /Trainingsstand/);
  fail({ ...good, sessions: 'x' }, /Trainingsverlauf/);
  fail({ ...good, sessions: [{ id: 'a', date: 'x' }] }, /Datum/);
  fail({ ...good, sessions: [{ date: good.exportedAt }] }, /ID/);
  fail({ ...good, sessions: [mkSession({ id: 'd' }), mkSession({ id: 'd' })] }, /doppelt/);
  fail({ ...good, app: 'physiobogen' }, /nicht zu Lisas/);
  // Sicherung der PhysioBogen-App (pt.v1) wird abgelehnt
  fail({ schemaVersion: 1, settings: { bands: [], surgeryDate: null }, state: { phaseId: 'p1' }, sessions: [] }, /nicht zu Lisas/);
  assert.deepEqual(validateBackup('{').errors, ['Die Datei ist kein gültiges JSON.']);
  assert.equal(validateBackup(good).ok, true);
  assert.throws(() => parseBackup('{'), /JSON/);
  assert.deepEqual(parseBackup({ a: 1 }), { a: 1 });
  assert.equal(importFromText('{').ok, false);
});

test('Import: repariert kaputte Werte und legt den alten Stand als Sicherung ab', () => {
  store.update((d) => { d.state.level = 3; });
  const prevRaw = store.rawSnapshot();
  const r = store.importData({ schemaVersion: 1, settings: { volume: 5 }, state: { level: 99 }, sessions: [mkSession({ id: 'q', painAfter: 50 })] });
  assert.equal(r.ok, true);
  assert.equal(store.get().settings.volume, 1);
  assert.equal(store.get().state.level, 8);
  assert.equal(store.get().sessions[0].painAfter, 10);
  assert.equal(mem.getItem('lisa.v1.before-import'), prevRaw);
});

test('requestPersistentStorage: fragt einmal an, scheitert still', async () => {
  let calls = 0;
  const old = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage: { persisted: async () => false, persist: async () => { calls++; return true; } } } });
  try {
    assert.equal(await store.requestPersistentStorage(), true);
    assert.equal(calls, 1);
    assert.equal(await store.requestPersistentStorage(), false, 'nur einmal');
  } finally {
    if (old) Object.defineProperty(globalThis, 'navigator', old); else delete globalThis.navigator;
  }
});
