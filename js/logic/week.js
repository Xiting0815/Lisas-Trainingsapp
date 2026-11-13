// Wochenübersicht, Erinnerungs-Hinweise, Schmerzverlauf. PURE (now injizierbar). Siehe docs/SPEC.md §4.
import { daysBetween, startOfIsoWeek, toISODate } from '../util/date.js';
import { toDate } from './levels.js';

const dayOf = (v) => toISODate(toDate(v));
const sessDay = (s) => (typeof s?.date === 'string' && Number.isFinite(Date.parse(s.date)) ? toISODate(new Date(s.date)) : null);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Wochenübersicht (Woche beginnt Montag): Trainings und Mini-Pausen, ohne Druck.
 * @returns {{trainings: number, breaks: number, text: string}}
 */
export function weekSummary(sessions, now) {
  const today = dayOf(now);
  const start = startOfIsoWeek(today);
  let trainings = 0;
  let breaks = 0;
  for (const s of sessions || []) {
    const d = sessDay(s);
    if (!d || d < start || d > today) continue;
    if (s.kind === 'training') trainings += 1;
    else if (s.kind === 'reset' || s.kind === 'evening') breaks += 1;
  }
  const parts = [];
  if (trainings) parts.push(plural(trainings, 'Training', 'Trainings'));
  if (breaks) parts.push(plural(breaks, 'Mini-Pause', 'Mini-Pausen'));
  const text = parts.length ? `Diese Woche: ${parts.join(', ')} 💗` : 'Diese Woche: noch nichts – ganz ohne Druck 💗';
  return { trainings, breaks, text };
}

/** Tage seit der letzten Einheit (Training oder Mini-Pause); null, wenn es noch keine gibt. */
export function daysSinceLast(sessions, now) {
  let last = null;
  for (const s of sessions || []) {
    const d = sessDay(s);
    if (d && (!last || d > last)) last = d;
  }
  return last ? Math.max(0, daysBetween(last, dayOf(now))) : null;
}

/** Sanfter Hinweis auf dem Startbildschirm: seit mindestens 3 Tagen nichts (ohne Einheit noch nie → kein Hinweis). */
export function needsNudge(sessions, now) {
  const n = daysSinceLast(sessions, now);
  return n != null && n >= 3;
}

/**
 * Alle 14 Tage an die Datensicherung erinnern. Bezugszeitpunkt = letzter Export bzw. zuletzt weggeklickter Hinweis,
 * sonst (optional, `state.firstRunAt`) der erste Start.
 * @param {{lastExportAt?: string|null, exportHintDismissedAt?: string|null}} settings
 * @param {Date|number|string} now
 * @param {{firstRunAt?: string|null}|null} [state]
 */
export function needsExportHint(settings, now, state = null) {
  const times = [settings?.lastExportAt, settings?.exportHintDismissedAt].map((v) => Date.parse(v)).filter(Number.isFinite);
  let ref = times.length ? new Date(Math.max(...times)) : null;
  if (!ref && state?.firstRunAt && Number.isFinite(Date.parse(state.firstRunAt))) ref = new Date(state.firstRunAt);
  if (!ref) return false;
  return daysBetween(toISODate(ref), dayOf(now)) >= 14;
}

/** Schmerz vor/nach dem Training für das Diagramm (älteste zuerst); Einheiten ganz ohne Schmerzwerte entfallen. */
export function painSeries(sessions) {
  return (sessions || [])
    .filter((s) => s && Number.isFinite(Date.parse(s.date)) && (Number.isFinite(s.painBefore) || Number.isFinite(s.painAfter)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map((s) => ({
      date: s.date,
      kind: s.kind,
      before: Number.isFinite(s.painBefore) ? s.painBefore : null,
      after: Number.isFinite(s.painAfter) ? s.painAfter : null,
    }));
}
