import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category');

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'category parameter is required' },
        { status: 400 }
      );
    }

    // Cross-source comparison: same category, grouped by source
    const comparison = await sql`
      SELECT
        source,
        COUNT(*)::int as item_count,
        ROUND(AVG(sell_price)::numeric, 0)::int as avg_sell_price,
        ROUND(AVG(list_price)::numeric, 0)::int as avg_list_price,
        ROUND(AVG(discount)::numeric, 3) as avg_discount,
        ROUND(MIN(sell_price)::numeric, 0)::int as min_price,
        ROUND(MAX(sell_price)::numeric, 0)::int as max_price,
        ROUND(STDDEV(sell_price)::numeric, 0)::int as stddev_price
      FROM prices
      WHERE category = ${category} AND sell_price > 0
      GROUP BY source
      ORDER BY avg_sell_price ASC
    `;

    // Find overlapping specs across sources for direct comparison
    const specOverlap = await sql`
      WITH spec_items AS (
        SELECT
          id, source, sell_price, list_price, discount, specs,
          specs->>'model' as model,
          specs->>'poles' as poles,
          specs->>'ampere' as ampere,
          specs->>'size' as size,
          specs->>'spec' as spec_value
        FROM prices
        WHERE category = ${category} AND sell_price > 0
      )
      SELECT
        COALESCE(model, spec_value, size, '') as spec_label,
        COALESCE(ampere, '') as ampere,
        COALESCE(poles, '') as poles,
        json_agg(json_build_object(
          'source', source,
          'sell_price', sell_price::int,
          'list_price', list_price::int,
          'discount', discount
        ) ORDER BY source) as prices
      FROM spec_items
      WHERE COALESCE(model, spec_value, size, '') != ''
      GROUP BY COALESCE(model, spec_value, size, ''),
               COALESCE(ampere, ''), COALESCE(poles, '')
      HAVING COUNT(DISTINCT source) >= 2
      ORDER BY COALESCE(ampere, '')::text, spec_label
      LIMIT 50
    `;

    return NextResponse.json({
      success: true,
      data: {
        category,
        sourceComparison: comparison,
        specOverlap
      }
    });
  } catch (error) {
    console.error('Price compare error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch price comparison' },
      { status: 500 }
    );
  }
}
