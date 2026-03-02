/** Sort spec values — strict numeric check with Number() */
export function sortSpecValues(values: string[]): string[] {
  const allNumeric = values.every((v) => v.trim() !== '' && !isNaN(Number(v)));
  if (allNumeric) {
    return [...values].sort((a, b) => Number(a) - Number(b));
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
