// <pt-pain-scale value label min max green-max yellow-max> – event `change` {value}.
// Big smiley/traffic-light scale 0–10 for the neck pain (6 + 5 grid, ≥ 56 px high buttons, accessible radiogroup with
// roving tabindex and arrow keys). Colors: sanfte Ampel – 0–3 grün, 4–6 gelb, 7–10 rot (matches logic/traffic.js).
import { escape } from '../render.js';

const Base = globalThis.HTMLElement ?? class {};

/** Color class for a pain value (default thresholds = traffic light of the logic layer). */
export function painClass(v, greenMax = 3, yellowMax = 6) {
  if (v == null) return '';
  return v <= greenMax ? 'is-green' : v <= yellowMax ? 'is-yellow' : 'is-red';
}

/** German word for a pain value 0–10. */
export function painWord(v) {
  if (v == null) return '';
  if (v === 0) return 'kein Schmerz';
  if (v <= 3) return 'leicht';
  if (v <= 6) return 'mittel';
  if (v <= 8) return 'stark';
  return 'sehr stark';
}

/** Face for a pain value. */
export function painFace(v) {
  if (v == null) return '';
  if (v === 0) return '😊';
  if (v <= 3) return '🙂';
  if (v <= 6) return '😐';
  if (v <= 8) return '😣';
  return '😖';
}

let uid = 0;

export class PtPainScale extends Base {
  static get observedAttributes() { return ['value', 'label', 'min', 'max', 'green-max', 'yellow-max']; }

  get value() {
    const v = this.getAttribute('value');
    return v === null || v === '' ? null : Number(v);
  }
  set value(v) {
    if (v === null || v === undefined || v === '') this.removeAttribute('value');
    else this.setAttribute('value', String(v));
  }

  connectedCallback() {
    this._render();
    if (this._bound) return;
    this._bound = true;
    this.addEventListener('click', (e) => {
      const b = /** @type {HTMLElement} */ (e.target).closest?.('button[data-v]');
      if (!b || !this.contains(b)) return;
      this._select(Number(b.dataset.v), true);
    });
    this.addEventListener('keydown', (e) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      const { min, max } = this._range();
      let v = this.value;
      if (e.key === 'Home') v = min;
      else if (e.key === 'End') v = max;
      else {
        const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
        v = v == null ? (d > 0 ? min : max) : Math.max(min, Math.min(max, v + d));
      }
      this._select(v, true);
    });
  }

  attributeChangedCallback(name) {
    if (!this.isConnected || !this._built) return;
    if (name === 'value') this._sync();
    else this._render();
  }

  _range() {
    return {
      min: Number(this.getAttribute('min') ?? 0),
      max: Number(this.getAttribute('max') ?? 10),
      greenMax: Number(this.getAttribute('green-max') ?? 3),
      yellowMax: Number(this.getAttribute('yellow-max') ?? 6),
    };
  }

  _select(v, focus = false) {
    const changed = v !== this.value;
    this.value = v;
    this._sync();
    if (focus) /** @type {HTMLElement|null} */ (this.querySelector(`button[data-v="${v}"]`))?.focus();
    if (changed) this.dispatchEvent(new CustomEvent('change', { detail: { value: v }, bubbles: true }));
  }

  _sync() {
    const { min, greenMax, yellowMax } = this._range();
    const cur = this.value;
    for (const b of this.querySelectorAll('button[data-v]')) {
      const v = Number(/** @type {HTMLElement} */ (b).dataset.v);
      const sel = v === cur;
      b.setAttribute('aria-checked', String(sel));
      b.setAttribute('tabindex', sel || (cur == null && v === min) ? '0' : '-1');
    }
    const out = this.querySelector('.pain-scale__current');
    if (out) {
      out.textContent = cur == null ? 'bitte antippen' : `${painFace(cur)} ${cur} · ${painWord(cur)}`;
      out.className = 'pain-scale__current ' + (cur != null ? painClass(cur, greenMax, yellowMax) : '');
    }
  }

  _render() {
    const { min, max, greenMax, yellowMax } = this._range();
    const label = this.getAttribute('label') || 'Schmerz';
    const id = this._id || (this._id = `pps-${++uid}`);
    let btns = '';
    for (let v = min; v <= max; v++) {
      btns += `<button type="button" role="radio" class="pain-scale__btn ${painClass(v, greenMax, yellowMax)}" data-v="${v}" aria-checked="false" tabindex="-1" aria-label="${v} – ${escape(painWord(v))}">${v}</button>`;
    }
    this.innerHTML = `<div class="pain-scale">
  <span class="pain-scale__label" id="${id}-l">${escape(label)}</span>
  <div class="pain-scale__buttons" role="radiogroup" aria-labelledby="${id}-l">${btns}</div>
  <div class="pain-scale__anchors" aria-hidden="true"><span>${min} = kein Schmerz</span><span>${max} = sehr stark</span></div>
  <div class="pain-scale__current" aria-live="polite"></div>
</div>`;
    this._built = true;
    this._sync();
  }
}

if (globalThis.customElements && !customElements.get('pt-pain-scale')) customElements.define('pt-pain-scale', PtPainScale);
