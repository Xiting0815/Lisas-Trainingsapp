// Kalender-Erinnerung als .ics (RFC 5545). PURE. Siehe docs/SPEC.md §4.
// Wiederkehrender Termin mit Alarm; „floating“ lokale Zeit (ohne feste Zeitzone), CRLF, Zeilenfaltung ≤ 75 Oktette.
import { toDate } from './levels.js';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const pad = (n) => String(n).padStart(2, '0');

/** Vorschlag-Tage: Mo, Mi, Fr (0 = So … 6 = Sa). */
export const DEFAULT_DAYS = [1, 3, 5];
export const DEFAULT_TIME = '18:30';
export const DEFAULT_RESET_TIME = '12:30';
/** Arbeitstage Mo–Fr für den Nacken-Reset. */
export const WORKDAYS = [1, 2, 3, 4, 5];

/** Text-Escaping nach RFC 5545 (Backslash, Semikolon, Komma, Zeilenumbruch). */
export function escapeText(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

const octets = (ch) => new TextEncoder().encode(ch).length;

/** Faltet eine Zeile auf höchstens 75 Oktette (Fortsetzungszeilen beginnen mit einem Leerzeichen); bricht nie mitten in einem Zeichen. */
export function foldLine(line) {
  const out = [];
  let cur = '';
  let len = 0;
  let limit = 75;
  for (const ch of line) {
    const n = octets(ch);
    if (len + n > limit) {
      out.push(cur);
      cur = ' ';
      len = 1;
      limit = 75;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out;
}

const utcStamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const localStamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

function cleanDays(days, fallback) {
  const list = Array.isArray(days) ? [...new Set(days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))] : [];
  return (list.length ? list : [...fallback]).sort((a, b) => (a || 7) - (b || 7)); // Mo … So
}

/**
 * .ics-Text mit wiederkehrendem Wochentermin und Alarm zur Startzeit.
 * @param {{days?: number[], time?: string, title?: string, description?: string, kind?: 'training'|'reset', now?: Date|number|string}} opts
 *   `days`: 0 = So … 6 = Sa
 * @returns {string}
 */
export function buildICS({ days, time, title, description, kind = 'training', now } = {}) {
  const reset = kind === 'reset';
  const dayList = cleanDays(days, reset ? WORKDAYS : DEFAULT_DAYS);
  const t = typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : reset ? DEFAULT_RESET_TIME : DEFAULT_TIME;
  const [hh, mm] = t.split(':').map(Number);
  const nowD = toDate(now);
  const summary = title || (reset ? 'Nacken-Reset' : 'Lisas Training');
  const desc = description ?? (reset
    ? 'Zwei Minuten für deinen Nacken: Kinn zurück, Schultern locker, tief atmen.'
    : 'Zeit für dich und dein Training – du entscheidest, wie lange.');
  const durationMin = reset ? 5 : 30;

  // erster Termin: heute oder der nächste passende Wochentag; ist die Zeit heute schon vorbei, der nächste Tag
  let start = null;
  for (let i = 0; i < 8 && !start; i++) {
    const c = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() + i, hh, mm, 0);
    if (dayList.includes(c.getDay()) && c.getTime() > nowD.getTime()) start = c;
  }
  const end = new Date(start.getTime() + durationMin * 60000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lisas Trainings-App//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:lisa-${reset ? 'nacken-reset' : 'training'}@lisas-trainingsapp`,
    `DTSTAMP:${utcStamp(nowD)}`,
    `DTSTART:${localStamp(start)}`,
    `DTEND:${localStamp(end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${dayList.map((d) => BYDAY[d]).join(',')}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(desc)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.flatMap(foldLine).join('\r\n')}\r\n`;
}

/** Dateiname der .ics-Datei. */
export const icsFileName = (kind = 'training') => (kind === 'reset' ? 'nacken-reset-erinnerung.ics' : 'lisas-training-erinnerung.ics');
