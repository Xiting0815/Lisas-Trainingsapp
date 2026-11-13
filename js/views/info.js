// Gut zu wissen: kein Ersatz für ärztlichen Rat, Warnzeichen, so funktioniert die App.
import { html } from './ui.js';
import { WARNING_SIGNS } from '../logic/traffic.js';

export const title = 'Gut zu wissen';

/** @param {HTMLElement} root */
export function render(root) {
  root.innerHTML = html`
<div class="page info">
  <a class="back" href="#/settings">‹ Einstellungen</a>
  <h1>Gut zu wissen</h1>

  <section class="card card--soft" aria-labelledby="doc-t">
    <h2 id="doc-t">Kein Ersatz für ärztlichen Rat</h2>
    <p>Diese App begleitet dich mit sanften Übungen. Sie kann keine Diagnose stellen und ersetzt keinen Besuch bei Ärztin, Arzt oder Physiotherapie.</p>
  </section>

  <section class="card" aria-labelledby="warn-t">
    <h2 id="warn-t">Das lass bitte ärztlich anschauen</h2>
    <p>Wenn eines davon dazukommt, mach erst mal Pause mit dem Training und sprich mit einer Ärztin oder einem Arzt:</p>
    <ul class="bullets">${WARNING_SIGNS.map((w) => html`<li>${w}</li>`)}</ul>
  </section>

  <section class="card" aria-labelledby="how-t">
    <h2 id="how-t">So funktioniert die App</h2>
    <ul class="bullets">
      <li><strong>Du</strong> entscheidest, wann und wie lange: 10, 15 oder 20 Minuten.</li>
      <li><strong>Die App</strong> sucht die Übungen für dich aus und wechselt sie ab.</li>
      <li>Geht es deinem Nacken heute nicht so gut, wird das Training automatisch <strong>sanfter</strong>.</li>
      <li>Nach jedem Training sagst du, wie anstrengend es war. Daraus wird das Training behutsam <strong>etwas anspruchsvoller</strong> – oder bleibt, wie es ist.</li>
      <li>Tut dir eine Übung weh, tippe auf <strong>„Das tut weh“</strong>. Dann suche ich dir eine sanftere heraus.</li>
      <li>Alles bleibt auf deinem Handy. Die App funktioniert auch ohne Internet.</li>
    </ul>
  </section>

  <a class="btn btn--block" href="#/install">App auf dem iPhone installieren</a>
</div>`.toString();
}
