import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { categorySchema, SPEC_DIMENSIONS } from '@/features/prices/constants';
import { ENRICHED_CONFIGS, handleEnriched } from './enriched-handler';

const MAX_FILTER_VALUE_LENGTH = 128;

/**
 * NFB Enriched CTE — 從自由文字 name 提取虛擬維度
 *
 * 問題背景（JC-156 §十一）：
 * - TCRI/PCIC/茂忠 共 310 筆只有 name 自由文字，無結構化 poles/frame_af
 * - 朝立 151 筆有 poles 但沒有 frame_af
 * - specs @> containment 查詢會靜默排除無 key 的記錄
 *
 * 解法：CTE 建立 v_poles / v_frame_af / v_rated_at 虛擬欄位，不改 DB schema
 *
 * rated_at 特殊處理：
 * - TCRI/PCIC: 從 name 提取 `額定電流 XXA`（每筆一個值）
 * - 茂忠: 從 name 提取 `BH-3P20A`（型號內嵌）
 * - 朝立/東元/三菱: ampere 是 JSON 陣列 `[10,15,20,30]`，一筆涵蓋多個 AT
 *   → 維度查詢用 jsonb_array_elements_text 展開
 *   → 產品篩選用 @> 陣列包含
 */
// NOTE: Do NOT use E'...' escape strings — JS template `\\d` becomes `\d`,
// then E-string eats the backslash (unrecognized escape → just 'd').
// Standard strings with standard_conforming_strings=on preserve `\d` for regex.
const NFB_CTE = `
WITH nfb_enriched AS (
  SELECT *,
    COALESCE(
      NULLIF(specs->>'poles', ''),
      (regexp_match(specs->>'name', '[，。 ](\\d)P[，。 ]'))[1] || 'P',
      (regexp_match(specs->>'name', '(\\d)P\\d+A'))[1] || 'P'
    ) AS v_poles,
    COALESCE(
      NULLIF(specs->>'frame_af', ''),
      CASE
        WHEN specs->>'name' ~ '額定啟斷容量AC (\\d+)KA' THEN
          CASE (regexp_match(specs->>'name', '額定啟斷容量AC (\\d+)KA'))[1]
            WHEN '5' THEN '50'
            WHEN '10' THEN '100'
            WHEN '15' THEN '100'
            WHEN '25' THEN '250'
            WHEN '30' THEN '250'
            WHEN '36' THEN '400'
            WHEN '50' THEN '800'
            WHEN '65' THEN '800'
            WHEN '85' THEN '1200'
            WHEN '100' THEN '1600'
            WHEN '35' THEN '400'
            WHEN '125' THEN '1600'
            WHEN '130' THEN '1600'
            ELSE NULL
          END
        WHEN specs->>'name' ~ 'BHS' THEN '250'
        WHEN specs->>'name' ~ 'BHU' THEN '100'
        WHEN specs->>'name' ~ 'BH[- ]' THEN '50'
        WHEN specs->>'model' ~ '^NF(\\d+)' THEN
          (regexp_match(specs->>'model', '^NF(\\d+)'))[1]
        ELSE NULL
      END
    ) AS v_frame_af,
    COALESCE(
      (regexp_match(specs->>'name', '額定電流 (\\d+)A'))[1],
      (regexp_match(specs->>'name', '\\dP(\\d+)A'))[1]
    ) AS v_rated_at
  FROM prices
  WHERE category = 'nfb' AND sell_price > 0
)`;

/** Virtual column mapping: SPEC_DIMENSIONS key → CTE column name */
const NFB_VIRTUAL_COLS: Record<string, string> = {
  poles: 'v_poles',
  frame_af: 'v_frame_af',
  rated_at: 'v_rated_at'
};

/** Keys that need special dual-group (include NULL rows) */
const NFB_DUAL_GROUP_KEYS = new Set(['frame_af']);

/**
 * GET /api/prices/spec-options?category=nfb&poles=3P&frame_af=100
 *
 * Returns available values per spec dimension, filtered by already-selected specs.
 * Each dimension excludes its own filter to show all available values.
 * Also returns matching products when any filter is applied.
 *
 * NFB uses enriched CTE for virtual columns; other categories use specs @> containment.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = categorySchema.safeParse(searchParams.get('category'));

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing category' },
        { status: 400 }
      );
    }

    const category = parsed.data;
    const dimensions = SPEC_DIMENSIONS[category];

    if (!dimensions || dimensions.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          category,
          dimensions: [],
          products: [],
          filterCount: 0,
          totalDimensions: 0,
          summary: null
        }
      });
    }

    // Build filter from query params (only known dimension keys, length-guarded)
    const filters: Record<string, string> = {};
    for (const dim of dimensions) {
      const val = searchParams.get(dim.key);
      if (val && val.length <= MAX_FILTER_VALUE_LENGTH) {
        filters[dim.key] = val;
      }
    }

    // Branch: NFB uses its own enriched CTE, other enriched categories
    // use generic CTE handler, rest use specs @> containment
    if (category === 'nfb') {
      return handleNfb(category, dimensions, filters);
    }

    const enrichedConfig = ENRICHED_CONFIGS[category];
    if (enrichedConfig) {
      return handleEnriched(enrichedConfig, category, dimensions, filters);
    }

    return handleGeneric(category, dimensions, filters);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[spec-options] query failed:', message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch spec options' },
      { status: 500 }
    );
  }
}

// ─── NFB handler (enriched CTE) ───────────────────────────────────────────

interface SpecDimension {
  key: string;
  label: string;
}

/** Build WHERE clause part for a single NFB filter */
function buildNfbFilterCondition(key: string, paramIndex: number): string {
  const vCol = NFB_VIRTUAL_COLS[key] ?? key;
  if (NFB_DUAL_GROUP_KEYS.has(key)) {
    return `(${vCol} = $${paramIndex} OR ${vCol} IS NULL)`;
  }
  if (key === 'rated_at') {
    // Match either CTE-extracted v_rated_at OR ampere JSON array containment
    return `(v_rated_at = $${paramIndex} OR (
      specs->'ampere' IS NOT NULL
      AND jsonb_typeof(specs->'ampere') = 'array'
      AND specs->'ampere' @> to_jsonb(ARRAY[$${paramIndex}::int])
    ))`;
  }
  return `${vCol} = $${paramIndex}`;
}

async function handleNfb(
  category: string,
  dimensions: SpecDimension[],
  filters: Record<string, string>
) {
  // 1. Query dimension values using virtual columns
  const dimensionResults = await Promise.all(
    dimensions.map(async (dim) => {
      const { [dim.key]: _excluded, ...otherFilters } = filters;

      // Build WHERE clauses for other filters
      const whereParts: string[] = [];
      const params: string[] = [];
      for (const [key, val] of Object.entries(otherFilters)) {
        params.push(val);
        whereParts.push(buildNfbFilterCondition(key, params.length));
      }
      const whereClause =
        whereParts.length > 0 ? `AND ${whereParts.join(' AND ')}` : '';

      // rated_at needs special UNION query (CTE v_rated_at + ampere JSON展開)
      if (dim.key === 'rated_at') {
        const query = `
          ${NFB_CTE}
          SELECT val FROM (
            SELECT v_rated_at AS val FROM nfb_enriched
            WHERE v_rated_at IS NOT NULL AND v_rated_at != ''
              ${whereClause}
            UNION
            SELECT e.val FROM nfb_enriched,
              jsonb_array_elements_text(specs->'ampere') AS e(val)
            WHERE specs->'ampere' IS NOT NULL
              AND jsonb_typeof(specs->'ampere') = 'array'
              AND jsonb_array_length(specs->'ampere') > 0
              AND e.val ~ '^\\d+$'
              ${whereClause}
          ) sub
          ORDER BY val::int
        `;
        const rows = await sql.unsafe(query, params);
        return {
          key: dim.key,
          label: dim.label,
          values: rows.map((r) => String((r as Record<string, unknown>).val)),
          selected: filters[dim.key] ?? null
        };
      }

      // Standard virtual column dimension query
      const vCol = NFB_VIRTUAL_COLS[dim.key] ?? dim.key;
      const query = `
        ${NFB_CTE}
        SELECT DISTINCT ${vCol} AS val
        FROM nfb_enriched
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

  // 2. Fetch products if any filter is set
  const hasFilters = Object.keys(filters).length > 0;
  let products: ProductRow[] = [];
  let summary: Summary | null = null;

  if (hasFilters) {
    const whereParts: string[] = [];
    const params: string[] = [];

    for (const [key, val] of Object.entries(filters)) {
      params.push(val);
      whereParts.push(buildNfbFilterCondition(key, params.length));
    }

    const whereClause = whereParts.join(' AND ');

    const query = `
      ${NFB_CTE}
      SELECT id, source, brand,
        CASE
          WHEN specs->>'model' IS NOT NULL AND specs->>'model' != ''
            THEN specs->>'model'
          WHEN specs->>'name' ~ '(BH[A-Z]*-\\d+P\\d+A)'
            THEN (regexp_match(specs->>'name', '(BH[A-Z]*-\\d+P\\d+A)'))[1]
          WHEN v_rated_at IS NOT NULL
            THEN 'NFB ' || v_poles || '/' || v_rated_at || 'A'
          ELSE LEFT(specs->>'name', 30)
        END AS model,
        sell_price::int AS sell_price,
        list_price::int AS list_price,
        discount,
        v_frame_af AS frame_af,
        specs->>'ampere' AS ampere,
        specs->>'series' AS series,
        CASE WHEN v_frame_af IS NOT NULL THEN 'exact' ELSE 'unknown_af' END AS match_type,
        json_build_object(
          'model', specs->>'model',
          'spec',  specs->>'spec',
          'name',  COALESCE(
            specs->>'name',
            NULLIF(TRIM(CONCAT_WS(' ',
              NULLIF(specs->>'model', ''),
              NULLIF(specs->>'brand', ''),
              CASE WHEN specs->>'spec' IS NOT NULL
                THEN specs->>'spec' || 'mm²' END
            )), '')
          ),
          'price_north', (specs->>'price_north')::numeric,
          'price_central', (specs->>'price_central')::numeric,
          'price_south', (specs->>'price_south')::numeric,
          'price_east', (specs->>'price_east')::numeric
        ) AS specs
      FROM nfb_enriched
      WHERE ${whereClause}
      ORDER BY
        CASE WHEN v_frame_af IS NOT NULL THEN 0 ELSE 1 END,
        sell_price ASC
      LIMIT 200
    `;

    const rows = await sql.unsafe(query, params);
    products = rows as unknown as ProductRow[];

    // Build summary
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

// ─── Generic handler (specs->>'key' = $val) ─────────────────────────────
//
// Uses specs->>'key' = $val instead of specs @> containment.
// The ->> operator always returns text, so it correctly handles JSON numbers
// (e.g., contactor rated_current_a stored as number 20, not string "20").
// Filter keys come from SPEC_DIMENSIONS constants (not user input), safe to interpolate.

async function handleGeneric(
  category: string,
  dimensions: SpecDimension[],
  filters: Record<string, string>
) {
  // Defense-in-depth: only allow dimension keys from SPEC_DIMENSIONS constants
  const allowedKeys = new Set(dimensions.map((d) => d.key));
  for (const key of Object.keys(filters)) {
    if (!allowedKeys.has(key)) {
      return NextResponse.json(
        { success: false, error: `Unknown filter key: ${key}` },
        { status: 400 }
      );
    }
  }

  const dimensionResults = await Promise.all(
    dimensions.map(async (dim) => {
      const { [dim.key]: _excluded, ...otherFilters } = filters;
      const filterEntries = Object.entries(otherFilters);

      // $1 = category, $2+ = filter values
      const params: string[] = [category];
      const whereParts: string[] = [];
      for (const [key, val] of filterEntries) {
        params.push(val);
        whereParts.push(`specs->>'${key}' = $${params.length}`);
      }
      const filterClause =
        whereParts.length > 0 ? `AND ${whereParts.join(' AND ')}` : '';

      const query = `
        SELECT DISTINCT specs->>'${dim.key}' AS val
        FROM prices
        WHERE category = $1
          AND sell_price > 0
          AND specs->>'${dim.key}' IS NOT NULL
          AND specs->>'${dim.key}' != ''
          ${filterClause}
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

  // Fetch matching products
  const hasFilters = Object.keys(filters).length > 0;
  let products: ProductRow[] = [];
  let summary: Summary | null = null;

  if (hasFilters) {
    const params: string[] = [category];
    const whereParts: string[] = [];
    for (const [key, val] of Object.entries(filters)) {
      params.push(val);
      whereParts.push(`specs->>'${key}' = $${params.length}`);
    }
    const filterClause = whereParts.join(' AND ');

    const query = `
      SELECT id, source, brand,
        COALESCE(specs->>'model', specs->>'name') AS model,
        sell_price::int AS sell_price,
        list_price::int AS list_price,
        discount,
        specs->>'frame_af' AS frame_af,
        specs->>'ampere' AS ampere,
        specs->>'series' AS series,
        'exact' AS match_type,
        json_build_object(
          'model', specs->>'model',
          'spec',  specs->>'spec',
          'name',  COALESCE(
            specs->>'name',
            NULLIF(TRIM(CONCAT_WS(' ',
              NULLIF(specs->>'model', ''),
              NULLIF(specs->>'brand', ''),
              CASE WHEN specs->>'spec' IS NOT NULL
                THEN specs->>'spec' || 'mm²' END
            )), '')
          ),
          'price_north', (specs->>'price_north')::numeric,
          'price_central', (specs->>'price_central')::numeric,
          'price_south', (specs->>'price_south')::numeric,
          'price_east', (specs->>'price_east')::numeric
        ) AS specs
      FROM prices
      WHERE category = $1
        AND sell_price > 0
        AND ${filterClause}
      ORDER BY sell_price ASC
      LIMIT 200
    `;
    const rows = await sql.unsafe(query, params);
    products = rows as unknown as ProductRow[];

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

// ─── Types ────────────────────────────────────────────────────────────────

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
}

interface Summary {
  sourceCount: number;
  totalProducts: number;
  lowestPrice: number;
  priceRange: [number, number];
}
