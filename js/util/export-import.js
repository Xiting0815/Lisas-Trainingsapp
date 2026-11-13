// Datensicherung: Export als Datei, Teilen (Share-Sheet), Import mit Prüfung. Siehe docs/SPEC.md §3.
// Die reinen Helfer (Dateiname, Parsen, Prüfen) laufen auch in Node; Download/Teilen brauchen den Browser.
import { exportData, importData, validateImport, update, nowISO, APP_ID } from '../store.js';
import { todayISO } from './date.js';

/** @param {string} [today] "YYYY-MM-DD" */
export function backupFilename(today = todayISO()) {
  return `lisa-training-sicherung-${today}.json`;
}

/** JSON-Text oder Objekt → Objekt. Wirft Error mit deutscher Meldung. */
export function parseBackup(input) {
  if (typeof input !== 'string') return input;
  try { return JSON.parse(input); } catch { throw new Error('Die Datei ist kein gültiges JSON.'); }
}

/** Prüft eine Sicherung (nur Lisas Daten, `lisa.v1`). @returns {{ok: boolean, errors: string[]}} */
export function validateBackup(input) {
  let obj;
  try { obj = parseBackup(input); } catch (e) { return { ok: false, errors: [e.message] }; }
  return validateImport(obj);
}

/** Text und Dateiname der Sicherung. */
export function buildBackup(today) {
  return { filename: backupFilename(today), text: exportData(), mime: 'application/json' };
}

function markExported() {
  update((d) => { d.settings.lastExportAt = nowISO(); });
}

/** Lädt eine Textdatei per Blob-Download herunter (Browser). */
export function downloadTextFile(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
}

/**
 * Teilen mit Datei (Share-Sheet), wenn der Browser es kann; sonst Download.
 * @returns {Promise<{ok: boolean, method: 'share'|'download'|'cancelled'}>}
 */
export async function shareOrDownload(filename, text, mime = 'text/plain') {
  try {
    const nav = globalThis.navigator;
    if (nav?.share && nav?.canShare && typeof File === 'function') {
      const file = new File([text], filename, { type: mime });
      if (nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: filename });
          return { ok: true, method: 'share' };
        } catch (e) {
          if (e?.name === 'AbortError') return { ok: false, method: 'cancelled' };
          /* sonst Download versuchen */
        }
      }
    }
    downloadTextFile(filename, text, mime);
    return { ok: true, method: 'download' };
  } catch {
    return { ok: false, method: 'download' };
  }
}

/** Sicherung als Datei herunterladen und „zuletzt gesichert“ vermerken. */
export function downloadBackup() {
  const b = buildBackup();
  downloadTextFile(b.filename, b.text, b.mime);
  markExported();
  return b.filename;
}

/** Sicherung teilen (mit Datei, sonst Download) und bei Erfolg „zuletzt gesichert“ vermerken. */
export async function shareBackup() {
  const b = buildBackup();
  const r = await shareOrDownload(b.filename, b.text, b.mime);
  if (r.ok) markExported();
  return r;
}

/** Erinnerungs-Datei (.ics) öffnen bzw. teilen. */
export function saveICS(filename, text) {
  return shareOrDownload(filename, text, 'text/calendar');
}

/** Sicherung aus Text einlesen. @returns {{ok: boolean, error?: string, sessions?: number}} */
export function importFromText(text) {
  return importData(text);
}

/** Sicherung aus einer gewählten Datei einlesen (Browser). */
export async function readBackupFile(file) {
  let text;
  try { text = await file.text(); } catch { return { ok: false, error: 'Die Datei konnte nicht gelesen werden.' }; }
  return importData(text);
}

export { APP_ID };
