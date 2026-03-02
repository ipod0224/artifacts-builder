/**
 * Cable labor cost lookup from work-rates.json
 *
 * @source ~/tmw/data/work-rates.json (TCRI 171期)
 * @lastSynced 2026-03-02
 *
 * Daily wage basis: L000005901002 室內配線技術工 $3,500/工
 *
 * XLPE: rate varies by spec (mm²) × cores (1C~4C)
 * PVC:  rate varies by spec only (conduit method as default)
 * FR:   no data available → null
 */

const DAILY_WAGE = 3500;

/** XLPE 穿線工率 (工/M) — keyed by spec (mm²) then cores ("1C"~"4C") */
const XLPE_RATES: Record<string, Record<string, number>> = {
  '2.0': { '1C': 0.0023, '2C': 0.0035, '3C': 0.004, '4C': 0.0046 },
  '3.5': { '1C': 0.0035, '2C': 0.004, '3C': 0.0046, '4C': 0.0052 },
  '5.5': { '1C': 0.004, '2C': 0.0053, '3C': 0.0066, '4C': 0.0066 },
  '8': { '1C': 0.0053, '2C': 0.0066, '3C': 0.0066, '4C': 0.0079 },
  '14': { '1C': 0.0079, '2C': 0.0079, '3C': 0.0093, '4C': 0.0106 },
  '22': { '1C': 0.0106, '2C': 0.0119, '3C': 0.0132, '4C': 0.0132 },
  '30': { '1C': 0.0159, '2C': 0.0159, '3C': 0.0172, '4C': 0.0198 },
  // NOTE: 38mm²/2C=0.0159 低於 1C=0.0198，原始 Excel 如此，保留待確認
  '38': { '1C': 0.0198, '2C': 0.0159, '3C': 0.0251, '4C': 0.0291 },
  '50': { '1C': 0.0265, '2C': 0.0291, '3C': 0.0331, '4C': 0.0357 },
  '60': { '1C': 0.0344, '2C': 0.037, '3C': 0.0463, '4C': 0.0503 },
  '80': { '1C': 0.0397, '2C': 0.0463, '3C': 0.0555, '4C': 0.0595 },
  '100': { '1C': 0.0463, '2C': 0.0529, '3C': 0.0608, '4C': 0.0661 },
  '125': { '1C': 0.0555, '2C': 0.0661, '3C': 0.0767, '4C': 0.082 },
  // NOTE: 150mm²/1C=0.1124 疑似偏高（125→0.0555, 200→0.0688 非單調），保留待確認
  '150': { '1C': 0.1124, '2C': 0.0794, '3C': 0.0899, '4C': 0.1058 },
  '200': { '1C': 0.0688, '2C': 0.0926, '3C': 0.1124, '4C': 0.1521 },
  '250': { '1C': 0.0899, '2C': 0.1084, '3C': 0.1389, '4C': 0.1785 },
  '325': { '1C': 0.1058, '2C': 0.1256, '3C': 0.1561, '4C': 0.1984 }
};

/** PVC 穿線工率 (工/M) — conduit method, keyed by spec (mm²) */
const PVC_CONDUIT_RATES: Record<string, number> = {
  '2.0': 0.002,
  '3.5': 0.002,
  '5.5': 0.002,
  '8': 0.003,
  '14': 0.005,
  '22': 0.007,
  '30': 0.009,
  '38': 0.013,
  '50': 0.015,
  '60': 0.017,
  '80': 0.018,
  '100': 0.023,
  '125': 0.026,
  '150': 0.03,
  '200': 0.035,
  '250': 0.046,
  '325': 0.058
};

/**
 * Look up cable labor cost per meter (TWD/M).
 *
 * CTE extracts: v_type (XLPE/PVC/FR/null), v_cores ("1"~"4"/null), v_spec ("5.5"/null)
 * Returns: labor cost = rate × 3500, or null if no matching rate.
 */
export function lookupCableLaborCost(
  type: string | null,
  cores: string | null,
  spec: string | null
): number | null {
  if (!type || !spec) return null;

  if (type === 'XLPE' && cores) {
    const coreKey = `${cores}C`;
    const specRates = XLPE_RATES[spec] ?? XLPE_RATES[`${spec}.0`];
    const rate = specRates?.[coreKey];
    return rate != null ? Math.round(rate * DAILY_WAGE * 10) / 10 : null;
  }

  if (type === 'PVC') {
    const rate = PVC_CONDUIT_RATES[spec] ?? PVC_CONDUIT_RATES[`${spec}.0`];
    return rate != null ? Math.round(rate * DAILY_WAGE * 10) / 10 : null;
  }

  return null;
}
