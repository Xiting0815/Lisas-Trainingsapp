// Laien-Texte einer Übung (short / setup / steps / feel / gear). PURE – kein DOM, kein Speicher.

/** Einzeiler: wofür ist die Übung gut? */
export const shortFor = (ex) => ex?.short || ex?.description || '';

/** 3–4 kurze Handlungsschritte. */
export function stepsFor(ex) {
  if (Array.isArray(ex?.steps) && ex.steps.length) return [...ex.steps];
  return (ex?.instructions || []).slice(0, 4);
}

/** „Du spürst …“ oder ''. */
export const feelFor = (ex) => ex?.feel || '';

/** Was gebraucht wird (z. B. „Therabänder, Tür“) oder ''. */
export const gearFor = (ex) => ex?.gear || '';

/** Sicherheitshinweis (z. B. Massagestab) oder ''. */
export const warnFor = (ex) => ex?.warn || '';

/** Ausgangsposition als Liste (Aufbau-Text der Übung). */
export const setupFor = (ex) => (ex?.setup ? [ex.setup] : []);

/** Erster Satz der Ausgangsposition (Hinweis in der Vorbereitungsphase). */
export function setupHeadline(ex) {
  const s = String(ex?.setup || '').trim();
  if (!s) return '';
  const m = s.match(/^.+?(?<!\b(?:ca|z|B|ggf|bzw))[.!?](?=\s+[A-ZÄÖÜ„]|$)/);
  return (m ? m[0] : s).trim();
}
