// Einstellungen: Ansagen, Erinnerungen (.ics), Aussehen, Datensicherung, Hilfe.
import { html, raw, toast, shareOrDownload, exportBackup, confirmDialog, WEEKDAYS_SHORT } from './ui.js';
import { buildICS, icsFileName } from '../logic/reminders.js';
import { unlock as unlockAudio, beep } from '../util/audio.js';
import { testVoice, voiceAvailable } from '../util/voice.js';

export const title = 'Einstellungen';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mo … So (0 = Sonntag)
const THEMES = [['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']];

/** @param {HTMLElement} root @param {any} ctx */
export function render(root, ctx) {
  const { store } = ctx;

  const view = () => {
    const s = store.get().settings;
    const rem = s.reminder || { days: [1, 3, 5], time: '18:30', reset: false, resetTime: '12:30' };
    const vol = Math.round((s.volume ?? 0.8) * 100);
    const last = s.lastExportAt ? new Date(s.lastExportAt) : null;
    return html`
<div class="page settings">
  <h1>Einstellungen</h1>

  <section class="card" aria-labelledby="voice-t">
    <h2 id="voice-t">Ansagen</h2>
    <label class="row switch"><span>Sprachansagen beim Training</span>
      <input type="checkbox" role="switch" id="voice" ${s.voice !== false ? raw('checked') : ''}><span class="switch__track" aria-hidden="true"></span></label>
    <div class="field">
      <label for="vol">Lautstärke der Ansagen und Töne: <strong id="vol-out">${vol} %</strong></label>
      <input type="range" id="vol" min="0" max="100" step="5" value="${vol}">
    </div>
    <button type="button" class="btn" data-act="probe">🔊 Probe hören</button>
    <p class="muted" id="probe-hint">Hörst du nichts? Schau nach, ob der Lautlos-Schalter an der Seite deines iPhones aus ist (kein Orange zu sehen) und die Lautstärke aufgedreht ist.</p>
  </section>

  <section class="card" aria-labelledby="rem-t">
    <h2 id="rem-t">Erinnerungen</h2>
    <p>Dein iPhone erinnert dich über den Kalender. Wähle Tage und Uhrzeit, dann trägst du es mit einem Tipp ein.</p>
    <div class="chips-row" role="group" aria-label="Wochentage">
      ${DAY_ORDER.map((d) => html`<button type="button" class="daychip" data-day="${d}" aria-pressed="${String((rem.days || []).includes(d))}">${WEEKDAYS_SHORT[d]}</button>`)}
    </div>
    <div class="field"><label for="rtime">Uhrzeit</label><input type="time" id="rtime" value="${rem.time || '18:30'}"></div>
    <label class="row switch"><span>Zusätzlich: Nacken-Reset mittags (Mo–Fr)</span>
      <input type="checkbox" role="switch" id="rreset" ${rem.reset ? raw('checked') : ''}><span class="switch__track" aria-hidden="true"></span></label>
    ${rem.reset ? html`<div class="field"><label for="rrtime">Uhrzeit für den Nacken-Reset</label><input type="time" id="rrtime" value="${rem.resetTime || '12:30'}"></div>` : ''}
    <button type="button" class="btn btn--primary" data-act="ics">📅 Erinnerung in Kalender eintragen</button>
    <p class="muted" id="ics-hint">Öffne die Datei danach und tippe auf „Hinzufügen“ – dann erinnert dich dein iPhone-Kalender.</p>
  </section>

  <section class="card" aria-labelledby="theme-t">
    <h2 id="theme-t">Aussehen</h2>
    <div class="seg" role="radiogroup" aria-labelledby="theme-t">
      ${THEMES.map(([k, l]) => html`<button type="button" role="radio" class="seg__btn seg__btn--wide" data-theme="${k}" aria-checked="${String((s.theme || 'auto') === k)}">${l}</button>`)}
    </div>
    <p class="muted">„Automatisch“ folgt der Einstellung deines iPhones.</p>
  </section>

  <section class="card" aria-labelledby="data-t">
    <h2 id="data-t">Datensicherung</h2>
    <p>Deine Trainings bleiben auf diesem Handy. Mit einer Sicherung kannst du sie jederzeit retten oder auf ein neues Handy mitnehmen.${last ? ` Zuletzt gesichert am ${last.getDate()}.${last.getMonth() + 1}.${last.getFullYear()}.` : ''}</p>
    <div class="btn-row">
      <button type="button" class="btn btn--primary" data-act="export">Daten sichern</button>
      <label class="btn" for="import-file">Daten zurückholen</label>
      <input type="file" id="import-file" accept="application/json,.json" class="sr-only">
    </div>
    <p class="muted" id="data-msg" role="status"></p>
  </section>

  <section class="card" aria-labelledby="help-t">
    <h2 id="help-t">Hilfe &amp; Wissenswertes</h2>
    <ul class="links">
      <li><a class="linkrow" href="#/info"><span>Gut zu wissen &amp; Warnzeichen</span><span aria-hidden="true">›</span></a></li>
      <li><a class="linkrow" href="#/install"><span>App auf dem iPhone installieren</span><span aria-hidden="true">›</span></a></li>
    </ul>
  </section>
  <p class="muted foot">Lisas Trainings-App · mit 💗 gemacht</p>
</div>`;
  };

  const paint = () => { root.innerHTML = view().toString(); };
  const setSettings = (fn) => store.update((d) => fn(d.settings));
  const rem = () => ({ days: [1, 3, 5], time: '18:30', reset: false, resetTime: '12:30', ...(store.get().settings.reminder || {}) });
  const msg = (t) => { const m = root.querySelector('#data-msg'); if (m) m.textContent = t; };

  const onChange = async (e) => {
    const t = /** @type {HTMLInputElement} */ (e.target);
    if (t.id === 'voice') setSettings((s) => { s.voice = t.checked; });
    else if (t.id === 'vol') setSettings((s) => { s.volume = Number(t.value) / 100; });
    else if (t.id === 'rtime') setSettings((s) => { s.reminder = { ...rem(), time: t.value || '18:30' }; });
    else if (t.id === 'rrtime') setSettings((s) => { s.reminder = { ...rem(), resetTime: t.value || '12:30' }; });
    else if (t.id === 'rreset') { setSettings((s) => { s.reminder = { ...rem(), reset: t.checked }; }); paint(); }
    else if (t.id === 'import-file' && t.files?.[0]) {
      const file = t.files[0];
      t.value = '';
      const ok = await confirmDialog({
        title: 'Sicherung zurückholen?',
        text: 'Alles, was jetzt auf diesem Handy gespeichert ist, wird durch die Sicherung ersetzt.',
        confirmLabel: 'Ja, zurückholen',
      });
      if (!ok) return;
      try {
        const text = await file.text();
        const res = store.importData(text);
        if (res && res.ok === false) { msg(`Das hat nicht geklappt: ${res.error || 'Die Datei passt nicht zur App.'}`); return; }
        toast('Deine Daten sind wieder da. 💗');
        paint();
      } catch (err) {
        console.error(err);
        msg('Die Datei konnte nicht gelesen werden.');
      }
    }
  };
  const onInput = (e) => {
    const t = /** @type {HTMLInputElement} */ (e.target);
    if (t.id === 'vol') { const o = root.querySelector('#vol-out'); if (o) o.textContent = `${t.value} %`; }
  };

  const onClick = async (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const day = t.closest('[data-day]');
    if (day) {
      const d = Number(day.getAttribute('data-day'));
      setSettings((s) => {
        const r = { ...rem() };
        const set = new Set(r.days || []);
        if (set.has(d)) set.delete(d); else set.add(d);
        r.days = [...set].sort((a, b) => a - b);
        s.reminder = r;
      });
      day.setAttribute('aria-pressed', String(!(day.getAttribute('aria-pressed') === 'true')));
      return;
    }
    const th = t.closest('[data-theme]');
    if (th) {
      const v = th.getAttribute('data-theme');
      setSettings((s) => { s.theme = v; });
      root.querySelectorAll('[data-theme]').forEach((b) => b.setAttribute('aria-checked', String(b === th)));
      return;
    }
    const act = t.closest('[data-act]')?.getAttribute('data-act');
    if (act === 'probe') {
      unlockAudio();
      const spoken = testVoice();
      if (!spoken) beep('done');
      const h = root.querySelector('#probe-hint');
      if (h && !voiceAvailable()) h.textContent = 'Auf diesem Gerät finde ich keine deutsche Stimme – du hörst stattdessen kleine Töne. Hörst du gar nichts? Prüfe den Lautlos-Schalter und die Lautstärke.';
    } else if (act === 'ics') {
      const r = rem();
      const hint = root.querySelector('#ics-hint');
      if (!(r.days || []).length) { if (hint) hint.textContent = 'Wähle bitte mindestens einen Tag aus.'; return; }
      const now = new Date();
      const files = [{
        name: icsFileName('training'),
        text: buildICS({ days: r.days, time: r.time, title: 'Training für Nacken & Rücken 💗', description: 'Zeit für dich: ein sanftes Training in Lisas Trainings-App.', kind: 'training', now }),
      }];
      if (r.reset) {
        files.push({
          name: icsFileName('reset'),
          text: buildICS({ days: [1, 2, 3, 4, 5], time: r.resetTime, title: 'Nacken-Reset', description: 'Zwei Minuten für deinen Nacken – im Stehen, ohne Geräte.', kind: 'reset', now }),
        });
      }
      for (const f of files) {
        const res = await shareOrDownload(f.text, f.name, 'text/calendar', 'Erinnerung für Lisas Training');
        if (res === 'cancelled') break;
      }
      if (hint) hint.textContent = 'Fast geschafft: Öffne die Datei und tippe auf „Hinzufügen“. Danach erinnert dich dein Kalender.';
    } else if (act === 'export') {
      const res = await exportBackup(store);
      if (res !== 'cancelled') { msg(res === 'shared' ? 'Gesichert – danke dir!' : 'Die Sicherung wurde als Datei heruntergeladen.'); paint(); }
    }
  };

  paint();
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    root.removeEventListener('input', onInput);
  };
}
