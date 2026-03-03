import { priceHubDb } from '@/lib/price-hub';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = priceHubDb();

    const totals = db
      .prepare(
        `SELECT
          COUNT(DISTINCT p.id) as total_items,
          COUNT(DISTINCT p.category) as total_categories,
          COUNT(DISTINCT pr.source) as total_sources,
          MAX(pr.fetched_at) as last_updated
        FROM products p
        JOIN price_records pr ON pr.product_id = p.id
        WHERE pr.price > 0 AND pr.is_stale = 0`
      )
      .get() as {
      total_items: number;
      total_categories: number;
      total_sources: number;
      last_updated: string | null;
    };

    const categoryStats = db
      .prepare(
        `SELECT
          p.category,
          COUNT(DISTINCT p.id) as count,
          CAST(ROUND(AVG(pr.price)) AS INTEGER) as avg_price,
          CAST(ROUND(MIN(pr.price)) AS INTEGER) as min_price,
          CAST(ROUND(MAX(pr.price)) AS INTEGER) as max_price
        FROM products p
        JOIN price_records pr ON pr.product_id = p.id
        WHERE pr.price > 0 AND pr.is_stale = 0
        GROUP BY p.category
        ORDER BY count DESC
        LIMIT 500`
      )
      .all() as {
      category: string;
      count: number;
      avg_price: number;
      min_price: number;
      max_price: number;
    }[];

    const sourceStatsRaw = db
      .prepare(
        `SELECT
          pr.source,
          COUNT(DISTINCT p.id) as count,
          json_group_array(DISTINCT p.category) as categories_json
        FROM products p
        JOIN price_records pr ON pr.product_id = p.id
        GROUP BY pr.source
        ORDER BY count DESC`
      )
      .all() as {
      source: string;
      count: number;
      categories_json: string;
    }[];

    const sources = sourceStatsRaw.map((row) => {
      let categories: string[] = [];
      try {
        categories = JSON.parse(row.categories_json) as string[];
      } catch {
        /* malformed json_group_array — skip */
      }
      return { source: row.source, count: row.count, categories };
    });

    const sourceTypes = db
      .prepare(
        `SELECT
          pr.source as source_type,
          COUNT(DISTINCT p.id) as count,
          1 as sources,
          COUNT(DISTINCT p.category) as categories,
          CAST(ROUND(AVG(pr.price)) AS INTEGER) as avg_price,
          MAX(pr.fetched_at) as last_sync
        FROM products p
        JOIN price_records pr ON pr.product_id = p.id
        WHERE pr.price > 0 AND pr.is_stale = 0
        GROUP BY pr.source
        ORDER BY count DESC`
      )
      .all() as {
      source_type: string;
      count: number;
      sources: number;
      categories: number;
      avg_price: number;
      last_sync: string | null;
    }[];

    const recentUpdates = db
      .prepare(
        `SELECT
          p.category,
          pr.source,
          COUNT(*) as count,
          MAX(pr.fetched_at) as updated_at
        FROM products p
        JOIN price_records pr ON pr.product_id = p.id
        GROUP BY p.category, pr.source
        ORDER BY MAX(pr.fetched_at) DESC
        LIMIT 10`
      )
      .all() as {
      category: string;
      source: string;
      count: number;
      updated_at: string | null;
    }[];

    return NextResponse.json({
      success: true,
      data: {
        totals,
        categories: categoryStats,
        sources,
        sourceTypes,
        recentUpdates
      }
    });
  } catch (error) {
    process.stderr.write(
      `[prices/summary] ${error instanceof Error ? error.message : error}\n`
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch price summary' },
      { status: 500 }
    );
  }
}
