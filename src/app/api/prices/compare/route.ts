import { priceHubDb } from '@/lib/price-hub';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/** 排除 discount_rate（折數非金額），其餘全視為有效價格 */
const PRICE_FILTER = `pr.price_type != 'discount_rate'`;
const SELL_TYPES = `('sell','selling','quotation','market_survey','awarded','spot','unit_price')`;
const LIST_TYPE = `'list'`;

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

    const comparison = db
      .prepare(
        `SELECT
          pr.source,
          COUNT(DISTINCT p.id) as item_count,
          CAST(ROUND(AVG(CASE WHEN pr.price_type IN ${SELL_TYPES} THEN pr.price END)) AS INTEGER) as avg_sell_price,
          CAST(ROUND(AVG(CASE WHEN pr.price_type = ${LIST_TYPE} THEN pr.price END)) AS INTEGER) as avg_list_price,
          ROUND(
            CASE WHEN AVG(CASE WHEN pr.price_type = ${LIST_TYPE} THEN pr.price END) > 0
              THEN COALESCE(
                AVG(CASE WHEN pr.price_type IN ${SELL_TYPES} THEN pr.price END),
                AVG(CASE WHEN pr.price_type = ${LIST_TYPE} THEN pr.price END)
              ) / AVG(CASE WHEN pr.price_type = ${LIST_TYPE} THEN pr.price END)
              ELSE NULL
            END, 3
          ) as avg_discount,
          CAST(ROUND(MIN(CASE WHEN ${PRICE_FILTER} THEN pr.price END)) AS INTEGER) as min_price,
          CAST(ROUND(MAX(CASE WHEN ${PRICE_FILTER} THEN pr.price END)) AS INTEGER) as max_price,
          0 as stddev_price
        FROM products p
        JOIN price_records pr ON pr.product_id = p.id
        WHERE p.category = ? AND pr.price > 0 AND ${PRICE_FILTER}
        GROUP BY pr.source
        ORDER BY COALESCE(avg_sell_price, avg_list_price) ASC`
      )
      .all(category) as {
      source: string;
      item_count: number;
      avg_sell_price: number | null;
      avg_list_price: number | null;
      avg_discount: number | null;
      min_price: number | null;
      max_price: number | null;
      stddev_price: number;
    }[];

    // Find overlapping specs across sources for direct comparison
    const specOverlap = db
      .prepare(
        `WITH sell AS (
          SELECT
            p.id, pr.source,
            CAST(ROUND(pr.price) AS INTEGER) as sell_price,
            json_extract(p.spec_json, '$.model') as model,
            json_extract(p.spec_json, '$.poles') as poles,
            json_extract(p.spec_json, '$.ampere') as ampere,
            json_extract(p.spec_json, '$.size') as size,
            json_extract(p.spec_json, '$.spec') as spec_value
          FROM products p
          JOIN price_records pr ON pr.product_id = p.id
          WHERE p.category = ? AND pr.price > 0 AND ${PRICE_FILTER}
        ),
        with_list AS (
          SELECT
            s.*,
            COALESCE(lp.price, 0) as list_price,
            CASE WHEN lp.price > 0 THEN ROUND(CAST(s.sell_price AS REAL) / lp.price, 3) ELSE 0 END as discount
          FROM sell s
          LEFT JOIN price_records lp
            ON lp.product_id = s.id AND lp.source = s.source AND lp.price_type = ${LIST_TYPE}
        )
        SELECT
          COALESCE(model, spec_value, size, '') as spec_label,
          COALESCE(ampere, '') as ampere,
          COALESCE(poles, '') as poles,
          json_group_array(json_object(
            'source', source,
            'sell_price', sell_price,
            'list_price', CAST(ROUND(list_price) AS INTEGER),
            'discount', discount
          )) as prices_json
        FROM with_list
        WHERE COALESCE(model, spec_value, size, '') != ''
        GROUP BY COALESCE(model, spec_value, size, ''),
                 COALESCE(ampere, ''), COALESCE(poles, '')
        HAVING COUNT(DISTINCT source) >= 2
        ORDER BY COALESCE(ampere, ''), spec_label
        LIMIT 50`
      )
      .all(category) as {
      spec_label: string;
      ampere: string;
      poles: string;
      prices_json: string;
    }[];

    return NextResponse.json({
      success: true,
      data: {
        category,
        sourceComparison: comparison.map((row) => ({
          ...row,
          avg_sell_price: row.avg_sell_price ?? 0,
          avg_list_price: row.avg_list_price ?? 0,
          avg_discount:
            row.avg_discount != null ? String(row.avg_discount) : '0',
          min_price: row.min_price ?? 0,
          max_price: row.max_price ?? 0
        })),
        specOverlap: specOverlap.map((row) => {
          let prices: {
            source: string;
            sell_price: number;
            list_price: number;
            discount: number;
          }[] = [];
          try {
            prices = JSON.parse(row.prices_json);
          } catch {
            /* malformed json_group_array — skip */
          }
          return {
            spec_label: row.spec_label,
            ampere: row.ampere,
            poles: row.poles,
            prices
          };
        })
      }
    });
  } catch (error) {
    process.stderr.write(
      `[prices/compare] ${error instanceof Error ? error.message : error}\n`
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch price comparison' },
      { status: 500 }
    );
  }
}
