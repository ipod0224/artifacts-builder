import { priceHubDb } from '@/lib/price-hub';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/** 排除 discount_rate（折數非金額），其餘全視為有效價格 */
const PRICE_FILTER = `pr.price_type != 'discount_rate'`;

const querySchema = z
  .string()
  .min(1, 'category is required')
  .max(100, 'category too long');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = querySchema.safeParse(searchParams.get('category'));

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing category' },
        { status: 400 }
      );
    }

    const category = parsed.data;
    const db = priceHubDb();

    // Price-spec curve: price vs spec value
    const specCurve = db
      .prepare(
        `SELECT
          pr.source,
          CAST(ROUND(pr.price) AS INTEGER) as sell_price,
          json_extract(p.spec_json, '$.spec') as spec_value,
          json_extract(p.spec_json, '$.size') as size,
          json_extract(p.spec_json, '$.ampere') as ampere,
          json_extract(p.spec_json, '$.model') as model,
          json_extract(p.spec_json, '$.nominalSize') as nominal_size
        FROM products p
        JOIN price_records pr ON pr.product_id = p.id
        WHERE p.category = ? AND pr.price > 0 AND ${PRICE_FILTER}
        ORDER BY pr.source, pr.price ASC
        LIMIT 3000`
      )
      .all(category) as {
      source: string;
      sell_price: number;
      spec_value: string | null;
      size: string | null;
      ampere: string | null;
      model: string | null;
      nominal_size: string | null;
    }[];

    // Price distribution by source
    const distribution = db
      .prepare(
        `SELECT
          pr.source,
          CASE
            WHEN pr.price < 100 THEN '0-100'
            WHEN pr.price < 500 THEN '100-500'
            WHEN pr.price < 1000 THEN '500-1K'
            WHEN pr.price < 5000 THEN '1K-5K'
            WHEN pr.price < 10000 THEN '5K-10K'
            WHEN pr.price < 50000 THEN '10K-50K'
            ELSE '50K+'
          END as price_range,
          COUNT(*) as count
        FROM products p
        JOIN price_records pr ON pr.product_id = p.id
        WHERE p.category = ? AND pr.price > 0 AND ${PRICE_FILTER}
        GROUP BY pr.source, price_range
        ORDER BY pr.source, MIN(pr.price)`
      )
      .all(category) as {
      source: string;
      price_range: string;
      count: number;
    }[];

    // Coverage matrix: which specs exist in which sources
    const coverage = db
      .prepare(
        `SELECT
          pr.source,
          COUNT(DISTINCT p.id) as total,
          COUNT(DISTINCT json_extract(p.spec_json, '$.model')) as unique_models,
          COUNT(DISTINCT json_extract(p.spec_json, '$.ampere')) as unique_amperes,
          COUNT(DISTINCT json_extract(p.spec_json, '$.size')) as unique_sizes
        FROM products p
        JOIN price_records pr ON pr.product_id = p.id
        WHERE p.category = ?
        GROUP BY pr.source`
      )
      .all(category) as {
      source: string;
      total: number;
      unique_models: number;
      unique_amperes: number;
      unique_sizes: number;
    }[];

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
    process.stderr.write(
      `[prices/trend] ${error instanceof Error ? error.message : error}\n`
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch price trends' },
      { status: 500 }
    );
  }
}
