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
  labor_cost_per_m?: number | null;
}

/** Max unknown_af rows shown before "show more" */
const UNKNOWN_AF_PREVIEW = 5;

/** Format source + brand into a single display string */
function formatSource(source: string, brand: string | null): string {
  if (!brand || brand === source) return source;
  return `${source}·${brand}`;
}

/** Category-aware label for the "unknown" section */
function getUnknownLabel(category: PriceCategory): string {
  switch (category) {
    case 'nfb':
    case 'leakagebreaker':
      return 'AF 未標示';
    case 'transformer':
      return '型式未標示';
    case 'cable':
      return '種類未標示';
    default:
      return '未標示';
  }
}

export function ProductTable({
  products,
  category
}: {
  products: ProductRow[];
  category: PriceCategory;
}) {
  const rawExact = products.filter((p) => p.match_type === 'exact');
  const rawUnknown = products.filter((p) => p.match_type === 'unknown_af');

  // If no exact products exist, promote unknown to regular display
  // (unknown section only meaningful when there's something to compare against)
  const exactProducts = rawExact.length > 0 ? rawExact : rawUnknown;
  const unknownAfProducts = rawExact.length > 0 ? rawUnknown : [];
  const minPrice = Math.min(...products.map((p) => p.sell_price));
  const showSeries =
    (category === 'nfb' || category === 'leakagebreaker') &&
    products.some((p) => p.series);
  const showLabor =
    category === 'cable' && products.some((p) => p.labor_cost_per_m != null);
  const colCount = 5 + (showSeries ? 1 : 0) + (showLabor ? 1 : 0);
  const unknownLabel = getUnknownLabel(category);

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
            {showLabor && (
              <th className='px-2 py-2 text-right font-medium'>工資/M</th>
            )}
          </tr>
        </thead>
        <tbody>
          {exactProducts.map((p, idx) => (
            <Row
              key={`e-${p.source}-${p.sell_price}-${idx}`}
              p={p}
              minPrice={minPrice}
              showSeries={showSeries}
              showLabor={showLabor}
            />
          ))}
          {unknownAfProducts.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={colCount}
                  className='text-muted-foreground border-t-2 border-dashed px-2 py-1.5 text-xs font-medium'
                >
                  {unknownLabel}（{unknownAfProducts.length} 筆）
                </td>
              </tr>
              {visibleUnknown.map((p, idx) => (
                <Row
                  key={`u-${p.source}-${p.sell_price}-${idx}`}
                  p={p}
                  minPrice={minPrice}
                  showSeries={showSeries}
                  showLabor={showLabor}
                  dimmed
                />
              ))}
              {hiddenCount > 0 && !showAllUnknown && (
                <tr>
                  <td colSpan={colCount} className='px-2 py-1.5'>
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
  showLabor = false,
  dimmed = false
}: {
  p: ProductRow;
  minPrice: number;
  showSeries: boolean;
  showLabor?: boolean;
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
      {showLabor && (
        <td className='text-muted-foreground px-2 py-2 text-right font-mono tabular-nums'>
          {p.labor_cost_per_m != null
            ? `$${p.labor_cost_per_m.toLocaleString()}`
            : ''}
        </td>
      )}
    </tr>
  );
}
