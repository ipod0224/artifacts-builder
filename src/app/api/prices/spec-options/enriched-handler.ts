import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { lookupCableLaborCost } from './cable-labor';

// ─── Shared types ────────────────────────────────────────────────────────────

interface SpecDimension {
  key: string;
  label: string;
}

interface ProductRow {
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
// Spec: extract Nmm and strip trailing ".0" to match canonical

const CABLE_CTE = `
WITH cable_enriched AS (
  SELECT *,
    COALESCE(
      NULLIF(specs->>'type', ''),
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
        (regexp_match(specs->>'name', '(\\d+(?:\\.\\d+)?)mm'))[1],
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
  dualGroupKeys: new Set(['type', 'cores']),
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

// ─── Config registry ─────────────────────────────────────────────────────────

export const ENRICHED_CONFIGS: Record<string, EnrichedConfig> = {
  leakagebreaker: LEAKAGEBREAKER_CONFIG,
  transformer: TRANSFORMER_CONFIG,
  cable: CABLE_CONFIG
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
      return {
        key: dim.key,
        label: dim.label,
        values: rows.map((r) => String((r as Record<string, unknown>).val)),
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
      SELECT source, brand,
        ${config.modelSql},
        sell_price::int AS sell_price,
        list_price::int AS list_price,
        discount,
        ${matchTypeSql},
        ${config.extraSelectCols},
        json_build_object(
          'model', specs->>'model',
          'spec',  specs->>'spec',
          'name',  specs->>'name'
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
