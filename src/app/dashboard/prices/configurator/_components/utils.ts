/**
 * Parse fractional inch string to numeric value for sorting.
 * e.g., '3/8"' → 0.375, '1-1/2"' → 1.5, '2"' → 2.0
 * Returns null if not a recognized inch pattern.
 */
function parseInchValue(s: string): number | null {
  const m = s.match(/^(\d+)?[-\s]?(\d+)\/(\d+)"?$/);
  if (m) {
    const whole = m[1] ? parseInt(m[1], 10) : 0;
    const num = parseInt(m[2], 10);
    const den = parseInt(m[3], 10);
    return den > 0 ? whole + num / den : null;
  }
  const mWhole = s.match(/^(\d+)"?$/);
  if (mWhole) return parseInt(mWhole[1], 10);
  return null;
}

/** Sort spec values — numeric, inch-aware, or locale string */
export function sortSpecValues(values: string[]): string[] {
  const allNumeric = values.every((v) => v.trim() !== '' && !isNaN(Number(v)));
  if (allNumeric) {
    return [...values].sort((a, b) => Number(a) - Number(b));
  }
  // Inch-aware sort: if all values parse as inches, sort by numeric size
  const inchValues = values.map((v) => parseInchValue(v));
  if (inchValues.every((v) => v !== null)) {
    return [...values].sort(
      (a, b) => (parseInchValue(a) ?? 0) - (parseInchValue(b) ?? 0)
    );
  }
  return [...values].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

/** Format ampere array for display: "[10, 15, 20]" → "10~20A" */
export function formatAmpere(raw: string | null): string {
  if (!raw) return '—';
  try {
    const arr: number[] = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return raw;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted.length === 1
      ? `${sorted[0]}A`
      : `${sorted[0]}~${sorted[sorted.length - 1]}A`;
  } catch {
    return raw;
  }
}
