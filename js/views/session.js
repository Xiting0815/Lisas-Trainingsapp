// Training: eine Übung nach der anderen (Figur, „Wofür“, Schritte, Timer mit Ansagen), „Das tut weh“, danach Rückmeldung.
// Die aktive Einheit liegt in `state.activeSession` und wird nach jedem Tipp gespeichert – nach einem Neuladen geht es
// bei der aktuellen Übung weiter. Siehe docs/SPEC.md §5.
import { html, raw, toast, actionSheet, confirmDialog, EFFORT } from './ui.js';
import {
  BLOCK_LABELS, BAND_LABELS, BAND_COLORS, doseText, timerPlanFor, planSeconds, beat, validActive, finishedSession,
} from './session-helpers.js';
import { swapExercise } from '../logic/compose.js';
import { applyTrainingResult } from '../logic/levels.js';
import { unlock as unlockAudio } from '../util/audio.js';
import { say, cancel as voiceCancel, unlock as unlockVoice } from '../util/voice.js';
import '../components/pt-timer.js';
import '../components/pt-figure.js';
import '../components/pt-pain-scale.js';

export const title = 'Training';

const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const GUARD_MS = 350;

const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/** @param {HTMLElement} root @param {any} ctx */
export function render(root, ctx) {
  const { store, content, navigate } = ctx;
  const exOf = (id) => content.byId?.get?.(id) || content.exercises.find((e) => e.id === id);
  const stored = store.get().state?.activeSession;
  if (!stored || !validActive(stored, content)) {
    if (stored) store.update((d) => { d.state.activeSession = null; });
    navigate('/');
    return undefined;
  }
  /** @type {any} */
  let active = clone(stored);
  let disposed = false;
  let guardUntil = 0;
  let timer = null;
  let wake = null;

  const persist = () => {
    beat(active);
    const copy = clone(active);
    store.update((d) => { d.state.activeSession = copy; });
  };

  // ---- Bildschirm wachhalten (Wake Lock ab iOS 16.4, sonst Hinweis) ------------------------------------------------
  const acquireWake = async () => {
    try {
      if (!navigator.wakeLock || wake || document.visibilityState !== 'visible') return;
      const lock = await navigator.wakeLock.request('screen');
      if (disposed) { lock.release().catch(() => {}); return; }
      wake = lock;
      lock.addEventListener?.('release', () => { if (wake === lock) wake = null; });
    } catch { /* nicht erlaubt */ }
  };
  const onVisible = () => { if (document.visibilityState === 'visible') acquireWake(); };
  document.addEventListener('visibilitychange', onVisible);
  acquireWake();

  const unlockAll = () => { try { unlockAudio(); unlockVoice(); } catch { /* ignorieren */ } };

  // ---- Übungsbildschirm ----------------------------------------------------------------------------------------------
  const item = () => active.plan.items[active.index];

  const exerciseView = () => {
    const it = item();
    const ex = exOf(it.exerciseId);
    const items = active.plan.items;
    const n = items.length;
    const steps = Array.isArray(ex.steps) ? ex.steps : [];
    const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    const mistakes = list(ex.mistakes);
    const instructions = list(ex.instructions);
    const showBand = it.band && !String(ex.gear || '').toLowerCase().includes((BAND_LABELS[it.band] || '').split(' ')[0]);
    const eachSide = it.side === 'each' || ex.side === 'each';
    const first = active.index === 0;
    return html`
<div class="ses">
  <header class="ses-top">
    <button type="button" class="btn btn--icon" data-act="menu" aria-label="Pausieren oder beenden">${raw(ICON_CLOSE)}</button>
    <div class="ses-top__title">
      <span class="eyebrow">Übung ${active.index + 1} von ${n}</span>
      <strong>${BLOCK_LABELS[it.block] || ''}</strong>
    </div>
  </header>
  <div class="progress" role="progressbar" aria-label="Fortschritt" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${active.index}">
    ${items.map((_, i) => html`<span class="progress__seg ${i < active.index ? 'is-done' : i === active.index ? 'is-now' : ''}"></span>`)}
  </div>

  ${first ? html`${(active.plan.notes || []).map((t) => html`<p class="hint hint--info">${t}</p>`)}
  ${active.plan.rowWarmup ? html`<label class="hint hint--info check"><input type="checkbox" data-rowed ${active.rowed ? raw('checked') : ''}> <span>Wenn du Lust hast: ca. 4 Minuten lockeres Rudern zum Aufwärmen – hast du es gemacht?</span></label>` : ''}
  ${'wakeLock' in navigator ? '' : html`<p class="hint">Tipp: Damit der Bildschirm nicht dunkel wird, stelle unter Einstellungen › Anzeige &amp; Helligkeit › Automatische Sperre „Nie“ ein.</p>`}` : ''}

  <article class="ex">
    <h1 class="ex__name">${ex.name}</h1>
    <div class="chips">
      <span class="chip chip--strong">${doseText(it, ex)}</span>
      ${eachSide ? html`<span class="chip">erst eine, dann die andere Seite</span>` : ''}
      ${showBand ? html`<span class="chip"><i class="dot" style="background:${BAND_COLORS[it.band] || '#999'}"></i>${BAND_LABELS[it.band] || it.band}</span>` : ''}
      ${ex.gear ? html`<span class="chip">🧰 ${ex.gear}</span>` : ''}
    </div>
    <div class="figure-card"><pt-figure exercise-id="${ex.id}" ${it.band ? raw(`band-id="${it.band}"`) : ''}></pt-figure></div>
    ${ex.warn ? html`<p class="hint hint--warn"><strong>Wichtig:</strong> ${ex.warn}</p>` : ''}
    <p class="why"><strong>Wofür?</strong> ${ex.short || ex.description || ''}</p>
    ${steps.length ? html`<ol class="steps">${steps.map((s) => html`<li>${s}</li>`)}</ol>` : ''}
    <details class="more">
      <summary>Mehr Details</summary>
      <div class="more__body">
        ${ex.setup ? html`<h3>So fängst du an</h3><p>${ex.setup}</p>` : ''}
        ${ex.feel ? html`<h3>Das solltest du spüren</h3><p>${ex.feel}</p>` : ''}
        ${instructions.length ? html`<h3>Ausführlich</h3><ul>${instructions.map((s) => html`<li>${s}</li>`)}</ul>` : ''}
        ${mistakes.length ? html`<h3>Das hilft dir, es richtig zu machen</h3><ul>${mistakes.map((s) => html`<li>${s}</li>`)}</ul>` : ''}
      </div>
    </details>
    <pt-timer id="timer" compact></pt-timer>
    <div class="ex__side">
      <button type="button" class="btn btn--soft" data-act="hurts">😣 Das tut weh</button>
      <button type="button" class="btn btn--ghost" data-act="skip">Überspringen</button>
    </div>
  </article>
</div>
<div class="cta-bar" role="region" aria-label="Steuerung">
  <p class="cta-bar__status" id="status" aria-live="off"></p>
  <button type="button" class="btn btn--primary btn--xl btn--block" id="cta" data-act="cta">Start</button>
</div>`;
  };

  // ---- Rückmeldung ----------------------------------------------------------------------------------------------------
  const afterView = () => {
    const isTraining = active.kind === 'training';
    const done = active.plan.items.length - (active.skipped || []).length;
    return html`
<div class="page after">
  <header class="hero">
    <h1>Geschafft! <span aria-hidden="true">🌸</span></h1>
    <p class="lead">${done > 0 ? 'Schön, dass du dir die Zeit genommen hast.' : 'Das ist völlig in Ordnung – auf deinen Körper zu hören ist wichtig.'}</p>
  </header>
  ${isTraining ? html`<section class="card" aria-labelledby="eff-t">
    <h2 id="eff-t">Wie anstrengend war’s?</h2>
    <div class="effort" role="radiogroup" aria-labelledby="eff-t">
      ${Object.entries(EFFORT).map(([k, v]) => html`<button type="button" role="radio" class="effort__btn" data-effort="${k}" aria-checked="${String(active.effort === k)}"><span class="effort__emoji" aria-hidden="true">${v.emoji}</span><span>${v.label}</span></button>`)}
    </div>
  </section>` : ''}
  <section class="card" aria-labelledby="pa-t">
    <h2 id="pa-t">Wie geht’s deinem Nacken jetzt?</h2>
    <pt-pain-scale id="pain-after" label="Nackenschmerz nach dem Training" ${active.painAfter == null ? '' : raw(`value="${active.painAfter}"`)}></pt-pain-scale>
    ${isTraining ? '' : html`<p class="muted">Das ist freiwillig – du kannst auch gleich weitermachen.</p>`}
  </section>
  <p class="hint hint--warn" id="need" role="status" hidden></p>
  <button type="button" class="btn btn--primary btn--xl btn--block" id="save" data-act="save">Fertig</button>
</div>`;
  };

  // ---- Anzeigen -------------------------------------------------------------------------------------------------------
  const setCta = () => {
    const cta = root.querySelector('#cta');
    if (!cta) return;
    const status = root.querySelector('#status');
    const last = active.index >= active.plan.items.length - 1;
    const st = timer ? timer.dataset.state : null;
    let label = 'Fertig';
    let mode = 'manual';
    if (timer && timer._phases?.length) {
      if (st === 'running') { label = 'Anhalten'; mode = 'pause'; }
      else if (st === 'paused') { label = 'Weiter'; mode = 'resume'; }
      else if (st === 'done') { label = last ? 'Zum Abschluss' : 'Nächste Übung'; mode = 'next'; }
      else { label = 'Start'; mode = 'start'; }
    } else { label = last ? 'Zum Abschluss' : 'Nächste Übung'; mode = 'next'; }
    cta.textContent = label;
    cta.dataset.mode = mode;
    cta.classList.toggle('is-calm', mode === 'pause');
    if (status) {
      if (timer && (st === 'running' || st === 'paused')) {
        const cue = timer.querySelector('.pt-timer__cue')?.textContent || '';
        status.textContent = `${cue} · ${timer.querySelector('.pt-timer__display')?.textContent || ''}`;
      } else status.textContent = '';
    }
  };

  const paint = () => {
    guardUntil = Date.now() + GUARD_MS;
    timer = null;
    if (active.step === 'after' || active.index >= active.plan.items.length) {
      active.step = 'after';
      document.body.classList.remove('has-cta');
      root.innerHTML = afterView().toString();
      window.scrollTo(0, 0);
      return;
    }
    root.innerHTML = exerciseView().toString();
    document.body.classList.add('has-cta');
    const it = item();
    const ex = exOf(it.exerciseId);
    timer = root.querySelector('#timer');
    const cue = timerPlanFor(it, ex);
    if (timer && cue.length && planSeconds(cue) > 0) timer.plan = cue;
    else if (timer) { timer.remove(); timer = null; }
    timer?.addEventListener('tick', setCta);
    timer?.addEventListener('done', () => {
      const next = active.plan.items[active.index + 1];
      const nextName = next ? exOf(next.exerciseId)?.name : '';
      say(nextName ? `Übung geschafft. Als Nächstes: ${nextName}` : 'Übung geschafft. Das war die letzte Übung.', { priority: 'high', interrupt: true, cue: 'exercise-done' });
      setCta();
      root.querySelector('#cta')?.focus({ preventScroll: true });
    });
    setCta();
    window.scrollTo(0, 0);
  };

  const goNext = () => {
    voiceCancel();
    active.index += 1;
    if (active.index >= active.plan.items.length) active.step = 'after';
    persist();
    paint();
  };

  // ---- Aktionen -------------------------------------------------------------------------------------------------------
  const actions = {
    cta() {
      if (Date.now() < guardUntil) return;
      const mode = root.querySelector('#cta')?.dataset.mode;
      unlockAll();
      if (mode === 'start' || mode === 'resume') {
        timer.start();
        const rect = timer.getBoundingClientRect();
        if (rect.bottom > innerHeight - 140 || rect.top < 60) timer.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setCta();
      } else if (mode === 'pause') { timer.pause(); setCta(); }
      else goNext();
    },
    skip() {
      timer?.pause();
      const id = item().exerciseId;
      if (!active.skipped.includes(id)) active.skipped.push(id);
      goNext();
    },
    hurts() {
      timer?.pause();
      voiceCancel();
      const idx = active.index;
      const oldId = item().exerciseId;
      const lastUsed = store.get().state?.lastUsed || {};
      const { plan, replacement } = swapExercise(active.plan, idx, { exercises: content.exercises, level: active.level, lastUsed });
      active.plan = plan;
      active.swaps.push({ from: oldId, to: replacement });
      if (replacement) toast(`Alles gut – ich habe dir eine sanftere Übung herausgesucht: ${exOf(replacement)?.name || ''}.`, 4200);
      else toast('Alles gut – diese Übung lassen wir weg. Gut, dass du auf dich hörst.', 4200);
      if (active.index >= active.plan.items.length) active.step = 'after';
      persist();
      paint();
    },
    async menu() {
      const wasRunning = timer?.dataset.state === 'running';
      if (wasRunning) { timer.pause(); setCta(); }
      const key = await actionSheet({
        title: 'Kurze Pause?',
        text: 'Dein Training bleibt gespeichert, du kannst später weitermachen.',
        items: [
          { key: 'stay', label: 'Weitermachen', primary: true },
          ...(active.index > 0 ? [{ key: 'finish', label: 'Hier beenden und speichern' }] : []),
          { key: 'later', label: 'Später weitermachen' },
          { key: 'discard', label: 'Training verwerfen', danger: true },
        ],
      });
      if (key === 'finish') {
        for (const it of active.plan.items.slice(active.index)) if (!active.skipped.includes(it.exerciseId)) active.skipped.push(it.exerciseId);
        active.index = active.plan.items.length;
        active.step = 'after';
        persist();
        paint();
      } else if (key === 'later') { persist(); navigate('/'); }
      else if (key === 'discard') {
        const ok = await confirmDialog({ title: 'Wirklich verwerfen?', text: 'Dieses Training wird nicht gespeichert.', confirmLabel: 'Verwerfen', danger: true });
        if (ok) { store.update((d) => { d.state.activeSession = null; }); active = null; navigate('/'); }
      }
    },
    save() {
      const isTraining = active.kind === 'training';
      const need = root.querySelector('#need');
      if (isTraining && (!active.effort || active.painAfter == null)) {
        need.hidden = false;
        need.textContent = !active.effort ? 'Sag mir noch kurz, wie anstrengend es war.' : 'Und noch kurz: Wie geht’s deinem Nacken jetzt?';
        (!active.effort ? root.querySelector('.effort') : root.querySelector('#pain-after'))?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      const now = new Date();
      const session = finishedSession(active, { effort: active.effort, painAfter: active.painAfter, now });
      if (active.rowed) session.rowWarmup = true;
      store.update((d) => {
        const next = applyTrainingResult(d, session, now);
        d.sessions = next.sessions;
        d.state = next.state;
        d.state.activeSession = null;
      });
      const id = session.id;
      active = null;
      navigate(`/summary/${encodeURIComponent(id)}`);
    },
  };

  const onClick = (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const eff = t.closest('[data-effort]');
    if (eff && active) {
      active.effort = eff.getAttribute('data-effort');
      root.querySelectorAll('[data-effort]').forEach((b) => b.setAttribute('aria-checked', String(b === eff)));
      root.querySelector('#need').hidden = true;
      persist();
      return;
    }
    const b = t.closest('[data-act]');
    if (!b || t.closest('pt-timer') || !active) return;
    const fn = actions[b.getAttribute('data-act')];
    if (fn) { e.preventDefault(); fn(); }
  };
  const onChange = (e) => {
    if (!active) return;
    const t = /** @type {HTMLElement} */ (e.target);
    if (t.matches?.('[data-rowed]')) { active.rowed = t.checked; persist(); return; }
    if (t.id === 'pain-after') {
      active.painAfter = e.detail?.value ?? null;
      const need = root.querySelector('#need');
      if (need) need.hidden = true;
      persist();
    }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);

  paint();

  return () => {
    disposed = true;
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    document.removeEventListener('visibilitychange', onVisible);
    document.body.classList.remove('has-cta');
    voiceCancel();
    wake?.release?.().catch?.(() => {});
    wake = null;
    // den aktuellen Stand sichern (z. B. nach „Später weitermachen“ oder Tab-Wechsel)
    if (active) { try { persist(); } catch (err) { console.error(err); } }
  };
}
