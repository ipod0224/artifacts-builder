'use client';

import { Card, CardContent } from '@/components/ui/card';
import { COMMODITIES, type LatestPrice, type PriceChange } from '../constants';

function formatPrice(price: number, unit: string): string {
  if (unit === '指數') return price.toFixed(1);
  if (price >= 100)
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${price.toFixed(3)}`;
}

export function CommodityKpiCards({
  latest,
  changes
}: {
  latest: LatestPrice[];
  changes: PriceChange[];
}) {
  return (
    <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
      {COMMODITIES.map((meta) => {
        const price = latest.find((p) => p.symbol === meta.symbol);
        const change = changes.find((c) => c.symbol === meta.symbol);
        const dayChange = change?.changes?.['1d'];

        return (
          <Card key={meta.symbol} className='overflow-hidden'>
            <CardContent className='px-3 py-2.5'>
              {/* Row 1: 商品名 + 漲跌% */}
              <div className='flex items-center justify-between gap-1'>
                <span
                  className='truncate text-sm font-semibold'
                  style={{ color: meta.color }}
                >
                  {meta.name}
                </span>
                {dayChange && (
                  <span
                    className={`shrink-0 text-[13px] font-bold tabular-nums ${
                      dayChange.pct > 0
                        ? 'text-red-600 dark:text-red-400'
                        : dayChange.pct < 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {dayChange.pct > 0 ? '+' : ''}
                    {dayChange.pct.toFixed(2)}%
                  </span>
                )}
              </div>

              {/* Row 2: 大數字 */}
              <div className='mt-0.5 text-xl leading-tight font-bold text-slate-900 tabular-nums sm:text-2xl dark:text-slate-50'>
                {price ? formatPrice(price.close, meta.unit) : '—'}
              </div>

              {/* Row 3: 單位 + 日期 */}
              <div className='mt-0.5 text-[13px] text-slate-600 dark:text-slate-300'>
                {meta.unit}
                {price && (
                  <span className='ml-1 text-slate-500 dark:text-slate-400'>
                    | {price.date}
                  </span>
                )}
              </div>

              {/* Row 4: 影響範圍 */}
              <div className='mt-1 border-t border-slate-200 pt-1 text-[13px] leading-snug text-slate-600 dark:border-slate-700 dark:text-slate-400'>
                {meta.impact}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
