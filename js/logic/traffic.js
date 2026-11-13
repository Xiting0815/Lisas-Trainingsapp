// Schmerz-Ampel vor dem Training. PURE. Siehe docs/SPEC.md §4.

/** Warnzeichen, bei denen Lisa ärztlich abklären lassen sollte. */
export const WARNING_SIGNS = [
  'Schmerzen, die in den Arm ausstrahlen',
  'Kribbeln oder Taubheit in Arm oder Hand',
  'Schwindel',
  'starke Kopfschmerzen',
  'Schmerzen nach einem Sturz oder Unfall',
  'Fieber',
  'Dauerschmerzen in der Nacht',
];

export const LIGHT_INFO = {
  green: { label: 'Alles gut', hint: 'Schön, dass du da bist – los geht’s mit deinem Training.' },
  yellow: { label: 'Heute sanft', hint: 'Heute sanft – das hilft auch!' },
  red: {
    label: 'Heute nur Entspannung',
    hint: 'Wenn das mehrere Tage so bleibt oder Warnzeichen dazukommen, lass es bitte ärztlich anschauen.',
  },
};

/**
 * Ampel für einen Schmerzwert: 0–3 grün, 4–6 gelb, 7–10 rot. Ungültige Werte gelten als 0 (grün).
 * @param {number|null|undefined} pain
 * @returns {'green'|'yellow'|'red'}
 */
export function lightFor(pain) {
  const p = typeof pain === 'number' && Number.isFinite(pain) ? Math.round(pain) : 0;
  if (p >= 7) return 'red';
  if (p >= 4) return 'yellow';
  return 'green';
}
