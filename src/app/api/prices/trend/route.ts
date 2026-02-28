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

    // Price-spec curve: price vs spec value (e.g., cable price by mm²)
    // This shows price reasonability — should follow predictable patterns
    const specCurve = await sql`
      SELECT
        source,
        sell_price::int as sell_price,
        list_price::int as list_price,
        discount,
        specs->>'spec' as spec_value,
        specs->>'size' as size,
        specs->>'ampere' as ampere,
        specs->>'model' as model,
        specs->>'poles' as poles,
        specs->>'nominalSize' as nominal_size
      FROM prices
      WHERE category = ${category} AND sell_price > 0
      ORDER BY source, sell_price ASC
    `;

    // Price distribution by source
    const distribution = await sql`
      SELECT
        source,
        CASE
          WHEN sell_price < 100 THEN '0-100'
          WHEN sell_price < 500 THEN '100-500'
          WHEN sell_price < 1000 THEN '500-1K'
          WHEN sell_price < 5000 THEN '1K-5K'
          WHEN sell_price < 10000 THEN '5K-10K'
          WHEN sell_price < 50000 THEN '10K-50K'
          ELSE '50K+'
        END as price_range,
        COUNT(*)::int as count
      FROM prices
      WHERE category = ${category} AND sell_price > 0
      GROUP BY source, price_range
      ORDER BY source, MIN(sell_price)
    `;

    // Coverage matrix: which specs exist in which sources
    const coverage = await sql`
      SELECT
        source,
        COUNT(*)::int as total,
        COUNT(DISTINCT specs->>'model')::int as unique_models,
        COUNT(DISTINCT specs->>'ampere')::int as unique_amperes,
        COUNT(DISTINCT specs->>'size')::int as unique_sizes
      FROM prices
      WHERE category = ${category}
      GROUP BY source
    `;

    return NextResponse.json({
      success: true,
      data: {
        category,
        specCurve,
        distribution,
        coverage
      }
    });
  } catch (error) {
    console.error('Price trend error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch price trends' },
      { status: 500 }
    );
  }
}
