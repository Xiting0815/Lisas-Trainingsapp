// Test-Helfer: liest data/*.json von der Platte und baut das Content-Objekt wie js/content.js im Browser.
import { readFileSync, existsSync } from 'node:fs';
import { buildContent, _setContent } from '../../js/content.js';

const dataPath = (name) => new URL(`../../data/${name}.json`, import.meta.url);
const readJson = (name, optional = false) => {
  const url = dataPath(name);
  if (optional && !existsSync(url)) return null;
  return JSON.parse(readFileSync(url, 'utf8'));
};

/** Rohe JSON-Dateien (ohne Aufbereitung). */
export function readRawFromDisk() {
  return {
    exercises: readJson('exercises'),
    routines: readJson('routines'),
    tips: readJson('tips'),
    quotes: readJson('quotes'),
    poses: readJson('poses'),
    figureOverrides: readJson('figure-overrides', true),
  };
}

/** @returns {import('../../js/types.js').Content} */
export function readContentFromDisk({ install = false } = {}) {
  const c = buildContent(readRawFromDisk());
  if (install) _setContent(c);
  return c;
}
