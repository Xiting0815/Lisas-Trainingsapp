// Nach dem Training: kleine Feier, liebevoller Spruch, Level-Hinweis, Schmerz vorher/nachher.
import { html, KIND_LABEL, pickStable, minutesText } from './ui.js';
import { levelInfo } from '../logic/levels.js';
import { confetti } from '../components/celebrate.js';

export const title = 'Geschafft';

const CHANGE_TEXT = {
  up: 'Du bist ein Level aufgestiegen – dein Körper hat es sich verdient. 🎉',
  down: 'Nächstes Mal gehen wir es etwas sanfter an – so passt es besser zu dir.',
  'pause-down': 'Nach der Pause starten wir mit einem Level weniger – ganz in Ruhe.',
  hold: 'Du bleibst auf deinem Level, bis es sich ganz leicht anfühlt.',
};

/** @param {HTMLElement} root @param {any} ctx */
export function render(root, ctx) {
  const { store, content, params } = ctx;
  const data = store.get();
  const s = (data.sessions || []).find((x) => x.id === params.id);
  if (!s) {
    root.innerHTML = html`<div class="page"><div class="card"><h2>Hier gibt es nichts zu sehen</h2><p>Dieses Training habe ich nicht gefunden.</p><a class="btn btn--primary" href="#/">Zur Startseite</a></div></div>`.toString();
    return undefined;
  }
  const quote = pickStable(content.quotes, s.id) || 'Dein Nacken sagt danke.';
  const done = (s.exerciseIds?.length || 0) - (s.skipped?.length || 0);
  const lv = levelInfo(data.state?.level ?? s.level ?? 1);
  const better = s.painBefore != null && s.painAfter != null && s.painAfter < s.painBefore;
  const mini = s.kind !== 'training';
  root.innerHTML = html`
<div class="page summary">
  <header class="hero hero--center">
    <div class="bloom" aria-hidden="true">💗</div>
    <h1>${mini ? 'Schön war’s!' : 'Das hast du toll gemacht!'}</h1>
    <p class="quote">„${quote}“</p>
  </header>
  <section class="card" aria-label="Zusammenfassung">
    <dl class="facts">
      <div><dt>${KIND_LABEL[s.kind] || 'Einheit'}</dt><dd>${done} ${done === 1 ? 'Übung' : 'Übungen'}</dd></div>
      <div><dt>Zeit</dt><dd>${minutesText(Math.max(60, s.durationSec || 0))}</dd></div>
      ${s.painBefore != null && s.painAfter != null ? html`<div><dt>Dein Nacken</dt><dd>${s.painBefore} → ${s.painAfter} ${better ? '💗' : ''}</dd></div>` : ''}
    </dl>
    ${better ? html`<p class="muted">Dein Nacken fühlt sich besser an als vorher – das ist genau der Sinn. 🌷</p>` : ''}
  </section>
  ${!mini ? html`<section class="card card--soft" aria-labelledby="lv-t">
    <h2 id="lv-t">${lv.title}</h2>
    <p>${lv.text}</p>
    ${CHANGE_TEXT[s.levelChange] ? html`<p><strong>${CHANGE_TEXT[s.levelChange]}</strong></p>` : ''}
  </section>` : ''}
  <div class="btn-row btn-row--stack">
    <a class="btn btn--primary btn--xl" href="#/">Zur Startseite</a>
    <a class="btn" href="#/history">Meinen Verlauf ansehen</a>
  </div>
</div>`.toString();
  try {
    if (sessionStorage.getItem('lisa.celebrated') !== s.id) {
      sessionStorage.setItem('lisa.celebrated', s.id);
      confetti();
    }
  } catch { confetti(); }
  return undefined;
}
