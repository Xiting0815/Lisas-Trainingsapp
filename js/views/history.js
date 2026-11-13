// Verlauf: Level-Karte, Schmerzverlauf (vorher/nachher), Liste oder Kalender der Trainings und Mini-Pausen.
import { html, raw, dayKey, longDay, clock, MONTHS, KIND_LABEL, KIND_ICON, EFFORT, asDate } from './ui.js';
import { LEVELS, levelInfo } from '../logic/levels.js';
import { painSeries } from '../logic/week.js';
import { painChartSvg } from '../components/charts.js';

export const title = 'Verlauf';

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function entryHtml(s) {
  const eff = s.effort ? EFFORT[s.effort] : null;
  const pain = s.painBefore != null || s.painAfter != null
    ? `Nacken ${s.painBefore ?? '–'} → ${s.painAfter ?? '–'}` : '';
  const sub = s.kind === 'training' ? `${s.minutes} Min · Level ${s.level}` : `${s.minutes} Min`;
  return html`<li class="entry">
    <span class="entry__icon" aria-hidden="true">${KIND_ICON[s.kind] || '🌸'}</span>
    <div class="entry__main">
      <strong>${KIND_LABEL[s.kind] || 'Einheit'}</strong>
      <span class="muted">${clock(s.date)} Uhr · ${sub}</span>
      ${pain ? html`<span class="entry__pain">${pain}</span>` : ''}
    </div>
    ${eff ? html`<span class="entry__effort" title="${eff.label}" role="img" aria-label="${eff.label}">${eff.emoji}</span>` : ''}
  </li>`;
}

/** @param {HTMLElement} root @param {any} ctx */
export function render(root, ctx) {
  const { store } = ctx;
  let mode = 'list';
  const today = new Date();
  let cal = { y: today.getFullYear(), m: today.getMonth() };
  let selected = dayKey(today);

  const view = () => {
    const data = store.get();
    const sessions = (data.sessions || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const lvl = levelInfo(data.state?.level ?? 1);
    const level = data.state?.level ?? 1;
    const series = painSeries(data.sessions || []);
    const hasChart = series.some((p) => p.before != null && p.after != null) || series.length > 0;
    return html`
<div class="page history">
  <h1>Dein Verlauf</h1>

  <section class="card card--soft" aria-labelledby="lvl-t">
    <p class="eyebrow">Dein Level</p>
    <h2 id="lvl-t">${lvl.title}</h2>
    <p>${lvl.text}</p>
    <ol class="level-dots" aria-label="Level ${level} von ${LEVELS.length}">
      ${LEVELS.map((l) => html`<li class="${l.n <= level ? 'is-on' : ''}"></li>`)}
    </ol>
  </section>

  <section class="card" aria-labelledby="pain-t">
    <h2 id="pain-t">Dein Nacken</h2>
    ${hasChart ? html`<div class="chart-wrap">${raw(painChartSvg(series))}</div>
    <p class="legend"><span class="legend__item"><i class="legend__line before"></i>vorher</span><span class="legend__item"><i class="legend__line after"></i>nachher</span></p>
    <p class="muted">Je weiter unten, desto besser geht es deinem Nacken.</p>`
      : html`<p class="muted">Sobald du die ersten Trainings gemacht hast, siehst du hier, wie sich dein Nacken fühlt. 🌱</p>`}
  </section>

  <section aria-labelledby="list-t">
    <div class="head-row">
      <h2 id="list-t">Deine Einheiten</h2>
      <div class="seg seg--small" role="radiogroup" aria-label="Ansicht">
        <button type="button" role="radio" class="seg__btn" data-mode="list" aria-checked="${String(mode === 'list')}">Liste</button>
        <button type="button" role="radio" class="seg__btn" data-mode="cal" aria-checked="${String(mode === 'cal')}">Kalender</button>
      </div>
    </div>
    ${mode === 'list' ? listView(sessions) : calView(sessions)}
  </section>
</div>`;
  };

  const listView = (sessions) => {
    if (!sessions.length) return html`<div class="card card--soft"><p>Hier erscheinen deine Trainings und Mini-Pausen. Fang ganz entspannt an – jede kleine Runde zählt. 💗</p></div>`;
    const groups = [];
    for (const s of sessions) {
      const k = dayKey(s.date);
      let g = groups.find((x) => x.k === k);
      if (!g) groups.push(g = { k, items: [], date: s.date });
      g.items.push(s);
    }
    return html`${groups.map((g) => html`<div class="day"><h3 class="day__title">${longDay(g.date)}</h3><ul class="entries">${g.items.map(entryHtml)}</ul></div>`)}`;
  };

  const calView = (sessions) => {
    const first = new Date(cal.y, cal.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(cal.y, cal.m + 1, 0).getDate();
    const byDay = new Map();
    for (const s of sessions) {
      const k = dayKey(s.date);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(s);
    }
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(html`<span class="cal__cell is-empty"></span>`);
    for (let d = 1; d <= days; d++) {
      const k = dayKey(new Date(cal.y, cal.m, d));
      const list = byDay.get(k) || [];
      const tr = list.some((s) => s.kind === 'training');
      const mi = list.some((s) => s.kind !== 'training');
      cells.push(html`<button type="button" class="cal__cell ${k === selected ? 'is-selected' : ''} ${k === dayKey(today) ? 'is-today' : ''}" data-day="${k}" aria-label="${d}. ${MONTHS[cal.m]}${tr ? ', Training' : ''}${mi ? ', Mini-Pause' : ''}" aria-pressed="${String(k === selected)}">
        <span class="cal__num">${d}</span><span class="cal__marks" aria-hidden="true">${tr ? html`<i class="mark mark--training"></i>` : ''}${mi ? html`<i class="mark mark--mini"></i>` : ''}</span></button>`);
    }
    const sel = byDay.get(selected) || [];
    return html`<div class="card cal">
      <div class="cal__head"><button type="button" class="btn btn--icon" data-cal="-1" aria-label="Voriger Monat">‹</button>
      <strong class="cal__title">${MONTHS[cal.m]} ${cal.y}</strong>
      <button type="button" class="btn btn--icon" data-cal="1" aria-label="Nächster Monat">›</button></div>
      <div class="cal__grid" role="group" aria-label="Kalender">${DAY_NAMES.map((n) => html`<span class="cal__dow">${n}</span>`)}${cells}</div>
      <p class="legend"><span class="legend__item"><i class="mark mark--training"></i>Training</span><span class="legend__item"><i class="mark mark--mini"></i>Mini-Pause</span></p>
    </div>
    <h3 class="day__title">${longDay(asDate(selected + 'T12:00:00'))}</h3>
    ${sel.length ? html`<ul class="entries">${sel.map(entryHtml)}</ul>` : html`<p class="muted">An diesem Tag war nichts – und das ist völlig okay.</p>`}`;
  };

  const paint = () => { root.innerHTML = view().toString(); };
  const onClick = (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const m = t.closest('[data-mode]');
    if (m) { mode = m.getAttribute('data-mode'); paint(); return; }
    const c = t.closest('[data-cal]');
    if (c) {
      const d = new Date(cal.y, cal.m + Number(c.getAttribute('data-cal')), 1);
      cal = { y: d.getFullYear(), m: d.getMonth() };
      paint();
      return;
    }
    const day = t.closest('[data-day]');
    if (day) { selected = day.getAttribute('data-day'); paint(); }
  };
  paint();
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
