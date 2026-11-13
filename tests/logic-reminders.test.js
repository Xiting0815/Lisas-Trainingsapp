import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildICS, icsFileName, escapeText, foldLine } from '../js/logic/reminders.js';

const NOW = new Date(2026, 10, 13, 10, 0, 0); // Freitag
const unfold = (ics) => ics.replace(/\r\n /g, '');
const lines = (ics) => unfold(ics).split('\r\n');

test('gültige Struktur: CRLF, Pflichtfelder, VALARM, RRULE mit BYDAY', () => {
  const ics = buildICS({ days: [5, 1, 3], time: '18:30', now: NOW });
  assert.ok(ics.endsWith('\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'nur CRLF');
  const l = lines(ics);
  assert.equal(l[0], 'BEGIN:VCALENDAR');
  assert.equal(l.at(-2), 'END:VCALENDAR');
  for (const must of ['VERSION:2.0', 'BEGIN:VEVENT', 'END:VEVENT', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'END:VALARM']) assert.ok(l.includes(must), must);
  assert.ok(l.some((x) => x.startsWith('PRODID:')));
  assert.ok(l.some((x) => /^UID:.+@/.test(x)));
  assert.ok(l.some((x) => /^DTSTAMP:\d{8}T\d{6}Z$/.test(x)));
  assert.ok(l.includes('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'));
  assert.ok(l.some((x) => /^TRIGGER:-?PT0[MS]$/.test(x)));
  // VALARM verschachtelt in VEVENT
  assert.ok(l.indexOf('BEGIN:VALARM') > l.indexOf('BEGIN:VEVENT') && l.indexOf('END:VALARM') < l.indexOf('END:VEVENT'));
});

test('Floating Time: DTSTART ohne Z und ohne TZID; erster Termin ist ein gewählter Wochentag in der Zukunft', () => {
  const l = lines(buildICS({ days: [1, 3, 5], time: '18:30', now: NOW }));
  const start = l.find((x) => x.startsWith('DTSTART'));
  assert.equal(start, 'DTSTART:20261113T183000'); // heute (Fr) 18:30, noch nicht vorbei
  assert.ok(!/TZID|Z$/.test(start));
  assert.equal(l.find((x) => x.startsWith('DTEND')).slice(0, 14), 'DTEND:20261113');
  // Zeit heute schon vorbei → nächster passender Tag (Mo 16.11.)
  const late = lines(buildICS({ days: [1, 3, 5], time: '09:00', now: NOW }));
  assert.equal(late.find((x) => x.startsWith('DTSTART')), 'DTSTART:20261116T090000');
  // DTSTAMP in UTC
  assert.equal(lines(buildICS({ now: new Date(Date.UTC(2026, 10, 13, 9, 5, 7)) })).find((x) => x.startsWith('DTSTAMP')), 'DTSTAMP:20261113T090507Z');
});

test('Vorschläge: Training Mo/Mi/Fr 18:30, Nacken-Reset Mo–Fr mittags', () => {
  const t = lines(buildICS({ now: NOW }));
  assert.ok(t.includes('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'));
  assert.ok(t.some((x) => x.startsWith('DTSTART') && x.endsWith('T183000')));
  const r = lines(buildICS({ kind: 'reset', now: NOW }));
  assert.ok(r.includes('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'));
  assert.ok(r.some((x) => x.startsWith('DTSTART') && x.endsWith('T123000')));
  assert.ok(r.some((x) => x === 'SUMMARY:Nacken-Reset'));
  assert.notEqual(t.find((x) => x.startsWith('UID')), r.find((x) => x.startsWith('UID')));
  // Sonntag → SU, Sortierung Mo…So
  assert.ok(lines(buildICS({ days: [0, 6, 2], now: NOW })).includes('RRULE:FREQ=WEEKLY;BYDAY=TU,SA,SU'));
  // ungültige Eingaben fallen auf Vorschläge zurück
  const bad = lines(buildICS({ days: ['x', 9], time: '25:99', now: NOW }));
  assert.ok(bad.includes('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'));
  assert.ok(bad.some((x) => x.startsWith('DTSTART') && x.endsWith('T183000')));
});

test('Escaping von Komma, Semikolon, Backslash und Zeilenumbruch', () => {
  assert.equal(escapeText('a,b;c\\d\ne'), 'a\\,b\;c\\\\d\\ne');
  const l = lines(buildICS({ title: 'Training, Nacken; Schultern', description: 'Zeile1\nZeile2, ok', now: NOW }));
  assert.ok(l.includes('SUMMARY:Training\\, Nacken\; Schultern'));
  assert.ok(l.includes('DESCRIPTION:Zeile1\\nZeile2\\, ok'));
});

test('Zeilenfaltung: ≤ 75 Oktette, Umlaute und Emoji werden nicht zerschnitten, Entfalten ergibt das Original', () => {
  const long = `Schöne Grüße 💗 ${'äöüß,'.repeat(40)} Ende`;
  const ics = buildICS({ description: long, now: NOW });
  for (const raw of ics.split('\r\n')) assert.ok(new TextEncoder().encode(raw).length <= 75, raw);
  assert.ok(ics.split('\r\n').some((x) => x.startsWith(' ')), 'es wurde gefaltet');
  assert.ok(lines(ics).includes(`DESCRIPTION:${escapeText(long)}`));
  assert.equal(foldLine('x'.repeat(75)).length, 1);
  assert.equal(foldLine('x'.repeat(76)).length, 2);
  assert.ok(!ics.includes('�'));
});

test('Dateinamen', () => {
  assert.match(icsFileName('training'), /\.ics$/);
  assert.match(icsFileName('reset'), /\.ics$/);
  assert.notEqual(icsFileName('training'), icsFileName('reset'));
});
