import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { lookupCableLaborCost } from './cable-labor';

// ─── Shared types ────────────────────────────────────────────────────────────

interface SpecDimension {
  key: string;
  label: string;
}

interface ProductRow {
  id: string;
  source: string;
  brand: string | null;
  model: string | null;
  sell_price: number;
  list_price: number | null;
  discount: number | null;
  frame_af: string | null;
  ampere: string | null;
  series: string | null;
  match_type: 'exact' | 'unknown_af';
  specs: { model?: string; spec?: string; name?: string };
  labor_cost_per_m?: number | null;
}

interface Summary {
  sourceCount: number;
  totalProducts: number;
  lowestPrice: number;
  priceRange: [number, number];
}

// ─── CTE Config interface ────────────────────────────────────────────────────

export interface EnrichedConfig {
  cteSql: string;
  cteAlias: string;
  virtualCols: Record<string, string>;
  dualGroupKeys: Set<string>;
  /** SQL expression that produces the model column (must end with `AS model`) */
  modelSql: string;
  /** Virtual col name used to determine match_type; null = all 'exact' */
  matchTypeCol: string | null;
  /** Extra SELECT columns in product query (frame_af, ampere, series) */
  extraSelectCols: string;
  /** Optional post-processing for product rows (e.g., cable labor cost) */
  postProcess?: (rows: Record<string, unknown>[]) => ProductRow[];
}

// ─── Leakagebreaker CTE ─────────────────────────────────────────────────────
//
// TCRI: 「產品，漏電斷路器，額定啟斷容量AC 15KA，3P，額定電流 15A，額定靈敏度電流30mA」
// 茂忠: 「士林無熔絲開關附漏電 1P20A NVB50L 110V」
// 朝立: has poles only, no sensitivity_ma or frame_af
// 東元: has all 3 dimensions in structured specs

const LEAKAGEBREAKER_CTE = `
WITH lb_enriched AS (
  SELECT *,
    COALESCE(
      NULLIF(specs->>'poles', ''),
      (regexp_match(specs->>'name', '(\\d)P'))[1] || 'P'
    ) AS v_poles,
    COALESCE(
      NULLIF(specs->>'sensitivity_ma', ''),
      (regexp_match(specs->>'name', '靈敏度電流(\\d+)mA'))[1]
    ) AS v_sensitivity_ma,
    COALESCE(
      NULLIF(specs->>'frame_af', ''),
      CASE
        WHEN specs->>'name' ~ 'NVB(\\d+)'
          THEN (regexp_match(specs->>'name', 'NVB(\\d+)'))[1]
        WHEN specs->>'model' ~ 'NVB(\\d+)'
          THEN (regexp_match(specs->>'model', 'NVB(\\d+)'))[1]
        ELSE NULL
      END
    ) AS v_frame_af
  FROM prices
  WHERE category = 'leakagebreaker' AND sell_price > 0
)`;

const LEAKAGEBREAKER_CONFIG: EnrichedConfig = {
  cteSql: LEAKAGEBREAKER_CTE,
  cteAlias: 'lb_enriched',
  virtualCols: {
    poles: 'v_poles',
    sensitivity_ma: 'v_sensitivity_ma',
    frame_af: 'v_frame_af'
  },
  dualGroupKeys: new Set(['sensitivity_ma', 'frame_af']),
  modelSql: `
    CASE
      WHEN specs->>'model' IS NOT NULL AND specs->>'model' != ''
        THEN specs->>'model'
      WHEN specs->>'name' ~ 'NVB\\d+'
        THEN (regexp_match(specs->>'name', '(NVB\\d+\\w*)'))[1]
      WHEN v_poles IS NOT NULL
        THEN 'ELB ' || v_poles
          || COALESCE('/' || (regexp_match(specs->>'name', '額定電流 (\\d+)A'))[1] || 'A', '')
          || COALESCE('/' || v_sensitivity_ma || 'mA', '')
      ELSE LEFT(specs->>'name', 30)
    END AS model`,
  matchTypeCol: 'v_frame_af',
  extraSelectCols:
    "v_frame_af AS frame_af, specs->>'ampere' AS ampere, specs->>'series' AS series"
};

// ─── Transformer CTE ────────────────────────────────────────────────────────
//
// TCRI: 「產品，高壓模鑄式變壓器，(屋外，三相，F級，自然冷卻型)，150kVA，IP00」
// 信佳: has type='dry-H' and capacityKVA in structured specs
//
// type is NOT extracted from TCRI name (F級 ≠ H級 mismatch).
// type uses dual-group so TCRI records (type=NULL) appear alongside 信佳.

const TRANSFORMER_CTE = `
WITH tx_enriched AS (
  SELECT *,
    NULLIF(specs->>'type', '') AS v_type,
    COALESCE(
      NULLIF(specs->>'capacityKVA', ''),
      (regexp_match(specs->>'name', '(\\d+)kVA'))[1]
    ) AS v_capacityKVA
  FROM prices
  WHERE category = 'transformer' AND sell_price > 0
)`;

const TRANSFORMER_CONFIG: EnrichedConfig = {
  cteSql: TRANSFORMER_CTE,
  cteAlias: 'tx_enriched',
  virtualCols: {
    type: 'v_type',
    capacityKVA: 'v_capacityKVA'
  },
  dualGroupKeys: new Set(['type']),
  modelSql: `
    CASE
      WHEN specs->>'model' IS NOT NULL AND specs->>'model' != ''
        THEN specs->>'model'
      WHEN v_capacityKVA IS NOT NULL
        THEN COALESCE(v_type || ' ', '') || v_capacityKVA || 'kVA'
          || COALESCE(' ' || (regexp_match(specs->>'name', '(IP\\d+)'))[1], '')
      ELSE LEFT(specs->>'name', 30)
    END AS model`,
  matchTypeCol: 'v_type',
  extraSelectCols:
    'NULL::text AS frame_af, NULL::text AS ampere, NULL::text AS series'
};

// ─── Cable CTE ──────────────────────────────────────────────────────────────
//
// TCRI PVC IV: 「產品，電線及電纜，600V聚氯乙烯絕緣電線，絞線，2.0mm2」
// TCRI XLPE:   「產品，電線及電纜，600V交連聚乙烯...電纜(XLPE)，3心，5.5mm2」
// PCIC XLPE:   「產品。電線及電纜。600V交連聚乙烯...電力電纜(XLPE)。125mm2」
// PCIC FR:     「產品。電線及電纜。FR。2.0mm」
//
// Mapping: 聚氯乙烯→PVC, 交連聚乙烯/XLPE→XLPE, 耐燃/FR→FR
// Cores: 絞線/單心/單線→1, N心→N, N/C→N
// Spec: extract Nmm² and strip trailing ".0" to match canonical
// IMPORTANT: Use mm[2²] (not bare mm) to avoid confusing diameter (mm) with
// cross-section area (mm²). Solid wire uses diameter like "2.0mm" which is
// NOT the same as "2.0mm²". See JC-164 for full analysis.

const CABLE_CTE = `
WITH cable_enriched AS (
  SELECT *,
    COALESCE(
      NULLIF(specs->>'type', ''),
      NULLIF(specs->>'wire_type', ''),
      CASE
        WHEN specs->>'name' ~ '交連聚乙烯' OR specs->>'name' ~ 'XLPE' THEN 'XLPE'
        WHEN specs->>'name' ~ '聚氯乙烯絕緣電線' THEN 'PVC'
        WHEN specs->>'name' ~ '耐燃' OR specs->>'name' ~ 'FR' THEN 'FR'
        ELSE NULL
      END
    ) AS v_type,
    COALESCE(
      NULLIF(specs->>'cores', ''),
      CASE
        WHEN specs->>'name' ~ '絞線' OR specs->>'name' ~ '單心' OR specs->>'name' ~ '單線' THEN '1'
        WHEN specs->>'name' ~ '\\d心' THEN (regexp_match(specs->>'name', '(\\d)心'))[1]
        WHEN specs->>'name' ~ '\\d/C' THEN (regexp_match(specs->>'name', '(\\d)/C'))[1]
        ELSE NULL
      END
    ) AS v_cores,
    COALESCE(
      NULLIF(specs->>'spec', ''),
      regexp_replace(
        (regexp_match(specs->>'name', '(\\d+(?:\\.\\d+)?)mm[2²]'))[1],
        '\\.0$', ''
      )
    ) AS v_spec
  FROM prices
  WHERE category = 'cable' AND sell_price > 0
)`;

/** Post-process cable products: enrich with labor cost per meter */
function cablePostProcess(rows: Record<string, unknown>[]): ProductRow[] {
  return rows.map((row) => {
    const product = row as unknown as ProductRow;
    const cableType =
      typeof row.cable_type === 'string' ? row.cable_type : null;
    const cableCores =
      typeof row.cable_cores === 'string' ? row.cable_cores : null;
    const cableSpec =
      typeof row.cable_spec === 'string' ? row.cable_spec : null;

    return {
      ...product,
      labor_cost_per_m: lookupCableLaborCost(cableType, cableCores, cableSpec)
    };
  });
}

const CABLE_CONFIG: EnrichedConfig = {
  cteSql: CABLE_CTE,
  cteAlias: 'cable_enriched',
  virtualCols: {
    type: 'v_type',
    cores: 'v_cores',
    spec: 'v_spec'
  },
  dualGroupKeys: new Set([]),
  modelSql: `
    CASE
      WHEN specs->>'model' IS NOT NULL AND specs->>'model' != ''
        THEN specs->>'model'
      WHEN v_type IS NOT NULL AND v_spec IS NOT NULL
        THEN v_type || COALESCE(' ' || v_cores || 'C', '') || ' ' || v_spec || 'mm²'
      WHEN v_spec IS NOT NULL
        THEN COALESCE(v_cores || 'C ', '') || v_spec || 'mm²'
      ELSE LEFT(specs->>'name', 30)
    END AS model`,
  matchTypeCol: 'v_type',
  extraSelectCols:
    'NULL::text AS frame_af, NULL::text AS ampere, NULL::text AS series, v_type AS cable_type, v_cores AS cable_cores, v_spec AS cable_spec',
  postProcess: cablePostProcess
};

// ─── Stainless pipe CTE ──────────────────────────────────────────────────────
//
// TCRI:   「...標稱厚度Sch-10S，材質種類304，標稱管徑15mm」(JIS 標稱 mm)
// PCIC:   「...標稱厚度Sch-20S，材質種類304，標稱管徑100mm」
// 萬蕙昇: specs.size=13, specs.inchSize="1/2\"", specs.thickness=0.8
//
// Unit mismatch: TCRI 15mm (JIS 15A), 萬蕙昇 13mm → both are 1/2"
// Normalize all to inch strings for cross-source comparison.

/** JIS/CNS 標稱 mm → inch mapping (covers both TCRI and 萬蕙昇 mm values) */
const MM_TO_INCH_PIPE = `
  CASE COALESCE(
    NULLIF(specs->>'size', '')::text,
    (regexp_match(specs->>'name', '標稱管徑(\\d+)mm'))[1]
  )
    WHEN '13' THEN '1/2"' WHEN '15' THEN '1/2"'
    WHEN '20' THEN '3/4"'
    WHEN '25' THEN '1"'
    WHEN '30' THEN '1-1/4"' WHEN '32' THEN '1-1/4"'
    WHEN '40' THEN '1-1/2"'
    WHEN '50' THEN '2"'
    WHEN '60' THEN '2-1/2"' WHEN '65' THEN '2-1/2"'
    WHEN '80' THEN '3"'
    WHEN '90' THEN '3-1/2"'
    WHEN '100' THEN '4"'
    WHEN '125' THEN '5"'
    WHEN '150' THEN '6"'
    ELSE NULL
  END
`;

const STAINLESSPIPE_CTE = `
WITH ss_enriched AS (
  SELECT *,
    COALESCE(
      NULLIF(specs->>'inchSize', ''),
      ${MM_TO_INCH_PIPE}
    ) AS v_size
  FROM prices
  WHERE category = 'stainlesspipe' AND sell_price > 0
)`;

const STAINLESSPIPE_CONFIG: EnrichedConfig = {
  cteSql: STAINLESSPIPE_CTE,
  cteAlias: 'ss_enriched',
  virtualCols: { size: 'v_size' },
  dualGroupKeys: new Set(),
  modelSql: `
    CASE
      WHEN specs->>'model' IS NOT NULL AND specs->>'model' != ''
        THEN specs->>'model'
      WHEN v_size IS NOT NULL
        THEN 'SS304 ' || v_size
          || COALESCE(' ' || (regexp_match(specs->>'name', '(Sch-\\w+)'))[1], '')
          || COALESCE(' t=' || NULLIF(specs->>'thickness', '') || 'mm', '')
      ELSE LEFT(specs->>'name', 30)
    END AS model`,
  matchTypeCol: null,
  extraSelectCols:
    'NULL::text AS frame_af, NULL::text AS ampere, NULL::text AS series'
};

// ─── PVC pipe CTE ────────────────────────────────────────────────────────────
//
// TCRI:   「...聚氯乙烯塑膠硬質管，E管，(標稱16mm，厚1.8mm)，未含管配件」
//         「...聚氯乙烯塑膠硬質管，ES-1管，(標稱80mm，厚2.7mm)，未含管配件」
// PCIC:   「...硬質聚氯乙烯塑膠管。E管。(標稱35mm，厚3.1mm)。含管配件」
// 萬蕙昇: pipeType=A/B, nominalSize=1/2" (already in inches)
//
// PVC uses CNS nominal mm (not JIS): 13→3/8", 16→1/2", 28→1", 41→1-1/2", etc.
// These differ from JIS metal pipe sizes (15→1/2", 25→1", 40→1-1/2").

const PVCPIPE_CTE = `
WITH pvc_enriched AS (
  SELECT *,
    COALESCE(
      NULLIF(specs->>'pipeType', ''),
      (regexp_match(specs->>'name', '(E(?:S-1)?)管'))[1]
    ) AS v_pipeType,
    COALESCE(
      NULLIF(specs->>'nominalSize', ''),
      CASE (regexp_match(specs->>'name', '標稱(\\d+)mm'))[1]
        WHEN '13' THEN '3/8"'
        WHEN '16' THEN '1/2"'
        WHEN '20' THEN '3/4"'
        WHEN '22' THEN '3/4"'
        WHEN '28' THEN '1"'
        WHEN '35' THEN '1-1/4"'
        WHEN '41' THEN '1-1/2"'
        WHEN '52' THEN '2"'
        WHEN '65' THEN '2-1/2"'
        WHEN '70' THEN '2-1/2"'
        WHEN '80' THEN '3"'
        WHEN '100' THEN '4"'
        WHEN '125' THEN '5"'
        WHEN '150' THEN '6"'
        WHEN '200' THEN '8"'
        ELSE NULL
      END
    ) AS v_nominalSize
  FROM prices
  WHERE category = 'pvc-pipe' AND sell_price > 0
)`;

const PVCPIPE_CONFIG: EnrichedConfig = {
  cteSql: PVCPIPE_CTE,
  cteAlias: 'pvc_enriched',
  virtualCols: {
    pipeType: 'v_pipeType',
    nominalSize: 'v_nominalSize'
  },
  dualGroupKeys: new Set(['pipeType']),
  modelSql: `
    CASE
      WHEN specs->>'model' IS NOT NULL AND specs->>'model' != ''
        THEN specs->>'model'
      WHEN v_pipeType IS NOT NULL AND v_nominalSize IS NOT NULL
        THEN 'PVC ' || v_pipeType || '管 ' || v_nominalSize
          || COALESCE(' t=' || NULLIF(specs->>'thickness', '') || 'mm', '')
      ELSE LEFT(specs->>'name', 30)
    END AS model`,
  matchTypeCol: null,
  extraSelectCols:
    'NULL::text AS frame_af, NULL::text AS ampere, NULL::text AS series'
};

// ─── RSG conduit CTE ─────────────────────────────────────────────────────────
//
// TCRI:   「產品，管材，鍍鋅鋼管(GIP)，A級，標稱25mm，厚2.4mm」
//         「產品，管材，鍍鋅鋼管(GIP)，B級，標稱25mm，厚3.2mm」
// PCIC:   「產品。導線管。電線用鋼管。厚管。稱呼G22」(recategorized from emt-conduit)
// 萬蕙昇: nominalSize="1 1/2"" (space-separated), metricSize=G42
//
// RSG uses JIS nominal mm (same as stainless pipe): 15→1/2", 25→1", 40→1-1/2"
// 萬蕙昇 uses space-separated inches ("1 1/2"") → normalize to dash ("1-1/2"")

const RSGCONDUIT_CTE = `
WITH rsg_enriched AS (
  SELECT *,
    COALESCE(
      REPLACE(NULLIF(specs->>'nominalSize', ''), ' ', '-'),
      CASE (regexp_match(specs->>'name', '標稱(\\d+)mm'))[1]
        WHEN '15' THEN '1/2"'
        WHEN '20' THEN '3/4"'
        WHEN '25' THEN '1"'
        WHEN '32' THEN '1-1/4"'
        WHEN '40' THEN '1-1/2"'
        WHEN '50' THEN '2"'
        WHEN '65' THEN '2-1/2"'
        WHEN '80' THEN '3"'
        WHEN '100' THEN '4"'
        WHEN '125' THEN '5"'
        WHEN '150' THEN '6"'
        ELSE NULL
      END,
      CASE (regexp_match(specs->>'name', '稱呼G(\\d+)'))[1]
        WHEN '16' THEN '1/2"'
        WHEN '22' THEN '3/4"'
        WHEN '28' THEN '1"'
        WHEN '36' THEN '1-1/4"'
        WHEN '42' THEN '1-1/2"'
        WHEN '54' THEN '2"'
        WHEN '70' THEN '2-1/2"'
        WHEN '82' THEN '3"'
        WHEN '92' THEN '3-1/2"'
        WHEN '104' THEN '4"'
        ELSE NULL
      END
    ) AS v_nominalSize
  FROM prices
  WHERE category = 'rsg-conduit' AND sell_price > 0
)`;

const RSGCONDUIT_CONFIG: EnrichedConfig = {
  cteSql: RSGCONDUIT_CTE,
  cteAlias: 'rsg_enriched',
  virtualCols: { nominalSize: 'v_nominalSize' },
  dualGroupKeys: new Set(),
  modelSql: `
    CASE
      WHEN specs->>'model' IS NOT NULL AND specs->>'model' != ''
        THEN specs->>'model'
      WHEN v_nominalSize IS NOT NULL
        THEN 'GIP'
          || COALESCE(' ' || (regexp_match(specs->>'name', '([AB])級'))[1] || '級', '')
          || ' ' || v_nominalSize
      ELSE LEFT(specs->>'name', 30)
    END AS model`,
  matchTypeCol: null,
  extraSelectCols:
    'NULL::text AS frame_af, NULL::text AS ampere, NULL::text AS series'
};

// ─── Config registry ─────────────────────────────────────────────────────────

export const ENRICHED_CONFIGS: Record<string, EnrichedConfig> = {
  leakagebreaker: LEAKAGEBREAKER_CONFIG,
  transformer: TRANSFORMER_CONFIG,
  cable: CABLE_CONFIG,
  stainlesspipe: STAINLESSPIPE_CONFIG,
  'pvc-pipe': PVCPIPE_CONFIG,
  'rsg-conduit': RSGCONDUIT_CONFIG
};

// ─── Generic enriched handler ────────────────────────────────────────────────

function buildFilterCondition(
  key: string,
  paramIndex: number,
  config: EnrichedConfig
): string {
  const vCol = config.virtualCols[key] ?? key;
  if (config.dualGroupKeys.has(key)) {
    return `(${vCol} = $${paramIndex} OR ${vCol} IS NULL)`;
  }
  return `${vCol} = $${paramIndex}`;
}

export async function handleEnriched(
  config: EnrichedConfig,
  category: string,
  dimensions: SpecDimension[],
  filters: Record<string, string>
) {
  // 1. Dimension value queries
  const dimensionResults = await Promise.all(
    dimensions.map(async (dim) => {
      const { [dim.key]: _excluded, ...otherFilters } = filters;
      const whereParts: string[] = [];
      const params: string[] = [];

      for (const [key, val] of Object.entries(otherFilters)) {
        params.push(val);
        whereParts.push(buildFilterCondition(key, params.length, config));
      }
      const whereClause =
        whereParts.length > 0 ? `AND ${whereParts.join(' AND ')}` : '';
      const vCol = config.virtualCols[dim.key] ?? dim.key;

      const query = `
        ${config.cteSql}
        SELECT DISTINCT ${vCol} AS val
        FROM ${config.cteAlias}
        WHERE ${vCol} IS NOT NULL AND ${vCol} != ''
          ${whereClause}
        ORDER BY val
      `;
      const rows = await sql.unsafe(query, params);
      const rawValues = rows.map((r) =>
        String((r as Record<string, unknown>).val)
      );

      // Sort numerically: ∅-prefixed first, then by numeric value, then text
      const values = rawValues.sort((a, b) => {
        const aHasDia = a.startsWith('∅');
        const bHasDia = b.startsWith('∅');
        if (aHasDia !== bHasDia) return aHasDia ? -1 : 1;
        const aNum = parseFloat(a.replace(/^∅/, ''));
        const bNum = parseFloat(b.replace(/^∅/, ''));
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        if (!isNaN(aNum)) return -1;
        if (!isNaN(bNum)) return 1;
        return a.localeCompare(b);
      });

      return {
        key: dim.key,
        label: dim.label,
        values,
        selected: filters[dim.key] ?? null
      };
    })
  );

  // 2. Products (only when filters applied)
  const hasFilters = Object.keys(filters).length > 0;
  let products: ProductRow[] = [];
  let summary: Summary | null = null;

  if (hasFilters) {
    const whereParts: string[] = [];
    const params: string[] = [];

    for (const [key, val] of Object.entries(filters)) {
      params.push(val);
      whereParts.push(buildFilterCondition(key, params.length, config));
    }
    const whereClause = whereParts.join(' AND ');

    const matchTypeSql = config.matchTypeCol
      ? `CASE WHEN ${config.matchTypeCol} IS NOT NULL THEN 'exact' ELSE 'unknown_af' END AS match_type`
      : "'exact' AS match_type";

    const orderSql = config.matchTypeCol
      ? `CASE WHEN ${config.matchTypeCol} IS NOT NULL THEN 0 ELSE 1 END,`
      : '';

    const query = `
      ${config.cteSql}
      SELECT id, source, brand,
        ${config.modelSql},
        sell_price::int AS sell_price,
        list_price::int AS list_price,
        discount,
        ${matchTypeSql},
        ${config.extraSelectCols},
        json_build_object(
          'model', specs->>'model',
          'spec',  specs->>'spec',
          'name',  COALESCE(
            specs->>'name',
            NULLIF(TRIM(CONCAT_WS(' ',
              NULLIF(specs->>'wire_type', ''),
              NULLIF(specs->>'brand', ''),
              NULLIF(specs->>'conductor', ''),
              CASE WHEN specs->>'spec' IS NOT NULL
                THEN specs->>'spec' || 'mm²' END
            )), '')
          )
        ) AS specs
      FROM ${config.cteAlias}
      WHERE ${whereClause}
      ORDER BY
        ${orderSql}
        sell_price ASC
      LIMIT 200
    `;

    const rows = await sql.unsafe(query, params);
    products = config.postProcess
      ? config.postProcess(rows as unknown as Record<string, unknown>[])
      : (rows as unknown as ProductRow[]);

    if (products.length > 0) {
      const sources = new Set(products.map((p) => p.source));
      const prices = products.map((p) => p.sell_price);
      summary = {
        sourceCount: sources.size,
        totalProducts: products.length,
        lowestPrice: Math.min(...prices),
        priceRange: [Math.min(...prices), Math.max(...prices)]
      };
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      category,
      dimensions: dimensionResults,
      products,
      filterCount: Object.keys(filters).length,
      totalDimensions: dimensions.length,
      summary
    }
  });
}
