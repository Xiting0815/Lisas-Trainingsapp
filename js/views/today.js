// „Heute“: Begrüßung, Schmerz-Skala, Zeit wählen, „Los geht’s“, Schnellstarts, Wochenübersicht, Tipp des Tages.
import { html, raw, longDay, isStandalone, lsGet, lsSet, exportBackup, toast, confirmDialog } from './ui.js';
import { startSession, validActive, weekDots } from './session-helpers.js';
import { lightFor, LIGHT_INFO } from '../logic/traffic.js';
import { tipOfDay } from '../logic/tips.js';
import { weekSummary, needsNudge, needsExportHint } from '../logic/week.js';
import { unlock as unlockAudio } from '../util/audio.js';
import { unlock as unlockVoice } from '../util/voice.js';

export const title = 'Heute';

const MINUTES = [10, 15, 20];
const LIGHT_TEXT = {
  green: 'Das passt gut – wir starten dein normales Training.',
  yellow: LIGHT_INFO.yellow.hint,
  red: 'Heute gibt es nur eine ruhige Entspannung – dein Nacken darf sich ausruhen.',
};

/** @param {HTMLElement} root @param {any} ctx */
export function render(root, ctx) {
  const { store, content, navigate } = ctx;
  let pain = null;
  const saved = Number(lsGet('lisa.ui.minutes', 15));
  let minutes = MINUTES.includes(saved) ? saved : 15;

  const view = () => {
    const now = new Date();
    const data = store.get();
    const sessions = data.sessions || [];
    const active = data.state?.activeSession;
    const resume = active && validActive(active, content);
    const week = weekSummary(sessions, now);
    const dots = weekDots(sessions, now);
    const tip = tipOfDay(content.tips, now);
    const nudge = !resume && needsNudge(sessions, now);
    const exportHint = needsExportHint(data.settings, now);
    const installHint = !isStandalone() && !data.state?.installHintDismissed;
    const light = pain == null ? null : lightFor(pain);

    return html`
<div class="page today">
  <header class="hero">
    <p class="eyebrow">${longDay(now)}</p>
    <h1>Hallo Lisa <span aria-hidden="true">💗</span></h1>
    <p class="lead">Schön, dass du da bist.</p>
  </header>

  ${resume ? html`<section class="card card--soft resume" aria-labelledby="resume-t">
    <h2 id="resume-t">Dein Training wartet</h2>
    <p>Du hast ein Training angefangen – ${active.plan.items.length ? `Übung ${Math.min(active.index + 1, active.plan.items.length)} von ${active.plan.items.length}` : 'es geht gleich weiter'}. Magst du weitermachen?</p>
    <div class="btn-row"><button type="button" class="btn btn--primary" data-act="resume">Weitermachen</button>
    <button type="button" class="btn btn--ghost" data-act="discard">Verwerfen</button></div>
  </section>` : ''}

  ${nudge ? html`<section class="card card--soft" aria-label="Kleiner Hinweis">
    <p class="card__lead">Schön, dich zu sehen! 🌷</p>
    <p>Es ist ein paar Tage her. Magst du heute wieder eine kleine Runde machen? Schon zwei Minuten tun dem Nacken gut.</p>
  </section>` : ''}

  <section class="card" aria-labelledby="pain-t">
    <h2 id="pain-t">Wie geht’s deinem Nacken heute?</h2>
    <pt-pain-scale id="pain" label="Nackenschmerz heute" ${pain == null ? '' : raw(`value="${pain}"`)}></pt-pain-scale>
    <p class="light-hint ${light ? `is-${light}` : ''}" id="light-hint" aria-live="polite" ${light ? '' : 'hidden'}>${light ? LIGHT_TEXT[light] : ''}</p>
  </section>

  <section class="card" aria-labelledby="time-t">
    <h2 id="time-t">Wie viel Zeit hast du?</h2>
    <div class="seg" role="radiogroup" aria-labelledby="time-t">
      ${MINUTES.map((m) => html`<button type="button" role="radio" class="seg__btn" data-min="${m}" aria-checked="${String(m === minutes)}"><span class="seg__num">${m}</span><span class="seg__unit">Minuten</span></button>`)}
    </div>
  </section>

  <button type="button" class="btn btn--primary btn--xl btn--block" id="go">Los geht’s</button>
  <p class="hint hint--warn" id="go-hint" role="status" hidden>Sag mir kurz, wie es deinem Nacken geht – tippe oben eine Zahl an.</p>

  <section class="stack" aria-labelledby="quick-t">
    <h2 id="quick-t">Zwischendurch</h2>
    <div class="quick">
      <button type="button" class="quick__btn" data-quick="reset"><span class="quick__icon" aria-hidden="true">💆</span><span class="quick__name">Nacken-Reset</span><span class="quick__meta">2 Min · im Stehen</span></button>
      <button type="button" class="quick__btn" data-quick="evening"><span class="quick__icon" aria-hidden="true">🌙</span><span class="quick__name">Abend-Entspannung</span><span class="quick__meta">5 Min · mit Wärme</span></button>
    </div>
  </section>

  ${tip ? html`<section class="card tip" aria-labelledby="tip-t">
    <p class="eyebrow">Tipp des Tages</p>
    <div class="tip__row"><span class="tip__icon" aria-hidden="true">${tip.icon || '💡'}</span>
    <div><h2 id="tip-t">${tip.title}</h2><p>${tip.text}</p></div></div>
  </section>` : ''}

  <section class="card week" aria-labelledby="week-t">
    <h2 id="week-t">Deine Woche</h2>
    <p class="week__text">${week.text}</p>
    <ol class="week__dots" aria-label="Wochentage">
      ${dots.map((d) => html`<li class="week__day ${d.today ? 'is-today' : ''}"><span class="week__dot ${d.training ? 'is-training' : d.mini ? 'is-mini' : ''}" role="img" aria-label="${d.name}: ${d.training ? 'Training' : d.mini ? 'Mini-Pause' : 'nichts'}"></span><span class="week__name">${d.name}</span></li>`)}
    </ol>
    <p class="muted week__legend"><span class="week__dot is-training" aria-hidden="true"></span> Training <span class="week__dot is-mini" aria-hidden="true"></span> Mini-Pause</p>
  </section>

  ${exportHint ? html`<section class="card card--soft" aria-labelledby="exp-t">
    <h2 id="exp-t">Deine Daten sichern?</h2>
    <p>Das dauert nur einen Moment – dann gehen deine Trainings nie verloren, auch wenn das Handy mal streikt.</p>
    <div class="btn-row"><button type="button" class="btn btn--primary" data-act="export">Jetzt sichern</button>
    <button type="button" class="btn btn--ghost" data-act="export-later">Später</button></div>
  </section>` : ''}

  ${installHint ? html`<section class="card card--soft" aria-labelledby="inst-t">
    <h2 id="inst-t">📲 Als App aufs iPhone holen</h2>
    <p>So startest du mit einem Tipp vom Home-Bildschirm – ganz ohne Internet und ohne Adressleiste.</p>
    <div class="btn-row"><a class="btn btn--primary" href="#/install">Zeig mir, wie</a>
    <button type="button" class="btn btn--ghost" data-act="install-later">Nicht mehr zeigen</button></div>
  </section>` : ''}
</div>`;
  };

  const paint = () => {
    root.innerHTML = view().toString();
    // Auswahl wiederherstellen (setAttribute-basiert, die Komponente baut sich selbst auf)
  };

  const unlockAll = () => { try { unlockAudio(); unlockVoice(); } catch { /* ignorieren */ } };

  const start = (kind) => {
    unlockAll();
    try {
      startSession(ctx, { kind, minutes, pain });
    } catch (e) {
      console.error(e);
      toast('Das Training konnte gerade nicht zusammengestellt werden. Bitte lade die App neu.');
      return;
    }
    navigate('/session');
  };

  const onClick = async (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const minBtn = t.closest('[data-min]');
    if (minBtn) {
      minutes = Number(minBtn.getAttribute('data-min'));
      lsSet('lisa.ui.minutes', minutes);
      root.querySelectorAll('[data-min]').forEach((b) => b.setAttribute('aria-checked', String(b === minBtn)));
      return;
    }
    if (t.closest('#go')) {
      if (pain == null) {
        const h = root.querySelector('#go-hint');
        h.hidden = false;
        root.querySelector('#pain')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        root.querySelector('#pain button')?.focus({ preventScroll: true });
        return;
      }
      start('training');
      return;
    }
    const quick = t.closest('[data-quick]');
    if (quick) { start(quick.getAttribute('data-quick')); return; }
    const act = t.closest('[data-act]')?.getAttribute('data-act');
    if (!act) return;
    if (act === 'resume') { unlockAll(); navigate('/session'); }
    else if (act === 'discard') {
      const ok = await confirmDialog({ title: 'Training verwerfen?', text: 'Das angefangene Training wird nicht gespeichert.', confirmLabel: 'Verwerfen', danger: true });
      if (ok) { store.update((d) => { d.state.activeSession = null; }); paint(); }
    } else if (act === 'export') {
      const r = await exportBackup(store);
      if (r !== 'cancelled') { toast('Gesichert – danke dir!'); paint(); }
    } else if (act === 'export-later') {
      store.update((d) => { d.settings.exportHintDismissedAt = new Date().toISOString(); });
      paint();
    } else if (act === 'install-later') {
      store.update((d) => { d.state.installHintDismissed = true; });
      paint();
    }
  };

  const onPain = (e) => {
    pain = e.detail.value;
    const light = lightFor(pain);
    const h = root.querySelector('#light-hint');
    h.hidden = false;
    h.className = `light-hint is-${light}`;
    h.textContent = LIGHT_TEXT[light];
    const gh = root.querySelector('#go-hint');
    if (gh) gh.hidden = true;
  };

  paint();
  root.addEventListener('click', onClick);
  root.addEventListener('change', onPain);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onPain);
  };
}
