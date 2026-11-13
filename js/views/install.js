// App auf dem iPhone installieren: drei bebilderte Schritte (Safari → Teilen → „Zum Home-Bildschirm“).
import { html, raw, isStandalone } from './ui.js';

export const title = 'App installieren';

// Eigene Illustrationen (dekorativ, Beschreibung steht im Text). Farben kommen aus den Design-Tokens.
const PHONE = '<rect class="ill-phone" x="82" y="6" width="136" height="188" rx="24"/><rect class="ill-notch" x="128" y="12" width="44" height="7" rx="3.5"/>';

const ILL_SAFARI = `<svg class="ill" viewBox="0 0 300 200" aria-hidden="true" focusable="false">
  ${PHONE}
  <rect class="ill-bar" x="94" y="30" width="112" height="26" rx="13"/>
  <rect class="ill-ring" x="90" y="26" width="120" height="34" rx="17"/>
  <text class="ill-text" x="150" y="48" text-anchor="middle">lisas-training …</text>
  <rect class="ill-card" x="98" y="76" width="104" height="38" rx="10"/>
  <rect class="ill-card" x="98" y="122" width="48" height="38" rx="10"/><rect class="ill-card" x="154" y="122" width="48" height="38" rx="10"/>
  <circle class="ill-badge" cx="40" cy="100" r="30"/>
  <circle class="ill-badge-ring" cx="40" cy="100" r="22"/>
  <path class="ill-needle" d="M40 82l7 18-7 18-7-18z"/><path class="ill-needle-alt" d="M40 82l7 18h-14z"/>
  <text class="ill-label" x="262" y="104" text-anchor="middle">Safari</text>
</svg>`;

const ILL_SHARE = `<svg class="ill" viewBox="0 0 300 200" aria-hidden="true" focusable="false">
  ${PHONE}
  <rect class="ill-card" x="98" y="34" width="104" height="40" rx="10"/><rect class="ill-card" x="98" y="82" width="104" height="40" rx="10"/>
  <rect class="ill-toolbar" x="86" y="150" width="128" height="40" rx="14"/>
  <path class="ill-ico" d="M104 170l-7 0M100 166l-4 4 4 4"/>
  <path class="ill-ico" d="M124 166l4 4-4 4"/>
  <g class="ill-share"><path class="ill-ico-strong" d="M150 168v-12M145 160l5-5 5 5"/><path class="ill-ico-strong" d="M144 164h-3v12h18v-12h-3"/></g>
  <path class="ill-ico" d="M176 164h12v12h-12zM180 164v-3h12v12h-4"/>
  <circle class="ill-ring" cx="150" cy="168" r="19"/>
  <path class="ill-arrow" d="M150 128v14M144 136l6 8 6-8"/>
</svg>`;

const ILL_HOME = `<svg class="ill" viewBox="0 0 300 200" aria-hidden="true" focusable="false">
  ${PHONE}
  <rect class="ill-sheet" x="88" y="52" width="124" height="138" rx="16"/>
  <rect class="ill-bar" x="132" y="58" width="36" height="5" rx="2.5"/>
  <rect class="ill-row" x="98" y="72" width="104" height="24" rx="8"/><text class="ill-text" x="108" y="89">Kopieren</text>
  <rect class="ill-row" x="98" y="100" width="104" height="24" rx="8"/><text class="ill-text" x="108" y="117">Lesezeichen</text>
  <rect class="ill-row is-hl" x="98" y="128" width="104" height="28" rx="8"/>
  <rect class="ill-plus" x="104" y="133" width="18" height="18" rx="4"/><path class="ill-plus-mark" d="M113 137v10M108 142h10"/>
  <text class="ill-text is-hl" x="128" y="147">Zum Home-Bildschirm</text>
  <rect class="ill-ring" x="94" y="124" width="112" height="36" rx="12"/>
  <rect class="ill-row" x="98" y="162" width="104" height="22" rx="8"/><text class="ill-text" x="108" y="177">Suchen</text>
</svg>`;

const STEPS = [
  { n: 1, ill: ILL_SAFARI, title: 'Öffne die App-Adresse in Safari', text: 'Wichtig: Es muss Safari sein (das blaue Kompass-Symbol). In Chrome oder anderen Apps geht es leider nicht.' },
  { n: 2, ill: ILL_SHARE, title: 'Tippe unten auf das Teilen-Symbol', text: 'Das ist das Quadrat mit dem Pfeil nach oben, in der Mitte der unteren Leiste.' },
  { n: 3, ill: ILL_HOME, title: 'Wähle „Zum Home-Bildschirm“', text: 'Scrolle in der Liste ein Stück nach unten, falls du es nicht gleich siehst. Tippe dann oben rechts auf „Hinzufügen“.' },
];

/** @param {HTMLElement} root */
export function render(root) {
  const installed = isStandalone();
  root.innerHTML = html`
<div class="page install">
  <a class="back" href="#/settings">‹ Einstellungen</a>
  <h1>App auf dem iPhone installieren</h1>
  <p class="lead">So liegt die App wie jede andere auf deinem Home-Bildschirm – und läuft auch ohne Internet.</p>
  ${installed ? html`<p class="hint hint--ok">Super, du nutzt die App schon als installierte App. 💗</p>` : ''}
  <ol class="istep-list">
    ${STEPS.map((s) => html`<li class="card istep">
      <div class="istep__head"><span class="istep__num" aria-hidden="true">${s.n}</span><h2>${s.title}</h2></div>
      <div class="istep__ill">${raw(s.ill)}</div>
      <p>${s.text}</p>
    </li>`)}
  </ol>
  <section class="card card--soft">
    <h2>Fertig! 🎉</h2>
    <p>Ab jetzt startest du die App mit einem Tipp auf das Symbol „Lisas Training“ auf deinem Home-Bildschirm.</p>
  </section>
  <a class="btn btn--block" href="#/">Zurück zur Startseite</a>
</div>`.toString();
}
