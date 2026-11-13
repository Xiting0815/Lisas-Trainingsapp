// Kleine gemeinsame Helfer für alle Views: Datum, Teilen/Herunterladen, Dialog, Toast, Browser-Speicher (nur Komfort).
import { html, raw, escape } from '../render.js';

export { html, raw, escape };

/* ------------------------------------------------------------------ Datum (lokale Zeit) */

const pad = (n) => String(n).padStart(2, '0');
/** @param {Date|string|number} d */
export const asDate = (d) => (d instanceof Date ? d : new Date(d ?? Date.now()));
/** Lokaler Tag als YYYY-MM-DD. */
export const dayKey = (d) => { const x = asDate(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** „Mittwoch, 13. November“ */
export const longDay = (d) => { const x = asDate(d); return `${WEEKDAYS_LONG[x.getDay()]}, ${x.getDate()}. ${MONTHS[x.getMonth()]}`; };
/** „13.11.“ */
export const shortDay = (d) => { const x = asDate(d); return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.`; };
/** „18:30“ */
export const clock = (d) => { const x = asDate(d); return `${pad(x.getHours())}:${pad(x.getMinutes())}`; };

/** Sekunden → „5 Min.“ / „1 Min. 30 Sek.“ / „45 Sek.“ */
export function minutesText(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  if (s < 60) return `${s} Sek.`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m} Min. ${r} Sek.` : `${m} Min.`;
}

/* ------------------------------------------------------------------ Browser-Speicher (nur Komfort, nie wichtig) */

export function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
export function lsSet(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* ignorieren */ }
}

/* ------------------------------------------------------------------ Teilen / Herunterladen */

/** Datei herunterladen. */
export function downloadFile(content, filename, mime = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Datei über das iPhone-Teilen-Menü anbieten (navigator.share mit Datei), sonst herunterladen.
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function shareOrDownload(content, filename, mime, title = '') {
  try {
    const file = new File([content], filename, { type: mime });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }) && typeof navigator.share === 'function') {
      await navigator.share({ files: [file], title: title || filename });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
    /* anderer Fehler → Download */
  }
  downloadFile(content, filename, mime);
  return 'downloaded';
}

/* ------------------------------------------------------------------ Toast + Dialog */

let toastTimer = 0;
/** Kurze Meldung unten. */
export function toast(text, ms = 3200) {
  document.querySelector('.toast--info')?.remove();
  const el = document.createElement('div');
  el.className = 'toast toast--info';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

/**
 * Bestätigungs-Dialog (statt window.confirm).
 * @param {{title: string, text?: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean}} o
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, text = '', confirmLabel = 'Ja', cancelLabel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 id="dlg-t">${escape(title)}</h2>${text ? `<p>${escape(text)}</p>` : ''}
      <div class="sheet__actions"><button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-ok>${escape(confirmLabel)}</button>
      <button type="button" class="btn btn--ghost" data-cancel>${escape(cancelLabel)}</button></div></div>`;
    const done = (v) => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (t.closest('[data-ok]')) done(true);
      else if (t.closest('[data-cancel]') || t === wrap) done(false);
    });
    document.body.appendChild(wrap);
    wrap.querySelector('[data-ok]')?.focus();
  });
}

/**
 * Menü-Sheet mit Knöpfen. `items`: [{key, label, primary?, danger?}] → Promise<key|null>.
 */
export function actionSheet({ title, text = '', items }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 id="dlg-t">${escape(title)}</h2>${text ? `<p>${escape(text)}</p>` : ''}
      <div class="sheet__actions">${items.map((it) => `<button type="button" class="btn ${it.primary ? 'btn--primary' : it.danger ? 'btn--danger' : ''}" data-key="${escape(it.key)}">${escape(it.label)}</button>`).join('')}
      <button type="button" class="btn btn--ghost" data-cancel>Zurück</button></div></div>`;
    const done = (v) => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      const b = t.closest('[data-key]');
      if (b) done(b.getAttribute('data-key'));
      else if (t.closest('[data-cancel]') || t === wrap) done(null);
    });
    document.body.appendChild(wrap);
    wrap.querySelector('button')?.focus();
  });
}

/* ------------------------------------------------------------------ App-Modus */

/** Läuft die Seite als installierte App (Home-Bildschirm)? */
export function isStandalone() {
  try {
    if (navigator.standalone === true) return true;
    return !!window.matchMedia?.('(display-mode: standalone)').matches;
  } catch { return false; }
}

/** Anzeige für Sessions (Titel je Art). */
export const KIND_LABEL = { training: 'Training', reset: 'Nacken-Reset', evening: 'Abend-Entspannung' };
export const KIND_ICON = { training: '🌸', reset: '💆', evening: '🌙' };
export const EFFORT = {
  leicht: { emoji: '😌', label: 'Leicht' },
  richtig: { emoji: '🙂', label: 'Genau richtig' },
  anstrengend: { emoji: '😅', label: 'Anstrengend' },
  zuviel: { emoji: '😣', label: 'Zu viel' },
};

/** Zufällige/stabile Auswahl aus einer Liste anhand eines Textes (z. B. Session-ID). */
export function pickStable(list, seed) {
  if (!list?.length) return '';
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

/* ------------------------------------------------------------------ Datensicherung */

/** Daten als Datei sichern (Teilen-Menü oder Download) und den Zeitpunkt merken. @returns {Promise<'shared'|'downloaded'|'cancelled'>} */
export async function exportBackup(store) {
  const text = store.exportData();
  const name = `lisas-training-${dayKey(new Date())}.json`;
  const r = await shareOrDownload(text, name, 'application/json', 'Lisas Training – Datensicherung');
  if (r !== 'cancelled') store.update((d) => { d.settings.lastExportAt = new Date().toISOString(); });
  return r;
}
