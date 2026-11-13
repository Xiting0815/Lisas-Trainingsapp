// WCAG AA contrast of the design tokens (light, dark via media query and dark via data-theme).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');

/** Parse `--name: #hex;` declarations of the block that starts at `startIdx` (up to the matching brace). */
function declsAt(startIdx) {
  const open = css.indexOf('{', startIdx);
  let depth = 0, end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const block = css.slice(open + 1, end);
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

const light = declsAt(css.indexOf(':root {'));
const dark = declsAt(css.indexOf(':root[data-theme="dark"]'));
const darkMedia = declsAt(css.indexOf(':root:not([data-theme="light"])'));

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground, background, minimum ratio]
const PAIRS = [
  ['text', 'bg', 4.5], ['text', 'surface', 4.5], ['text', 'surface-2', 4.5], ['text', 'surface-3', 4.5],
  ['muted', 'bg', 4.5], ['muted', 'surface', 4.5], ['muted', 'surface-2', 4.5],
  ['on-primary', 'primary', 4.5], ['on-primary', 'primary-hover', 4.5],
  ['primary', 'bg', 4.5], ['primary', 'surface', 4.5], ['primary', 'surface-2', 4.5],
  ['on-primary-soft', 'primary-soft', 4.5],
  ['on-green-soft', 'green-soft', 4.5], ['on-yellow-soft', 'yellow-soft', 4.5], ['on-red-soft', 'red-soft', 4.5],
  ['green', 'surface', 3], ['yellow', 'surface', 3], ['red', 'surface', 3],
  ['on-gold', 'gold', 4.5], ['on-calm', 'calm', 4.5],
  ['chart-before', 'surface', 3], ['chart-after', 'surface', 3],
  ['accent', 'surface', 3],
];

for (const [name, tokens] of [['hell', light], ['dunkel (data-theme)', { ...light, ...dark }], ['dunkel (prefers-color-scheme)', { ...light, ...darkMedia }]]) {
  test(`Kontrast AA – ${name}`, () => {
    for (const [fg, bg, min] of PAIRS) {
      assert.ok(tokens[fg] && tokens[bg], `Token fehlt: ${fg} / ${bg}`);
      const r = ratio(tokens[fg], tokens[bg]);
      assert.ok(r >= min, `${name}: ${fg} (${tokens[fg]}) auf ${bg} (${tokens[bg]}) = ${r.toFixed(2)} < ${min}`);
    }
  });
}

test('Dunkel-Varianten (Media-Query und data-theme) sind identisch', () => {
  assert.deepEqual(Object.keys(darkMedia).sort(), Object.keys(dark).sort());
  for (const k of Object.keys(dark)) {
    if (['shadow-1', 'shadow-2'].includes(k)) continue;
    assert.equal(darkMedia[k], dark[k], `Dark-Token ${k} weicht ab`);
  }
});
