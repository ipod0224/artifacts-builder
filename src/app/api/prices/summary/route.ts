import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [categoryStats, sourceStats, totals, recentUpdates] =
      await Promise.all([
        sql`
        SELECT category, COUNT(*)::int as count,
          ROUND(AVG(sell_price)::numeric, 0)::int as avg_price,
          ROUND(MIN(sell_price)::numeric, 0)::int as min_price,
          ROUND(MAX(sell_price)::numeric, 0)::int as max_price
        FROM prices
        WHERE sell_price > 0
        GROUP BY category
        ORDER BY count DESC
      `,
        sql`
        SELECT source, COUNT(*)::int as count,
          array_agg(DISTINCT category) as categories
        FROM prices
        GROUP BY source
        ORDER BY count DESC
      `,
        sql`
        SELECT
          COUNT(*)::int as total_items,
          COUNT(DISTINCT category)::int as total_categories,
          COUNT(DISTINCT source)::int as total_sources,
          MAX(updated_at) as last_updated
        FROM prices
      `,
        sql`
        SELECT category, source, COUNT(*)::int as count, MAX(updated_at) as updated_at
        FROM prices
        GROUP BY category, source
        ORDER BY MAX(updated_at) DESC
        LIMIT 10
      `
      ]);

    return NextResponse.json({
      success: true,
      data: {
        totals: totals[0],
        categories: categoryStats,
        sources: sourceStats,
        recentUpdates
      }
    });
  } catch (error) {
    console.error('Price summary error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch price summary' },
      { status: 500 }
    );
  }
}
