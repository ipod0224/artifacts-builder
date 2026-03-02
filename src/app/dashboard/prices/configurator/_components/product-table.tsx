'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { PriceCategory } from '@/features/prices/constants';

export interface ProductRow {
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

/** Max unknown_af rows shown before "show more" */
const UNKNOWN_AF_PREVIEW = 5;

/** Format source + brand into a single display string */
function formatSource(source: string, brand: string | null): string {
  if (!brand || brand === source) return source;
  return `${source}·${brand}`;
}

export function ProductTable({
  products,
  category
}: {
  products: ProductRow[];
  category: PriceCategory;
}) {
  const exactProducts = products.filter((p) => p.match_type === 'exact');
  const unknownAfProducts = products.filter(
    (p) => p.match_type === 'unknown_af'
  );
  const minPrice = Math.min(...products.map((p) => p.sell_price));
  const showSeries =
    (category === 'nfb' || category === 'leakagebreaker') &&
    products.some((p) => p.series);

  const [showAllUnknown, setShowAllUnknown] = useState(false);
  const visibleUnknown = showAllUnknown
    ? unknownAfProducts
    : unknownAfProducts.slice(0, UNKNOWN_AF_PREVIEW);
  const hiddenCount = unknownAfProducts.length - UNKNOWN_AF_PREVIEW;

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-xs sm:text-sm'>
        <thead>
          <tr className='border-b'>
            <th className='px-2 py-2 text-left font-medium'>通路</th>
            <th className='px-2 py-2 text-left font-medium'>型號</th>
            {showSeries && (
              <th className='px-2 py-2 text-left font-medium'>產品線</th>
            )}
            <th className='px-2 py-2 text-right font-medium'>售價</th>
            <th className='px-2 py-2 text-right font-medium'>牌價</th>
            <th className='px-2 py-2 text-right font-medium'>折數</th>
          </tr>
        </thead>
        <tbody>
          {exactProducts.map((p, idx) => (
            <Row
              key={`e-${p.source}-${p.sell_price}-${idx}`}
              p={p}
              minPrice={minPrice}
              showSeries={showSeries}
            />
          ))}
          {unknownAfProducts.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={showSeries ? 6 : 5}
                  className='text-muted-foreground border-t-2 border-dashed px-2 py-1.5 text-xs font-medium'
                >
                  AF 未標示（{unknownAfProducts.length} 筆）
                </td>
              </tr>
              {visibleUnknown.map((p, idx) => (
                <Row
                  key={`u-${p.source}-${p.sell_price}-${idx}`}
                  p={p}
                  minPrice={minPrice}
                  showSeries={showSeries}
                  dimmed
                />
              ))}
              {hiddenCount > 0 && !showAllUnknown && (
                <tr>
                  <td colSpan={showSeries ? 6 : 5} className='px-2 py-1.5'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-muted-foreground h-auto p-0 text-xs'
                      onClick={() => setShowAllUnknown(true)}
                    >
                      展開其餘 {hiddenCount} 筆 ▾
                    </Button>
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  p,
  minPrice,
  showSeries,
  dimmed = false
}: {
  p: ProductRow;
  minPrice: number;
  showSeries: boolean;
  dimmed?: boolean;
}) {
  return (
    <tr className={`border-b ${dimmed ? 'bg-muted/30' : ''}`}>
      <td className='px-2 py-2 whitespace-nowrap'>
        {formatSource(p.source, p.brand)}
      </td>
      <td className='max-w-[220px] truncate px-2 py-2 font-mono'>
        {p.model ?? '—'}
      </td>
      {showSeries && (
        <td className='text-muted-foreground px-2 py-2 font-mono'>
          {p.series ?? ''}
        </td>
      )}
      <td className='px-2 py-2 text-right'>
        <span
          className={`font-mono tabular-nums ${
            p.sell_price === minPrice
              ? 'font-bold text-green-600 dark:text-green-400'
              : ''
          }`}
        >
          ${p.sell_price.toLocaleString()}
        </span>
      </td>
      <td className='text-muted-foreground px-2 py-2 text-right font-mono tabular-nums'>
        {p.list_price ? `$${p.list_price.toLocaleString()}` : ''}
      </td>
      <td className='text-muted-foreground px-2 py-2 text-right font-mono tabular-nums'>
        {p.discount ? `${(Number(p.discount) * 100).toFixed(1)}%` : ''}
      </td>
    </tr>
  );
}
