'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { COMMODITIES, type PriceChange } from '../constants';

const PERIODS = ['1d', '1w', '1m', '3m', '1y'] as const;
const PERIOD_LABELS: Record<string, string> = {
  '1d': '日',
  '1w': '週',
  '1m': '月',
  '3m': '季',
  '1y': '年'
};

function PctCell({ pct }: { pct: number | null | undefined }) {
  if (pct == null)
    return <td className='text-muted-foreground px-3 py-2 text-center'>—</td>;
  const color =
    pct > 0
      ? 'text-red-600 dark:text-red-400'
      : pct < 0
        ? 'text-green-600 dark:text-green-400'
        : 'text-muted-foreground';
  return (
    <td className={`px-3 py-2 text-center font-mono tabular-nums ${color}`}>
      {pct > 0 ? '+' : ''}
      {pct.toFixed(2)}%
    </td>
  );
}

export function CommodityChangeTable({ changes }: { changes: PriceChange[] }) {
  return (
    <Card>
      <CardHeader className='px-4 pt-4 pb-2 sm:px-6 sm:pt-6'>
        <CardTitle className='text-base sm:text-lg'>漲跌幅一覽</CardTitle>
        <CardDescription>各商品在不同時間區間的價格變化</CardDescription>
      </CardHeader>
      <CardContent className='px-0 sm:px-2'>
        <div className='overflow-x-auto'>
          <table className='w-full text-xs sm:text-sm'>
            <thead>
              <tr className='border-b'>
                <th className='px-3 py-2 text-left font-medium'>商品</th>
                {PERIODS.map((p) => (
                  <th key={p} className='px-3 py-2 text-center font-medium'>
                    {PERIOD_LABELS[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMMODITIES.map((meta) => {
                const item = changes.find((c) => c.symbol === meta.symbol);
                return (
                  <tr key={meta.symbol} className='border-b last:border-b-0'>
                    <td className='px-3 py-2 font-medium'>
                      <span
                        className='mr-1.5 inline-block h-2 w-2 rounded-full'
                        style={{ backgroundColor: meta.color }}
                      />
                      {meta.name}
                    </td>
                    {PERIODS.map((p) => (
                      <PctCell key={p} pct={item?.changes?.[p]?.pct} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
