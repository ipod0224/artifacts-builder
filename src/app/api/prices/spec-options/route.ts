import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { categorySchema, SPEC_DIMENSIONS } from '@/features/prices/constants';

const MAX_FILTER_VALUE_LENGTH = 128;

/**
 * GET /api/prices/spec-options?category=nfb&series=NF-SN&poles=3P
 *
 * Returns available values per spec dimension, filtered by already-selected specs.
 * Each dimension excludes its own filter to show all available values.
 * Also returns matching products when any filter is applied.
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
          totalDimensions: 0
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

    // For each dimension, query DISTINCT values excluding that dimension's own filter
    const dimensionResults = await Promise.all(
      dimensions.map(async (dim) => {
        const { [dim.key]: _excluded, ...otherFilters } = filters;
        const otherJsonb =
          Object.keys(otherFilters).length > 0
            ? JSON.stringify(otherFilters)
            : null;

        const rows = otherJsonb
          ? await sql`
              SELECT DISTINCT specs->> ${dim.key} AS val
              FROM prices
              WHERE category = ${category}
                AND sell_price > 0
                AND specs @> ${otherJsonb}::jsonb
                AND specs->> ${dim.key} IS NOT NULL
                AND specs->> ${dim.key} != ''
              ORDER BY val
            `
          : await sql`
              SELECT DISTINCT specs->> ${dim.key} AS val
              FROM prices
              WHERE category = ${category}
                AND sell_price > 0
                AND specs->> ${dim.key} IS NOT NULL
                AND specs->> ${dim.key} != ''
              ORDER BY val
            `;

        return {
          key: dim.key,
          label: dim.label,
          values: rows.map((r) => String(r.val)),
          selected: filters[dim.key] ?? null
        };
      })
    );

    // Fetch matching products — only project needed fields (not full specs)
    const filterJsonb =
      Object.keys(filters).length > 0 ? JSON.stringify(filters) : null;

    let products: {
      source: string;
      brand: string | null;
      model: string | null;
      sell_price: number;
      list_price: number | null;
      discount: number | null;
      specs: { model?: string; spec?: string; name?: string };
    }[] = [];

    if (filterJsonb) {
      const rows = await sql`
        SELECT source, brand,
          specs->>'model' AS model,
          sell_price::int AS sell_price,
          list_price::int AS list_price,
          discount,
          json_build_object(
            'model', specs->>'model',
            'spec',  specs->>'spec',
            'name',  specs->>'name'
          ) AS specs
        FROM prices
        WHERE category = ${category}
          AND sell_price > 0
          AND specs @> ${filterJsonb}::jsonb
        ORDER BY sell_price ASC
        LIMIT 100
      `;
      products = rows as unknown as typeof products;
    }

    return NextResponse.json({
      success: true,
      data: {
        category,
        dimensions: dimensionResults,
        products,
        filterCount: Object.keys(filters).length,
        totalDimensions: dimensions.length
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[spec-options] query failed:', message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch spec options' },
      { status: 500 }
    );
  }
}
