// Tipp des Tages. PURE.

const dayNumber = (date) => {
  const d = date instanceof Date ? date : new Date(date ?? Date.now());
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
};

/**
 * Tipp des Tages: rotiert deterministisch nach (lokalem) Kalendertag durch die Liste.
 * @param {Array<{id: string}>} tips
 * @param {Date|number|string} [date]
 * @returns {object|null}
 */
export function tipOfDay(tips, date = new Date()) {
  if (!Array.isArray(tips) || !tips.length) return null;
  const n = dayNumber(date);
  return tips[((n % tips.length) + tips.length) % tips.length];
}
